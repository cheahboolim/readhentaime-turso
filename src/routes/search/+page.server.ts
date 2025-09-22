import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

/** basic escape for single quotes in SQL literals */
const esc = (v: string) => v.replace(/'/g, "''")

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  // Set 1-day edge cache header for search results
  if (setHeaders) {
    setHeaders({
      'Cache-Control': 'public, max-age=86400, immutable'
    })
  } else if (typeof globalThis.setHeaders === 'function') {
    globalThis.setHeaders({
      'Cache-Control': 'public, max-age=86400, immutable'
    })
  }
  const query = (url.searchParams.get('q') ?? '').trim()
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const PAGE_SIZE = 10
  const from = (page - 1) * PAGE_SIZE

  if (!query) {
    return {
      query,
      comics: [],
      page: 1,
      totalPages: 1,
      totalResults: 0,
      meta: {
        title: 'Search | Read Hentai',
        description: 'Search for manga on Read Hentai.',
        prev: null,
        next: null
      }
    }
  }

  const qEsc = esc(query)
  const perSourceLimit = 200

  try {
    // Build a UNION ALL of weighted matches (DB does aggregation + ranking)
    const unionParts = [
      // titles (highest weight)
      `SELECT id AS manga_id, 100 AS score FROM manga WHERE title LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`,
      // tags
      `SELECT mt.manga_id AS manga_id, 50 AS score FROM tags t JOIN manga_tags mt ON t.id = mt.tag_id WHERE t.name LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`,
      // artists
      `SELECT ma.manga_id AS manga_id, 40 AS score FROM artists a JOIN manga_artists ma ON a.id = ma.artist_id WHERE a.name LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`,
      // categories
      `SELECT mc.manga_id AS manga_id, 45 AS score FROM categories c JOIN manga_categories mc ON c.id = mc.category_id WHERE c.name LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`,
      // characters
      `SELECT mc2.manga_id AS manga_id, 30 AS score FROM characters ch JOIN manga_characters mc2 ON ch.id = mc2.character_id WHERE ch.name LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`,
      // parodies
      `SELECT mp.manga_id AS manga_id, 35 AS score FROM parodies p JOIN manga_parodies mp ON p.id = mp.parody_id WHERE p.name LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`,
      // groups
      `SELECT mg.manga_id AS manga_id, 25 AS score FROM groups g JOIN manga_groups mg ON g.id = mg.group_id WHERE g.name LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE LIMIT ${perSourceLimit}`
    ]

    const candidatesCTE = `WITH candidates AS (${unionParts.join(' UNION ALL ')})`
    // total distinct matches
    const countQ = `${candidatesCTE} SELECT COUNT(DISTINCT manga_id) AS cnt FROM candidates;`
    const countRes = await db.execute(countQ)
    const totalCount = Number(countRes.rows?.[0]?.cnt ?? 0)

    if (totalCount === 0) {
      const meta = {
        title: `Search results for "${query}" | readhentai.me`,
        description: `No results found for "${query}" on Read Hentai.`,
        prev: null,
        next: null
      }
      return {
        query,
        comics: [],
        page: 1,
        totalPages: 1,
        totalResults: 0,
        meta
      }
    }

    // fetch top manga_ids by aggregated score (DB sorts and limits)
    const idsQ = `${candidatesCTE}
      SELECT manga_id, SUM(score) AS relevance
      FROM candidates
      GROUP BY manga_id
      ORDER BY relevance DESC
      LIMIT ${PAGE_SIZE} OFFSET ${from};`
    const idsRes = await db.execute(idsQ)
    const paginated = (idsRes.rows ?? []) as { manga_id: any; relevance: number }[]
    const paginatedIds = paginated.map((r) => String(r.manga_id))

    if (!paginatedIds.length) {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
      const meta = {
        title: `Search results for "${query}" | readhentai.me`,
        description: `Discover ${totalCount} Hentai results for "${query}" on Read Hentai.`,
        prev: page > 1 ? `/search?q=${encodeURIComponent(query)}&page=${page - 1}` : null,
        next: page < totalPages ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : null
      }
      return { query, comics: [], page, totalPages, totalResults: totalCount, meta }
    }

    // fetch metadata in batches
    const idsList = paginatedIds.map((id) => `'${esc(String(id))}'`).join(',')
    const [mRes, sRes, artistsRes, tagsRes] = await Promise.all([
      db.execute(`SELECT id, title, feature_image_url, created_at FROM manga WHERE id IN (${idsList});`),
      db.execute(`SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`),
      db.execute(`SELECT ma.manga_id, a.name FROM manga_artists ma JOIN artists a ON ma.artist_id = a.id WHERE ma.manga_id IN (${idsList});`),
      db.execute(`SELECT mt.manga_id, t.name FROM manga_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.manga_id IN (${idsList});`)
    ])

    const mangaRows = mRes.rows ?? []
    const slugRows = sRes.rows ?? []
    const artistsRows = artistsRes.rows ?? []
    const tagsRows = tagsRes.rows ?? []

    const artistsLookup = new Map<string, string[]>()
    for (const r of artistsRows) {
      const key = String(r.manga_id)
      if (!artistsLookup.has(key)) artistsLookup.set(key, [])
      if (r.name) artistsLookup.get(key)!.push(r.name)
    }
    const tagsLookup = new Map<string, string[]>()
    for (const r of tagsRows) {
      const key = String(r.manga_id)
      if (!tagsLookup.has(key)) tagsLookup.set(key, [])
      if (r.name) tagsLookup.get(key)!.push(r.name)
    }
    const slugLookup = new Map<string, string>()
    for (const s of slugRows) slugLookup.set(String(s.manga_id), s.slug)

    // preserve order from paginatedIds
    const mangaMap = new Map(mangaRows.map((m: any) => [String(m.id), m]))
    const sortedManga = paginatedIds.map((id) => mangaMap.get(String(id))).filter(Boolean)

    const comics = (sortedManga as any[]).map((m: any) => ({
      id: m.id,
      title: m.title,
      slug: slugLookup.get(String(m.id)) ?? '',
      featureImage: m.feature_image_url,
      author: { name: (artistsLookup.get(String(m.id))?.[0]) || 'Unknown' },
      tags: tagsLookup.get(String(m.id)) || [],
      relevanceScore: paginated.find((p) => String(p.manga_id) === String(m.id))?.relevance || 0,
      created_at: m.created_at
    }))

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    const meta = {
      title: page > 1 ? `Search results for "${query}" – Page ${page} | readhentai.me` : `Search results for "${query}" | readhentai.me`,
      description: `Discover ${totalCount} Hentai results for "${query}" on Read Hentai. Page ${page} of ${totalPages}.`,
      prev: page > 1 ? `/search?q=${encodeURIComponent(query)}&page=${page - 1}` : null,
      next: page < totalPages ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : null
    }

    return { query, comics, page, totalPages, totalResults: totalCount, meta }
  } catch (err) {
    console.error('Search error (Turso):', err)
    // Fallback: cheaper title-only search (keeps behavior similar to previous fallback)
    try {
      const countRes = await db.execute(
        `SELECT COUNT(*) AS count FROM manga WHERE title LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE;`
      )
      const total = Number(countRes.rows?.[0]?.count ?? 0)
      const res = await db.execute(
        `SELECT id, title, feature_image_url FROM manga WHERE title LIKE '%' || '${qEsc}' || '%' COLLATE NOCASE ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${from};`
      )
      const rows = res.rows ?? []
      const idsList = rows.map((r: any) => `'${esc(String(r.id))}'`).join(',')
      let slugRows: any[] = []
      if (idsList) {
        const sres = await db.execute(`SELECT slug, manga_id FROM slug_map WHERE manga_id IN (${idsList});`)
        slugRows = sres.rows ?? []
      }
      const slugLookup = new Map<string, string>()
      for (const s of slugRows) slugLookup.set(String(s.manga_id), s.slug)
      const comics = (rows as any[]).map((m) => ({
        id: m.id,
        title: m.title,
        slug: slugLookup.get(String(m.id)) ?? '',
        featureImage: m.feature_image_url,
        author: { name: 'Unknown' },
        tags: [],
        relevanceScore: 0
      }))
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
      const meta = {
        title: page > 1 ? `Search results for "${query}" – Page ${page} | readhentai.me` : `Search results for "${query}" | readhentai.me`,
        description: `Discover Hentai results for "${query}" on Read Hentai. Page ${page} of ${totalPages}.`,
        prev: page > 1 ? `/search?q=${encodeURIComponent(query)}&page=${page - 1}` : null,
        next: page < totalPages ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : null
      }
      return { query, comics, page, totalPages, totalResults: total, meta }
    } catch (fallbackErr) {
      console.error('Search fallback failed:', fallbackErr)
      throw error(500, 'Failed to search manga')
    }
  }
}