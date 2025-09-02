<script lang="ts">
	import { seo } from '$lib/seo.ts'
	import NativeAds from '$lib/components/adsterra/NativeAds.svelte'
	import TrafficStarsAd from '$lib/components/TrafficStarsAd.svelte'
	import { page } from '$app/stores'

	export let data: {
		type: string
		slug: string
		name: string
		typeLabel: string
		totalManga: number
		popularContent: {
			characters: string[]
			tags: string[]
			parodies: string[]
		}
		comics: {
			id: string
			title: string
			slug: string
			featureImage: string
			author: { name: string }
			seoData: {
				artists: string[]
				tags: string[]
				characters: string[]
				parodies: string[]
				imageAlt: string
				imageTitle: string
			}
		}[]
		page: number
		totalPages: number
		seo: {
			title: string
			description: string
			canonical: string
			keywords: string
			ogTitle: string
			ogDescription: string
			ogImages: string[]
			ogType: string
			ogSiteName: string
			ogLocale: string
			twitterTitle: string
			twitterDescription: string
			twitterCard: string
			twitterSite: string
			structuredData: any
		}
	}

	// SEO setup
	seo.set(data.seo)

	// Pagination helpers
	$: showingStart = (data.page - 1) * 10 + 1
	$: showingEnd = Math.min(data.page * 10, data.totalManga)
	$: hasNextPage = data.page < data.totalPages
	$: hasPrevPage = data.page > 1

	// Generate pagination range for better UX
	$: paginationRange = (() => {
		const range = []
		const current = data.page
		const total = data.totalPages

		// Always show first page
		if (current > 3) range.push(1)
		if (current > 4) range.push('...')

		// Show pages around current
		for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
			range.push(i)
		}

		// Show last pages
		if (current < total - 3) range.push('...')
		if (current < total - 2) range.push(total)

		return range
	})()

	// Share functionality
	let showShareOptions = false

	function copyPageUrl() {
		navigator.clipboard.writeText(window.location.href)
		// Show feedback
		const button = document.querySelector('[data-copy-button]')
		if (button) {
			const originalText = button.textContent
			button.textContent = '✅ Copied!'
			setTimeout(() => {
				button.textContent = originalText
			}, 2000)
		}
	}

	function shareToTwitter() {
		const text = `🔥 Check out these ${data.name} hentai manga! ${data.totalManga} free titles available.`
		const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`
		window.open(url, '_blank', 'width=550,height=420')
	}

	function shareToReddit() {
		const title = `${data.name} ${data.typeLabel} - ${data.totalManga} Free Manga Collection`
		const url = `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(window.location.href)}`
		window.open(url, '_blank')
	}
</script>

<svelte:head>
	<title>{data.seo.title}</title>
	<meta name="description" content={data.seo.description} />
	<meta name="keywords" content={data.seo.keywords} />
	<link rel="canonical" href={data.seo.canonical} />

	<!-- Enhanced Open Graph -->
	<meta property="og:type" content={data.seo.ogType} />
	<meta property="og:site_name" content={data.seo.ogSiteName} />
	<meta property="og:locale" content={data.seo.ogLocale} />
	<meta property="og:url" content={data.seo.canonical} />
	<meta property="og:title" content={data.seo.ogTitle} />
	<meta property="og:description" content={data.seo.ogDescription} />

	<!-- Multiple OG Images -->
	{#each data.seo.ogImages.slice(0, 4) as ogImage}
		<meta property="og:image" content={ogImage} />
		<meta property="og:image:secure_url" content={ogImage} />
	{/each}
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="{data.name} {data.typeLabel.toLowerCase()} hentai manga collection"
	/>

	<!-- Enhanced Twitter Cards -->
	<meta name="twitter:card" content={data.seo.twitterCard} />
	<meta name="twitter:site" content={data.seo.twitterSite} />
	<meta name="twitter:title" content={data.seo.twitterTitle} />
	<meta name="twitter:description" content={data.seo.twitterDescription} />
	<meta name="twitter:image" content={data.seo.ogImages[0]} />

	<!-- Additional SEO -->
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="author" content="Read Hentai Pics" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<!-- Pagination SEO -->
	{#if hasPrevPage}
		<link
			rel="prev"
			href={`/browse/${data.type}/${data.slug}${data.page === 2 ? '' : `?page=${data.page - 1}`}`}
		/>
	{/if}
	{#if hasNextPage}
		<link rel="next" href={`/browse/${data.type}/${data.slug}?page=${data.page + 1}`} />
	{/if}

	<!-- Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify(data.seo.structuredData)}</script>`}
