import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'

// escape single quotes for SQL literals
const esc = (v: string) => (v ?? '').toString().replace(/'/g, "''")
const safeNum = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

// caches (process lifetime)
const METADATA_CACHE_TTL = 10 * 60 * 1000
const PAGE_COUNT_TTL = 5 * 60 * 1000
const RANDOM_CACHE_TTL = 5 * 60 * 1000
const ID_MINMAX_TTL = 60 * 1000

let metadataCache = new Map<string, { ts: number; data: any }>()
let pageCountCache = new Map<string, { ts: number; count: number }>()
let cachedRandomComics: any[] | null = null
let cachedRandomComicsTs = 0
let cachedIdMinMax: { minRowid: number; maxRowid: number; ts: number } | null = null

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
    const slug = params.slug
    const pageParam = params.page ?? '1'
    const pageNum = Math.max(1, parseInt(String(pageParam), 10) || 1)
    const IMAGES_PER_PAGE = 1
    const PREFETCH_RADIUS = 1
    const RELATED_LIMIT = 100
    const RANDOM_LIMIT = 8

    // Set Cache-Control header for Cloudflare edge caching (1 year)
    if (setHeaders) {
        setHeaders({
            'Cache-Control': 'public, max-age=31536000, immutable'
        })
    }

    if (!slug) throw error(404, 'Not found')

    // 1) Resolve slug -> manga_id
    let slugRow
    try {
        const q = `SELECT manga_id FROM slug_map WHERE slug = '${esc(slug)}' LIMIT 1;`
        const res = await db.execute(q)
        slugRow = res.rows?.[0]
    } catch (err) {
        console.error('slug lookup error', err)
        throw error(404, 'Not found')
    }
    if (!slugRow || !slugRow.manga_id) throw error(404, 'Not found')
    const mangaId = String(slugRow.manga_id)

    // 2) Metadata (cached)
    const now = Date.now()
    let cached = metadataCache.get(mangaId)
    let metadata: {
        manga: any
        tagNames: string[]
        tagIds: string[]
        characterNames: string[]
        parodyNames: string[]
        artistNames: string[]
    }
    if (!cached || now - cached.ts > METADATA_CACHE_TTL) {
        try {
            // fetch small related sets in parallel (limited)
            const [
                mRes,
                artistsRes,
                tagsRes,
                charactersRes,
                parodiesRes
            ] = await Promise.all([
                db.execute(
                    `SELECT id, manga_id, title, feature_image_url, created_at FROM manga WHERE id = '${esc(
                        mangaId
                    )}' LIMIT 1;`
                ),
                db.execute(
                    `SELECT a.id, a.name FROM manga_artists ma JOIN artists a ON ma.artist_id = a.id WHERE ma.manga_id = '${esc(
                        mangaId
                    )}' LIMIT 5;`
                ),
                db.execute(
                    `SELECT t.id, t.name FROM manga_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.manga_id = '${esc(
                        mangaId
                    )}' LIMIT 10;`
                ),
                db.execute(
                    `SELECT ch.id, ch.name FROM manga_characters mc JOIN characters ch ON mc.character_id = ch.id WHERE mc.manga_id = '${esc(
                        mangaId
                    )}' LIMIT 5;`
                ),
                db.execute(
                    `SELECT p.id, p.name FROM manga_parodies mp JOIN parodies p ON mp.parody_id = p.id WHERE mp.manga_id = '${esc(
                        mangaId
                    )}' LIMIT 3;`
                )
            ])

            const manga = (mRes.rows ?? [])[0] ?? null
            if (!manga) throw new Error('manga missing')

            const artistNames = (artistsRes.rows ?? []).map((r: any) => r.name).filter(Boolean)
            const tagNames = (tagsRes.rows ?? []).map((r: any) => r.name).filter(Boolean)
            const tagIds = (tagsRes.rows ?? []).map((r: any) => String(r.id)).filter(Boolean)
            const characterNames = (charactersRes.rows ?? []).map((r: any) => r.name).filter(Boolean)
            const parodyNames = (parodiesRes.rows ?? []).map((r: any) => r.name).filter(Boolean)

            metadata = {
                manga,
                tagNames,
                tagIds,
                characterNames,
                parodyNames,
                artistNames,
            }
            metadataCache.set(mangaId, { ts: now, data: metadata })
        } catch (err) {
            console.error('metadata fetch error', err)
            throw error(404, 'Not found')
        }
    } else {
        metadata = cached.data
    }

    const { manga, tagNames, tagIds, characterNames, parodyNames, artistNames } = metadata

    // 3) Page count (cached) and fetch requested page(s)
    let totalImages = 0
    let totalPages = 0
    try {
        const pcCached = pageCountCache.get(mangaId)
        if (!pcCached || now - pcCached.ts > PAGE_COUNT_TTL) {
            const cRes = await db.execute(`SELECT COUNT(*) AS cnt FROM pages WHERE manga_id = '${esc(mangaId)}';`)
            const cnt = safeNum(cRes.rows?.[0]?.cnt)
            pageCountCache.set(mangaId, { ts: now, count: cnt })
            totalImages = cnt
        } else {
            totalImages = pcCached.count
        }
        totalPages = Math.max(0, Math.ceil(totalImages / IMAGES_PER_PAGE))
    } catch (err) {
        console.error('page count error', err)
        // continue with fallback (empty pages)
        totalImages = 0
        totalPages = 0
    }

    if (totalPages > 0 && pageNum > totalPages) throw error(404, 'Page not found')

    const fromPage = Math.max(1, pageNum - PREFETCH_RADIUS)
    const toPage = Math.min(Math.max(pageNum, fromPage), pageNum + PREFETCH_RADIUS)
    let pages: { page_number: number; image_url: string }[] = []
    try {
        const pr = `SELECT page_number, image_url FROM pages WHERE manga_id = '${esc(mangaId)}' AND page_number BETWEEN ${fromPage} AND ${toPage} ORDER BY page_number ASC;`
        const pRes = await db.execute(pr)
        pages = (pRes.rows ?? []) as typeof pages
    } catch (err) {
        console.error('pages fetch error', err)
        pages = []
    }

    // 4) Random recommendations (cached, sampling via rowid window)
    const seedParam = url.searchParams.get('seed')
    const seed = seedParam ? Number(seedParam) || Math.floor(Math.random() * 1_000_000) : Math.floor(Math.random() * 1_000_000)
    let randomComics: any[] = []

    if (!cachedRandomComics || now - cachedRandomComicsTs > RANDOM_CACHE_TTL) {
        let finalRandom: any[] = []
        try {
            // min/max rowid cache
            if (!cachedIdMinMax || now - (cachedIdMinMax.ts ?? 0) > ID_MINMAX_TTL) {
                const mm = await db.execute('SELECT MIN(rowid) AS minRowid, MAX(rowid) AS maxRowid FROM manga;')
                cachedIdMinMax = {
                    minRowid: safeNum(mm.rows?.[0]?.minRowid),
                    maxRowid: safeNum(mm.rows?.[0]?.maxRowid),
                    ts: Date.now()
                }
            }
            const minRowid = cachedIdMinMax?.minRowid ?? 0
            const maxRowid = cachedIdMinMax?.maxRowid ?? 0

            if (minRowid > 0 && maxRowid >= minRowid) {
                const range = maxRowid - minRowid + 1
                const startOffset = seed % Math.max(range, 1)
                const startRowidGuess = minRowid + startOffset
                const windowSize = Math.max(RANDOM_LIMIT, RANDOM_LIMIT * 3)

                const qWindow = `SELECT id, title, feature_image_url FROM manga WHERE rowid >= ${startRowidGuess} ORDER BY rowid ASC LIMIT ${windowSize};`
                const wRes = await db.execute(qWindow)
                let windowRows = (wRes.rows ?? []) as any[]

                if ((windowRows?.length ?? 0) < RANDOM_LIMIT) {
                    const needed = Math.max(0, RANDOM_LIMIT - (windowRows?.length ?? 0))
                    const qWrap = `SELECT id, title, feature_image_url FROM manga WHERE rowid < ${startRowidGuess} ORDER BY rowid ASC LIMIT ${needed};`
                    const w2 = await db.execute(qWrap)
                    const wrapRows = (w2.rows ?? []) as any[]
                    windowRows = (windowRows || []).concat(wrapRows)
                }

                // deterministic-ish shuffle via simple keyed mapping (seed)
                const seeded = windowRows.map((r, i) => ({ r, k: (Math.imul(i + 0x9e3779b1, seed + 0x7ffff) >>> 0) / 0xffffffff }))
                seeded.sort((a, b) => a.k - b.k)
                finalRandom = seeded.slice(0, RANDOM_LIMIT).map((s) => s.r)
            }

            // fallback to recent window
            if (!finalRandom || finalRandom.length === 0) {
                const fb = await db.execute(`SELECT id, title, feature_image_url FROM manga ORDER BY rowid DESC LIMIT ${RANDOM_LIMIT * 3};`)
                let rows = (fb.rows ?? []) as any[]
                // in-memory shuffle
                for (let i = rows.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[rows[i], rows[j]] = [rows[j], rows[i]]
                }
                finalRandom = rows.slice(0, RANDOM_LIMIT)
            }
        } catch (err) {
            console.error('random sampling error', err)
            finalRandom = []
        }

        // batch fetch slugs for these ids
        if (finalRandom.length > 0) {
            const idsList = finalRandom.map((r) => `'${esc(String(r.id))}'`).join(',')
            try {
                const sres = await db.execute(`SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`)
                const slugRows = sres.rows ?? []
                cachedRandomComics = finalRandom.map((item) => ({
                    id: item.id,
                    title: item.title,
                    slug: (slugRows.find((s: any) => String(s.manga_id) === String(item.id))?.slug) ?? '',
                    featureImage: item.feature_image_url ?? null,
                    author: { name: 'Unknown' }
                }))
            } catch (err) {
                console.error('random slug fetch error', err)
                cachedRandomComics = finalRandom.map((item) => ({
                    id: item.id,
                    title: item.title,
                    slug: '',
                    featureImage: item.feature_image_url ?? null,
                    author: { name: 'Unknown' }
                }))
            }
        } else {
            cachedRandomComics = []
        }

        cachedRandomComicsTs = Date.now()
    }

    randomComics = cachedRandomComics ?? []

    // 5) build enhanced images with SEO metadata
    const enhanceImageAlt = (index: number) => {
        const actual = (pageNum - 1) * IMAGES_PER_PAGE + index + 1
        let alt = `${manga.title} page ${actual}`
        if (characterNames?.[0]) alt += ` featuring ${characterNames[0]}`
        if (parodyNames?.[0]) alt += ` ${parodyNames[0]} parody`
        if (tagNames?.length) alt += ` - ${tagNames.slice(0, 2).join(' ')}`
        return alt
    }
    const enhanceImageTitle = (index: number) => {
        const actual = (pageNum - 1) * IMAGES_PER_PAGE + index + 1
        let t = `Read ${manga.title} page ${actual} online`
        if (characterNames?.[0]) t += ` - ${characterNames[0]}`
        return t
    }

    const enhancedImages = (pages ?? []).map((p, i) => ({
        url: p.image_url,
        alt: enhanceImageAlt(i),
        title: enhanceImageTitle(i),
        pageNumber: (pageNum - 1) * IMAGES_PER_PAGE + i + 1
    }))

    // 6) SEO pieces
    const topCharacters = (characterNames ?? []).slice(0, 2)
    const topTags = (tagNames ?? []).slice(0, 3)
    const topParody = (parodyNames ?? [])[0] ?? ''
    const primaryArtist = (artistNames ?? [])[0] ?? ''

    const generateSEODescription = () => {
        let desc = `Read ${manga.title} online. `
        if (topCharacters.length) {
            desc += `Featuring ${topCharacters.join(' and ')}. `
        }
        if (totalImages) desc += `${totalImages} pages available. `
        if (topTags.length) desc += `Tags: ${topTags.slice(0, 2).join(', ')}. `
        desc += 'Mobile-friendly reader.'
        return desc
    }

    const canonical = `https://readhentai.me/read/${slug}/${pageNum}`
    const prev = pageNum > 1 ? `/read/${slug}/${pageNum - 1}` : undefined
    const next = pageNum < totalPages ? `/read/${slug}/${pageNum + 1}` : undefined

    return {
        slug,
        manga: {
            id: manga.id,
            mangaId: manga.manga_id,
            title: manga.title,
            tagIds,
            tagNames,
            characterNames,
            parodyNames,
            artistNames,
            seoData: {
                topCharacters,
                topTags,
                topParody,
                primaryArtist
            }
        },
        images: enhancedImages,
        currentPage: pageNum,
        totalPages,
        randomComics,
        seo: {
            title: `${manga.title}${topCharacters[0] ? ` - ${topCharacters[0]}` : ''} | Read Hentai`,
            description: generateSEODescription(),
            canonical,
            prev,
            next,
            keywords: [
                manga.title,
                ...topCharacters,
                ...topTags,
                topParody,
                primaryArtist
            ]
                .filter(Boolean)
                .join(', ')
        }
    } as const
}