// src/lib/sitemap-utils.ts
import { supabase } from '$lib/supabaseClient';

export interface SitemapStats {
  totalManga: number;
  totalPages: number;
  totalCategories: number;
  totalBrowsePages: number;
  estimatedUrls: number;
}

export async function getSitemapStats(): Promise<SitemapStats> {
  try {
    // Get manga count
    const { count: totalManga } = await supabase
      .from('slug_map')
      .select('slug', { count: 'exact', head: true })
      .not('slug', 'is', null)
      .neq('slug', '');

    // Get pages count
    const { count: totalPages } = await supabase
      .from('pages')
      .select('id', { count: 'exact', head: true })
      .not('manga_id', 'is', null);

    // Get categories count
    const browseQueries = [
      'tags', 'artists', 'categories', 'parodies', 
      'characters', 'languages', 'groups'
    ];
    
    let totalCategories = 0;
    let totalBrowsePages = 0;

    for (const table of browseQueries) {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .not('slug', 'is', null)
        .neq('slug', '');
      
      totalCategories += count || 0;
      
      // Estimate browse pages (assuming average 5 pages per category)
      totalBrowsePages += Math.floor((count || 0) * 5);
    }

    const estimatedUrls = 
      10 + // Static pages
      totalCategories + // Category pages
      totalBrowsePages + // Paginated browse pages
      (totalManga || 0) + // Gallery pages
      (totalPages || 0); // Reading pages

    return {
      totalManga: totalManga || 0,
      totalPages: totalPages || 0,
      totalCategories,
      totalBrowsePages,
      estimatedUrls
    };
  } catch (error) {
    console.error('Error getting sitemap stats:', error);
    return {
      totalManga: 0,
      totalPages: 0,
      totalCategories: 0,
      totalBrowsePages: 0,
      estimatedUrls: 0
    };
  }
}

// Utility to generate sitemap XML
export function generateSitemapXML(urls: Array<{
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority ? `<priority>${url.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;
}

// XML escaping for URLs
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}