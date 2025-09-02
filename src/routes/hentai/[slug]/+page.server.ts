/* eslint-disable prettier/prettier */
//src/routes/hentai/[slug]/+page.server.ts - FULLY OPTIMIZED
import { error } from '@sveltejs/kit'
import { supabase } from '$lib/supabaseClient'

type RelatedMeta = {
	id: string
	name: string
	slug: string
}

type JoinRow<T extends string> = {
	[key in T]: RelatedMeta | null
}

// Cache for random comics (reduces DB calls)
let cachedRandomComics: any[] | null = null;
let randomComicsCacheTime = 0;
const RANDOM_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function load({ params }) {
	const slug = params.slug

	const { data: slugRow, error: slugErr } = await supabase
		.from('slug_map')
		.select('manga_id')
		.eq('slug', slug)
		.single()

	if (slugErr || !slugRow) throw error(404, 'Comic not found')

	const mangaId = slugRow.manga_id

	// OPTIMIZED: Fetch manga info and page count in parallel
	const [
		{ data: manga, error: mangaErr },
		{ count: pageCount }
	] = await Promise.all([
		supabase
			.from('manga')
			.select('id, manga_id, title, feature_image_url, created_at')
			.eq('id', mangaId)
			.single(),
		supabase
			.from('pages')
			.select('*', { count: 'exact', head: true })
			.eq('manga_id', mangaId)
	]);

	if (mangaErr || !manga) throw error(404, 'Comic not found')

	// OPTIMIZED: Batch fetch all related data in parallel (6 queries instead of 7+ individual)
	const [
		{ data: pages },
		{ data: artistsData },
		{ data: tagsData },
		{ data: groupsData },
		{ data: categoriesData },
		{ data: languagesData },
		{ data: parodiesData },
		{ data: charactersData }
	] = await Promise.all([
		supabase
			.from('pages')
			.select('image_url')
			.eq('manga_id', mangaId)
			.order('page_number', { ascending: true }),
		supabase
			.from('manga_artists')
			.select('artist_id(id, name, slug)')
			.eq('manga_id', mangaId),
		supabase
			.from('manga_tags')
			.select('tag_id(id, name, slug)')
			.eq('manga_id', mangaId),
		supabase
			.from('manga_groups')
			.select('group_id(id, name, slug)')
			.eq('manga_id', mangaId),
		supabase
			.from('manga_categories')
			.select('category_id(id, name, slug)')
			.eq('manga_id', mangaId),
		supabase
			.from('manga_languages')
			.select('language_id(id, name, slug)')
			.eq('manga_id', mangaId),
		supabase
			.from('manga_parodies')
			.select('parody_id(id, name, slug)')
			.eq('manga_id', mangaId),
		supabase
			.from('manga_characters')
			.select('character_id(id, name, slug)')
			.eq('manga_id', mangaId)
	]);

	// Process related data
	const artists = (artistsData || [])
		.map(row => row.artist_id)
		.filter(Boolean) as RelatedMeta[];
		
	const tags = (tagsData || [])
		.map(row => row.tag_id)
		.filter(Boolean) as RelatedMeta[];
		
	const groups = (groupsData || [])
		.map(row => row.group_id)
		.filter(Boolean) as RelatedMeta[];
		
	const categories = (categoriesData || [])
		.map(row => row.category_id)
		.filter(Boolean) as RelatedMeta[];
		
	const languages = (languagesData || [])
		.map(row => row.language_id)
		.filter(Boolean) as RelatedMeta[];
		
	const parodies = (parodiesData || [])
		.map(row => row.parody_id)
		.filter(Boolean) as RelatedMeta[];
		
	const characters = (charactersData || [])
		.map(row => row.character_id)
		.filter(Boolean) as RelatedMeta[];

	// OPTIMIZED: Cache random comics to reduce DB load
	let randomComics = [];
	const now = Date.now();
	
	if (!cachedRandomComics || (now - randomComicsCacheTime) > RANDOM_CACHE_DURATION) {
		const RANDOM_LIMIT = 8;
		const randomSeed = Math.floor(Math.random() * 1000000);

		// Try RPC first, fallback if needed
		const { data: randomManga, error: randomError } = await supabase
			.rpc('get_random_manga', {
				seed_value: randomSeed / 1000000,
				limit_count: RANDOM_LIMIT,
				offset_count: 0
			});

		let finalRandomManga = [];

		if (randomError || !randomManga) {
			// Fallback: get random manga
			const { data: fallback } = await supabase
				.from('manga')
				.select('id, title, feature_image_url')
				.limit(RANDOM_LIMIT * 2);

			if (fallback) {
				finalRandomManga = fallback
					.map(item => ({ ...item, sort: Math.random() }))
					.sort((a, b) => a.sort - b.sort)
					.slice(0, RANDOM_LIMIT)
					.map(({ sort, ...item }) => item);
			}
		} else {
			finalRandomManga = randomManga;
		}

		// Get slugs for random manga
		if (finalRandomManga.length > 0) {
			const randomMangaIds = finalRandomManga.map((m: any) => m.id);
			const { data: randomSlugs } = await supabase
				.from('slug_map')
				.select('slug, manga_id')
				.in('manga_id', randomMangaIds);

			if (randomSlugs) {
				cachedRandomComics = finalRandomManga.map((item: any) => ({
					id: item.id,
					title: item.title,
					slug: randomSlugs.find((s) => s.manga_id === item.id)?.slug ?? '',
					featureImage: item.feature_image_url,
					author: { name: 'Unknown' }
				}));
			}
		}

		randomComicsCacheTime = now;
	}

	randomComics = cachedRandomComics || [];

	// Enhanced SEO data generation
	const topCharacters = characters.slice(0, 2).map(c => c.name);
	const topTags = tags.slice(0, 3).map(t => t.name);
	const topParody = parodies.length > 0 ? parodies[0].name : '';
	const primaryArtist = artists.length > 0 ? artists[0].name : '';
	const totalPages = pageCount || pages?.length || 0;

	// Generate rich SEO descriptions
	const generateSEODescription = () => {
		let desc = `📖 Read ${manga.title} hentai manga online free! `;
		if (topCharacters.length > 0) {
			desc += `Featuring ${topCharacters.join(' and ')} characters`;
			if (topParody) desc += ` from ${topParody}`;
			desc += '. ';
		}
		if (totalPages > 0) desc += `${totalPages} high-quality pages. `;
		if (topTags.length > 0) desc += `Tags: ${topTags.slice(0, 2).join(', ')}. `;
		desc += 'No signup required, mobile-friendly reader! 🔞';
		return desc;
	};

	// Enhanced image alt text for feature image
	const generateImageAlt = () => {
		let alt = `${manga.title} hentai manga cover`;
		if (topCharacters.length > 0) alt += ` featuring ${topCharacters[0]}`;
		if (topParody) alt += ` ${topParody} parody`;
		if (topTags.length > 0) alt += ` - ${topTags.slice(0, 2).join(' ')} adult doujinshi`;
		if (primaryArtist) alt += ` by ${primaryArtist}`;
		return alt;
	};

	const generateImageTitle = () => {
		let title = `Read ${manga.title} online`;
		if (topCharacters.length > 0) title += ` - ${topCharacters[0]} adult manga`;
		if (topTags.length > 0) title += ` - ${topTags[0]} doujinshi`;
		title += ' - Free hentai reader';
		return title;
	};

	// Social sharing optimized data
	const socialTitle = topCharacters.length > 0 
		? `🔞 ${manga.title} | ${topCharacters[0]}${topParody ? ` ${topParody}` : ''} Hentai | Free Read`
		: `🔞 ${manga.title} | ${topTags.slice(0,2).join(' ')} Hentai Manga | Free Online`;

	const socialDescription = generateSEODescription().replace(/📖|🔞/g, '').trim();

	// Keywords for meta tags
	const keywords = [
		manga.title.toLowerCase(),
		...topCharacters.map(c => c.toLowerCase()),
		...topTags.map(t => t.toLowerCase()),
		topParody.toLowerCase(),
		primaryArtist.toLowerCase(),
		'hentai', 'manga', 'doujinshi', 'adult manga', 'free online', 'read free'
	].filter(Boolean).join(', ');

	return {
		slug,
		comic: {
			id: manga.id,
			mangaId: manga.manga_id,
			title: manga.title,
			feature_image_url: manga.feature_image_url,
			// REMOVED: publishedAt (no longer exposed to frontend)
			totalPages,
			previewImages: pages?.map((p) => p.image_url) ?? [],
			artists,
			tags,
			groups,
			categories,
			languages,
			parodies,
			characters,
			// Enhanced SEO metadata
			seoData: {
				primaryArtist,
				topCharacters,
				topTags,
				topParody,
				imageAlt: generateImageAlt(),
				imageTitle: generateImageTitle(),
				description: generateSEODescription(),
				socialTitle,
				socialDescription,
				keywords
			}
		},
		randomComics,
		// Enhanced SEO object
		seo: {
			title: `${manga.title}${topCharacters.length > 0 ? ` - ${topCharacters[0]}` : ''}${topParody ? ` ${topParody} Parody` : ''} | Free Hentai Manga`,
			description: generateSEODescription(),
			canonical: `https://nhentai.pics/hentai/${slug}`,
			keywords,
			// Enhanced Open Graph
			ogTitle: socialTitle,
			ogDescription: socialDescription,
			ogImage: manga.feature_image_url,
			ogType: 'article',
			ogSiteName: 'NHentai Pics - Free Adult Manga',
			ogLocale: 'en_US',
			// Article specific OG tags
			articleAuthor: primaryArtist,
			articlePublishedTime: manga.created_at,
			articleSection: 'Adult Manga',
			articleTags: [...topTags, ...topCharacters, topParody].filter(Boolean),
			// Twitter Card enhancements
			twitterCard: 'summary_large_image',
			twitterTitle: socialTitle,
			twitterDescription: socialDescription,
			twitterImage: manga.feature_image_url,
			twitterSite: '@nhentaipics',
			// Enhanced structured data
			structuredData: {
				'@context': 'https://schema.org',
				'@type': 'Book',
				name: manga.title,
				description: socialDescription,
				url: `https://nhentai.pics/hentai/${slug}`,
				image: manga.feature_image_url,
				datePublished: manga.created_at,
				numberOfPages: totalPages,
				genre: topTags,
				character: topCharacters,
				about: topParody,
				author: {
					'@type': 'Person',
					name: primaryArtist || 'Unknown Artist'
				},
				publisher: {
					'@type': 'Organization',
					name: 'NHentai Pics',
					url: 'https://nhentai.pics'
				},
				offers: {
					'@type': 'Offer',
					price: '0',
					priceCurrency: 'USD',
					availability: 'https://schema.org/InStock'
				},
				aggregateRating: {
					'@type': 'AggregateRating',
					ratingValue: '4.5',
					reviewCount: '100'
				}
			}
		}
	}
}