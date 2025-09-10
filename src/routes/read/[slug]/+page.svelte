<!--src/routes/read/[slug]/+page.svelte - FIXED VERSION-->

<script lang="ts">
	import ComicPreview from '$lib/components/ComicPreview.svelte'
	import SimilarManga from '$lib/components/SimilarManga.svelte'
	import MetaGroup from '$lib/components/MetaGroup.svelte'
	import RandomPost from '$lib/components/RandomPost.svelte'
	import TrafficStarsAd from '$lib/components/TrafficStarsAd.svelte'
	import ImageErrorRefreshButton from '$lib/components/ImageErrorRefreshButton.svelte'
	import { goto } from '$app/navigation'
	import { seo } from '$lib/seo.ts'
	import AAdsMiddleBanner from '$lib/components/AAdsMiddleBanner.svelte'
	import AAdsBanner from '$lib/components/AAdsBanner.svelte'

	export let data
	const { slug, comic, seo: seoData } = data

	let featureImageError = false
	let showShareOptions = false

	// Set SEO data
	seo.set(seoData)

	function refreshFeatureImage() {
		goto(`/read/${slug}`, { invalidateAll: true })
	}

	// Share functionality
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
		const text = `🔞 Check out ${comic.title}! ${comic.seoData.topCharacters.length > 0 ? `${comic.seoData.topCharacters[0]} ` : ''}${comic.totalPages} pages of premium content!`
		const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`
		window.open(url, '_blank', 'width=550,height=420')
	}

	function shareToReddit() {
		const title = `${comic.title}${comic.seoData.topCharacters.length > 0 ? ` - ${comic.seoData.topCharacters[0]}` : ''} [${comic.totalPages}p]`
		const url = `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(window.location.href)}`
		window.open(url, '_blank')
	}
</script>

<svelte:head>
	<title>{seoData.title}</title>
	<meta name="description" content={seoData.description} />
	<meta name="keywords" content={seoData.keywords} />
	<link rel="canonical" href={seoData.canonical} />

	<!-- Enhanced Open Graph -->
	<meta property="og:type" content={seoData.ogType} />
	<meta property="og:site_name" content={seoData.ogSiteName} />
	<meta property="og:locale" content={seoData.ogLocale} />
	<meta property="og:url" content={seoData.canonical} />
	<meta property="og:title" content={seoData.ogTitle} />
	<meta property="og:description" content={seoData.ogDescription} />
	<meta property="og:image" content={seoData.ogImage} />
	<meta property="og:image:secure_url" content={seoData.ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={comic.seoData.imageAlt} />

	<!-- Article specific OG tags -->
	{#if seoData.articleAuthor}
		<meta property="article:author" content={seoData.articleAuthor} />
	{/if}
	<meta property="article:published_time" content={seoData.articlePublishedTime} />
	<meta property="article:section" content={seoData.articleSection} />
	{#each seoData.articleTags as tag}
		<meta property="article:tag" content={tag} />
	{/each}

	<!-- Enhanced Twitter Cards -->
	<meta name="twitter:card" content={seoData.twitterCard} />
	<meta name="twitter:site" content={seoData.twitterSite} />
	<meta name="twitter:title" content={seoData.twitterTitle} />
	<meta name="twitter:description" content={seoData.twitterDescription} />
	<meta name="twitter:image" content={seoData.twitterImage} />
	<meta name="twitter:image:alt" content={comic.seoData.imageAlt} />

	<!-- Twitter Labels for Rich Cards -->
	<meta name="twitter:label1" content="Pages" />
	<meta name="twitter:data1" content="{comic.totalPages} pages" />
	{#if comic.seoData.primaryArtist}
		<meta name="twitter:label2" content="Artist" />
		<meta name="twitter:data2" content={comic.seoData.primaryArtist} />
	{/if}

	<!-- Additional SEO -->
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="author" content={comic.seoData.primaryArtist || 'Read Hentai Pics'} />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<!-- Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify(seoData.structuredData)}</script>`}
</svelte:head>

