<script lang="ts">
	export let data: {
		query: string
		comics: {
			id: string
			title: string
			slug: string
			featureImage: string
			author: { name: string }
			tags?: string[]
			relevanceScore?: number
		}[]
		page: number
		totalPages: number
		totalResults?: number
		meta: {
			title: string
			description: string
			prev: string | null
			next: string | null
		}
	}

	import TrafficStarsAd from '$lib/components/TrafficStarsAd.svelte'

	// Helper function to highlight matching terms
	function highlightMatch(text: string, query: string): string {
		if (!query.trim()) return text
		const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
		return text.replace(regex, '<mark class="bg-pink-300 text-pink-900 px-1 rounded">$1</mark>')
	}

	// Helper to check if any tag matches the search query
	function getMatchingTags(tags: string[], query: string): string[] {
		if (!query.trim() || !tags) return []
		const queryLower = query.toLowerCase()
		return tags.filter((tag) => tag.toLowerCase().includes(queryLower))
	}

	// Improved pagination logic
	function getPaginationPages(currentPage: number, totalPages: number): (number | string)[] {
		const pages: (number | string)[] = []
		const delta = 2 // Number of pages to show on each side of current page

		// Always show first page
		if (totalPages > 1) {
			pages.push(1)
		}

		// Calculate range around current page
		const rangeStart = Math.max(2, currentPage - delta)
		const rangeEnd = Math.min(totalPages - 1, currentPage + delta)

		// Add ellipsis after first page if needed
		if (rangeStart > 2) {
			pages.push('...')
		}

		// Add pages around current page
		for (let i = rangeStart; i <= rangeEnd; i++) {
			if (i !== 1 && i !== totalPages) {
				// Don't duplicate first/last pages
				pages.push(i)
			}
		}

		// Add ellipsis before last page if needed
		if (rangeEnd < totalPages - 1) {
			pages.push('...')
		}

		// Always show last page if it's different from first
		if (totalPages > 1) {
			pages.push(totalPages)
		}

		return pages
	}

	$: paginationPages = getPaginationPages(data.page, data.totalPages)
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta name="description" content={data.meta.description} />
	<link rel="canonical" href={`https://readhentai.me/search?q=${encodeURIComponent(data.query)}`}/>
	<meta name="keywords" content={`search, hentai, manga, doujinshi, adult comics, ${data.query}`} />
	<meta name="robots" content="noindex, follow" />
	{#if data.meta.prev}
		<link rel="prev" href={data.meta.prev} />
	{/if}
	{#if data.meta.next}
		<link rel="next" href={data.meta.next} />
	{/if}
	<!-- Open Graph tags -->
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={`https://readhentai.me/search?q=${encodeURIComponent(data.query)}`} />
	<meta property="og:site_name" content="Read Hentai" />
	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={data.meta.title} />
	<meta name="twitter:description" content={data.meta.description} />
	<!-- Structured Data: ItemList JSON-LD -->
	<script type="application/ld+json">
		{JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'ItemList',
			'name': data.meta.title,
			'description': data.meta.description,
			'itemListElement': data.comics.map((comic, i) => ({
				'@type': 'ListItem',
				'position': i + 1,
				'url': `https://readhentai.me/read/${comic.slug}`,
				'name': comic.title
			}))
		})}
	</script>
</svelte:head>

