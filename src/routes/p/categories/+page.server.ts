// ...existing code...
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** escape single quotes for SQL literals */
const esc = (v: string) => v.replace(/'/g, "''")

/** small in-memory cache to avoid repeated full-table reads (process lifetime) */
let groupedCache: {
    ts: number
    grouped: Record<string, { id: number | string; name: string; slug: string | null }[]>
    totalCategories: number
    availableLetters: string[]
    popularCategories: string
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
    // ?letter=A  -> return only categories under A
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
            totalCategories: cached.totalCategories,
            availableLetters: cached.availableLetters,
            seo: makeSeo(cached.totalCategories, cached.availableLetters, cached.popularCategories, url)
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
                        `SELECT id, name, slug FROM categories WHERE NOT ((substr(name,1,1) BETWEEN 'A' AND 'Z') OR (substr(name,1,1) BETWEEN 'a' AND 'z')) ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            } else {
                const prefix = esc(requestedLetter) + '%'
                rows = (
                    await db.execute(
                        `SELECT id, name, slug FROM categories WHERE name LIKE '${prefix}' COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`
                    )
                ).rows ?? []
            }

            const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
            grouped[requestedLetter] = rows.map((r: any) => ({ id: r.id, name: r.name ?? '', slug: r.slug ?? null }))

            const totalCategories = grouped[requestedLetter].length
            const availableLetters = Object.keys(grouped).sort()
            const popularCategories = grouped[requestedLetter].slice(0, 15).map((a) => a.name).join(', ')

            return {
                grouped,
                totalCategories,
                availableLetters,
                seo: makeSeo(totalCategories, availableLetters, popularCategories, url)
            } as const
        } catch (err) {
            console.error('Turso categories letter query error', err)
            return {
                grouped: {},
                totalCategories: 0,
                availableLetters: [],
                seo: makeSeo(0, [], '', url)
            } as const
        }
    }

    // No letter filter: fetch full list once and cache it.
    try {
        const res = await db.execute(`SELECT id, name, slug FROM categories ORDER BY name COLLATE NOCASE ASC;`)
        const categories = (res.rows ?? []) as { id: number | string; name: string; slug: string | null }[]

        // Group categories by A-Z or '#'
        const grouped: Record<string, { id: number | string; name: string; slug: string | null }[]> = {}
        for (const category of categories) {
            const name = (category.name ?? '').toString()
            const first = name.charAt(0).toUpperCase() || '#'
            const letter = /^[A-Z]$/.test(first) ? first : '#'
            if (!grouped[letter]) grouped[letter] = []
            grouped[letter].push({ id: category.id, name, slug: category.slug ?? null })
        }

        // Ensure group order and item sorting
        for (const k of Object.keys(grouped)) {
            grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        }

        const totalCategories = categories.length
        const availableLetters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1
            if (b === '#') return -1
            return a.localeCompare(b)
        })
        const popularCategories = categories.slice(0, 15).map((c) => c.name).join(', ')

        // cache result
        groupedCache = { ts: now, grouped, totalCategories, availableLetters, popularCategories }

        return {
            grouped,
            totalCategories,
            availableLetters,
            seo: makeSeo(totalCategories, availableLetters, popularCategories, url)
        } as const
    } catch (err) {
        console.error('Turso categories load error', err)
        return {
            grouped: {},
            totalCategories: 0,
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
        totalCategories: number
        availableLetters: string[]
        popularCategories: string
    },
    letter: string,
    url: URL
) {
    const group = cached.grouped[letter] ?? []
    const grouped: Record<string, typeof group> = {}
    grouped[letter] = group
    return {
        grouped,
        totalCategories: group.length,
        availableLetters: Object.keys(cached.grouped).sort(),
        seo: makeSeo(group.length, Object.keys(cached.grouped).sort(), group.slice(0, 15).map((g) => g.name).join(', '), url)
    } as const
}

/** helper: consistent SEO object */
function makeSeo(totalCategories: number, availableLetters: string[], popularCategories: string, url: URL) {
    return {
        title: `Browse ${totalCategories}+ Hentai Categories A-Z | Read Hentai`,
        description: `Explore ${totalCategories} hentai categories organized alphabetically. Find content by genre, theme, and more. Popular categories: ${popularCategories.toLowerCase()}.`,
        canonical: `https://readhentai.me${url.pathname}`,
        keywords: `hentai categories, hentai genres, ${popularCategories.toLowerCase()}, hentai themes, category list`,
        ogTitle: `${totalCategories}+ Hentai Categories | Browse A-Z`,
        ogDescription: `Complete collection of hentai categories organized alphabetically. Discover content by genre, theme, and more.`,
        ogImage: 'https://readhentai.me/images/categories-og.jpg',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Hentai Categories',
            description: `Browse our comprehensive collection of ${totalCategories} hentai categories organized alphabetically`,
            url: `https://readhentai.me${url.pathname}`,
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalCategories,
                itemListElement: [] // avoid large payloads; frontend can request sample
            },
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://readhentai.me' },
                    { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://readhentai.me/browse' },
                    { '@type': 'ListItem', position: 3, name: 'Categories', item: `https://readhentai.me${url.pathname}` }
                ]
            }
        }
    }
}
// ...existing code...