</svelte:head>

<main class="container mx-auto px-4 py-8 max-w-7xl">
	<!-- Breadcrumb Navigation -->
	<nav aria-label="Breadcrumb" class="mb-6">
		<ol class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
			<li><a href="/" class="hover:text-pink-500 transition-colors">Home</a></li>
			<li class="text-gray-400">/</li>
			<li><a href="/browse" class="hover:text-pink-500 transition-colors">Browse</a></li>
			<li class="text-gray-400">/</li>
			<li>
				<a href={`/p/${data.type}`} class="hover:text-pink-500 transition-colors capitalize"
					>{data.type}</a
				>
			</li>
			<li class="text-gray-400">/</li>
			<li class="text-pink-500 font-medium" aria-current="page">{data.name}</li>
		</ol>
	</nav>

	<!-- Header Section with Enhanced SEO -->
	<header class="mb-8">
		<h1 class="text-3xl md:text-4xl font-bold mb-4">
			<span class="text-gray-800 dark:text-gray-200 capitalize">{data.typeLabel}:</span>
			<span class="text-pink-500 ml-2">{data.name}</span>
		</h1>

		<!-- Results Summary -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
			<p class="text-gray-600 dark:text-gray-300">
				{data.totalManga} manga found • Showing {showingStart}-{showingEnd} of {data.totalManga}
				{#if data.page > 1}• Page {data.page} of {data.totalPages}{/if}
			</p>

			{#if data.totalPages > 1}
				<div class="text-sm text-gray-500 dark:text-gray-400">
					Page {data.page} of {data.totalPages}
				</div>
			{/if}
		</div>

		<!-- Enhanced SEO Content Section -->
		<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
			<h2 class="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
				About {data.name}
				{data.typeLabel}
			</h2>
			<div class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2">
				{#if data.type === 'tags'}
					<p>
						Discover <strong>{data.totalManga} premium {data.name} hentai manga</strong> in our
						curated collection. This tag features high-quality adult doujinshi with detailed artwork
						and engaging storylines.
						{#if data.popularContent.characters.length > 0}
							Popular characters include <strong
								>{data.popularContent.characters.slice(0, 3).join(', ')}</strong
							>.
						{/if}
					</p>
				{:else if data.type === 'artists'}
					<p>
						Explore the complete works of <strong>artist {data.name}</strong> featuring
						<strong>{data.totalManga} exclusive manga titles</strong>. Known for exceptional art
						quality and unique storytelling style.
						{#if data.popularContent.tags.length > 0}
							Specializes in <strong>{data.popularContent.tags.slice(0, 3).join(', ')}</strong> content.
						{/if}
					</p>
				{:else if data.type === 'parodies'}
					<p>
						Read <strong>{data.totalManga} fan-made {data.name} parody hentai</strong> created by
						talented artists. These adult doujinshi reimagine beloved characters in new scenarios.
						{#if data.popularContent.characters.length > 0}
							Features <strong>{data.popularContent.characters.slice(0, 3).join(', ')}</strong> and other
							popular characters.
						{/if}
					</p>
				{:else if data.type === 'characters'}
					<p>
						Find <strong>{data.totalManga} hentai manga featuring {data.name}</strong> in various
						scenarios and art styles. This beloved character appears in high-quality adult doujinshi
						across multiple genres.
						{#if data.popularContent.tags.length > 0}
							Common themes include <strong
								>{data.popularContent.tags.slice(0, 3).join(', ')}</strong
							>.
						{/if}
					</p>
				{:else if data.type === 'categories'}
					<p>
						Browse <strong>{data.totalManga} manga in the {data.name} category</strong>. This genre
						offers diverse storylines and art styles within the adult manga spectrum.
						{#if data.popularContent.characters.length > 0}
							Features characters like <strong
								>{data.popularContent.characters.slice(0, 2).join(', ')}</strong
							>.
						{/if}
					</p>
				{:else if data.type === 'languages'}
					<p>
						Access <strong>{data.totalManga} hentai manga translated in {data.name}</strong>.
						Professional translations ensure you enjoy content in your preferred language with
						cultural context preserved.
					</p>
				{:else if data.type === 'groups'}
					<p>
						Discover <strong
							>{data.totalManga} manga releases by {data.name} scanlation group</strong
						>. Known for quality translations and timely releases of popular adult manga series.
					</p>
				{/if}

				<!-- Popular Content Tags -->
				{#if data.popularContent.tags.length > 0}
					<div class="mt-3">
						<h3 class="font-medium mb-2">Popular Tags in This Collection:</h3>
						<div class="flex flex-wrap gap-2">
							{#each data.popularContent.tags.slice(0, 8) as tag}
								<span
									class="bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 px-2 py-1 rounded text-xs"
								>
									{tag}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- FIXED Share Section -->
		<div
			class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6"
		>
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">
						💾 Love this collection? Save it for later!
					</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Copy the URL or share with friends (discretely)
					</p>
				</div>

				<div class="flex items-center gap-3">
					<button
						data-copy-button
						on:click={copyPageUrl}
						class="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
					>
						📋 Copy URL
					</button>

					<!-- FIXED: Added data-share-container attribute -->
					<div class="relative" data-share-container>
						<button
							on:click={() => (showShareOptions = !showShareOptions)}
							class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium"
						>
							🔗 Share
						</button>

						{#if showShareOptions}
							<div
								class="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[150px]"
							>
								<button
									on:click={shareToTwitter}
									class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
								>
									🐦 Twitter
								</button>
								<button
									on:click={shareToReddit}
									class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
								>
									🔴 Reddit
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Manga Grid with Enhanced Image SEO -->
	{#if data.comics.length > 0}
		<section aria-label="Manga collection" class="mb-8">
			<h2 class="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">
				{data.name} Hentai Manga Collection
			</h2>
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
				{#each data.comics as comic, index}
					<article class="group">
						<a
							href={`/hentai/${comic.slug}`}
							class="block hover:opacity-90 transition-opacity duration-200 focus:ring-2 focus:ring-pink-500 focus:outline-none rounded-lg"
							aria-label="Read {comic.title}"
						>
							<div
								class="relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
							>
								<img
									src={comic.featureImage}
									alt={comic.seoData.imageAlt}
									title={comic.seoData.imageTitle}
									class="w-full h-auto aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-200"
									loading={index < 8 ? 'eager' : 'lazy'}
									decoding="async"
								/>
								<div
									class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
								></div>

								<!-- Enhanced overlay with SEO keywords -->
								{#if comic.seoData.characters.length > 0 || comic.seoData.tags.length > 0}
									<div
										class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
									>
										<div class="text-white text-xs">
											{#if comic.seoData.characters.length > 0}
												<div class="mb-1">👤 {comic.seoData.characters[0]}</div>
											{/if}
											{#if comic.seoData.tags.length > 0}
												<div class="flex flex-wrap gap-1">
													{#each comic.seoData.tags.slice(0, 2) as tag}
														<span class="bg-pink-500 px-1 rounded text-xs">#{tag}</span>
													{/each}
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>
							<h3
								class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200 text-center leading-tight line-clamp-2 group-hover:text-pink-500 transition-colors duration-200"
							>
								{comic.title}
								{#if comic.seoData.characters.length > 0}
									<span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
										{comic.seoData.characters[0]}
										{#if comic.seoData.parodies.length > 0}• {comic.seoData.parodies[0]}{/if}
									</span>
								{/if}
							</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
								by {comic.author.name}
							</p>
						</a>
					</article>
				{/each}
			</div>
		</section>
	{:else}
		<div class="text-center py-12">
			<p class="text-gray-600 dark:text-gray-300 text-lg mb-4">
				No manga found in this collection.
			</p>
			<a href={`/p/${data.type}`} class="text-pink-500 hover:text-pink-600 font-medium">
				← Browse other {data.type}
			</a>
		</div>
	{/if}

	<!-- Enhanced Pagination -->
	{#if data.totalPages > 1}
		<nav aria-label="Pagination" class="flex flex-col items-center gap-4 mt-12">
			<!-- Mobile Pagination (Simple) -->
			<div class="flex justify-center gap-2 sm:hidden">
				{#if hasPrevPage}
					<a
						href={`/browse/${data.type}/${data.slug}${data.page === 2 ? '' : `?page=${data.page - 1}`}`}
						class="px-4 py-2 text-white rounded-lg hover:bg-pink-600 transition-colors focus:ring-2 focus:ring-pink-500 focus:outline-none"
						style="background-color: #ff1493"
						aria-label="Go to previous page"
					>
						← Prev
					</a>
				{/if}

				<span
					class="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg"
				>
					{data.page} / {data.totalPages}
				</span>

				{#if hasNextPage}
					<a
						href={`/browse/${data.type}/${data.slug}?page=${data.page + 1}`}
						class="px-4 py-2 text-white rounded-lg hover:bg-pink-600 transition-colors focus:ring-2 focus:ring-pink-500 focus:outline-none"
						style="background-color: #ff1493"
						aria-label="Go to next page"
					>
						Next →
					</a>
				{/if}
			</div>

			<!-- Desktop Pagination (Full) -->
			<div class="hidden sm:flex items-center gap-2">
				{#if hasPrevPage}
					<a
						href={`/browse/${data.type}/${data.slug}${data.page === 2 ? '' : `?page=${data.page - 1}`}`}
						class="px-4 py-2 text-white rounded-lg hover:bg-pink-600 transition-colors focus:ring-2 focus:ring-pink-500 focus:outline-none"
						style="background-color: #ff1493"
						aria-label="Go to previous page"
					>
						← Previous
					</a>
				{/if}

				{#each paginationRange as pageNum}
					{#if pageNum === '...'}
						<span class="px-2 py-2 text-gray-400">...</span>
					{:else if pageNum === data.page}
						<span
							class="px-4 py-2 text-white rounded-lg font-semibold"
							style="background-color: #ff1493"
							aria-current="page"
						>
							{pageNum}
						</span>
					{:else}
						<a
							href={`/browse/${data.type}/${data.slug}${pageNum === 1 ? '' : `?page=${pageNum}`}`}
							class="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:ring-2 focus:ring-pink-500 focus:outline-none"
							aria-label="Go to page {pageNum}"
						>
							{pageNum}
						</a>
					{/if}
				{/each}

				{#if hasNextPage}
					<a
						href={`/browse/${data.type}/${data.slug}?page=${data.page + 1}`}
						class="px-4 py-2 text-white rounded-lg hover:bg-pink-600 transition-colors focus:ring-2 focus:ring-pink-500 focus:outline-none"
						style="background-color: #ff1493"
						aria-label="Go to next page"
					>
						Next →
					</a>
				{/if}
			</div>
		</nav>
	{/if}

	<!-- Ad Placements -->
	<div class="mt-12 space-y-8">
		<NativeAds />
	</div>
</main>

<!-- FIXED: Close share dropdown when clicking outside -->
<svelte:window
	on:click={(e) => {
		const target = e.target as Element
		if (!target.closest('[data-share-container]')) {
			showShareOptions = false
		}
	}}
/>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Focus styles for better accessibility */
	a:focus-visible {
		outline: 2px solid #ec4899;
		outline-offset: 2px;
	}
</style>
