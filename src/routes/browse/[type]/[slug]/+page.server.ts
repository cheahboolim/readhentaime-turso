/* eslint-disable prettier/prettier */
// src/routes/browse/[type]/[slug]/+page.server.ts - FULLY OPTIMIZED
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';

export const load: PageServerLoad = async ({ params, url }) => {
	const { type, slug } = params;
	const page = Number(url.searchParams.get('page')) || 1;
	const PAGE_SIZE = 10;
	const offset = (page - 1) * PAGE_SIZE;

	// Maps "tags" => "manga_tags", etc.
	const allowed: Record<string, string> = {
		tags: 'manga_tags',
		artists: 'manga_artists',
		categories: 'manga_categories',
		parodies: 'manga_parodies',
		characters: 'manga_characters',
		languages: 'manga_languages',
		groups: 'manga_groups'
	};

	const typeLabels: Record<string, string> = {
		tags: 'Tag',
		artists: 'Artist',
		categories: 'Category',
		parodies: 'Parody',
		characters: 'Character',
		languages: 'Language',
		groups: 'Group'
	};

	if (!(type in allowed)) {
		throw error(404, 'Invalid browse type');
	}

	const joinTable = allowed[type];
	const idField = type.endsWith('ies')
		? type.slice(0, -3) + 'y_id'
		: type.slice(0, -1) + '_id';

	// 1. Fetch the meta tag/category/language/etc. info
	const { data: meta, error: metaErr } = await supabase
		.from(type)
		.select('id, name')
		.eq('slug', slug)
		.single();

	if (metaErr || !meta) {
		throw error(404, 'Browse category not found');
	}

	// 2. Count total manga for pagination
	const { count: total, error: countErr } = await supabase
		.from(joinTable)
		.select('manga_id', { count: 'exact', head: true })
		.eq(idField, meta.id);

	if (countErr) throw error(500, 'Failed to count related manga');

	const totalPages = Math.ceil((total || 0) / PAGE_SIZE);
	const totalManga = total || 0;

	// 3. Get paginated manga IDs
	const { data: rel, error: relErr } = await supabase
		.from(joinTable)
		.select('manga_id')
		.eq(idField, meta.id)
		.order('manga_id')
		.range(offset, offset + PAGE_SIZE - 1);

	if (relErr || !rel?.length) {
		throw error(404, 'No manga found for this page');
	}

	const mangaIds = rel.map((r) => r.manga_id);

	// 4. OPTIMIZED: Batch fetch all data in parallel (6 queries instead of 50+)
	const [
		{ data: manga, error: mangaErr },
		{ data: slugs, error: slugErr },
		{ data: allArtists },
		{ data: allTags },
		{ data: allCharacters },
		{ data: allParodies }
	] = await Promise.all([
		supabase
			.from('manga')
			.select('id, title, feature_image_url')
			.in('id', mangaIds),
		supabase
			.from('slug_map')
			.select('slug, manga_id')
			.in('manga_id', mangaIds),
		supabase
			.from('manga_artists')
			.select('manga_id, artist_id(name)')
			.in('manga_id', mangaIds)
			.limit(mangaIds.length * 2),
		supabase
			.from('manga_tags')
			.select('manga_id, tag_id(name)')
			.in('manga_id', mangaIds)
			.limit(mangaIds.length * 3),
		supabase
			.from('manga_characters')
			.select('manga_id, character_id(name)')
			.in('manga_id', mangaIds)
			.limit(mangaIds.length * 2),
		supabase
			.from('manga_parodies')
			.select('manga_id, parody_id(name)')
			.in('manga_id', mangaIds)
			.limit(mangaIds.length)
	]);

	if (mangaErr || !manga) {
		throw error(500, 'Failed to fetch manga data');
	}

	if (slugErr || !slugs) {
		throw error(500, 'Failed to fetch slug mappings');
	}

	// 5. Group related data by manga_id (replaces N+1 queries)
	const relatedDataByMangaId = mangaIds.reduce((acc, mangaId) => {
		acc[mangaId] = {
			artists: (allArtists || [])
				.filter(a => a.manga_id === mangaId)
				.map(a => a.artist_id?.name)
				.filter(Boolean)
				.slice(0, 2),
			tags: (allTags || [])
				.filter(t => t.manga_id === mangaId)
				.map(t => t.tag_id?.name)
				.filter(Boolean)
				.slice(0, 3),
			characters: (allCharacters || [])
				.filter(c => c.manga_id === mangaId)
				.map(c => c.character_id?.name)
				.filter(Boolean)
				.slice(0, 2),
			parodies: (allParodies || [])
				.filter(p => p.manga_id === mangaId)
				.map(p => p.parody_id?.name)
				.filter(Boolean)
				.slice(0, 1)
		};
		return acc;
	}, {} as Record<string, any>);

	// 6. Map manga and slugs into final result with enhanced SEO data
	const comics = manga.map((item) => {
		const related = relatedDataByMangaId[item.id];
		return {
			id: item.id,
			title: item.title,
			slug: slugs.find((s) => s.manga_id === item.id)?.slug ?? '',
			featureImage: item.feature_image_url,
			author: { name: related?.artists[0] || 'Unknown' },
			seoData: {
				artists: related?.artists || [],
				tags: related?.tags || [],
				characters: related?.characters || [],
				parodies: related?.parodies || [],
				imageAlt: `${item.title}${related?.characters.length ? ` - ${related.characters[0]}` : ''}${related?.parodies.length ? ` ${related.parodies[0]} parody` : ''} hentai manga${related?.tags.length ? ` featuring ${related.tags.slice(0,2).join(' ')}` : ''} by ${related?.artists[0] || 'unknown artist'}`,
				imageTitle: `Read ${item.title} online free${related?.characters.length ? ` - ${related.characters[0]} adult manga` : ''}${related?.tags.length ? ` - ${related.tags[0]} doujinshi` : ''}`
			}
		};
	});

	// Enhanced SEO data
	const typeLabel = typeLabels[type] || type;
	const canonicalUrl = page === 1 ? 
		`https://nhentai.pics/browse/${type}/${slug}` : 
		`https://nhentai.pics/browse/${type}/${slug}?page=${page}`;

	// Get popular characters/tags for this category
	const topCharacters = comics.map(c => c.seoData.characters).flat().filter(Boolean);
	const topTags = comics.map(c => c.seoData.tags).flat().filter(Boolean);
	const topParodies = comics.map(c => c.seoData.parodies).flat().filter(Boolean);

	// Generate dynamic descriptions based on type
	const generateDescription = () => {
		const pageInfo = page > 1 ? ` - Page ${page}` : '';
		const popChars = topCharacters.slice(0,2).join(', ');
		const popTags = topTags.slice(0,3).join(', ');
		
		switch (type) {
			case 'tags':
				return `🔞 Browse ${totalManga} premium ${meta.name} hentai manga${pageInfo}. ${popChars ? `Featuring ${popChars} characters, ` : ''}free adult doujinshi with high-quality artwork. Read online instantly!`;
			case 'artists':
				return `🎨 Discover ${totalManga} exclusive hentai by artist ${meta.name}${pageInfo}. ${popTags ? `${popTags} content, ` : ''}premium adult manga collection. Free reading, no signup required!`;
			case 'parodies':
				return `📚 Read ${totalManga} ${meta.name} parody hentai${pageInfo}. ${popChars ? `${popChars} characters, ` : ''}fan-made adult doujinshi based on popular anime. Free online access!`;
			case 'characters':
				return `💕 Find ${totalManga} hentai featuring ${meta.name}${pageInfo}. ${popTags ? `${popTags} themes, ` : ''}premium adult manga with your favorite character. Read free online!`;
			case 'categories':
				return `📖 Explore ${totalManga} ${meta.name} category hentai${pageInfo}. ${popChars ? `${popChars} characters, ` : ''}curated adult manga collection. High-quality content, free access!`;
			case 'languages':
				return `🌍 Read ${totalManga} hentai in ${meta.name}${pageInfo}. ${popTags ? `${popTags} content, ` : ''}translated adult manga in your preferred language. Free online reader!`;
			case 'groups':
				return `👥 Browse ${totalManga} hentai by ${meta.name} group${pageInfo}. ${popChars ? `${popChars} characters, ` : ''}quality translations and premium releases. Read free online!`;
			default:
				return `Browse ${totalManga} hentai in ${meta.name}${pageInfo}. Free adult manga collection online.`;
		}
	};

	const socialTitle = page === 1 ? 
		`🔥 ${totalManga} ${meta.name} Hentai Manga | Free Online | NHentai` :
		`${meta.name} Hentai - Page ${page} | ${totalManga} Free Adult Manga`;

	const socialDescription = generateDescription().replace(/🔞|🎨|📚|💕|📖|🌍|👥/g, '').trim();

	const ogImages = [
		comics[0]?.featureImage,
		comics[1]?.featureImage,
		comics[2]?.featureImage,
		`/images/og-${type}-default.jpg`
	].filter(Boolean);

	return {
		type,
		slug,
		name: meta.name,
		comics,
		page,
		totalPages,
		totalManga,
		typeLabel,
		popularContent: {
			characters: [...new Set(topCharacters)].slice(0, 5),
			tags: [...new Set(topTags)].slice(0, 5),
			parodies: [...new Set(topParodies)].slice(0, 3)
		},
		seo: {
			title: page === 1 ? 
				`${meta.name} ${typeLabel} Hentai - ${totalManga} Free Adult Manga | NHentai` :
				`${meta.name} ${typeLabel} - Page ${page} | ${totalManga} Free Hentai Manga`,
			description: generateDescription(),
			canonical: canonicalUrl,
			keywords: `${meta.name.toLowerCase()}, ${type}, hentai, manga, doujinshi, adult manga, free online, ${topCharacters.slice(0,3).join(', ').toLowerCase()}, ${topTags.slice(0,3).join(', ').toLowerCase()}`,
			ogTitle: socialTitle,
			ogDescription: socialDescription,
			ogImages: ogImages,
			ogType: 'website',
			ogSiteName: 'NHentai Pics - Free Adult Manga',
			ogLocale: 'en_US',
			twitterTitle: socialTitle,
			twitterDescription: socialDescription,
			twitterCard: 'summary_large_image',
			twitterSite: '@nhentaipics',
			structuredData: {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: `${meta.name} ${typeLabel} Collection`,
				description: socialDescription,
				url: canonicalUrl,
				image: ogImages[0],
				about: {
					'@type': 'Thing',
					name: meta.name,
					description: `${typeLabel} featuring adult manga content`
				},
				mainEntity: {
					'@type': 'ItemList',
					numberOfItems: totalManga,
					itemListElement: comics.map((comic, index) => ({
						'@type': 'ListItem',
						position: (page - 1) * PAGE_SIZE + index + 1,
						item: {
							'@type': 'Book',
							'@id': `https://nhentai.pics/hentai/${comic.slug}`,
							name: comic.title,
							url: `https://nhentai.pics/hentai/${comic.slug}`,
							image: comic.featureImage,
							author: {
								'@type': 'Person',
								name: comic.author.name
							},
							genre: comic.seoData.tags,
							character: comic.seoData.characters,
							about: comic.seoData.parodies
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
							item: 'https://nhentai.pics'
						},
						{
							'@type': 'ListItem',
							position: 2,
							name: 'Browse',
							item: 'https://nhentai.pics/browse'
						},
						{
							'@type': 'ListItem',
							position: 3,
							name: typeLabel + 's',
							item: `https://nhentai.pics/p/${type}`
						},
						{
							'@type': 'ListItem',
							position: 4,
							name: meta.name,
							item: canonicalUrl
						}
					]
				}
			}
		}
	};
};