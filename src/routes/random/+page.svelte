<script lang="ts">
	import RandomComics from '$lib/components/RandomComics.svelte';
	import TrafficStarsAd from '$lib/components/TrafficStarsAd.svelte';
	export let data;
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta name="description" content={data.meta.description} />
	<link rel="canonical" href="https://readhentai.me/random" />
	<meta name="keywords" content="random, hentai, manga, doujinshi, adult comics" />
	<meta name="robots" content="index, follow" />
	<!-- Open Graph tags -->
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://readhentai.me/random" />
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
	{#if data.meta.prev}
		<link rel="prev" href={data.meta.prev} />
	{/if}
	{#if data.meta.next}
		<link rel="next" href={data.meta.next} />
	{/if}
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<main class="max-w-6xl mx-auto px-4 py-8">
	<RandomComics comics={data.comics} page={data.page} total={data.total} seed={data.seed} />
	<TrafficStarsAd />
</main>