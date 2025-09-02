// src/routes/sitemaps/sitemap-manga-galleries-[index]/+server.ts
import { supabase } from '$lib/supabaseClient'

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
		// FIXED: Removed the .limit(1000) that was capping your results
		const { data: mangaData } = await supabase
			.from('slug_map')
			.select(
				`
        slug,
        manga_id,
        manga!inner(created_at)
      `
			)
			.not('slug', 'is', null)
			.neq('slug', '')
			.order('manga_id') // Consistent ordering
			.range(index * URLS_PER_SITEMAP, (index + 1) * URLS_PER_SITEMAP - 1)

		const urls: SitemapUrl[] = []

		if (mangaData) {
			for (const item of mangaData) {
				const manga = item.manga as any
				const lastmod = manga?.created_at
					? new Date(manga.created_at).toISOString().split('T')[0]
					: new Date().toISOString().split('T')[0]

				urls.push({
					loc: `${SITE_URL}/read/${item.slug}`,
					lastmod,
					changefreq: 'monthly',
					priority: '0.7'
				})
			}
		}

		const sitemap = generateSitemapXML(urls)

		return new Response(sitemap, {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'max-age=86400'
			}
		})
	} catch (error) {
		console.error(`Manga galleries sitemap ${index} error:`, error)
		return new Response(generateSitemapXML([]), {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'max-age=3600'
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