<main class="container mx-auto px-4 py-12">
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">
			Search results for: <span class="text-pink-500">{data.query}</span>
		</h1>
		{#if data.totalResults !== undefined}
			<p class="text-muted-foreground">
				Found {data.totalResults.toLocaleString()} result{data.totalResults !== 1 ? 's' : ''}
				{#if data.totalPages > 1}
					(Page {data.page} of {data.totalPages})
				{/if}
			</p>
		{/if}
	</div>

	{#if data.comics.length === 0}
		<div class="text-center py-12">
			<p class="text-muted-foreground mb-4">No comics found for "{data.query}"</p>
			<p class="text-sm text-muted-foreground">Try searching for:</p>
			<ul class="text-sm text-muted-foreground mt-2 space-y-1">
				<li>• Different keywords or tags</li>
				<li>• Artist names</li>
				<li>• Character names</li>
				<li>• Parody titles</li>
				<li>• Categories or genres</li>
			</ul>
		</div>
	{:else}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			{#each data.comics as comic}
				<div class="block hover:opacity-90">
					<a href={`/read/${comic.slug}`}>
						<img
							src={comic.featureImage}
							alt={comic.title}
							class="w-full h-auto rounded shadow"
							loading="lazy"
						/>
					</a>

					<div class="mt-2">
						<a href={`/read/${comic.slug}`} class="block">
							<p
								class="text-sm font-medium text-white text-center hover:text-pink-400 transition-colors"
							>
								{@html highlightMatch(comic.title, data.query)}
							</p>
						</a>

						{#if comic.author.name !== 'Unknown'}
							<p class="text-xs text-gray-400 text-center mt-1">
								by {@html highlightMatch(comic.author.name, data.query)}
							</p>
						{/if}

						<!-- Show matching tags if any -->
						{#if comic.tags && comic.tags.length > 0}
							{@const matchingTags = getMatchingTags(comic.tags, data.query)}
							{#if matchingTags.length > 0}
								<div class="flex flex-wrap gap-1 mt-2 justify-center">
									{#each matchingTags.slice(0, 3) as tag}
										<span class="text-xs bg-pink-600 text-white px-2 py-1 rounded">
											{@html highlightMatch(tag, data.query)}
										</span>
									{/each}
									{#if matchingTags.length > 3}
										<span class="text-xs text-gray-400">
											+{matchingTags.length - 3} more
										</span>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Improved Pagination -->
		{#if data.totalPages > 1}
			<div class="mt-10">
				<!-- Previous/Next navigation for mobile -->
				<div class="flex justify-between items-center mb-4 md:hidden">
					{#if data.page > 1}
						<a
							href={`/search?q=${encodeURIComponent(data.query)}&page=${data.page - 1}`}
							class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition"
						>
							← Previous
						</a>
					{:else}
						<div></div>
					{/if}

					<span class="text-sm text-gray-400">
						Page {data.page} of {data.totalPages}
					</span>

					{#if data.page < data.totalPages}
						<a
							href={`/search?q=${encodeURIComponent(data.query)}&page=${data.page + 1}`}
							class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition"
						>
							Next →
						</a>
					{:else}
						<div></div>
					{/if}
				</div>

				<!-- Full pagination for desktop -->
				<div class="hidden md:flex items-center justify-center gap-2">
					<!-- Previous button -->
					{#if data.page > 1}
						<a
							href={`/search?q=${encodeURIComponent(data.query)}&page=${data.page - 1}`}
							class="px-3 py-2 rounded border border-gray-500 text-white hover:bg-white hover:text-black transition"
						>
							← Prev
						</a>
					{/if}

					<!-- Page numbers -->
					{#each paginationPages as pageItem}
						{#if pageItem === '...'}
							<span class="px-3 py-2 text-gray-400">...</span>
						{:else}
							<a
								href={`/search?q=${encodeURIComponent(data.query)}&page=${pageItem}`}
								class="px-3 py-2 rounded border transition"
								class:bg-pink-600={data.page === pageItem}
								class:border-pink-600={data.page === pageItem}
								class:text-white={data.page === pageItem}
								class:border-gray-500={data.page !== pageItem}
								class:text-gray-300={data.page !== pageItem}
								class:hover:bg-white={data.page !== pageItem}
								class:hover:text-black={data.page !== pageItem}
							>
								{pageItem}
							</a>
						{/if}
					{/each}

					<!-- Next button -->
					{#if data.page < data.totalPages}
						<a
							href={`/search?q=${encodeURIComponent(data.query)}&page=${data.page + 1}`}
							class="px-3 py-2 rounded border border-gray-500 text-white hover:bg-white hover:text-black transition"
						>
							Next →
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</main>
