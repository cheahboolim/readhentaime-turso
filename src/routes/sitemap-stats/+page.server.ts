// src/routes/sitemap-stats/+page.server.ts
import { getSitemapStats } from '$lib/sitemap-utils';

export async function load() {
  const stats = await getSitemapStats();
  
  return {
    stats,
    lastGenerated: new Date().toISOString()
  };
}