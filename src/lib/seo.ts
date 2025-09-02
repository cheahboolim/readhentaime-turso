// src/lib/seo.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'book';
  ogUrl?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  jsonLd?: any;
  robots?: string;
  prev?: string;
  next?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

const defaultSEO: SEOData = {
  title: 'nHentai Pics | Premium Adult Manga & Doujinshi Online',
  description: 'Read premium adult manga, doujinshi and hentai comics online free. Updated daily with high-quality translated content at nHentai.pics',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
  ogImage: '/images/og-default.jpg'
};

export const seo = writable<SEOData>(defaultSEO);

// Helper function to set SEO data with smart defaults
export function setSEO(data: Partial<SEOData>) {
  const updatedData: SEOData = {
    ...defaultSEO,
    ...data,
    // Auto-generate Open Graph fields if not provided
    ogTitle: data.ogTitle || data.title,
    ogDescription: data.ogDescription || data.description,
    ogUrl: data.ogUrl || data.canonical,
    // Auto-generate Twitter fields if not provided  
    twitterTitle: data.twitterTitle || data.title,
    twitterDescription: data.twitterDescription || data.description,
    twitterImage: data.twitterImage || data.ogImage
  };

  seo.set(updatedData);

  // Update document title in browser
  if (browser && updatedData.title) {
    document.title = updatedData.title;
  }
}

