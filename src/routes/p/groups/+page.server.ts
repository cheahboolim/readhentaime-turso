import type { PageServerLoad } from './$types'
import { supabase } from '$lib/supabaseClient'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase

	const { data: groups, error } = await supabase
		.from('groups')
		.select('id, name, slug')
		.order('name', { ascending: true })

	if (error || !groups) {
		console.error('Error loading groups:', error)
		return {
			grouped: {},
			totalGroups: 0,
			availableLetters: [],
			seo: {
				title: 'Browse Hentai Groups | Read Hentai',
				description: 'Browse hentai scanlation groups alphabetically',
				canonical: `https://readhentai.me${url.pathname}`
			}
		}
	}

	// Group groups by first letter (A-Z or '#')
	const grouped: Record<string, { id: number; name: string; slug: string | null }[]> = {}

	for (const group of groups) {
		const first = group.name[0]?.toUpperCase()
		const letter = /^[A-Z]$/.test(first) ? first : '#'

		if (!grouped[letter]) grouped[letter] = []
		grouped[letter].push(group)
	}

	// Enhanced SEO data
	const totalGroups = groups.length
	const availableLetters = Object.keys(grouped).sort()
	const popularGroups = groups
		.slice(0, 15)
		.map((g) => g.name)
		.join(', ')

	return {
		grouped,
		totalGroups,
		availableLetters,
		seo: {
			title: `Browse ${totalGroups}+ Hentai Groups A-Z | Read Hentai`,
			description: `Explore ${totalGroups} hentai scanlation groups organized alphabetically. Find your favorite groups and their releases. Popular groups: ${popularGroups.toLowerCase()}.`,
			canonical: `https://readhentai.me${url.pathname}`,
			keywords: `hentai groups, scanlation groups, ${popularGroups.toLowerCase()}, hentai teams, group list`,
			ogTitle: `${totalGroups}+ Hentai Groups | Browse A-Z`,
			ogDescription: `Complete collection of hentai scanlation groups organized alphabetically. Discover groups and their releases.`,
			ogImage: 'https://readhentai.me/images/groups-og.jpg',
			structuredData: {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: 'Hentai Groups',
				description: `Browse our comprehensive collection of ${totalGroups} hentai scanlation groups organized alphabetically`,
				url: `https://readhentai.me${url.pathname}`,
				mainEntity: {
					'@type': 'ItemList',
					numberOfItems: totalGroups,
					itemListElement: groups.slice(0, 25).map((group, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						item: {
							'@type': 'Organization',
							name: group.name,
							url: `https://readhentai.me/browse/groups/${group.slug}`,
							inDefinedTermSet: {
								'@type': 'DefinedTermSet',
								name: 'Hentai Groups'
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
							name: 'Groups',
							item: `https://readhentai.me${url.pathname}`
						}
					]
				}
			}
		}
	}
}
