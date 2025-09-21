/* eslint-disable prettier/prettier */
import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'

type RelatedMeta = {
    id: string
    name: string
    slug: string
}

// simple SQL escape for single quotes (values come from params / DB)
const esc = (v: string) => v.replace(/'/g, "''")

// Cache for random comics (reduces DB calls)
let cachedRandomComics: any[] | null = null
let randomComicsCacheTime = 0
const RANDOM_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache for page counts per manga
const pageCountCache = new Map<string, { count: number; ts: number }>()
const PAGE_COUNT_TTL = 5 * 60 * 1000 // 5 minutes

// id-range cache for random sampling (min/max ids)
let cachedIdMinMax: { minId: number; maxId: number; ts: number } | null = null
const ID_MINMAX_TTL = 60 * 1000 // 1 minute

const safeNum = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

export async function load({ params, url }) {
    const slug = params.slug
    if (!slug) throw error(404, 'Comic not found')

    // 1) Resolve slug -> manga_id
    let slugRow
    try {
        const q = `SELECT manga_id FROM slug_map WHERE slug = '${esc(slug)}' LIMIT 1;`
        const res = await db.execute(q)
        slugRow = res.rows?.[0]
    } catch (err) {
        console.error('Turso slug lookup error', err)
        throw error(404, 'Comic not found')
    }

    if (!slugRow || !slugRow.manga_id) throw error(404, 'Comic not found')
    const mangaId = slugRow.manga_id as string

    // 2) Fetch manga and pages count in parallel (count is cached)
    let manga: any = null
    let pageCount = 0
    try {
        const now = Date.now()
        let cached = pageCountCache.get(String(mangaId))
        if (!cached || now - cached.ts > PAGE_COUNT_TTL) {
            const countRes = await db.execute(`SELECT COUNT(*) AS count FROM pages WHERE manga_id = '${esc(mangaId)}';`)
            pageCount = safeNum(countRes.rows?.[0]?.count)
            pageCountCache.set(String(mangaId), { count: pageCount, ts: now })
        } else {
            pageCount = cached.count
        }

        const mangaRes = await db.execute(
            `SELECT id, manga_id, title, feature_image_url, created_at FROM manga WHERE id = '${esc(mangaId)}' LIMIT 1;`
        )
        manga = mangaRes.rows?.[0] ?? null
    } catch (err) {
        console.error('Turso manga/pages count error', err)
        throw error(404, 'Comic not found')
    }

    if (!manga) throw error(404, 'Comic not found')

    // 3) Fetch pages image urls.
    // To avoid massive reads for very large releases, only fetch all pages when ?full=1 is provided.
    const MAX_PAGES_FETCH = 500 // safe default upper bound for full fetch on this route
    const wantFull = url.searchParams.get('full') === '1' // manual override if frontend requests all pages
    let pages: { image_url: string }[] = []
    let partialPages = false
    let maxPagesFetched = 0
    try {
        if (pageCount <= MAX_PAGES_FETCH || wantFull) {
            const pagesRes = await db.execute(
                `SELECT image_url FROM pages WHERE manga_id = '${esc(mangaId)}' ORDER BY page_number ASC;`
            )
            pages = (pagesRes.rows ?? []) as { image_url: string }[]
            partialPages = false
            maxPagesFetched = pages.length
        } else {
            // fetch a limited prefix: first N pages (useful for previews) and let frontend lazy-load the rest via an API
            const pagesRes = await db.execute(
                `SELECT image_url FROM pages WHERE manga_id = '${esc(mangaId)}' ORDER BY page_number ASC LIMIT ${MAX_PAGES_FETCH};`
            )
            pages = (pagesRes.rows ?? []) as { image_url: string }[]
            partialPages = true
            maxPagesFetched = pages.length
        }
    } catch (err) {
        console.error('Turso pages fetch error', err)
        pages = []
    }

    // 4) Fetch related metadata via joins (parallel). Keep reasonable limits where appropriate.
    const RELATED_LIMIT = 200
    const [
        artistsData,
        tagsData,
        groupsData,
        categoriesData,
        languagesData,
        parodiesData,
        charactersData
    ] = await Promise.all([
        (async () =>
            (
                await db.execute(
                    `SELECT a.id, a.name, a.slug FROM manga_artists ma JOIN artists a ON ma.artist_id = a.id WHERE ma.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])(),
        (async () =>
            (
                await db.execute(
                    `SELECT t.id, t.name, t.slug FROM manga_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])(),
        (async () =>
            (
                await db.execute(
                    `SELECT g.id, g.name, g.slug FROM manga_groups mg JOIN groups g ON mg.group_id = g.id WHERE mg.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])(),
        (async () =>
            (
                await db.execute(
                    `SELECT c.id, c.name, c.slug FROM manga_categories mc JOIN categories c ON mc.category_id = c.id WHERE mc.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])(),
        (async () =>
            (
                await db.execute(
                    `SELECT l.id, l.name, l.slug FROM manga_languages ml JOIN languages l ON ml.language_id = l.id WHERE ml.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])(),
        (async () =>
            (
                await db.execute(
                    `SELECT p.id, p.name, p.slug FROM manga_parodies mp JOIN parodies p ON mp.parody_id = p.id WHERE mp.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])(),
        (async () =>
            (
                await db.execute(
                    `SELECT ch.id, ch.name, ch.slug FROM manga_characters mc JOIN characters ch ON mc.character_id = ch.id WHERE mc.manga_id = '${esc(
                        mangaId
                    )}' LIMIT ${RELATED_LIMIT};`
                )
            ).rows ?? [])()
    ])

    const artists = (artistsData || []) as RelatedMeta[]
    const tags = (tagsData || []) as RelatedMeta[]
    const groups = (groupsData || []) as RelatedMeta[]
    const categories = (categoriesData || []) as RelatedMeta[]
    const languages = (languagesData || []) as RelatedMeta[]
    const parodies = (parodiesData || []) as RelatedMeta[]
    const characters = (charactersData || []) as RelatedMeta[]

    // 5) Cache and compute random comics (replace expensive ORDER BY RANDOM())
    let randomComics: any[] = []
    const now = Date.now()

    if (!cachedRandomComics || now - randomComicsCacheTime > RANDOM_CACHE_DURATION) {
        const RANDOM_LIMIT = 8
        let finalRandomManga: any[] = []

        try {
            // Get id min/max (cached) and sample by id-range. This avoids scanning entire table.
            const now2 = Date.now()
            if (!cachedIdMinMax || now2 - cachedIdMinMax.ts > ID_MINMAX_TTL) {
                const mm = await db.execute('SELECT MIN(id) AS minId, MAX(id) AS maxId FROM manga;')
                cachedIdMinMax = {
                    minId: safeNum(mm.rows?.[0]?.minId),
                    maxId: safeNum(mm.rows?.[0]?.maxId),
                    ts: now2
                }
            }
            const minId = cachedIdMinMax?.minId ?? 0
            const maxId = cachedIdMinMax?.maxId ?? 0

            if (minId && maxId && maxId >= minId) {
                // attempt to sample a small window starting at a pseudo-random id
                const attempts = RANDOM_LIMIT * 4
                const picked: any[] = []
                const seenIds = new Set<string | number>()
                for (let i = 0; i < attempts && picked.length < RANDOM_LIMIT * 2; i++) {
                    const randId = Math.floor(Math.random() * (maxId - minId + 1)) + minId
                    try {
                        const r = await db.execute(
                            `SELECT id, title, feature_image_url FROM manga WHERE id >= ${randId} ORDER BY id ASC LIMIT 1;`
                        )
                        const row = (r.rows ?? [])[0]
                        if (row && !seenIds.has(String(row.id))) {
                            seenIds.add(String(row.id))
                            picked.push(row)
                        }
                    } catch (e) {
                        // ignore per-attempt errors
                    }
                }
                finalRandomManga = picked
            }

            // If id-range sampling produced nothing (very sparse ids or other), fallback to a small random slice using LIMIT
            if ((!finalRandomManga || finalRandomManga.length === 0)) {
                const randRes = await db.execute(
                    `SELECT id, title, feature_image_url FROM manga ORDER BY rowid DESC LIMIT ${RANDOM_LIMIT * 5};`
                )
                finalRandomManga = (randRes.rows ?? []) as any[]
            }

            // Shuffle and pick final RANDOM_LIMIT
            if (finalRandomManga && finalRandomManga.length > 0) {
                finalRandomManga = finalRandomManga
                    .map((item) => ({ ...item, __r: Math.random() }))
                    .sort((a, b) => a.__r - b.__r)
                    .slice(0, RANDOM_LIMIT)
                    .map(({ __r, ...it }) => it)
            }
        } catch (err) {
            console.error('Turso random sampling error', err)
            finalRandomManga = []
        }

        // Get slugs for random manga in one batched query
        if (finalRandomManga.length > 0) {
            const randomMangaIds = finalRandomManga.map((m) => m.id as string)
            const idsList = randomMangaIds.map((id) => `'${esc(String(id))}'`).join(',')
            try {
                const slugsRes = await db.execute(`SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`)
                const randomSlugs = slugsRes.rows ?? []
                cachedRandomComics = finalRandomManga.map((item) => ({
                    id: item.id,
                    title: item.title,
                    slug: (randomSlugs.find((s: any) => String(s.manga_id) === String(item.id))?.slug) ?? '',
                    featureImage: item.feature_image_url,
                    author: { name: 'Unknown' }
                }))
            } catch (err) {
                console.error('Turso random slugs error', err)
                cachedRandomComics = finalRandomManga.map((item) => ({
                    id: item.id,
                    title: item.title,
                    slug: '',
                    featureImage: item.feature_image_url,
                    author: { name: 'Unknown' }
                }))
            }
        } else {
            cachedRandomComics = []
        }

        randomComicsCacheTime = now
    }

    randomComics = cachedRandomComics || []

    // 6) SEO and metadata generation (kept similar to previous logic)
    const topCharacters = characters.slice(0, 2).map((c) => c.name)
    const topTags = tags.slice(0, 3).map((t) => t.name)
    const topParody = parodies.length > 0 ? parodies[0].name : ''
    const primaryArtist = artists.length > 0 ? artists[0].name : ''
    const totalPages = pageCount || pages.length || 0

    const generateSEODescription = () => {
        let desc = `📖 Read ${manga.title} hentai manga online free! `
        if (topCharacters.length > 0) {
            desc += `Featuring ${topCharacters.join(' and ')} characters`
            if (topParody) desc += ` from ${topParody}`
            desc += '. '
        }
        if (totalPages > 0) desc += `${totalPages} high-quality pages. `
        if (topTags.length > 0) desc += `Tags: ${topTags.slice(0, 2).join(', ')}. `
        desc += 'No signup required, mobile-friendly reader! 🔞'
        return desc
    }

    const generateImageAlt = () => {
        let alt = `${manga.title} hentai manga cover`
        if (topCharacters.length > 0) alt += ` featuring ${topCharacters[0]}`
        if (topParody) alt += ` ${topParody} parody`
        if (topTags.length > 0) alt += ` - ${topTags.slice(0, 2).join(' ')} adult doujinshi`
        if (primaryArtist) alt += ` by ${primaryArtist}`
        return alt
    }

    const generateImageTitle = () => {
        let title = `Read ${manga.title} online`
        if (topCharacters.length > 0) title += ` - ${topCharacters[0]} adult manga`
        if (topTags.length > 0) title += ` - ${topTags[0]} doujinshi`
        title += ' - Free hentai reader'
        return title
    }

    const socialTitle =
        topCharacters.length > 0
            ? `🔞 ${manga.title} | ${topCharacters[0]}${topParody ? ` ${topParody}` : ''} Hentai | Free Read`
            : `🔞 ${manga.title} | ${topTags.slice(0, 2).join(' ')} Hentai Manga | Free Online`

    const socialDescription = generateSEODescription().replace(/📖|🔞/g, '').trim()

    const keywords = [
        manga.title.toLowerCase(),
        ...topCharacters.map((c) => c.toLowerCase()),
        ...topTags.map((t) => t.toLowerCase()),
        topParody.toLowerCase(),
        primaryArtist.toLowerCase(),
        'hentai',
        'manga',
        'doujinshi',
        'adult manga',
        'free online',
        'read free'
    ]
        .filter(Boolean)
        .join(', ')

    return {
        slug,
        comic: {
            id: manga.id,
            mangaId: manga.manga_id,
            title: manga.title,
            feature_image_url: manga.feature_image_url,
            totalPages,
            previewImages: pages.map((p) => p.image_url) ?? [],
            partialPages, // true if we returned a limited prefix
            maxPagesFetched, // how many page rows were fetched
            artists,
            tags,
            groups,
            categories,
            languages,
            parodies,
            characters,
            seoData: {
                primaryArtist,
                topCharacters,
                topTags,
                topParody,
                imageAlt: generateImageAlt(),
                imageTitle: generateImageTitle(),
                description: generateSEODescription(),
                socialTitle,
                socialDescription,
                keywords
            }
        },
        randomComics,
        seo: {
            title: `${manga.title}${topCharacters.length > 0 ? ` - ${topCharacters[0]}` : ''}${
                topParody ? ` ${topParody} Parody` : ''
            } | Free Hentai Manga`,
            description: generateSEODescription(),
            canonical: `https://readhentai.me/read/${slug}`,
            keywords,
            ogTitle: socialTitle,
            ogDescription: socialDescription,
            ogImage: manga.feature_image_url,
            ogType: 'article',
            ogSiteName: 'Read Hentai Pics - Free Adult Manga',
            ogLocale: 'en_US',
            articleAuthor: primaryArtist,
            articlePublishedTime: manga.created_at,
            articleSection: 'Adult Manga',
            articleTags: [...topTags, ...topCharacters, topParody].filter(Boolean),
            twitterCard: 'summary_large_image',
            twitterTitle: socialTitle,
            twitterDescription: socialDescription,
            twitterImage: manga.feature_image_url,
            twitterSite: '@Read Hentaipics',
            structuredData: {
                '@context': 'https://schema.org',
                '@type': 'Book',
                name: manga.title,
                description: socialDescription,
                url: `https://readhentai.me/read/${slug}`,
                image: manga.feature_image_url,
                datePublished: manga.created_at,
                numberOfPages: totalPages,
                genre: topTags,
                character: topCharacters,
                about: topParody,
                author: {
                    '@type': 'Person',
                    name: primaryArtist || 'Unknown Artist'
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Read Hentai Pics',
                    url: 'https://readhentai.me'
                }
            }
        }
    }
}