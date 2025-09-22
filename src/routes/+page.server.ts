/* eslint-disable prettier/prettier */
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

// escape single quotes for SQL literals
const esc = (v: string) => v.replace(/'/g, "''")

const safeNum = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

// caches
let cachedRowidMinMax: { minRowid: number; maxRowid: number; ts: number } | null = null
let cachedTotal: { total: number; ts: number } | null = null
const CACHE_TTL = 60 * 1000 // 1 minute

interface MangaItem {
    id: number | string
    title: string
    feature_image_url: string | null
}

interface SlugItem {
    slug: string
    manga_id: number | string
}

interface ComicItem {
    id: number | string
    title: string
    slug: string
    featureImage: string | null
    author: { name: string }
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
    // Set 10-minute edge cache header
    if (setHeaders) {
        setHeaders({
            'Cache-Control': 'public, max-age=600, stale-while-revalidate=60, immutable'
        })
    } else if (typeof globalThis.setHeaders === 'function') {
        globalThis.setHeaders({
            'Cache-Control': 'public, max-age=600, stale-while-revalidate=60, immutable'
        })
    }
    const PAGE_SIZE = 20

    const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10)
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const refreshParam = url.searchParams.get('refresh')
    const seedParam = url.searchParams.get('seed')

    let seed: number
    if (refreshParam === 'true' || !seedParam) {
        seed = Math.floor(Math.random() * 1000000)
    } else {
        seed = parseInt(seedParam, 10) || Math.floor(Math.random() * 1000000)
    }

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

    // Use rowid sampling to avoid arithmetic on id (works with UUID PKs too)
    let mangaRows: MangaItem[] = []
    try {
        const now = Date.now()
        if (!cachedRowidMinMax || now - cachedRowidMinMax.ts > CACHE_TTL) {
            const mm = await db.execute('SELECT MIN(rowid) AS minRowid, MAX(rowid) AS maxRowid FROM manga;')
            const minRowid = safeNum(mm.rows?.[0]?.minRowid)
            const maxRowid = safeNum(mm.rows?.[0]?.maxRowid)
            cachedRowidMinMax = { minRowid, maxRowid, ts: now }
        }

        const minRowid = cachedRowidMinMax?.minRowid ?? 0
        const maxRowid = cachedRowidMinMax?.maxRowid ?? 0

        if (minRowid > 0 && maxRowid >= minRowid) {
            const range = maxRowid - minRowid + 1
            const seedOffset = seed % Math.max(range, 1)
            const startIndex = (seedOffset + offset) % Math.max(range, 1)
            const startRowidGuess = minRowid + startIndex

            const q1 = `
                SELECT id, title, feature_image_url
                FROM manga
                WHERE rowid >= ${startRowidGuess}
                ORDER BY rowid ASC
                LIMIT ${PAGE_SIZE};
            `
            const r1 = await db.execute(q1)
            mangaRows = (r1.rows ?? []) as MangaItem[]

            if (mangaRows.length < PAGE_SIZE) {
                const remaining = PAGE_SIZE - mangaRows.length
                const q2 = `
                    SELECT id, title, feature_image_url
                    FROM manga
                    WHERE rowid < ${startRowidGuess}
                    ORDER BY rowid ASC
                    LIMIT ${remaining};
                `
                const r2 = await db.execute(q2)
                mangaRows = mangaRows.concat((r2.rows ?? []) as MangaItem[])
            }
        } else {
            mangaRows = []
        }
    } catch (err) {
        console.error('Turso rowid sampling error', err)
        mangaRows = []
    }

    // Fallback sampling (non-blocking, avoids ORDER BY RANDOM())
    if (!mangaRows || mangaRows.length === 0) {
        try {
            const mm = await db.execute('SELECT MIN(rowid) AS minRowid, MAX(rowid) AS maxRowid FROM manga;')
            const minRowid = safeNum(mm.rows?.[0]?.minRowid)
            const maxRowid = safeNum(mm.rows?.[0]?.maxRowid)

            if (minRowid > 0 && maxRowid >= minRowid) {
                const attempts = PAGE_SIZE * 4
                const seen = new Set<string | number>()
                const samples: MangaItem[] = []
                for (let i = 0; i < attempts && samples.length < PAGE_SIZE; i++) {
                    const randRowid = Math.floor(Math.random() * (maxRowid - minRowid + 1)) + minRowid
                    const r = await db.execute(
                        `SELECT id, title, feature_image_url FROM manga WHERE rowid >= ${randRowid} ORDER BY rowid ASC LIMIT 1;`
                    )
                    const row = (r.rows ?? [])[0]
                    if (row && !seen.has(row.id)) {
                        seen.add(row.id)
                        samples.push(row as MangaItem)
                    }
                }
                mangaRows = samples.slice(0, PAGE_SIZE)
            } else {
                mangaRows = []
            }
        } catch (err) {
            console.error('Turso fallback sampling error', err)
            mangaRows = []
        }
    }

    // If still empty, return graceful response
    if (!mangaRows || mangaRows.length === 0) {
        return {
            comics: [],
            total,
            page,
            seed,
            meta: {
                title: 'Read Hentai Pics | Read Hentai',
                description: 'Discover popular hentai and doujinshi.',
                prev: null,
                next: null
            }
        }
    }

    // Fetch slugs - build IN list with proper quoting for string ids
    const mangaIds = mangaRows.map((m) => m.id).filter(Boolean)
    let slugs: SlugItem[] = []
    if (mangaIds.length > 0) {
        try {
            const idsList = mangaIds
                .map((id) => (typeof id === 'number' ? String(id) : `'${esc(String(id))}'`))
                .join(',')
            if (idsList.length > 0) {
                const slugQ = `SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`
                const sres = await db.execute(slugQ)
                slugs = (sres.rows ?? []) as SlugItem[]
            }
        } catch (err) {
            console.error('Turso slug query error', err)
            slugs = []
        }
    }

    const comics: ComicItem[] = mangaRows.map((item) => ({
        id: item.id,
        title: item.title,
        slug: (slugs.find((s) => String(s.manga_id) === String(item.id))?.slug) ?? '',
        featureImage: item.feature_image_url ?? null,
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
            title: isFirstPage ? 'Read Hentai Pics | Read Hentai, Doujinshi, and Latest Pictures' : `Popular Hentai | Page ${page} | Read Hentai`,
            description: isFirstPage
                ? 'Discover popular manga, hentai, and doujinshi that others are reading on Read Hentai.'
                : `Browse page ${page} of popular hentai selections.`,
            prev: page > 1 ? `/?page=${page - 1}&seed=${seed}` : null,
            next: page < totalPages ? `/?page=${page + 1}&seed=${seed}` : null
        }
    } as const
}