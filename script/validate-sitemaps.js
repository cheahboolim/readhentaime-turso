// scripts/validate-sitemaps.js
const fetch = require('node-fetch');

const SITEMAPS = [
  'http://localhost:5173/sitemap.xml',
  'http://localhost:5173/sitemaps/sitemap-static.xml',
  'http://localhost:5173/sitemaps/sitemap-browse-categories.xml',
  'http://localhost:5173/sitemaps/sitemap-browse-paginated.xml',
  'http://localhost:5173/sitemaps/sitemap-manga-galleries-0.xml',
  'http://localhost:5173/sitemaps/sitemap-manga-pages-0.xml'
];

async function validateSitemaps() {
  console.log('🔍 Validating sitemaps...\n');
  
  for (const sitemapUrl of SITEMAPS) {
    try {
      console.log(`Testing: ${sitemapUrl}`);
      const response = await fetch(sitemapUrl);
      
      if (!response.ok) {
        console.log(`❌ Failed: ${response.status} ${response.statusText}`);
        continue;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('xml')) {
        console.log(`❌ Wrong content-type: ${contentType}`);
        continue;
      }

      const xml = await response.text();
      const urlCount = (xml.match(/<url>/g) || []).length;
      const sitemapCount = (xml.match(/<sitemap>/g) || []).length;
      
      if (urlCount > 0) {
        console.log(`✅ Valid sitemap with ${urlCount} URLs`);
      } else if (sitemapCount > 0) {
        console.log(`✅ Valid sitemap index with ${sitemapCount} sitemaps`);
      } else {
        console.log(`⚠️  Empty sitemap`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

validateSitemaps();