import type { PageServerLoad } from './$types'
import { supabase } from '$lib/supabaseClient'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase

	const { data: categories, error } = await supabase
		.from('categories')
		.select('id, name, slug')
		.order('name', { ascending: true })

	if (error || !categories) {
		console.error('Error loading categories:', error)
		return {
			grouped: {},
			totalCategories: 0,
			availableLetters: [],
			seo: {
				title: 'Browse Hentai Categories | Read Hentai',
				description: 'Browse hentai categories alphabetically',
				canonical: `https://readhentai.me${url.pathname}`
			}
		}
	}

	// Group categories by first letter (A-Z or '#')
	const grouped: Record<string, { id: number; name: string; slug: string | null }[]> = {}

	for (const category of categories) {
		const first = category.name[0]?.toUpperCase()
		const letter = /^[A-Z]$/.test(first) ? first : '#'

		if (!grouped[letter]) grouped[letter] = []
		grouped[letter].push(category)
	}

	// Enhanced SEO data
	const totalCategories = categories.length
	const availableLetters = Object.keys(grouped).sort()
	const popularCategories = categories
		.slice(0, 15)
		.map((c) => c.name)
		.join(', ')

	return {
		grouped,
		totalCategories,
		availableLetters,
		seo: {
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
					itemListElement: categories.slice(0, 25).map((category, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						item: {
							'@type': 'DefinedTerm',
							name: category.name,
							url: `https://readhentai.me/browse/categories/${category.slug}`,
							inDefinedTermSet: {
								'@type': 'DefinedTermSet',
								name: 'Hentai Categories'
							}
						}
					}))
				},
				breadcrumb: {
					'@type': 'BreadcrumbList',
					itemListElement: [
						{
							'@type': 'ListItem',
							position: 1,
							name: 'Home',
							item: 'https://readhentai.me'
						},
						{
							'@type': 'ListItem',
							position: 2,
							name: 'Browse',
							item: 'https://readhentai.me/browse'
						},
						{
							'@type': 'ListItem',
							position: 3,
							name: 'Categories',
							item: `https://readhentai.me${url.pathname}`
						}
					]
				}
			}
		}
	}
}
