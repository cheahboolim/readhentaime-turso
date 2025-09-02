import type { PageServerLoad } from './$types'
import { supabase } from '$lib/supabaseClient'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase

	const { data: characters, error } = await supabase
		.from('characters')
		.select('id, name, slug')
		.order('name', { ascending: true })

	if (error || !characters) {
		console.error('Error loading characters:', error)
		return {
			grouped: {},
			totalCharacters: 0,
			availableLetters: [],
			seo: {
				title: 'Browse Hentai Characters | Read Hentai',
				description: 'Browse hentai characters alphabetically',
				canonical: `https://readhentai.me${url.pathname}`
			}
		}
	}

	// Group characters by first letter (A-Z or '#')
	const grouped: Record<string, { id: number; name: string; slug: string | null }[]> = {}

	for (const character of characters) {
		const first = character.name[0]?.toUpperCase()
		const letter = /^[A-Z]$/.test(first) ? first : '#'

		if (!grouped[letter]) grouped[letter] = []
		grouped[letter].push(character)
	}

	// Enhanced SEO data
	const totalCharacters = characters.length
	const availableLetters = Object.keys(grouped).sort()
	const popularCharacters = characters
		.slice(0, 15)
		.map((c) => c.name)
		.join(', ')

	return {
		grouped,
		totalCharacters,
		availableLetters,
		seo: {
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
					itemListElement: characters.slice(0, 25).map((character, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						item: {
							'@type': 'Person',
							name: character.name,
							url: `https://readhentai.me/character/${character.slug}`,
							inDefinedTermSet: {
								'@type': 'DefinedTermSet',
								name: 'Hentai Characters'
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
							name: 'Characters',
							item: `https://readhentai.me${url.pathname}`
						}
					]
				}
			}
		}
	}
}
