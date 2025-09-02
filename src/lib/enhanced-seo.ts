// src/lib/enhanced-seo.ts
export interface SEOData {
	title: string
	description: string
	canonical: string
	keywords?: string
	ogTitle?: string
	ogDescription?: string
	ogImage?: string
	ogType?: string
	twitterCard?: string
	robots?: string
	jsonLd?: any
	prev?: string
	next?: string
}

export class SEOManager {
	static generateMangaPageSEO(
		manga: { title: string; tagNames?: string[] },
		slug: string,
		page: number,
		totalPages: number,
		currentImage?: string
	): SEOData {
		const baseTitle = manga.title
		const siteTitle = 'Read Hentai'

		const title =
			page === 1
				? `Read ${baseTitle} Online Free - Chapter ${page} | ${siteTitle}`
				: `${baseTitle} - Page ${page} Online Reader | ${siteTitle}`

		const description =
			page === 1
				? `Read ${baseTitle} manga online for free at Read Hentai. High quality translated manga with fast updates.${manga.tagNames?.length ? ` Available genres: ${manga.tagNames.slice(0, 3).join(', ')}.` : ''}`
				: `Continue reading ${baseTitle} - Page ${page} at Read Hentai. Free online manga reader with high quality images and fast loading.`

		const canonical = `https://readhentai.me/hentai/${slug}/${page}`

		return {
			title,
			description,
			canonical,
			keywords: [...(manga.tagNames || []), manga.title, 'manga', 'read online', 'free manga'].join(
				', '
			),
			ogTitle: title,
			ogDescription: description,
			ogImage: currentImage || '/default-manga-cover.jpg',
			ogType: 'article',
			twitterCard: 'summary_large_image',
			prev: page > 1 ? `/hentai/${slug}/${page - 1}` : undefined,
			next: page < totalPages ? `/hentai/${slug}/${page + 1}` : undefined,
			jsonLd: {
				'@context': 'https://schema.org',
				'@type': 'ComicSeries',
				name: manga.title,
				description: description,
				url: `https://readhentai.me/hentai/${slug}`,
				image: currentImage,
				genre: manga.tagNames,
				numberOfEpisodes: totalPages,
				publisher: {
					'@type': 'Organization',
					name: siteTitle,
					url: 'https://readhentai.me'
				}
			}
		}
	}

	static generateBrowsePageSEO(
		type: string,
		name: string,
		slug: string,
		page: number,
		totalPages: number,
		totalManga: number
	): SEOData {
		const typeLabel = type.charAt(0).toUpperCase() + type.slice(1, -1) // "tags" -> "Tag"
		const pageInfo = page > 1 ? ` - Page ${page}` : ''

		const title =
			page === 1
				? `${name} ${typeLabel} - ${totalManga} Manga | Read Hentai`
				: `${name} ${typeLabel} - Page ${page} of ${totalPages} | Read Hentai`

		const description = this.generateBrowseDescription(type, name, page, totalManga)

		const canonical =
			page === 1
				? `https://readhentai.me/browse/${type}/${slug}`
				: `https://readhentai.me/browse/${type}/${slug}?page=${page}`

		return {
			title,
			description,
			canonical,
			keywords: `${name.toLowerCase()}, ${type}, manga, doujinshi, hentai, adult manga, ${name.toLowerCase()} manga`,
			ogTitle: `${name} ${typeLabel} - ${totalManga} Manga`,
			ogDescription: description,
			ogType: 'website',
			prev:
				page > 1
					? page === 2
						? `/browse/${type}/${slug}`
						: `/browse/${type}/${slug}?page=${page - 1}`
					: undefined,
			next: page < totalPages ? `/browse/${type}/${slug}?page=${page + 1}` : undefined,
			jsonLd: {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: `${name} ${typeLabel} Collection`,
				description: description,
				url: canonical,
				mainEntity: {
					'@type': 'ItemList',
					numberOfItems: totalManga
				}
			}
		}
	}

	private static generateBrowseDescription(
		type: string,
		name: string,
		page: number,
		totalManga: number
	): string {
		const pageInfo = page > 1 ? ` - Page ${page}` : ''

		switch (type) {
			case 'tags':
				return `Browse ${totalManga} hentai with ${name} tag${pageInfo}. Find doujinshi and hentai manga featuring ${name.toLowerCase()} content.`
			case 'artists':
				return `Discover ${totalManga} hentai by artist ${name}${pageInfo}. Read all works from this talented hentai creator.`
			case 'parodies':
				return `Read ${totalManga} ${name} parody hentai${pageInfo}. Fan-made doujinshi and adult content based on ${name}.`
			case 'characters':
				return `Find ${totalManga} hentai featuring ${name}${pageInfo}. Browse doujinshi with this popular character.`
			case 'categories':
				return `Explore ${totalManga} hentai in ${name} category${pageInfo}. Discover content in this genre.`
			case 'languages':
				return `Read ${totalManga} hentai in ${name}${pageInfo}. Browse content in your preferred language.`
			case 'groups':
				return `Browse ${totalManga} hentai by ${name} group${pageInfo}. Quality translations and releases.`
			default:
				return `Browse ${totalManga} hentai in ${name}${pageInfo}.`
		}
	}
}
