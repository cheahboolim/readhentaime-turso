// ...existing code...
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** escape single quotes for SQL literals */
const esc = (v: string) => v.replace(/'/g, "''")

/** small in-memory cache to avoid repeated full-table reads (process lifetime) */
let groupedCache: {
    ts: number
    grouped: Record<string, { id: number | string; name: string; slug: string | null }[]>
    totalArtists: number
    availableLetters: string[]
    popularArtists: string
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const load: PageServerLoad = async ({ url }) => {
    // Set Cache-Control header for Cloudflare edge caching (1 year)
    if (typeof globalThis.setHeaders === 'function') {
        globalThis.setHeaders({
            'Cache-Control': 'public, max-age=31536000, immutable'
        })
    }
    // optional query params:
    // ?letter=A  -> return only artists under A
    // ?refresh=1 -> force refresh cache
    const letterParam = (url.searchParams.get('letter') ?? '').toUpperCase()
    const refresh = url.searchParams.get('refresh') === '1'

    // If cached and not refresh, return cached grouped or filtered view
    const now = Date.now()
    if (groupedCache && !refresh && now - groupedCache.ts < CACHE_TTL) {
        const cached = groupedCache
        if (letterParam) {
            // return only that letter (or '#')
            const l = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
            return buildResponseFromCache(cached, l, url)
        }
        // full cached response
        return {
            grouped: cached.grouped,
            totalArtists: cached.totalArtists,
            availableLetters: cached.availableLetters,
            seo: makeSeo(cached.totalArtists, cached.availableLetters, cached.popularArtists, url)
        } as const
    }

    // If user requested a single letter and we don't want to fetch full table,
    // run a targeted query to reduce read volume.
    if (letterParam) {
        const requestedLetter = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
        try {
            let rows = []
            if (requestedLetter === '#') {
                // non A-Z initial characters
                // select names that do NOT start with A-Z or a-z
                rows = (
                    await db.execute(
                        `SELECT id, name, slug FROM artists WHERE NOT ((substr(name,1,1) BETWEEN 'A' AND 'Z') OR (substr(name,1,1) BETWEEN 'a' AND 'z')) ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            } else {
                // ASCII letter prefix search; uses index on name COLLATE NOCASE if present
                const prefix = esc(requestedLetter) + '%'
                rows = (await db.execute(`SELECT id, name, slug FROM artists WHERE name LIKE '${prefix}' COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`)).rows ?? []
            }

            const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
            grouped[requestedLetter] = (rows as any[]).map((r) => ({ id: r.id, name: r.name ?? '', slug: r.slug ?? null }))

            // compute lightweight totals for SEO; do not scan whole table here
            const totalArtists = grouped[requestedLetter].length
            const availableLetters = Object.keys(grouped).sort()
            const popularArtists = grouped[requestedLetter].slice(0, 15).map((a) => a.name).join(', ')

            return {
                grouped,
                totalArtists,
                availableLetters,
                seo: makeSeo(totalArtists, availableLetters, popularArtists, url)
            } as const
        } catch (err) {
            console.error('Turso artists letter query error', err)
            // fallback to empty
            return {
                grouped: {},
                totalArtists: 0,
                availableLetters: [],
                seo: makeSeo(0, [], '', url)
            } as const
        }
    }

    // No letter filter: fetch full list once and cache it.
    try {
        const res = await db.execute(`SELECT id, name, slug FROM artists ORDER BY name COLLATE NOCASE ASC;`)
        const artists = (res.rows ?? []) as { id: number | string; name: string; slug: string | null }[]

        // Group artists by A-Z or '#'
        const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
        for (const artist of artists) {
            const name = (artist.name ?? '').toString()
            const first = name.charAt(0).toUpperCase() || '#'
            const letter = /^[A-Z]$/.test(first) ? first : '#'
            if (!grouped[letter]) grouped[letter] = []
            grouped[letter].push({ id: artist.id, name, slug: artist.slug ?? null })
        }

        // Sort items per group case-insensitively (should already be ordered but keep as safeguard)
        for (const k of Object.keys(grouped)) {
            grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        }

        const totalArtists = artists.length
        const availableLetters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1
            if (b === '#') return -1
            return a.localeCompare(b)
        })
        const popularArtists = artists.slice(0, 15).map((a) => (a.name ?? '').toString()).join(', ')

        // cache result
        groupedCache = { ts: now, grouped, totalArtists, availableLetters, popularArtists }

        return {
            grouped,
            totalArtists,
            availableLetters,
            seo: makeSeo(totalArtists, availableLetters, popularArtists, url)
        } as const
    } catch (err) {
        console.error('Turso artists load error', err)
        return {
            grouped: {},
            totalArtists: 0,
            availableLetters: [],
            seo: makeSeo(0, [], '', url)
        } as const
    }
}

/** helper: build response when cache exists but user asked a letter */
function buildResponseFromCache(
    cached: {
        ts: number
        grouped: Record<string, { id: number | string; name: string; slug: string | null }[]>
        totalArtists: number
        availableLetters: string[]
        popularArtists: string
    },
    letter: string,
    url: URL
) {
    const group = cached.grouped[letter] ?? []
    const grouped: Record<string, typeof group> = {}
    grouped[letter] = group
    return {
        grouped,
        totalArtists: group.length,
        availableLetters: Object.keys(cached.grouped).sort(),
        seo: makeSeo(group.length, Object.keys(cached.grouped).sort(), group.slice(0, 15).map((g) => g.name).join(', '), url)
    } as const
}

/** helper: consistent SEO object */
function makeSeo(totalArtists: number, availableLetters: string[], popularArtists: string, url: URL) {
    return {
        title: `Browse ${totalArtists}+ Hentai Artists A-Z | Read Hentai`,
        description: `Explore ${totalArtists} hentai artists organized alphabetically. Find your favorite artists and their works. Popular artists: ${popularArtists.toLowerCase()}.`,
        canonical: `https://readhentai.me${url.pathname}`,
        keywords: `hentai artists, manga artists, ${popularArtists.toLowerCase()}, hentai creators, artist list`,
        ogTitle: `${totalArtists}+ Hentai Artists | Browse A-Z`,
        ogDescription: `Complete collection of hentai artists organized alphabetically. Discover artists and their works from your favorite series.`,
        ogImage: 'https://readhentai.me/images/artists-og.jpg',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Hentai Artists',
            description: `Browse our comprehensive collection of ${totalArtists} hentai artists organized alphabetically`,
            url: `https://readhentai.me${url.pathname}`,
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalArtists,
                itemListElement: [] // kept empty here to avoid large payloads; frontend can request sample
            },
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://readhentai.me' },
                    { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://readhentai.me/browse' },
                    { '@type': 'ListItem', position: 3, name: 'Artists', item: `https://readhentai.me${url.pathname}` }
                ]
            }
        }
    }
}
// ...existing code...