// src/routes/sitemap.xml/+server.ts
import { supabase } from '$lib/supabaseClient'

const SITE_URL = 'https://readhentai.me'
	const URLS_PER_SITEMAP = 25000 // Google max is 50,000, but 25k is safer for performance

export async function GET() {
	try {
		const sitemaps = []

		// Static pages sitemap
		sitemaps.push({
			loc: `${SITE_URL}/sitemaps/sitemap-static.xml`,
			lastmod: new Date().toISOString().split('T')[0]
		})

		// Browse categories sitemaps (one per category type)
		const categoryTypes = [
			'tags',
			'artists',
			'categories',
			'parodies',
			'characters',
			'languages',
			'groups'
		]
		for (const categoryType of categoryTypes) {
			sitemaps.push({
				loc: `${SITE_URL}/sitemaps/sitemap-browse-${categoryType}.xml`,
				lastmod: new Date().toISOString().split('T')[0]
			})
		}

		// Manga galleries sitemap (chunked)
		const { count: totalManga } = await supabase
			.from('slug_map')
			.select('slug', { count: 'exact', head: true })
			.not('slug', 'is', null)
			.neq('slug', '')

		const galleryChunks = Math.ceil((totalManga || 0) / URLS_PER_SITEMAP)
		for (let i = 0; i < galleryChunks; i++) {
			sitemaps.push({
				loc: `${SITE_URL}/sitemaps/sitemap-manga-galleries-${i}.xml`,
				lastmod: new Date().toISOString().split('T')[0]
			})
		}

		// Reading pages sitemaps (chunked)
		const { count: totalPages } = await supabase
			.from('pages')
			.select('id', { count: 'exact', head: true })
			.not('manga_id', 'is', null)

		// Remove artificial cap, allow up to 50,000 sitemaps (Google limit)
		const pageChunks = Math.ceil((totalPages || 0) / URLS_PER_SITEMAP)
		const maxChunks = Math.min(pageChunks, 50000)

		for (let i = 0; i < maxChunks; i++) {
			sitemaps.push({
				loc: `${SITE_URL}/sitemaps/sitemap-manga-pages-${i}.xml`,
				lastmod: new Date().toISOString().split('T')[0]
			})
		}

		const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
	.map(
		(sitemap) => `  <sitemap>
    <loc>${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
	)
	.join('\n')}
</sitemapindex>`

		return new Response(sitemapIndex, {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'public, max-age=2592000, immutable'
			}
		})
	} catch (error) {
		console.error('Sitemap index generation error:', error)

		// Fallback minimal sitemap
		const fallbackSitemaps = [
			{
				loc: `${SITE_URL}/sitemaps/sitemap-static.xml`,
				lastmod: new Date().toISOString().split('T')[0]
			}
		]

		const fallbackIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fallbackSitemaps
	.map(
		(sitemap) => `  <sitemap>
    <loc>${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
	)
	.join('\n')}
</sitemapindex>`

		return new Response(fallbackIndex, {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'public, max-age=3600'
			},
			status: 500
		})
	}
}