// SEO helpers for different page types
export const seoHelpers = {
  // Homepage SEO
  homepage: (page = 1) => ({
    title: page === 1 
      ? 'nHentai Pics | Read Premium Adult Manga & Doujinshi Free Online'
      : `Premium Adult Manga | Page ${page} | nHentai Pics`,
    description: page === 1
      ? 'Discover thousands of premium adult manga, doujinshi and hentai comics. Updated daily with high-quality translated content. Read free online at nHentai.pics'
      : `Browse page ${page} of premium adult manga. Thousands of high-quality doujinshi and hentai comics available free at nHentai.pics`,
    canonical: page === 1 ? 'https://nhentai.pics' : `https://nhentai.pics?page=${page}`,
    keywords: 'adult manga, doujinshi, hentai comics, free manga online, translated manga, premium adult content',
    ogImage: '/images/nhentai-home-og.jpg'
  }),

  // Manga detail page SEO
  manga: (comic: any, slug: string) => {
    const tags = comic.tags?.map((t: any) => t.name) || [];
    const artists = comic.artists?.map((a: any) => a.name) || [];
    
    return {
      title: `${comic.title} | Read Free Adult Manga | nHentai Pics`,
      description: `Read ${comic.title} online free. ${tags.length > 0 ? `Tagged with ${tags.slice(0, 3).join(', ')}.` : ''} ${artists.length > 0 ? `By ${artists[0]}.` : ''} High quality adult manga at nHentai.pics`,
      canonical: `https://nhentai.pics/manga/${slug}`,
      keywords: [comic.title, ...tags, ...artists, 'adult manga', 'read online'].join(', '),
      ogType: 'book' as const,
      ogImage: comic.feature_image_url || '/images/manga-default-og.jpg',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Book',
        'name': comic.title,
        'description': `Adult manga: ${comic.title}`,
        'genre': ['Adult', 'Manga', ...tags],
        'inLanguage': comic.languages?.[0]?.name || 'en',
        'datePublished': comic.publishedAt,
        'image': comic.feature_image_url,
        'url': `https://nhentai.pics/manga/${slug}`,
        'publisher': {
          '@type': 'Organization',
          'name': 'nHentai Pics',
          'url': 'https://nhentai.pics'
        },
        ...(artists.length > 0 && {
          'author': {
            '@type': 'Person',
            'name': artists[0]
          }
        })
      }
    };
  },

  // Manga reader page SEO
  reader: (manga: any, slug: string, currentPage: number, totalPages: number) => ({
    title: `${manga.title} - Page ${currentPage} | Online Manga Reader | nHentai Pics`,
    description: `Read ${manga.title} page ${currentPage} of ${totalPages} online. Free manga reader with high quality images and fast loading at nHentai.pics`,
    canonical: `https://nhentai.pics/manga/${slug}/read/${currentPage}`,
    keywords: `${manga.title}, page ${currentPage}, online reader, manga reader, adult manga`,
    prev: currentPage > 1 ? `/manga/${slug}/read/${currentPage - 1}` : undefined,
    next: currentPage < totalPages ? `/manga/${slug}/read/${currentPage + 1}` : undefined,
    ogImage: `/api/og/reader?slug=${slug}&page=${currentPage}`, // Dynamic OG image
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': `${manga.title} - Page ${currentPage}`,
      'description': `Reading page ${currentPage} of ${manga.title}`,
      'url': `https://nhentai.pics/manga/${slug}/read/${currentPage}`,
      'isPartOf': {
        '@type': 'Book',
        'name': manga.title,
        'url': `https://nhentai.pics/manga/${slug}`
      },
      'mainEntity': {
        '@type': 'ImageObject',
        'name': `${manga.title} - Page ${currentPage}`,
        'contentUrl': `/api/og/reader?slug=${slug}&page=${currentPage}`
      }
    }
  }),

  // Browse/category page SEO
  browse: (type: string, name: string, slug: string, page: number, totalManga: number) => {
    const typeLabels = {
      tags: 'Tag',
      artists: 'Artist', 
      categories: 'Category',
      parodies: 'Parody',
      characters: 'Character',
      languages: 'Language',
      groups: 'Group'
    };
    
    const label = typeLabels[type as keyof typeof typeLabels] || type;
    const pageInfo = page > 1 ? ` - Page ${page}` : '';
    
    return {
      title: `${name} ${label} - ${totalManga} Manga${pageInfo} | nHentai Pics`,
      description: `Browse ${totalManga} adult manga with ${name} ${label.toLowerCase()}${pageInfo}. High-quality doujinshi and hentai comics at nHentai.pics`,
      canonical: page === 1 
        ? `https://nhentai.pics/browse/${type}/${slug}`
        : `https://nhentai.pics/browse/${type}/${slug}?page=${page}`,
      keywords: `${name}, ${type}, adult manga, doujinshi, hentai comics, browse ${type}`,
      prev: page > 1 ? `/browse/${type}/${slug}${page === 2 ? '' : `?page=${page - 1}`}` : undefined,
      next: page < Math.ceil(totalManga / 10) ? `/browse/${type}/${slug}?page=${page + 1}` : undefined
    };
  },

  // Search results SEO
  search: (query: string, page: number, totalResults: number) => ({
    title: page === 1 
      ? `Search: "${query}" | nHentai Pics`
      : `Search: "${query}" - Page ${page} | nHentai Pics`,
    description: `Search results for "${query}" on nHentai Pics. Found ${totalResults} adult manga and doujinshi${page > 1 ? ` - Page ${page}` : ''}.`,
    canonical: page === 1 
      ? `https://nhentai.pics/search?q=${encodeURIComponent(query)}`
      : `https://nhentai.pics/search?q=${encodeURIComponent(query)}&page=${page}`,
    keywords: `${query}, search, adult manga, doujinshi, hentai comics`,
    robots: totalResults > 0 ? 'index, follow' : 'noindex, follow',
    prev: page > 1 ? `/search?q=${encodeURIComponent(query)}${page === 2 ? '' : `&page=${page - 1}`}` : undefined,
    next: page < Math.ceil(totalResults / 10) ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : undefined
  }),

  // Random page SEO  
  random: (page: number) => ({
    title: page === 1 
      ? 'Random Adult Manga | Discover New Comics | nHentai Pics'
      : `Random Adult Manga - Page ${page} | nHentai Pics`,
    description: 'Discover random adult manga and doujinshi. Find new comics you might have missed with our random selection at nHentai.pics',
    canonical: page === 1 
      ? 'https://nhentai.pics/random'
      : `https://nhentai.pics/random?page=${page}`,
    keywords: 'random manga, discover comics, adult manga, doujinshi, surprise me',
    robots: 'noindex, follow' // Random pages shouldn't be indexed
  })
};

// Utility to generate JSON-LD for breadcrumbs
export function generateBreadcrumbJsonLd(breadcrumbs: Array<{name: string, url: string}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': crumb.url
    }))
  };
}