// ...existing code...
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

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

// simple SQL escape for single quotes
const esc = (v: string) => v.replace(/'/g, "''")
const safeNum = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

// small in-memory caches (process lifetime) to reduce Turso reads
let cachedPopular: ComicItem[] | null = null
let cachedPopularTs = 0
let cachedMinMax: { minRowid: number; maxRowid: number; ts: number } | null = null
const CACHE_TTL = 60 * 1000 // 1 minute

export const load: PageServerLoad = async () => {
    const POPULAR_COUNT = 12
    const WINDOW_MULT = 4 // fetch a small window and sample from it
    const now = Date.now()

    // Use cached popular list when available
    if (cachedPopular && now - cachedPopularTs < CACHE_TTL) {
        return {
            popularComics: cachedPopular,
            meta: {
                title: 'Browse Manga | Read Hentai',
                description:
                    'Browse manga by tags, artists, parodies, characters, groups, categories, and languages. Discover your favorite hentai and doujinshi on Read Hentai.'
            }
        } as const
    }

    // determine min/max rowid (cached)
    try {
        if (!cachedMinMax || now - cachedMinMax.ts > CACHE_TTL) {
            const mm = await db.execute('SELECT MIN(rowid) AS minRowid, MAX(rowid) AS maxRowid FROM manga;')
            cachedMinMax = {
                minRowid: safeNum(mm.rows?.[0]?.minRowid),
                maxRowid: safeNum(mm.rows?.[0]?.maxRowid),
                ts: now
            }
        }
    } catch (err) {
        console.error('Turso min/max rowid error', err)
        cachedMinMax = null
    }

    let finalMangaRows: MangaItem[] = []

    try {
        if (cachedMinMax && cachedMinMax.maxRowid >= cachedMinMax.minRowid && cachedMinMax.maxRowid > 0) {
            const minRowid = cachedMinMax.minRowid
            const maxRowid = cachedMinMax.maxRowid
            const range = Math.max(1, maxRowid - minRowid + 1)

            // pick a random start within range
            const startOffset = Math.floor(Math.random() * range)
            const startRowidGuess = minRowid + startOffset

            const windowSize = POPULAR_COUNT * WINDOW_MULT

            // fetch a small window starting at guess
            const qWindow = `
                SELECT id, title, feature_image_url
                FROM manga
                WHERE rowid >= ${startRowidGuess}
                ORDER BY rowid ASC
                LIMIT ${windowSize};
            `
            const wRes = await db.execute(qWindow)
            let windowRows = (wRes.rows ?? []) as MangaItem[]

            // if not enough rows, wrap from beginning
            if ((windowRows.length ?? 0) < POPULAR_COUNT) {
                const needed = Math.max(0, POPULAR_COUNT - (windowRows.length ?? 0))
                const qWrap = `
                    SELECT id, title, feature_image_url
                    FROM manga
                    WHERE rowid < ${startRowidGuess}
                    ORDER BY rowid ASC
                    LIMIT ${needed};
                `
                const w2 = await db.execute(qWrap)
                const wrapRows = (w2.rows ?? []) as MangaItem[]
                windowRows = (windowRows || []).concat(wrapRows)
            }

            // shuffle in-memory (Fisher-Yates) and pick POPULAR_COUNT
            for (let i = windowRows.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[windowRows[i], windowRows[j]] = [windowRows[j], windowRows[i]]
            }
            finalMangaRows = windowRows.slice(0, POPULAR_COUNT)
        }
    } catch (err) {
        console.error('Turso popular sampling error', err)
        finalMangaRows = []
    }

    // fallback: if sampling failed, load recent window and pick from it
    if (!finalMangaRows || finalMangaRows.length === 0) {
        try {
            const fallbackSize = POPULAR_COUNT * WINDOW_MULT
            const res = await db.execute(`SELECT id, title, feature_image_url FROM manga ORDER BY rowid DESC LIMIT ${fallbackSize};`)
            const rows = (res.rows ?? []) as MangaItem[]
            for (let i = rows.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[rows[i], rows[j]] = [rows[j], rows[i]]
            }
            finalMangaRows = rows.slice(0, POPULAR_COUNT)
        } catch (err) {
            console.error('Turso popular fallback error', err)
            finalMangaRows = []
        }
    }

    // Batch fetch slugs for the selected ids (single query)
    const mangaIds = finalMangaRows.map((m) => m.id).filter(Boolean)
    let slugs: SlugItem[] = []
    if (mangaIds.length > 0) {
        try {
            const idsList = mangaIds.map((id) => (typeof id === 'number' ? String(id) : `'${esc(String(id))}'`)).join(',')
            const slugQ = `SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`
            const sres = await db.execute(slugQ)
            slugs = (sres.rows ?? []) as SlugItem[]
        } catch (err) {
            console.error('Turso slug fetch error', err)
            slugs = []
        }
    }

    const popularComics: ComicItem[] = finalMangaRows.map((item) => ({
        id: item.id,
        title: item.title,
        slug: slugs.find((s) => String(s.manga_id) === String(item.id))?.slug ?? '',
        featureImage: item.feature_image_url ?? null,
        author: { name: 'Unknown' }
    }))

    // cache result for short TTL to reduce reads
    cachedPopular = popularComics
    cachedPopularTs = Date.now()

    return {
        popularComics,
        meta: {
            title: 'Browse Manga | Read Hentai',
            description:
                'Browse manga by tags, artists, parodies, characters, groups, categories, and languages. Discover your favorite hentai and doujinshi on Read Hentai.'
        }
    } as const
}
// ...existing code...