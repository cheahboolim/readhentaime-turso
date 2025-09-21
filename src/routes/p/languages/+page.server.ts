// ...existing code...
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** escape single quotes for SQL literals */
const esc = (v: string) => v.replace(/'/g, "''")

type LangRow = { id: number | string; name: string; slug: string | null }

/** small in-memory cache to avoid repeated full-table reads (process lifetime) */
let groupedCache: {
    ts: number
    grouped: Record<string, LangRow[]>
    totalLanguages: number
    availableLetters: string[]
    popularLanguages: string
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const load: PageServerLoad = async ({ url }) => {
    // query params:
    // ?letter=A  -> return only languages under A (targeted query)
    // ?refresh=1 -> force refresh cache
    const letterParam = (url.searchParams.get('letter') ?? '').toUpperCase()
    const refresh = url.searchParams.get('refresh') === '1'
    const now = Date.now()

    // serve from cache when possible
    if (groupedCache && !refresh && now - groupedCache.ts < CACHE_TTL) {
        if (letterParam) {
            const l = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
            return buildResponseFromCache(groupedCache, l, url)
        }
        return {
            grouped: groupedCache.grouped,
            totalLanguages: groupedCache.totalLanguages,
            availableLetters: groupedCache.availableLetters,
            seo: makeSeo(groupedCache.totalLanguages, groupedCache.availableLetters, groupedCache.popularLanguages, url)
        } as const
    }

    // targeted single-letter query to reduce reads
    if (letterParam) {
        const requested = /^[A-Z]$/.test(letterParam) ? letterParam : '#'
        try {
            let rows: LangRow[] = []
            if (requested === '#') {
                // names that do NOT start with A-Z or a-z
                const q = `SELECT id, name, slug FROM languages WHERE NOT ((substr(name,1,1) BETWEEN 'A' AND 'Z') OR (substr(name,1,1) BETWEEN 'a' AND 'z')) ORDER BY name COLLATE NOCASE ASC;`
                rows = (await db.execute(q)).rows ?? []
            } else {
                const prefix = esc(requested) + '%'
                const q = `SELECT id, name, slug FROM languages WHERE name LIKE '${prefix}' COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`
                rows = (await db.execute(q)).rows ?? []
            }

            const grouped: Record<string, LangRow[]> = {}
            grouped[requested] = rows.map((r: any) => ({ id: r.id, name: r.name ?? '', slug: r.slug ?? null }))

            const totalLanguages = grouped[requested].length
            const availableLetters = Object.keys(grouped).sort()
            const popularLanguages = grouped[requested].slice(0, 15).map((l) => l.name).join(', ')

            return {
                grouped,
                totalLanguages,
                availableLetters,
                seo: makeSeo(totalLanguages, availableLetters, popularLanguages, url)
            } as const
        } catch (err) {
            console.error('Turso languages letter query error', err)
            return {
                grouped: {},
                totalLanguages: 0,
                availableLetters: [],
                seo: makeSeo(0, [], '', url)
            } as const
        }
    }

    // full list fetch (cached)
    try {
        const res = await db.execute(`SELECT id, name, slug FROM languages ORDER BY name COLLATE NOCASE ASC;`)
        const languages = (res.rows ?? []) as LangRow[]

        // group by A-Z or '#'
        const grouped: Record<string, LangRow[]> = {}
        for (const lang of languages) {
            const name = (lang.name ?? '').toString()
            const first = name.charAt(0).toUpperCase() || '#'
            const letter = /^[A-Z]$/.test(first) ? first : '#'
            if (!grouped[letter]) grouped[letter] = []
            grouped[letter].push({ id: lang.id, name, slug: lang.slug ?? null })
        }

        // ensure stable, case-insensitive sort per group
        for (const k of Object.keys(grouped)) {
            grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        }

        const totalLanguages = languages.length
        const availableLetters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1
            if (b === '#') return -1
            return a.localeCompare(b)
        })
        const popularLanguages = languages.slice(0, 15).map((l) => l.name).join(', ')

        groupedCache = { ts: now, grouped, totalLanguages, availableLetters, popularLanguages }

        return {
            grouped,
            totalLanguages,
            availableLetters,
            seo: makeSeo(totalLanguages, availableLetters, popularLanguages, url)
        } as const
    } catch (err) {
        console.error('Turso languages load error', err)
        return {
            grouped: {},
            totalLanguages: 0,
            availableLetters: [],
            seo: makeSeo(0, [], '', url)
        } as const
    }
}

/** helper: build response when cache exists but user asked a letter */
function buildResponseFromCache(
    cached: {
        ts: number
        grouped: Record<string, LangRow[]>
        totalLanguages: number
        availableLetters: string[]
        popularLanguages: string
    },
    letter: string,
    url: URL
) {
    const group = cached.grouped[letter] ?? []
    const grouped: Record<string, LangRow[]> = {}
    grouped[letter] = group
    return {
        grouped,
        totalLanguages: group.length,
        availableLetters: Object.keys(cached.grouped).sort(),
        seo: makeSeo(group.length, Object.keys(cached.grouped).sort(), group.slice(0, 15).map((g) => g.name).join(', '), url)
    } as const
}

/** helper: consistent SEO object */
function makeSeo(totalLanguages: number, availableLetters: string[], popularLanguages: string, url: URL) {
    return {
        title: `Browse ${totalLanguages}+ Hentai Languages A-Z | Read Hentai`,
        description: `Explore ${totalLanguages} hentai languages organized alphabetically. Find content in your preferred language. Popular languages: ${popularLanguages.toLowerCase()}.`,
        canonical: `https://readhentai.me${url.pathname}`,
        keywords: `hentai languages, ${popularLanguages.toLowerCase()}, hentai translations, language list`,
        ogTitle: `${totalLanguages}+ Hentai Languages | Browse A-Z`,
        ogDescription: `Complete collection of hentai languages organized alphabetically. Discover content in various languages.`,
        ogImage: 'https://readhentai.me/images/languages-og.jpg',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Hentai Languages',
            description: `Browse our comprehensive collection of ${totalLanguages} hentai languages organized alphabetically`,
            url: `https://readhentai.me${url.pathname}`,
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalLanguages,
                itemListElement: (groupedCache ? Object.values(groupedCache.grouped).flat().slice(0, 25) : []).map((language, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    item: {
                        '@type': 'DefinedTerm',
                        name: language.name,
                        url: `https://readhentai.me/language/${language.slug}`
                    }
                }))
            },
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://readhentai.me' },
                    { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://readhentai.me/browse' },
                    { '@type': 'ListItem', position: 3, name: 'Languages', item: `https://readhentai.me${url.pathname}` }
                ]
            }
        }
    }
}