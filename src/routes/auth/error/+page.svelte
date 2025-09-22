<svelte:head>
	<title>Auth Error | ReadHentai.me</title>
	<meta name="description" content="Authentication error occurred while logging in to ReadHentai.me." />
	<link rel="canonical" href="https://readhentai.me/auth/error" />
	<meta name="keywords" content="auth, error, login, hentai, manga, doujinshi, adult comics, account" />
	<meta name="robots" content="noindex, nofollow" />
	<!-- Open Graph tags -->
	<meta property="og:title" content="Auth Error | ReadHentai.me" />
	<meta property="og:description" content="Authentication error occurred while logging in to ReadHentai.me." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://readhentai.me/auth/error" />
	<meta property="og:site_name" content="Read Hentai" />
	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Auth Error | ReadHentai.me" />
	<meta name="twitter:description" content="Authentication error occurred while logging in to ReadHentai.me." />
	<!-- Structured Data: WebPage JSON-LD -->
	<script type="application/ld+json">
		{JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			'name': 'Auth Error | ReadHentai.me',
			'description': 'Authentication error occurred while logging in to ReadHentai.me.',
			'url': 'https://readhentai.me/auth/error'
		})}
	</script>
</svelte:head>
<script lang="ts">
	import { page } from '$app/stores'

	let searchParams = $derived(new URLSearchParams($page.url.hash.substring(1)))

	// TODO: sentry log?
</script>

<div>
	<h1>An authentication error occurred. Please <a href="/auth">try again.</a></h1>

	<div>
		Details for engineering:
		<pre>{JSON.stringify([...searchParams.entries()], null, 2)}</pre>
	</div>
</div>
