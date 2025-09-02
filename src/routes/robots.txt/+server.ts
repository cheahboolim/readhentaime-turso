// src/routes/robots.txt/+server.ts
export async function GET() {
	const robots = `User-agent: *
Allow: /

# Important content sections
Allow: /hentai/
Allow: /browse/
Allow: /p/

# Block sensitive areas
Disallow: /api/
Disallow: /admin/

# Main sitemap
Sitemap: https://readhentai.me/sitemap.xml

# Be respectful to servers
Crawl-delay: 1

# Special instructions for major bots
User-agent: Googlebot
Crawl-delay: 1

User-agent: Bingbot
Crawl-delay: 2`

	return new Response(robots, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'max-age=86400'
		}
	})
}
