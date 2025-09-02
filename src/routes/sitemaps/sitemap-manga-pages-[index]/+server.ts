// src/routes/sitemaps/sitemap-manga-pages-[index]/+server.ts
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
		const urls: SitemapUrl[] = []
		const offset = index * URLS_PER_SITEMAP

		// FIXED: Simplified approach - get pages directly with slug information
		const { data: pageData } = await supabase
			.from('pages')
			.select(
				`
        manga_id,
        page_number,
        manga!inner(
          created_at,
          slug_map!inner(slug)
        )
      `
			)
			.not('manga_id', 'is', null)
			.order('manga_id')
			.order('page_number')
			.range(offset, offset + URLS_PER_SITEMAP - 1)

		if (pageData) {
			for (const page of pageData) {
				const manga = page.manga as any
				const slugData = manga.slug_map

				if (slugData && slugData.length > 0 && slugData[0].slug) {
					const slug = slugData[0].slug
					const lastmod = manga.created_at
						? new Date(manga.created_at).toISOString().split('T')[0]
						: new Date().toISOString().split('T')[0]

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
				'Cache-Control': 'max-age=86400'
			}
		})
	} catch (error) {
		console.error(`Manga pages sitemap ${index} error:`, error)
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
