export async function GET() {
    const robots = `User-agent: *
Allow: /

# Allow main content
Allow: /read/
Allow: /browse/
Allow: /p/

# Block sensitive and admin areas
Disallow: /api/
Disallow: /admin/
Disallow: /test/

# Block internal files
Disallow: /*.bak
Disallow: /*.txt

# Sitemap location
Sitemap: https://readhentai.me/sitemap.xml

# Crawl-delay for all bots
Crawl-delay: 10

# Googlebot specific
User-agent: Googlebot
Crawl-delay: 5

# Bingbot specific
User-agent: Bingbot
Crawl-delay: 10

# Yandex specific
User-agent: Yandex
Disallow: /

# Archive.org
User-agent: ia_archiver
Disallow: /
`

    return new Response(robots, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=2592000, immutable'
        }
    })
}