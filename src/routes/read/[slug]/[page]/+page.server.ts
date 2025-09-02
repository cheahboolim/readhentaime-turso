/* eslint-disable prettier/prettier */
// src/routes/read/[slug]/[page]/+page.server.ts - FULLY OPTIMIZED
import { error } from '@sveltejs/kit'
import { supabase } from '$lib/supabaseClient'

// Cache for manga metadata to reduce repeated queries
let metadataCache = new Map<string, any>()
const METADATA_CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

// Cache for random comics
let cachedRandomComics: any[] | null = null
let randomComicsCacheTime = 0
const RANDOM_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function load({ params, url: _url }) {
	const slug = params.slug
	const pageNum = Number(params.page)

	// Validate page number
	if (isNaN(pageNum) || pageNum < 1) {
		throw error(404, 'Invalid page number')
	}

	// 1) Look up manga_id via slug
	const { data: slugRow, error: slugErr } = await supabase
		.from('slug_map')
		.select('manga_id')
		.eq('slug', slug)
		.single()
	if (slugErr || !slugRow) throw error(404, 'Manga not found')

	const mangaId = slugRow.manga_id

	// 2) OPTIMIZED: Check cache for metadata first
	const cacheKey = mangaId
	const now = Date.now()
	let cachedMetadata = metadataCache.get(cacheKey)

	if (!cachedMetadata || now - cachedMetadata.timestamp > METADATA_CACHE_DURATION) {
		// Fetch fresh metadata only if not cached or expired
		const [
			{ data: manga, error: mangaErr },
			{ data: artistsData },
			{ data: tagsData },
			{ data: charactersData },
			{ data: parodiesData }
		] = await Promise.all([
			supabase
				.from('manga')
				.select('id, manga_id, title, feature_image_url, created_at')
				.eq('id', mangaId)
				.single(),
			supabase.from('manga_artists').select('artist_id(name)').eq('manga_id', mangaId).limit(2),
			supabase.from('manga_tags').select('tag_id(id, name)').eq('manga_id', mangaId).limit(5),
			supabase
				.from('manga_characters')
				.select('character_id(name)')
				.eq('manga_id', mangaId)
				.limit(3),
			supabase.from('manga_parodies').select('parody_id(name)').eq('manga_id', mangaId).limit(2)
		])

		if (mangaErr || !manga) throw error(404, 'Manga record missing')

		// Process and cache metadata
		const tagNames = (tagsData || []).map((t) => t.tag_id?.name).filter(Boolean)
		const tagIds = (tagsData || []).map((t) => t.tag_id?.id).filter(Boolean)
		const characterNames = (charactersData || []).map((c) => c.character_id?.name).filter(Boolean)
		const parodyNames = (parodiesData || []).map((p) => p.parody_id?.name).filter(Boolean)
		const artistNames = (artistsData || []).map((a) => a.artist_id?.name).filter(Boolean)

		cachedMetadata = {
			manga,
			tagNames,
			tagIds,
			characterNames,
			parodyNames,
			artistNames,
			timestamp: now
		}

		metadataCache.set(cacheKey, cachedMetadata)
	}

	const { manga, tagNames, tagIds, characterNames, parodyNames, artistNames } = cachedMetadata

	// 3) Fetch page images with count
	const IMAGES_PER_PAGE = 1
	const offset = (pageNum - 1) * IMAGES_PER_PAGE

	const {
		data: pages,
		error: pagesErr,
		count
	} = await supabase
		.from('pages')
		.select('image_url', { count: 'exact' })
		.eq('manga_id', mangaId)
		.order('page_number', { ascending: true })
		.range(offset, offset + IMAGES_PER_PAGE - 1)

	if (pagesErr || !pages) throw error(500, 'Failed to load pages')

	const totalImages = count ?? pages.length
	const totalPages = Math.ceil(totalImages / IMAGES_PER_PAGE)

	// Validate that the requested page exists
	if (pageNum > totalPages) {
		throw error(404, 'Page not found')
	}

	// 4) OPTIMIZED: Use cached random comics if available
	let randomComics = []

	if (!cachedRandomComics || now - randomComicsCacheTime > RANDOM_CACHE_DURATION) {
		const RANDOM_LIMIT = 8
		const randomSeed = Math.floor(Math.random() * 1000000)

		// Try RPC first, fallback if needed
		const { data: randomManga, error: randomError } = await supabase.rpc('get_random_manga', {
			seed_value: randomSeed / 1000000,
			limit_count: RANDOM_LIMIT,
			offset_count: 0
		})

		let finalRandomManga = []

		if (randomError || !randomManga) {
			// Fallback: get random manga
			const { data: fallback, error: fallbackError } = await supabase
				.from('manga')
				.select('id, title, feature_image_url')
				.limit(RANDOM_LIMIT * 2)

			if (!fallbackError && fallback) {
				finalRandomManga = fallback
					.map((item) => ({ ...item, _sort: Math.random() }))
					.sort((a, b) => a._sort - b._sort)
					.slice(0, RANDOM_LIMIT)
					.map(({ _sort, ...item }) => item)
			}
		} else {
			finalRandomManga = randomManga
		}

		// Get slugs for the random manga
		if (finalRandomManga.length > 0) {
			const randomMangaIds = finalRandomManga.map((m: { id: string }) => m.id)
			const { data: randomSlugs, error: randomSlugError } = await supabase
				.from('slug_map')
				.select('slug, manga_id')
				.in('manga_id', randomMangaIds)

			if (!randomSlugError && randomSlugs) {
				cachedRandomComics = finalRandomManga.map(
					(item: { id: string; title: string; feature_image_url: string }) => ({
						id: item.id,
						title: item.title,
						slug: randomSlugs.find((s) => s.manga_id === item.id)?.slug ?? '',
						featureImage: item.feature_image_url,
						author: { name: 'Read N Hentai' }
					})
				)
			}
		}

		randomComicsCacheTime = now
	}

	randomComics = cachedRandomComics || []

	// 5) Enhanced SEO data generation
	const topCharacters = characterNames.slice(0, 2)
	const topTags = tagNames.slice(0, 3)
	const topParody = parodyNames[0] || ''
	const primaryArtist = artistNames[0] || ''

	// Generate enhanced image alt text for the reading page
	const generateImageAlt = (pageIndex: number) => {
		const actualPageNum = (pageNum - 1) * IMAGES_PER_PAGE + pageIndex + 1
		let alt = `${manga.title} page ${actualPageNum}`
		if (topCharacters.length > 0) alt += ` featuring ${topCharacters[0]}`
		if (topParody) alt += ` ${topParody} parody`
		if (topTags.length > 0) alt += ` - ${topTags.slice(0, 2).join(' ')} hentai manga`
		alt += ' - read online free'
		return alt
	}

	const generateImageTitle = (pageIndex: number) => {
		const actualPageNum = (pageNum - 1) * IMAGES_PER_PAGE + pageIndex + 1
		let title = `Read ${manga.title} page ${actualPageNum} online`
		if (topCharacters.length > 0) title += ` - ${topCharacters[0]} adult manga`
		if (topTags.length > 0) title += ` - ${topTags[0]} doujinshi`
		return title
	}

	// Enhanced SEO descriptions
	const generateSEODescription = () => {
		let desc = `📖 Read ${manga.title} page ${pageNum} of ${totalPages} online free! `
		if (topCharacters.length > 0) {
			desc += `${topCharacters.join(' and ')} characters`
			if (topParody) desc += ` from ${topParody}`
			desc += '. '
		}
		if (topTags.length > 0) desc += `${topTags.slice(0, 2).join(', ')} content. `
		desc += 'High-quality hentai manga reader, mobile-friendly! 🔞'
		return desc
	}

	// Social sharing optimized titles
	const socialTitle =
		pageNum === 1
			? `🔞 ${manga.title}${topCharacters.length > 0 ? ` - ${topCharacters[0]}` : ''} | Chapter 1 | Free Hentai Reader`
			: `${manga.title} - Page ${pageNum}${topCharacters.length > 0 ? ` | ${topCharacters[0]}` : ''} | Free Online`

	const socialDescription = generateSEODescription().replace(/📖|🔞/g, '').trim()

	// Keywords for meta tags
	const keywords = [
		manga.title.toLowerCase(),
		...topCharacters.map((c) => c.toLowerCase()),
		...topTags.map((t) => t.toLowerCase()),
		topParody.toLowerCase(),
		'hentai reader',
		'manga online',
		'free reading',
		`page ${pageNum}`,
		'adult manga',
		'doujinshi'
	]
		.filter(Boolean)
		.join(', ')

	// Canonical and navigation URLs
	const canonical = `https://readhentai.me/read/${slug}/${pageNum}`
	const prev = pageNum > 1 ? `/read/${slug}/${pageNum - 1}` : undefined
	const next = pageNum < totalPages ? `/read/${slug}/${pageNum + 1}` : undefined

	// Enhanced images array with SEO data
	const enhancedImages = pages.map((p, index) => ({
		url: p.image_url,
		alt: generateImageAlt(index),
		title: generateImageTitle(index),
		pageNumber: (pageNum - 1) * IMAGES_PER_PAGE + index + 1
	}))

	return {
		slug,
		manga: {
			id: manga.id,
			mangaId: manga.manga_id,
			title: manga.title,
			tagIds,
			tagNames,
			characterNames,
			parodyNames,
			artistNames,
			// SEO enhancement data
			seoData: {
				topCharacters,
				topTags,
				topParody,
				primaryArtist
			}
		},
		images: enhancedImages,
		currentPage: pageNum,
		totalPages,
		randomComics,
		// Comprehensive SEO metadata for server-side rendering
		seo: {
			title:
				pageNum === 1
					? `Read ${manga.title} Online Free${topCharacters.length > 0 ? ` - ${topCharacters[0]}` : ''} | Chapter 1 | Read Hentai`
					: `${manga.title} - Page ${pageNum}${topCharacters.length > 0 ? ` | ${topCharacters[0]}` : ''} | Free Online Reader`,
			description: generateSEODescription(),
			canonical,
			prev,
			next,
			keywords,
			// Enhanced Open Graph
			ogTitle: socialTitle,
			ogDescription: socialDescription,
			ogImage: enhancedImages[0]?.url || manga.feature_image_url,
			ogType: 'article',
			ogSiteName: 'Read Hentai Pics - Free Adult Manga Reader',
			ogLocale: 'en_US',
			// Article-specific OG tags
			articleAuthor: primaryArtist,
			articlePublishedTime: manga.created_at,
			articleSection: 'Manga Reader',
			articleTags: [...topTags, ...topCharacters, topParody].filter(Boolean),
			// Twitter Card enhancements
			twitterCard: 'summary_large_image',
			twitterTitle: socialTitle,
			twitterDescription: socialDescription,
			twitterImage: enhancedImages[0]?.url || manga.feature_image_url,
			twitterSite: '@Read Hentaipics',
			// Enhanced JSON-LD structured data
			jsonLd: {
				'@context': 'https://schema.org',
				'@type': 'ComicSeries',
				name: manga.title,
				description: socialDescription,
				url: `https://readhentai.me/read/${slug}`,
				image: enhancedImages[0]?.url || manga.feature_image_url,
				genre: topTags,
				character: topCharacters,
				numberOfEpisodes: totalPages,
				datePublished: manga.created_at,
				publisher: {
					'@type': 'Organization',
					name: 'Read Hentai Pics',
					url: 'https://readhentai.me'
				},
				author: {
					'@type': 'Person',
					name: primaryArtist || 'Unknown Artist'
				},
				about: topParody,
				episode: {
					'@type': 'ComicIssue',
					issueNumber: pageNum,
					name: `${manga.title} - Page ${pageNum}`,
					url: canonical,
					image: enhancedImages[0]?.url
				}
			}
		}
	}
}
