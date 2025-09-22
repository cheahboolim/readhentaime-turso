// src/routes/sitemaps/sitemap-manga-pages-[index]/+server.ts
import { db } from '$lib/server/db'

const SITE_URL = 'https://readhentai.me'
const URLS_PER_SITEMAP = 25000

interface SitemapUrl {
	loc: string
	lastmod?: string
	changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
	priority?: string
}

export async function GET({ params }) {
	const index = parseInt(params.index, 10)
	if (isNaN(index)) {
		return new Response('Invalid index', { status: 400 })
	}

	try {
		const urls: SitemapUrl[] = []
		const offset = index * URLS_PER_SITEMAP
		// Use Turso (SQLite) to select pages with manga_id/page_number, then batch-fetch slugs
		const q = `SELECT manga_id, page_number FROM pages WHERE manga_id IS NOT NULL ORDER BY manga_id, page_number LIMIT ${URLS_PER_SITEMAP} OFFSET ${offset};`
		const pagesRes = await db.execute(q)
		const pageRows = pagesRes?.rows ?? []

		if (pageRows.length) {
			// collect unique manga_ids to fetch slugs and created_at
			const mangaIds = Array.from(new Set(pageRows.map((r: any) => r.manga_id))).map((id) => String(id))
			const idsList = mangaIds.map((id) => `'${id.replace("'", "''")}'`).join(',')
			const metaQ = `SELECT m.id AS manga_id, m.created_at, s.slug FROM manga m LEFT JOIN slug_map s ON s.manga_id = m.id AND s.is_primary = 1 WHERE m.id IN (${idsList});`
			const metaRes = await db.execute(metaQ)
			const metaRows = (metaRes?.rows ?? []).reduce((acc: any, r: any) => {
				acc[String(r.manga_id)] = r
				return acc
			}, {})

			for (const page of pageRows) {
				const manga = metaRows[String(page.manga_id)]
				const slug = manga?.slug
				if (slug) {
					const lastmod = manga?.created_at ? new Date(manga.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
					urls.push({
						loc: `${SITE_URL}/read/${slug}/${page.page_number}`,
						lastmod,
						changefreq: 'monthly',
						priority: page.page_number === 1 ? '0.6' : '0.4'
					})
				}
			}
		}

		const sitemap = generateSitemapXML(urls)

		return new Response(sitemap, {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'public, max-age=2592000, immutable'
			}
		})
	} catch (error) {
		console.error(`Manga pages sitemap ${index} error:`, error)
		return new Response(generateSitemapXML([]), {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'public, max-age=3600'
			}
		})
	}
}

function generateSitemapXML(urls: SitemapUrl[]): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(url) => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority ? `<priority>${url.priority}</priority>` : ''}
  </url>`
	)
	.join('\n')}
</urlset>`
}