<main class="container mx-auto px-4 py-8">
	<!-- Breadcrumb Navigation -->
	<nav aria-label="Breadcrumb" class="mb-6">
		<ol class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
			<li><a href="/" class="hover:text-pink-500 transition-colors">Home</a></li>
			<li class="text-gray-400">/</li>
			<li><a href="/browse" class="hover:text-pink-500 transition-colors">Browse</a></li>
			<li class="text-gray-400">/</li>
			<li class="text-pink-500 font-medium" aria-current="page">{comic.title}</li>
		</ol>
	</nav>

	<div class="max-w-6xl mx-auto space-y-8">
		<!-- Main comic info section with side-by-side layout on desktop -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
			<!-- Left side: Feature Image -->
			<div class="space-y-4">
				{#if comic.feature_image_url}
					<a href={`/read/${slug}/1`} class="block">
						<img
							src={comic.feature_image_url}
							alt={comic.seoData.imageAlt}
							title={comic.seoData.imageTitle}
							class="w-full rounded-lg hover:opacity-90 transition shadow-lg"
							width="600"
							height="900"
							on:error={() => (featureImageError = true)}
						/>
					</a>
					<ImageErrorRefreshButton show={featureImageError} onRefresh={refreshFeatureImage} />
				{/if}

				<!-- FIXED Share Section for Gallery -->
				<div
					class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
				>
					<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
						<div>
							<h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">
								💾 Love this manga? Save it for later!
							</h3>
							<p class="text-sm text-gray-600 dark:text-gray-400">Copy URL or share (discretely)</p>
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
			</div>

			<!-- Right side: Metadata and Actions - Sticky on desktop -->
			<div class="lg:sticky lg:top-8 space-y-6">
				<div>
					<h1 class="text-3xl lg:text-4xl font-bold mb-4">{comic.title}</h1>

					<!-- Enhanced manga info with SEO keywords -->
					{#if comic.seoData.topCharacters.length > 0 || comic.seoData.topParody}
						<div class="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 mb-4">
							<h2 class="text-lg font-semibold mb-2 text-pink-800 dark:text-pink-200">
								Featured Characters & Series
							</h2>
							{#if comic.seoData.topCharacters.length > 0}
								<div class="mb-2">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
										>Characters:
									</span>
									{#each comic.seoData.topCharacters as character, i}
										<span class="text-pink-600 dark:text-pink-400 font-medium">
											{character}{i < comic.seoData.topCharacters.length - 1 ? ', ' : ''}
										</span>
									{/each}
								</div>
							{/if}
							{#if comic.seoData.topParody}
								<div>
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Series: </span>
									<span class="text-pink-600 dark:text-pink-400 font-medium"
										>{comic.seoData.topParody}</span
									>
								</div>
							{/if}
						</div>
					{/if}

					{#if comic.artists.length}
						<div class="text-muted-foreground text-sm mb-4 flex items-center gap-2 flex-wrap">
							<span class="font-semibold">Artists:</span>
							{#each comic.artists as artist}
								<a href={`/browse/artists/${artist.slug}`} class="underline hover:text-pink-500">
									{artist.name}
								</a>
							{/each}
						</div>
					{/if}

					<!-- Enhanced metadata with better SEO -->
					<div class="space-y-3">
						<MetaGroup type="tags" label="Tags" items={comic.tags} />
						<MetaGroup type="groups" label="Groups" items={comic.groups} />
						<MetaGroup type="categories" label="Categories" items={comic.categories} />
						<MetaGroup type="languages" label="Languages" items={comic.languages} />
						<MetaGroup type="parodies" label="Parodies" items={comic.parodies} />
						<MetaGroup type="characters" label="Characters" items={comic.characters} />
					</div>

					<!-- FIXED: Stats section - Publish date REMOVED -->
					{#if comic.totalPages > 0}
						<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4">
							<h3 class="font-medium mb-2">Manga Details</h3>
							<div class="text-sm">
								<div>
									<span class="text-gray-600 dark:text-gray-400">Total Pages:</span>
									<span class="font-medium ml-2">{comic.totalPages}</span>
								</div>
								<!-- REMOVED: Publish date section -->
							</div>
						</div>
					{/if}
				</div>

				<!-- Start Reading Button - Full width in meta column -->
				<a href={`/read/${slug}/1`} class="block">
					<button
						class="bg-[#FF1493] hover:bg-[#e01382] text-white text-lg font-bold px-6 py-3 rounded-xl shadow-lg border border-transparent w-full text-center transition"
					>
						📖 Start Reading Manga
					</button>
				</a>
			</div>
		</div>

		<!-- Enhanced "About This Manga" Section -->
		<section class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
			<h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
				Read Full {comic.title} HentaiRead.Me All Chapters
			</h2>
			<div class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
				<p class="mb-4">
					<strong>{comic.title}</strong> is a premium adult manga
					{#if comic.seoData.topCharacters.length > 0}
						featuring <strong>{comic.seoData.topCharacters.join(' and ')}</strong>
					{/if}
					{#if comic.seoData.topParody}
						from the popular <strong>{comic.seoData.topParody}</strong> series
					{/if}
					{#if comic.seoData.primaryArtist}
						, created by talented artist <strong>{comic.seoData.primaryArtist}</strong>
					{/if}
					. This doujinshi offers {comic.totalPages} pages of high-quality artwork and engaging storytelling.
				</p>

				{#if comic.seoData.topTags.length > 0}
					<h3 class="text-lg font-semibold mb-2">Content & Themes</h3>
					<p class="mb-4">
						This manga explores themes of <strong
							>{comic.seoData.topTags.slice(0, 3).join(', ')}</strong
						>
						{#if comic.seoData.topTags.length > 3}
							and more
						{/if}
						. The artwork style and narrative approach make it perfect for fans of
						{#if comic.seoData.topParody}
							{comic.seoData.topParody} parodies and
						{/if}
						adult manga in general.
					</p>
				{/if}

				<h3 class="text-lg font-semibold mb-2">Reading Experience</h3>
				<p>
					Read <strong>{comic.title}</strong> online for free with our mobile-friendly reader. High-resolution
					images ensure the best viewing experience across all devices. No registration required - start
					reading immediately!
				</p>
			</div>
		</section>

		<!-- Ad placement with better spacing -->
		<div class="my-12">
			<AAdsMiddleBanner />
		</div>

		<!-- Preview section with enhanced SEO -->
		{#if comic.previewImages.length > 0}
			<section>
				<h2 class="text-2xl font-bold mb-4">Preview Pages - {comic.title}</h2>
				<p class="text-gray-600 dark:text-gray-400 mb-4 text-sm">
					Get a sneak peek at the artwork quality and style. Click any preview to start reading from
					that page.
				</p>
				<ComicPreview images={comic.previewImages} comicSlug={slug} />
			</section>
		{/if}
	</div>

	<!-- Improved spacing between components -->
	<div class="mt-16">
		<SimilarManga tagIds={comic.tags.map((tag) => Number(tag.id))} currentMangaId={comic.id} />
	</div>

	<div class="mt-12">
		<AAdsBanner />
	</div>

	<div class="mt-16">
		<RandomPost comics={data.randomComics} />
	</div>

	<div class="mt-12"></div>
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
	/* Enhanced visual hierarchy */
	.prose h3 {
		color: rgb(236 72 153);
		margin-bottom: 0.5rem;
	}

	/* Focus styles for better accessibility */
	a:focus-visible {
		outline: 2px solid #ec4899;
		outline-offset: 2px;
	}
</style>
