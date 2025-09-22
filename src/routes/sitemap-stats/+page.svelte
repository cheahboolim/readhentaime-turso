<!-- src/routes/sitemap-stats/+page.svelte -->
<script lang="ts">
	export let data: {
		stats: {
			totalManga: number
			totalPages: number
			totalCategories: number
			totalBrowsePages: number
			estimatedUrls: number
		}
		lastGenerated: string
	}

	const { stats } = data
</script>

<svelte:head>
	<title>Sitemap Statistics | Read Hentai Admin</title>
	<meta name="description" content="Sitemap statistics for ReadHentai.me" />
	<link rel="canonical" href="https://readhentai.me/sitemap-stats" />
	<meta name="keywords" content="sitemap, stats, hentai, manga, doujinshi, adult comics" />
	<meta name="robots" content="noindex, nofollow" />
	<!-- Open Graph tags -->
	<meta property="og:title" content="Sitemap Statistics | Read Hentai Admin" />
	<meta property="og:description" content="Sitemap statistics for ReadHentai.me" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://readhentai.me/sitemap-stats" />
	<meta property="og:site_name" content="Read Hentai" />
	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Sitemap Statistics | Read Hentai Admin" />
	<meta name="twitter:description" content="Sitemap statistics for ReadHentai.me" />
	<!-- Structured Data: WebPage JSON-LD -->
	<script type="application/ld+json">
		{JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			'name': 'Sitemap Statistics | Read Hentai Admin',
			'description': 'Sitemap statistics for ReadHentai.me',
			'url': 'https://readhentai.me/sitemap-stats'
		})}
	</script>
</svelte:head>

<main class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Sitemap Statistics</h1>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold mb-2">Manga Content</h2>
			<p class="text-3xl font-bold text-blue-600">{stats.totalManga.toLocaleString()}</p>
			<p class="text-sm text-gray-600">Total Manga</p>
		</div>

		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold mb-2">Reading Pages</h2>
			<p class="text-3xl font-bold text-green-600">{stats.totalPages.toLocaleString()}</p>
			<p class="text-sm text-gray-600">Individual Pages</p>
		</div>

		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold mb-2">Categories</h2>
			<p class="text-3xl font-bold text-purple-600">{stats.totalCategories.toLocaleString()}</p>
			<p class="text-sm text-gray-600">Browse Categories</p>
		</div>

		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold mb-2">Browse Pages</h2>
			<p class="text-3xl font-bold text-orange-600">{stats.totalBrowsePages.toLocaleString()}</p>
			<p class="text-sm text-gray-600">Paginated Browse</p>
		</div>

		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold mb-2">Total URLs</h2>
			<p class="text-3xl font-bold text-red-600">{stats.estimatedUrls.toLocaleString()}</p>
			<p class="text-sm text-gray-600">Estimated in Sitemap</p>
		</div>

		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold mb-2">Last Updated</h2>
			<p class="text-sm text-gray-600">{new Date(data.lastGenerated).toLocaleString()}</p>
		</div>
	</div>

	<div
		class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8"
	>
		<h3 class="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Sitemap URLs</h3>
		<ul class="space-y-2 text-sm">
			<li>
				<a href="/sitemap.xml" class="text-blue-600 hover:underline">/sitemap.xml</a> - Main sitemap
				index
			</li>
			<li>
				<a href="/sitemaps/sitemap-static.xml" class="text-blue-600 hover:underline"
					>/sitemaps/sitemap-static.xml</a
				> - Static pages
			</li>
			<li>
				<a href="/sitemaps/sitemap-browse-categories.xml" class="text-blue-600 hover:underline"
					>/sitemaps/sitemap-browse-categories.xml</a
				> - Browse categories
			</li>
			<li>
				<a href="/sitemaps/sitemap-browse-paginated.xml" class="text-blue-600 hover:underline"
					>/sitemaps/sitemap-browse-paginated.xml</a
				> - Paginated browse pages
			</li>
			<li>
				<a href="/sitemaps/sitemap-manga-galleries-0.xml" class="text-blue-600 hover:underline"
					>/sitemaps/sitemap-manga-galleries-0.xml</a
				> - Manga gallery pages
			</li>
			<li>
				<a href="/sitemaps/sitemap-manga-pages-0.xml" class="text-blue-600 hover:underline"
					>/sitemaps/sitemap-manga-pages-0.xml</a
				> - Individual reading pages
			</li>
		</ul>
	</div>

	<div
		class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6"
	>
		<h3 class="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">SEO Recommendations</h3>
		<ul class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
			<li>• Submit main sitemap.xml to Google Search Console</li>
			<li>• Monitor indexing status in GSC</li>
			<li>• Consider splitting large sitemaps if URLs exceed 50,000</li>
			<li>• Update sitemaps when adding new content</li>
			<li>• Check for 404s in sitemap URLs regularly</li>
		</ul>
	</div>
</main>
