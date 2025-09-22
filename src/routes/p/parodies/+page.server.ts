// ...existing code...
import type { PageServerLoad } from './$types'
import type { Parody } from '$lib/types'
import { db } from '$lib/server/db'

/** escape single quotes for SQL literals */
const esc = (v: string) => (v ?? '').toString().replace(/'/g, "''")

type ParodyRow = { id: number | string; name: string; slug: string | null }

/** small in-memory cache to avoid repeated full-table reads (process lifetime) */
let groupedCache: {
    ts: number
    grouped: Record<string, ParodyRow[]>
    totalParodies: number
    availableLetters: string[]
    popularParodies: string
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const load: PageServerLoad = async ({ url }) => {
    // Set Cache-Control header for Cloudflare edge caching (1 year)
    if (typeof globalThis.setHeaders === 'function') {
        globalThis.setHeaders({
            'Cache-Control': 'public, max-age=31536000, immutable'
        })
    }
    // query params:
    // ?letter=A  -> return only parodies under A (targeted query)
    // ?refresh=1 -> force refresh cache
    const letterParam = (url.searchParams.get('letter') ?? '').toUpperCase()
    const refresh = url.searchParams.get('refresh') === '1'
    const now = Date.now()

    // Serve from cache if available and not forced refresh
    if (groupedCache && !refresh && now - groupedCache.ts < CACHE_TTL) {
        if (letterParam) {
            const l = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
            return buildResponseFromCache(groupedCache, l, url)
        }
        return {
            grouped: groupedCache.grouped,
            totalParodies: groupedCache.totalParodies,
            availableLetters: groupedCache.availableLetters,
            seo: makeSeo(groupedCache.totalParodies, groupedCache.availableLetters, groupedCache.popularParodies, url)
        } as const
    }

    // If a single-letter filter is provided, do a targeted query to avoid scanning the whole table.
    if (letterParam) {
        const requestedLetter = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
        try {
            let rows: ParodyRow[] = []
            if (requestedLetter === '#') {
                // names not starting with A-Z or a-z
                rows = (await db.execute(
                    `SELECT id, name, slug FROM parodies WHERE NOT ((substr(name,1,1) BETWEEN 'A' AND 'Z') OR (substr(name,1,1) BETWEEN 'a' AND 'z')) ORDER BY name COLLATE NOCASE ASC;`
                )).rows ?? []
            } else {
                const prefix = esc(requestedLetter) + '%'
                rows = (await db.execute(
                    `SELECT id, name, slug FROM parodies WHERE name LIKE '${prefix}' COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`
                )).rows ?? []
            }

            const grouped: Record<string, ParodyRow[]> = {}
            grouped[requestedLetter] = (rows as any[]).map((r) => ({ id: r.id, name: r.name ?? '', slug: r.slug ?? null }))

            const totalParodies = grouped[requestedLetter].length
            const availableLetters = Object.keys(grouped).sort()
            const popularParodies = grouped[requestedLetter].slice(0, 10).map((p) => p.name).join(', ')

            return {
                grouped,
                totalParodies,
                availableLetters,
                seo: makeSeo(totalParodies, availableLetters, popularParodies, url)
            } as const
        } catch (err) {
            console.error('Turso parodies letter query error', err)
            return {
                grouped: {},
                totalParodies: 0,
                availableLetters: [],
                seo: makeSeo(0, [], '', url)
            } as const
        }
    }

    // No letter filter: fetch full list once and cache it. This is expensive so we cache the result.
    try {
        const res = await db.execute(`SELECT id, name, slug FROM parodies ORDER BY name COLLATE NOCASE ASC;`)
        const parodies = (res.rows ?? []) as ParodyRow[]

        // Group parodies A-Z and '#'
        const grouped: Record<string, ParodyRow[]> = {}
        for (const p of parodies) {
            const name = (p.name ?? '').toString()
            const first = (name.charAt(0) || '#').toUpperCase()
            const key = /^[A-Z]$/.test(first) ? first : '#'
            if (!grouped[key]) grouped[key] = []
            grouped[key].push({ id: p.id, name, slug: p.slug ?? null })
        }

        // Ensure per-group sort (case-insensitive)
        for (const k of Object.keys(grouped)) {
            grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        }

        const totalParodies = parodies.length
        const availableLetters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1
            if (b === '#') return -1
            return a.localeCompare(b)
        })
        const popularParodies = parodies.slice(0, 10).map((p) => p.name).join(', ')

        groupedCache = { ts: now, grouped, totalParodies, availableLetters, popularParodies }

        return {
            grouped,
            totalParodies,
            availableLetters,
            seo: makeSeo(totalParodies, availableLetters, popularParodies, url)
        } as const
    } catch (err) {
        console.error('Turso parodies load error', err)
        return {
            grouped: {},
            totalParodies: 0,
            availableLetters: [],
            seo: makeSeo(0, [], '', url)
        } as const
    }
}

/** helper: build response when cache exists but user asked a letter */
function buildResponseFromCache(
    cached: {
        ts: number
        grouped: Record<string, ParodyRow[]>
        totalParodies: number
        availableLetters: string[]
        popularParodies: string
    },
    letter: string,
    url: URL
) {
    const group = cached.grouped[letter] ?? []
    const grouped: Record<string, ParodyRow[]> = {}
    grouped[letter] = group
    return {
        grouped,
        totalParodies: group.length,
        availableLetters: Object.keys(cached.grouped).sort(),
        seo: makeSeo(group.length, Object.keys(cached.grouped).sort(), group.slice(0, 10).map((g) => g.name).join(', '), url)
    } as const
}

/** helper: consistent SEO object */
function makeSeo(totalParodies: number, availableLetters: string[], popularParodies: string, url: URL) {
    return {
        title: `Browse ${totalParodies}+ Hentai Parodies A-Z | Read Hentai`,
        description: `Discover manga parodies organized alphabetically. Popular parodies: ${popularParodies.toLowerCase()}.`,
        canonical: `https://readhentai.me${url.pathname}`,
        keywords: `manga parodies, anime parodies, doujinshi, hentai parodies, ${popularParodies.toLowerCase()}`,
        ogTitle: `${totalParodies}+ Manga Parodies | Browse A-Z`,
        ogDescription: `Complete collection of manga parodies organized alphabetically. Find your favorite anime, game, and comic parodies.`,
        ogImage: 'https://readhentai.me/images/parodies-og.jpg',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Manga Parodies Collection',
            description: `Browse our collection of ${totalParodies} parodies organized alphabetically`,
            url: `https://readhentai.me${url.pathname}`,
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalParodies,
                itemListElement: [] // avoid huge payloads
            }
        }
    }
}
// ...existing code...