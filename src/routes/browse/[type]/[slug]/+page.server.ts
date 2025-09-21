import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** simple SQL escape for single quotes */
const esc = (v: string) => v.replace(/'/g, "''")

// lightweight in-memory caches (process lifetime)
const metaCache = new Map<string, { id: any; name: string; ts: number }>()
const countCache = new Map<string, { count: number; ts: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

export const load: PageServerLoad = async ({ params, url }) => {
    const { type, slug } = params
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const PAGE_SIZE = 10
    const offset = (page - 1) * PAGE_SIZE
    const MAX_PAGE = 1000 // defend against huge OFFSETs
    const cursor = url.searchParams.get('cursor') ?? null // optional keyset param

    // Allowed mapping from route type => join table
    const allowed: Record<string, string> = {
        tags: 'manga_tags',
        artists: 'manga_artists',
        categories: 'manga_categories',
        parodies: 'manga_parodies',
        characters: 'manga_characters',
        languages: 'manga_languages',
        groups: 'manga_groups'
    }

    const typeLabels: Record<string, string> = {
        tags: 'Tag',
        artists: 'Artist',
        categories: 'Category',
        parodies: 'Parody',
        characters: 'Character',
        languages: 'Language',
        groups: 'Group'
    }

    if (!(type in allowed)) throw error(404, 'Invalid browse type')

    const joinTable = allowed[type]
    const idField = type.endsWith('ies') ? `${type.slice(0, -3)}y_id` : `${type.slice(0, -1)}_id`

    // 1) fetch meta record (id, name) with cache
    let meta: { id: any; name: string } | null = null
    try {
        const cacheKey = `${type}:${slug}`
        const now = Date.now()
        const cached = metaCache.get(cacheKey)
        if (!cached || now - cached.ts > CACHE_TTL) {
            const res = await db.execute(`SELECT id, name FROM ${type} WHERE slug = '${esc(slug)}' LIMIT 1;`)
            meta = (res.rows ?? [])[0] ?? null
            if (meta && meta.id) metaCache.set(cacheKey, { ...meta, ts: now })
        } else {
            meta = { id: cached.id, name: cached.name }
        }
    } catch (e) {
        console.error('Turso meta lookup error', e)
        throw error(404, 'Browse category not found')
    }

    if (!meta || !meta.id) throw error(404, 'Browse category not found')

    // 2) count total related manga (cached)
    let totalManga = 0
    try {
        const cacheKey = `${joinTable}:${String(meta.id)}`
        const now = Date.now()
        const cached = countCache.get(cacheKey)
        if (!cached || now - cached.ts > CACHE_TTL) {
            const countQ = `SELECT COUNT(*) AS count FROM ${joinTable} WHERE ${idField} = ${
                typeof meta.id === 'number' ? meta.id : `'${esc(String(meta.id))}'`
            };`
            const countRes = await db.execute(countQ)
            totalManga = Number(countRes.rows?.[0]?.count ?? 0)
            countCache.set(cacheKey, { count: totalManga, ts: now })
        } else {
            totalManga = cached.count
        }
    } catch (e) {
        console.error('Turso count error', e)
        throw error(500, 'Failed to count related manga')
    }

    const totalPages = Math.max(1, Math.ceil((totalManga || 0) / PAGE_SIZE))

    // If cursor not used and page is too large, refuse to perform huge OFFSET
    if (!cursor && page > MAX_PAGE) {
        throw error(400, `Page too large; use cursor-based pagination (max page ${MAX_PAGE})`)
    }

    // 3) get paginated manga ids from join table (use keyset if cursor provided)
    let relRows: { manga_id: any }[] = []
    try {
        let relQ: string
        if (cursor) {
            // keyset pagination: get items with manga_id > cursor (client should pass last manga_id)
            relQ = `SELECT manga_id FROM ${joinTable} WHERE ${idField} = ${
                typeof meta.id === 'number' ? meta.id : `'${esc(String(meta.id))}'`
            } AND manga_id > '${esc(cursor)}' ORDER BY manga_id ASC LIMIT ${PAGE_SIZE};`
        } else {
            relQ = `SELECT manga_id FROM ${joinTable} WHERE ${idField} = ${
                typeof meta.id === 'number' ? meta.id : `'${esc(String(meta.id))}'`
            } ORDER BY manga_id LIMIT ${PAGE_SIZE} OFFSET ${offset};`
        }
        const relRes = await db.execute(relQ)
        relRows = relRes.rows ?? []
    } catch (e) {
        console.error('Turso related manga query error', e)
        throw error(404, 'No manga found for this page')
    }

    if (!relRows || relRows.length === 0) {
        return {
            type,
            slug,
            name: meta.name,
            comics: [],
            page,
            totalPages,
            totalManga,
            typeLabel: typeLabels[type] ?? type,
            popularContent: { characters: [], tags: [], parodies: [] },
            seo: {
                title: `${meta.name} ${typeLabels[type] ?? type} - Page ${page}`,
                description: `${meta.name} - no results`,
                canonical: `https://readhentai.me/browse/${type}/${slug}${page > 1 ? `?page=${page}` : ''}`
            }
        }
    }

    const mangaIds = relRows.map((r) => r.manga_id)

    // Helper to build IN list with proper quoting
    const inList = (ids: any[]) =>
        ids
            .map((id) => (typeof id === 'number' ? String(id) : `'${esc(String(id))}'`))
            .join(',')

    // 4) Parallel batch fetch: manga, slug_map, and related join -> target tables
    let mangaRows: any[] = []
    let slugRows: any[] = []
    let allArtists: any[] = []
    let allTags: any[] = []
    let allCharacters: any[] = []
    let allParodies: any[] = []

    try {
        const idsList = inList(mangaIds)
        const promises = [
            db.execute(`SELECT id, title, feature_image_url FROM manga WHERE id IN (${idsList});`),
            db.execute(`SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`),
            db.execute(
                `SELECT ma.manga_id, a.name FROM manga_artists ma JOIN artists a ON ma.artist_id = a.id WHERE ma.manga_id IN (${idsList}) LIMIT 200;`
            ),
            db.execute(
                `SELECT mt.manga_id, t.name FROM manga_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.manga_id IN (${idsList}) LIMIT 200;`
            ),
            db.execute(
                `SELECT mc.manga_id, ch.name FROM manga_characters mc JOIN characters ch ON mc.character_id = ch.id WHERE mc.manga_id IN (${idsList}) LIMIT 200;`
            ),
            db.execute(
                `SELECT mp.manga_id, p.name FROM manga_parodies mp JOIN parodies p ON mp.parody_id = p.id WHERE mp.manga_id IN (${idsList}) LIMIT 200;`
            )
        ]

        const [mRes, sRes, aRes, tRes, cRes, pRes] = await Promise.all(promises)

        mangaRows = mRes.rows ?? []
        slugRows = sRes.rows ?? []
        allArtists = aRes.rows ?? []
        allTags = tRes.rows ?? []
        allCharacters = cRes.rows ?? []
        allParodies = pRes.rows ?? []
    } catch (e) {
        console.error('Turso batch fetch error', e)
        throw error(500, 'Failed to fetch manga data')
    }

    // 5) group related data by manga id
    const relatedDataByMangaId: Record<string, any> = {}
    for (const id of mangaIds) {
        relatedDataByMangaId[String(id)] = { artists: [], tags: [], characters: [], parodies: [] }
    }

    for (const r of allArtists) {
        const key = String(r.manga_id)
        if (!relatedDataByMangaId[key]) relatedDataByMangaId[key] = { artists: [], tags: [], characters: [], parodies: [] }
        if (r.name) relatedDataByMangaId[key].artists.push(r.name)
    }
    for (const r of allTags) {
        const key = String(r.manga_id)
        if (!relatedDataByMangaId[key]) relatedDataByMangaId[key] = { artists: [], tags: [], characters: [], parodies: [] }
        if (r.name) relatedDataByMangaId[key].tags.push(r.name)
    }
    for (const r of allCharacters) {
        const key = String(r.manga_id)
        if (!relatedDataByMangaId[key]) relatedDataByMangaId[key] = { artists: [], tags: [], characters: [], parodies: [] }
        if (r.name) relatedDataByMangaId[key].characters.push(r.name)
    }
    for (const r of allParodies) {
        const key = String(r.manga_id)
        if (!relatedDataByMangaId[key]) relatedDataByMangaId[key] = { artists: [], tags: [], characters: [], parodies: [] }
        if (r.name) relatedDataByMangaId[key].parodies.push(r.name)
    }

    // 6) map manga rows into final comics array with seo data
    const comics = (mangaRows || []).map((item: any) => {
        const related = relatedDataByMangaId[String(item.id)] || { artists: [], tags: [], characters: [], parodies: [] }
        const artists = (related.artists || []).slice(0, 2)
        const tags = (related.tags || []).slice(0, 3)
        const characters = (related.characters || []).slice(0, 2)
        const parodies = (related.parodies || []).slice(0, 1)

        return {
            id: item.id,
            title: item.title,
            slug: (slugRows.find((s: any) => String(s.manga_id) === String(item.id))?.slug) ?? '',
            featureImage: item.feature_image_url,
            author: { name: artists[0] ?? 'Unknown' },
            seoData: {
                artists,
                tags,
                characters,
                parodies,
                imageAlt: `${item.title}${characters.length ? ` - ${characters[0]}` : ''}${parodies.length ? ` ${parodies[0]} parody` : ''} hentai manga${tags.length ? ` featuring ${tags.slice(0, 2).join(' ')}` : ''} by ${artists[0] ?? 'unknown artist'}`,
                imageTitle: `Read ${item.title} online free${characters.length ? ` - ${characters[0]} adult manga` : ''}${tags.length ? ` - ${tags[0]} doujinshi` : ''}`
            }
        }
    })

    // popular content for sidebar
    const topCharacters = comics.map((c) => c.seoData.characters).flat().filter(Boolean)
    const topTags = comics.map((c) => c.seoData.tags).flat().filter(Boolean)
    const topParodies = comics.map((c) => c.seoData.parodies).flat().filter(Boolean)

    const typeLabel = typeLabels[type] || type
    const canonicalUrl =
        page === 1
            ? `https://readhentai.me/browse/${type}/${slug}`
            : `https://readhentai.me/browse/${type}/${slug}?page=${page}`

    // description generator
    const generateDescription = () => {
        const pageInfo = page > 1 ? ` - Page ${page}` : ''
        const popChars = [...new Set(topCharacters)].slice(0, 2).join(', ')
        const popTags = [...new Set(topTags)].slice(0, 3).join(', ')
        switch (type) {
            case 'tags':
                return `🔞 Browse ${totalManga} premium ${meta.name} hentai manga${pageInfo}. ${popChars ? `Featuring ${popChars} characters, ` : ''}free adult doujinshi with high-quality artwork. Read online instantly!`
            case 'artists':
                return `🎨 Discover ${totalManga} exclusive hentai by artist ${meta.name}${pageInfo}. ${popTags ? `${popTags} content, ` : ''}premium adult manga collection. Free reading, no signup required!`
            case 'parodies':
                return `📚 Read ${totalManga} ${meta.name} parody hentai${pageInfo}. ${popChars ? `${popChars} characters, ` : ''}fan-made adult doujinshi based on popular anime. Free online access!`
            case 'characters':
                return `💕 Find ${totalManga} hentai featuring ${meta.name}${pageInfo}. ${popTags ? `${popTags} themes, ` : ''}premium adult manga with your favorite character. Read free online!`
            case 'categories':
                return `📖 Explore ${totalManga} ${meta.name} category hentai${pageInfo}. ${popChars ? `${popChars} characters, ` : ''}curated adult manga collection. High-quality content, free access!`
            case 'languages':
                return `🌍 Read ${totalManga} hentai in ${meta.name}${pageInfo}. ${popTags ? `${popTags} content, ` : ''}translated adult manga in your preferred language. Free online reader!`
            case 'groups':
                return `👥 Browse ${totalManga} hentai by ${meta.name} group${pageInfo}. ${popChars ? `${popChars} characters, ` : ''}quality translations and premium releases. Read free online!`
            default:
                return `Browse ${totalManga} hentai in ${meta.name}${pageInfo}. Free adult manga collection online.`
        }
    }

    const socialTitle =
        page === 1
            ? `🔥 ${totalManga} ${meta.name} Hentai Manga | Free Online | Read Hentai`
            : `${meta.name} Hentai - Page ${page} | ${totalManga} Free Adult Manga`

    const socialDescription = generateDescription().replace(/🔞|🎨|📚|💕|📖|🌍|👥/g, '').trim()

    const ogImages = [
        comics[0]?.featureImage,
        comics[1]?.featureImage,
        comics[2]?.featureImage,
        `/images/og-${type}-default.jpg`
    ].filter(Boolean)

    // compute nextCursor for keyset pagination (if applicable)
    const nextCursor = relRows.length ? String(relRows[relRows.length - 1].manga_id) : null

    return {
        type,
        slug,
        name: meta.name,
        comics,
        page,
        totalPages,
        totalManga,
        typeLabel,
        popularContent: {
            characters: [...new Set(topCharacters)].slice(0, 5),
            tags: [...new Set(topTags)].slice(0, 5),
            parodies: [...new Set(topParodies)].slice(0, 3)
        },
        pagination: {
            cursor: cursor ?? null,
            nextCursor,
            pageSize: PAGE_SIZE
        },
        seo: {
            title:
                page === 1
                    ? `${meta.name} ${typeLabel} Hentai - ${totalManga} Free Adult Manga | Read Hentai`
                    : `${meta.name} ${typeLabel} - Page ${page} | ${totalManga} Free Adult Manga`,
            description: generateDescription(),
            canonical: canonicalUrl,
            keywords: `${meta.name.toLowerCase()}, ${type}, hentai, manga, doujinshi, adult manga, free online, ${[...new Set(topCharacters)].slice(0,3).join(', ').toLowerCase()}, ${[...new Set(topTags)].slice(0,3).join(', ').toLowerCase()}`,
            ogTitle: socialTitle,
            ogDescription: socialDescription,
            ogImages,
            ogType: 'website',
            ogSiteName: 'Read Hentai Pics - Free Adult Manga',
            ogLocale: 'en_US',
            twitterTitle: socialTitle,
            twitterDescription: socialDescription,
            twitterCard: 'summary_large_image',
            twitterSite: '@Read Hentaipics'
        }
    }
}