// ...existing code...
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** escape single quotes for SQL literals */
const esc = (v: string) => v.replace(/'/g, "''")

/** small in-memory cache to avoid repeated full-table reads (process lifetime) */
let groupedCache: {
    ts: number
    grouped: Record<string, { id: number | string; name: string; slug: string | null }[]>
    totalGroups: number
    availableLetters: string[]
    popularGroups: string
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const load: PageServerLoad = async ({ url }) => {
    // Query params:
    // ?letter=A  -> return only groups under A (targeted query)
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
            totalGroups: groupedCache.totalGroups,
            availableLetters: groupedCache.availableLetters,
            seo: makeSeo(groupedCache.totalGroups, groupedCache.availableLetters, groupedCache.popularGroups, url)
        } as const
    }

    // If a letter filter is provided, do a targeted query to avoid scanning full table
    if (letterParam) {
        const requestedLetter = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
        try {
            let rows: { id: number | string; name: string; slug: string | null }[] = []
            if (requestedLetter === '#') {
                // names that do NOT start with A-Z or a-z
                rows = (
                    await db.execute(
                        `SELECT id, name, slug FROM groups WHERE NOT ((substr(name,1,1) BETWEEN 'A' AND 'Z') OR (substr(name,1,1) BETWEEN 'a' AND 'z')) ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            } else {
                const prefix = esc(requestedLetter) + '%'
                rows = (
                    await db.execute(
                        `SELECT id, name, slug FROM groups WHERE name LIKE '${prefix}' COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            }

            const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
            grouped[requestedLetter] = rows.map((r: any) => ({ id: r.id, name: r.name ?? '', slug: r.slug ?? null }))

            const totalGroups = grouped[requestedLetter].length
            const availableLetters = Object.keys(grouped).sort()
            const popularGroups = grouped[requestedLetter].slice(0, 15).map((g) => g.name).join(', ')

            return {
                grouped,
                totalGroups,
                availableLetters,
                seo: makeSeo(totalGroups, availableLetters, popularGroups, url)
            } as const
        } catch (err) {
            console.error('Turso groups letter query error', err)
            return {
                grouped: {},
                totalGroups: 0,
                availableLetters: [],
                seo: makeSeo(0, [], '', url)
            } as const
        }
    }

    // No letter filter: fetch full list once and cache it
    try {
        const res = await db.execute(`SELECT id, name, slug FROM groups ORDER BY name COLLATE NOCASE ASC;`)
        const groups = (res.rows ?? []) as { id: number | string; name: string; slug: string | null }[]

        // Group by first letter (A-Z or '#')
        const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
        for (const g of groups) {
            const name = (g.name ?? '').toString()
            const first = name.charAt(0).toUpperCase() || '#'
            const letter = /^[A-Z]$/.test(first) ? first : '#'
            if (!grouped[letter]) grouped[letter] = []
            grouped[letter].push({ id: g.id, name, slug: g.slug ?? null })
        }

        // Ensure per-group sorting (case-insensitive)
        for (const k of Object.keys(grouped)) {
            grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        }

        const totalGroups = groups.length
        const availableLetters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1
            if (b === '#') return -1
            return a.localeCompare(b)
        })
        const popularGroups = groups.slice(0, 15).map((g) => g.name).join(', ')

        groupedCache = { ts: now, grouped, totalGroups, availableLetters, popularGroups }

        return {
            grouped,
            totalGroups,
            availableLetters,
            seo: makeSeo(totalGroups, availableLetters, popularGroups, url)
        } as const
    } catch (err) {
        console.error('Turso groups load error', err)
        return {
            grouped: {},
            totalGroups: 0,
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
        totalGroups: number
        availableLetters: string[]
        popularGroups: string
    },
    letter: string,
    url: URL
) {
    const group = cached.grouped[letter] ?? []
    const grouped: Record<string, typeof group> = {}
    grouped[letter] = group
    return {
        grouped,
        totalGroups: group.length,
        availableLetters: Object.keys(cached.grouped).sort(),
        seo: makeSeo(group.length, Object.keys(cached.grouped).sort(), group.slice(0, 15).map((g) => g.name).join(', '), url)
    } as const
}

/** helper: consistent SEO object */
function makeSeo(totalGroups: number, availableLetters: string[], popularGroups: string, url: URL) {
    return {
        title: `Browse ${totalGroups}+ Hentai Groups A-Z | Read Hentai`,
        description: `Explore ${totalGroups} hentai scanlation groups organized alphabetically. Find your favorite groups and their releases. Popular groups: ${popularGroups.toLowerCase()}.`,
        canonical: `https://readhentai.me${url.pathname}`,
        keywords: `hentai groups, scanlation groups, ${popularGroups.toLowerCase()}, hentai teams, group list`,
        ogTitle: `${totalGroups}+ Hentai Groups | Browse A-Z`,
        ogDescription: `Complete collection of hentai scanlation groups organized alphabetically. Discover groups and their releases.`,
        ogImage: 'https://readhentai.me/images/groups-og.jpg',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Hentai Groups',
            description: `Browse our comprehensive collection of ${totalGroups} hentai scanlation groups organized alphabetically`,
            url: `https://readhentai.me${url.pathname}`,
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalGroups,
                itemListElement: (groupedCache ? Object.values(groupedCache.grouped).flat().slice(0, 25) : []).map((group, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    item: {
                        '@type': 'Organization',
                        name: group.name,
                        url: `https://readhentai.me/browse/groups/${group.slug}`
                    }
                }))
            },
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://readhentai.me' },
                    { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://readhentai.me/browse' },
                    { '@type': 'ListItem', position: 3, name: 'Groups', item: `https://readhentai.me${url.pathname}` }
                ]
            }
        }
    }
}
// ...existing code...