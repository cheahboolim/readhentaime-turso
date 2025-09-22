import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

// escape single quotes for SQL literals
const esc = (v: string) => v.replace(/'/g, "''")
const safeNum = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

// small in-memory caches for expensive aggregates (process lifetime)
let cachedMinMax: { minRowid: number; maxRowid: number; ts: number } | null = null
let cachedTotal: { total: number; ts: number } | null = null
const CACHE_TTL = 60 * 1000 // 1 minute

export const load: PageServerLoad = async ({ url, setHeaders }) => {
    // Set 30-minute edge cache header
    if (setHeaders) {
        setHeaders({
            'Cache-Control': 'public, max-age=1800, stale-while-revalidate=120, immutable'
        })
    } else if (typeof globalThis.setHeaders === 'function') {
        globalThis.setHeaders({
            'Cache-Control': 'public, max-age=1800, stale-while-revalidate=120, immutable'
        })
    }
    const PAGE_SIZE = 20
    const WINDOW_MULT = 4 // fetch a small window and sample from it to avoid many DB calls

    const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10)
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const refresh = url.searchParams.get('refresh') === 'true'
    const seedParam = url.searchParams.get('seed')
    const seed = refresh || !seedParam ? Math.floor(Math.random() * 1_000_000) : parseInt(seedParam, 10) || Math.floor(Math.random() * 1_000_000)
    const offset = (page - 1) * PAGE_SIZE

    // total count (cached)
    let total = 0
    try {
        const now = Date.now()
        if (!cachedTotal || now - cachedTotal.ts > CACHE_TTL) {
            const countRes = await db.execute('SELECT COUNT(*) AS count FROM manga;')
            total = safeNum(countRes.rows?.[0]?.count)
            cachedTotal = { total, ts: now }
        } else {
            total = cachedTotal.total
        }
    } catch (err) {
        console.error('Turso count error', err)
        total = 0
    }

    // Try to sample deterministically by rowid to avoid ORDER BY RANDOM and many single-row queries
    let mangaRows: { id: number | string; title: string; feature_image_url: string | null }[] = []
    try {
        const now = Date.now()
        if (!cachedMinMax || now - cachedMinMax.ts > CACHE_TTL) {
            const mm = await db.execute('SELECT MIN(rowid) AS minRowid, MAX(rowid) AS maxRowid FROM manga;')
            const minRowid = safeNum(mm.rows?.[0]?.minRowid)
            const maxRowid = safeNum(mm.rows?.[0]?.maxRowid)
            cachedMinMax = { minRowid, maxRowid, ts: now }
        }

        const minRowid = cachedMinMax?.minRowid ?? 0
        const maxRowid = cachedMinMax?.maxRowid ?? 0

        if (minRowid > 0 && maxRowid >= minRowid) {
            const range = maxRowid - minRowid + 1
            // compute a deterministic start index within range
            const seedOffset = seed % Math.max(range, 1)
            const startIndex = (seedOffset + offset) % Math.max(range, 1)
            const startRowidGuess = minRowid + startIndex

            // fetch a small window (WINDOW_MULT * PAGE_SIZE) starting at guess to limit DB calls
            const windowSize = Math.max(PAGE_SIZE, PAGE_SIZE * WINDOW_MULT)
            const qWindow = `
                SELECT id, title, feature_image_url
                FROM manga
                WHERE rowid >= ${startRowidGuess}
                ORDER BY rowid ASC
                LIMIT ${windowSize};
            `
            const wRes = await db.execute(qWindow)
            const windowRows = (wRes.rows ?? []) as typeof mangaRows

            // if window has enough rows, pick PAGE_SIZE items using deterministic shuffle derived from seed
            if ((windowRows?.length ?? 0) >= PAGE_SIZE) {
                // deterministic pseudorandom shuffle using seed
                const seeded = windowRows.map((r, i) => ({ r, k: (Math.imul(i + 0x9e3779b1, seed + 0x7ffff) >>> 0) / 0xffffffff }))
                seeded.sort((a, b) => a.k - b.k)
                mangaRows = seeded.slice(0, PAGE_SIZE).map((s) => s.r)
            } else {
                // not enough rows at the tail -> fetch remainder from start of table to wrap
                const firstPart = windowRows ?? []
                if (firstPart.length < PAGE_SIZE) {
                    const needed = PAGE_SIZE - firstPart.length
                    const qWrap = `
                        SELECT id, title, feature_image_url
                        FROM manga
                        WHERE rowid < ${startRowidGuess}
                        ORDER BY rowid ASC
                        LIMIT ${needed};
                    `
                    const w2 = await db.execute(qWrap)
                    const wrapRows = (w2.rows ?? []) as typeof mangaRows
                    mangaRows = firstPart.concat(wrapRows).slice(0, PAGE_SIZE)
                } else {
                    mangaRows = firstPart.slice(0, PAGE_SIZE)
                }
            }
        } else {
            mangaRows = []
        }
    } catch (err) {
        console.error('Turso sampling error', err)
        mangaRows = []
    }

    // fallback: if sampling produced nothing, pick a small recent window and shuffle (cheap)
    if (!mangaRows || mangaRows.length === 0) {
        try {
            const fallbackSize = PAGE_SIZE * WINDOW_MULT
            const res = await db.execute(`SELECT id, title, feature_image_url FROM manga ORDER BY rowid DESC LIMIT ${fallbackSize};`)
            const rows = (res.rows ?? []) as typeof mangaRows
            // shuffle and slice
            for (let i = rows.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[rows[i], rows[j]] = [rows[j], rows[i]]
            }
            mangaRows = rows.slice(0, PAGE_SIZE)
        } catch (err) {
            console.error('Turso fallback error', err)
            mangaRows = []
        }
    }

    // If still nothing, return graceful empty
    if (!mangaRows || mangaRows.length === 0) {
        return {
            comics: [],
            total,
            page,
            seed,
            meta: {
                title: 'Random Hentai | Read Hentai',
                description: 'Discover random Hentai and doujinshi on Read Hentai.',
                prev: null,
                next: null
            }
        }
    }

    // Batch fetch slugs for the selected ids (single query)
    const mangaIds = mangaRows.map((m) => m.id).filter(Boolean)
    let slugs: { slug: string; manga_id: number | string }[] = []
    if (mangaIds.length > 0) {
        try {
            const idsList = mangaIds.map((id) => (typeof id === 'number' ? String(id) : `'${esc(String(id))}'`)).join(',')
            const slugQ = `SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`
            const sres = await db.execute(slugQ)
            slugs = (sres.rows ?? []) as typeof slugs
        } catch (err) {
            console.error('Turso slug query error', err)
            slugs = []
        }
    }

    const comics = mangaRows.map((m) => ({
        id: m.id,
        title: m.title,
        slug: (slugs.find((s) => String(s.manga_id) === String(m.id))?.slug) ?? '',
        featureImage: m.feature_image_url ?? null,
        author: { name: 'Unknown' }
    }))

    const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
    const isFirstPage = page === 1

    return {
        comics,
        total,
        page,
        seed,
        meta: {
            title: isFirstPage ? 'Random Hentai | Discover New Comics | Read Hentai' : `Random Hentai | Page ${page} | Read Hentai`,
            description: isFirstPage
                ? 'Discover random Hentai and doujinshi on Read Hentai. Find new comics you might have missed!'
                : `Browse page ${page} of random Hentai selections. Discover new adult comics randomly.`,
            prev: page > 1 ? `/random?page=${page - 1}&seed=${seed}` : null,
            next: page < totalPages ? `/random?page=${page + 1}&seed=${seed}` : null
        }
    } as const
}