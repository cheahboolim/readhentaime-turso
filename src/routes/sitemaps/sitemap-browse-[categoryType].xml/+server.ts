// src/routes/sitemaps/sitemap-browse-[categoryType]/+server.ts
import { supabase } from '$lib/supabaseClient'

const SITE_URL = 'https://readhentai.me'
const PAGE_SIZE = 10
const MAX_PAGES_PER_CATEGORY = 500 // Increased limit

interface SitemapUrl {
	loc: string
	lastmod?: string
	changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
	priority?: string
}

// Define the mapping for each category type
const CATEGORY_CONFIGS = {
	tags: { table: 'tags', joinTable: 'manga_tags', idField: 'tag_id' },
	artists: { table: 'artists', joinTable: 'manga_artists', idField: 'artist_id' },
	categories: { table: 'categories', joinTable: 'manga_categories', idField: 'category_id' },
	parodies: { table: 'parodies', joinTable: 'manga_parodies', idField: 'parody_id' },
	characters: { table: 'characters', joinTable: 'manga_characters', idField: 'character_id' },
	languages: { table: 'languages', joinTable: 'manga_languages', idField: 'language_id' },
	groups: { table: 'groups', joinTable: 'manga_groups', idField: 'group_id' }
}

export async function GET({ params }) {
	const categoryType = params.categoryType
	const config = CATEGORY_CONFIGS[categoryType]

	if (!config) {
		return new Response('Invalid category type', { status: 400 })
	}

	const urls: SitemapUrl[] = []

	try {
		// Get all categories/tags/etc for this type
		const { data: categories } = await supabase
			.from(config.table)
			.select('id, slug')
			.not('slug', 'is', null)
			.neq('slug', '')

		if (categories) {
			for (const category of categories) {
				// Add the main category page
				urls.push({
					loc: `${SITE_URL}/browse/${categoryType}/${category.slug}`,
					lastmod: new Date().toISOString().split('T')[0],
					changefreq: 'daily',
					priority: '0.7'
				})

				// Count total manga for this category
				const { count: totalManga } = await supabase
					.from(config.joinTable)
					.select('manga_id', { count: 'exact', head: true })
					.eq(config.idField, category.id)

				// Add paginated URLs if there are multiple pages
				if (totalManga && totalManga > PAGE_SIZE) {
					const totalPages = Math.min(Math.ceil(totalManga / PAGE_SIZE), MAX_PAGES_PER_CATEGORY)

					// Add paginated URLs (starting from page 2)
					for (let page = 2; page <= totalPages; page++) {
						urls.push({
							loc: `${SITE_URL}/browse/${categoryType}/${category.slug}?page=${page}`,
							lastmod: new Date().toISOString().split('T')[0],
							changefreq: 'weekly',
							priority: '0.5'
						})
					}
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
		console.error(`Browse ${categoryType} sitemap error:`, error)
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
