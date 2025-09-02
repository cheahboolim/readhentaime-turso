// src/routes/search/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const supabase = locals.supabase;
	const query = url.searchParams.get('q')?.trim() || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
	const PAGE_SIZE = 10;
	const from = (page - 1) * PAGE_SIZE;
	const to = from + PAGE_SIZE - 1;

	if (!query) {
		return {
			query,
			comics: [],
			page: 1,
			totalPages: 1,
			meta: {
				title: 'Search | NHentai',
				description: 'Search for manga on NHentai.',
				prev: null,
				next: null
			}
		};
	}

	try {
		// Search across multiple tables and collect manga IDs with scores
		const searchPromises = [
			// 1. Search by title (highest priority)
			supabase
				.from('manga')
				.select('id, title, feature_image_url, created_at')
				.ilike('title', `%${query}%`),
			
			// 2. Search by tags
			supabase
				.from('tags')
				.select('manga_tags(manga_id)')
				.ilike('name', `%${query}%`),
			
			// 3. Search by artists
			supabase
				.from('artists')
				.select('manga_artists(manga_id)')
				.ilike('name', `%${query}%`),
			
			// 4. Search by categories
			supabase
				.from('categories')
				.select('manga_categories(manga_id)')
				.ilike('name', `%${query}%`),
			
			// 5. Search by characters
			supabase
				.from('characters')
				.select('manga_characters(manga_id)')
				.ilike('name', `%${query}%`),
			
			// 6. Search by parodies
			supabase
				.from('parodies')
				.select('manga_parodies(manga_id)')
				.ilike('name', `%${query}%`),
			
			// 7. Search by groups
			supabase
				.from('groups')
				.select('manga_groups(manga_id)')
				.ilike('name', `%${query}%`),
		];

		const [
			titleResults,
			tagResults,
			artistResults,
			categoryResults,
			characterResults,
			parodyResults,
			groupResults
		] = await Promise.all(searchPromises);

		// Collect manga IDs with relevance scores
		const mangaScores = new Map<string, number>();

		// Helper function to add manga ID with score
		const addMangaScore = (mangaId: string, score: number) => {
			const currentScore = mangaScores.get(mangaId) || 0;
			mangaScores.set(mangaId, currentScore + score);
		};

		// Process title results (highest score: 100)
		if (titleResults.data) {
			titleResults.data.forEach((manga: any) => {
				addMangaScore(manga.id, 100);
			});
		}

		// Process tag results (score: 50)
		if (tagResults.data) {
			tagResults.data.forEach((tag: any) => {
				tag.manga_tags?.forEach((mt: any) => {
					addMangaScore(mt.manga_id, 50);
				});
			});
		}

		// Process category results (score: 45)
		if (categoryResults.data) {
			categoryResults.data.forEach((category: any) => {
				category.manga_categories?.forEach((mc: any) => {
					addMangaScore(mc.manga_id, 45);
				});
			});
		}

		// Process artist results (score: 40)
		if (artistResults.data) {
			artistResults.data.forEach((artist: any) => {
				artist.manga_artists?.forEach((ma: any) => {
					addMangaScore(ma.manga_id, 40);
				});
			});
		}

		// Process parody results (score: 35)
		if (parodyResults.data) {
			parodyResults.data.forEach((parody: any) => {
				parody.manga_parodies?.forEach((mp: any) => {
					addMangaScore(mp.manga_id, 35);
				});
			});
		}

		// Process character results (score: 30)
		if (characterResults.data) {
			characterResults.data.forEach((character: any) => {
				character.manga_characters?.forEach((mc: any) => {
					addMangaScore(mc.manga_id, 30);
				});
			});
		}

		// Process group results (score: 25)
		if (groupResults.data) {
			groupResults.data.forEach((group: any) => {
				group.manga_groups?.forEach((mg: any) => {
					addMangaScore(mg.manga_id, 25);
				});
			});
		}

		// Get unique manga IDs sorted by relevance score
		const mangaIds = Array.from(mangaScores.keys());
		const totalCount = mangaIds.length;

		if (mangaIds.length === 0) {
			return {
				query,
				comics: [],
				page: 1,
				totalPages: 1,
				totalResults: 0,
				meta: {
					title: `Search results for "${query}" | nHentai.pics`,
					description: `No results found for "${query}" on nHentai.`,
					prev: null,
					next: null
				}
			};
		}

		// Sort manga IDs by relevance score and creation date
		const sortedMangaIds = mangaIds.sort((a, b) => {
			const scoreA = mangaScores.get(a) || 0;
			const scoreB = mangaScores.get(b) || 0;
			return scoreB - scoreA; // Higher score first
		});

		// Apply pagination
		const paginatedMangaIds = sortedMangaIds.slice(from, from + PAGE_SIZE);

		// Fetch full manga data for the paginated results
		const { data: mangaData, error: mangaError } = await supabase
			.from('manga')
			.select('id, title, feature_image_url, created_at, slug_map(slug)')
			.in('id', paginatedMangaIds);

		if (mangaError || !mangaData) {
			console.error('Manga fetch error:', mangaError);
			throw error(500, 'Failed to fetch manga data');
		}

		// Get additional metadata
		const { data: artistsData } = await supabase
			.from('manga_artists')
			.select('manga_id, artists(name)')
			.in('manga_id', paginatedMangaIds);

		const { data: tagsData } = await supabase
			.from('manga_tags')
			.select('manga_id, tags(name)')
			.in('manga_id', paginatedMangaIds);

		// Create lookup maps
		const artistsLookup = new Map<string, string[]>();
		const tagsLookup = new Map<string, string[]>();

		artistsData?.forEach((item: any) => {
			if (!artistsLookup.has(item.manga_id)) {
				artistsLookup.set(item.manga_id, []);
			}
			artistsLookup.get(item.manga_id)?.push(item.artists.name);
		});

		tagsData?.forEach((item: any) => {
			if (!tagsLookup.has(item.manga_id)) {
				tagsLookup.set(item.manga_id, []);
			}
			tagsLookup.get(item.manga_id)?.push(item.tags.name);
		});

		// Sort manga data to match our sorted IDs and create final results
		const mangaMap = new Map(mangaData.map(m => [m.id, m]));
		const sortedManga = paginatedMangaIds
			.map(id => mangaMap.get(id))
			.filter(Boolean);

		const comics = sortedManga.map((m: any) => ({
			id: m.id,
			title: m.title,
			slug: m.slug_map?.[0]?.slug ?? '',
			featureImage: m.feature_image_url,
			author: { name: artistsLookup.get(m.id)?.[0] || 'Unknown' },
			tags: tagsLookup.get(m.id) || [],
			relevanceScore: mangaScores.get(m.id) || 0
		}));

		const totalPages = Math.ceil(totalCount / PAGE_SIZE);

		const meta = {
			title:
				page > 1
					? `Search results for "${query}" – Page ${page} | nHentai.pics`
					: `Search results for "${query}" | nHentai.pics`,
			description: `Discover ${totalCount} Hentai results for "${query}" on nHentai. Page ${page} of ${totalPages}.`,
			prev: page > 1 ? `/search?q=${encodeURIComponent(query)}&page=${page - 1}` : null,
			next: page < totalPages ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : null
		};

		return {
			query,
			comics,
			page,
			totalPages,
			totalResults: totalCount,
			meta
		};

	} catch (err) {
		console.error('Search error:', err);
		
		// Fallback to simple title search
		const { data: manga, error: mangaError, count } = await supabase
			.from('manga')
			.select('id, title, feature_image_url, slug_map(slug)', { count: 'exact' })
			.ilike('title', `%${query}%`)
			.range(from, to);

		if (mangaError || !manga) {
			throw error(500, 'Failed to search manga');
		}

		const comics = manga.map((m) => ({
			id: m.id,
			title: m.title,
			slug: m.slug_map?.[0]?.slug ?? '',
			featureImage: m.feature_image_url,
			author: { name: 'Unknown' },
			tags: [],
			relevanceScore: 0
		}));

		const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

		const meta = {
			title:
				page > 1
					? `Search results for "${query}" – Page ${page} | nHentai.pics`
					: `Search results for "${query}" | nHentai.pics`,
			description: `Discover Hentai results for "${query}" on nHentai. Page ${page} of ${totalPages}.`,
			prev: page > 1 ? `/search?q=${encodeURIComponent(query)}&page=${page - 1}` : null,
			next: page < totalPages ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : null
		};

		return {
			query,
			comics,
			page,
			totalPages,
			totalResults: count || 0,
			meta
		};
	}
};