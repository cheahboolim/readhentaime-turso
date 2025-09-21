import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** escape single quotes for SQL literals */
const esc = (v: string) => v.replace(/'/g, "''")

/** small in-memory cache to avoid repeated full-table reads (process lifetime) */
let groupedCache: {
    ts: number
    grouped: Record<string, { id: number | string; name: string; slug: string | null }[]>
    totalCharacters: number
    availableLetters: string[]
    popularCharacters: string
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const load: PageServerLoad = async ({ url }) => {
    // query params:
    // ?letter=A  -> return only characters under A
    // ?refresh=1 -> force refresh cache
    const letterParam = (url.searchParams.get('letter') ?? '').toUpperCase()
    const refresh = url.searchParams.get('refresh') === '1'
    const now = Date.now()

    // If cached and not refresh, return cached grouped or filtered view
    if (groupedCache && !refresh && now - groupedCache.ts < CACHE_TTL) {
        const cached = groupedCache
        if (letterParam) {
            const l = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
            return buildResponseFromCache(cached, l, url)
        }
        return {
            grouped: cached.grouped,
            totalCharacters: cached.totalCharacters,
            availableLetters: cached.availableLetters,
            seo: makeSeo(cached.totalCharacters, cached.availableLetters, cached.popularCharacters, url)
        } as const
    }

    // If user requested a single letter: targeted query to reduce read volume.
    if (letterParam) {
        const requestedLetter = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
        try {
            let rows: { id: number | string; name: string; slug: string | null }[] = []
            if (requestedLetter === '#') {
                // names that do NOT start with A-Z or a-z
                rows = (
                    await db.execute(
                        `SELECT id, name, slug FROM characters WHERE NOT ((substr(name,1,1) BETWEEN 'A' AND 'Z') OR (substr(name,1,1) BETWEEN 'a' AND 'z')) ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            } else {
                const prefix = esc(requestedLetter) + '%'
                rows = (
                    await db.execute(
                        `SELECT id, name, slug FROM characters WHERE name LIKE '${prefix}' COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            }

            const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
            grouped[requestedLetter] = rows.map((r: any) => ({ id: r.id, name: r.name ?? '', slug: r.slug ?? null }))

            const totalCharacters = grouped[requestedLetter].length
            const availableLetters = Object.keys(grouped).sort()
            const popularCharacters = grouped[requestedLetter].slice(0, 15).map((a) => a.name).join(', ')

            return {
                grouped,
                totalCharacters,
                availableLetters,
                seo: makeSeo(totalCharacters, availableLetters, popularCharacters, url)
            } as const
        } catch (err) {
            console.error('Turso characters letter query error', err)
            return {
                grouped: {},
                totalCharacters: 0,
                availableLetters: [],
                seo: makeSeo(0, [], '', url)
            } as const
        }
    }

    // No letter filter: fetch full list once and cache it.
    try {
        const res = await db.execute(`SELECT id, name, slug FROM characters ORDER BY name COLLATE NOCASE ASC;`)
        const characters = (res.rows ?? []) as { id: number | string; name: string; slug: string | null }[]

        // Group characters by A-Z or '#'
        const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
        for (const character of characters) {
            const name = (character.name ?? '').toString()
            const first = name.charAt(0).toUpperCase() || '#'
            const letter = /^[A-Z]$/.test(first) ? first : '#'
            if (!grouped[letter]) grouped[letter] = []
            grouped[letter].push({ id: character.id, name, slug: character.slug ?? null })
        }

        // Ensure group order and item sorting
        for (const k of Object.keys(grouped)) {
            grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        }

        const totalCharacters = characters.length
        const availableLetters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1
            if (b === '#') return -1
            return a.localeCompare(b)
        })
        const popularCharacters = characters.slice(0, 15).map((c) => c.name).join(', ')

        // cache result
        groupedCache = { ts: now, grouped, totalCharacters, availableLetters, popularCharacters }

        return {
            grouped,
            totalCharacters,
            availableLetters,
            seo: makeSeo(totalCharacters, availableLetters, popularCharacters, url)
        } as const
    } catch (err) {
        console.error('Turso characters load error', err)
        return {
            grouped: {},
            totalCharacters: 0,
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
        totalCharacters: number
        availableLetters: string[]
        popularCharacters: string
    },
    letter: string,
    url: URL
) {
    const group = cached.grouped[letter] ?? []
    const grouped: Record<string, typeof group> = {}
    grouped[letter] = group
    return {
        grouped,
        totalCharacters: group.length,
        availableLetters: Object.keys(cached.grouped).sort(),
        seo: makeSeo(group.length, Object.keys(cached.grouped).sort(), group.slice(0, 15).map((g) => g.name).join(', '), url)
    } as const
}

/** helper: consistent SEO object */
function makeSeo(totalCharacters: number, availableLetters: string[], popularCharacters: string, url: URL) {
    return {
        title: `Browse ${totalCharacters}+ Hentai Characters A-Z | Read Hentai`,
        description: `Explore ${totalCharacters} hentai characters organized alphabetically. Find your favorite characters from various hentai series. Popular characters: ${popularCharacters.toLowerCase()}.`,
        canonical: `https://readhentai.me${url.pathname}`,
        keywords: `hentai characters, anime characters, ${popularCharacters.toLowerCase()}, hentai cast, character list`,
        ogTitle: `${totalCharacters}+ Hentai Characters | Browse A-Z`,
        ogDescription: `Complete collection of hentai characters organized alphabetically. Discover characters from your favorite series.`,
        ogImage: 'https://readhentai.me/images/characters-og.jpg',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Hentai Characters',
            description: `Browse our comprehensive collection of ${totalCharacters} hentai characters organized alphabetically`,
            url: `https://readhentai.me${url.pathname}`,
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalCharacters,
                itemListElement: (groupedCache ? Object.values(groupedCache.grouped).flat().slice(0, 25) : []).map((character, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    item: {
                        '@type': 'Person',
                        name: character.name,
                        url: `https://readhentai.me/character/${character.slug}`
                    }
                }))
            },
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://readhentai.me' },
                    { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://readhentai.me/browse' },
                    { '@type': 'ListItem', position: 3, name: 'Characters', item: `https://readhentai.me${url.pathname}` }
                ]
            }
        }
    }
}