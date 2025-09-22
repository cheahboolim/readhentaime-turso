<svelte:head>
	<title>Auth Callback | ReadHentai.me</title>
	<meta name="description" content="Authentication callback for ReadHentai.me account login." />
	<link rel="canonical" href="https://readhentai.me/auth/callback" />
	<meta name="keywords" content="auth, callback, login, hentai, manga, doujinshi, adult comics, account" />
	<meta name="robots" content="noindex, nofollow" />
	<!-- Open Graph tags -->
	<meta property="og:title" content="Auth Callback | ReadHentai.me" />
	<meta property="og:description" content="Authentication callback for ReadHentai.me account login." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://readhentai.me/auth/callback" />
	<meta property="og:site_name" content="Read Hentai" />
	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Auth Callback | ReadHentai.me" />
	<meta name="twitter:description" content="Authentication callback for ReadHentai.me account login." />
	<!-- Structured Data: WebPage JSON-LD -->
	<script type="application/ld+json">
		{JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			'name': 'Auth Callback | ReadHentai.me',
			'description': 'Authentication callback for ReadHentai.me account login.',
			'url': 'https://readhentai.me/auth/callback'
		})}
	</script>
</svelte:head>
<script lang="ts">
	let { data } = $props()
</script>

{#if data.status === 'missingCodeVerifier'}
	<p>
		Please open this page in the browser you used to request the magic link in order to continue.
	</p>
	<p>
		If you are on a mobile device, please note that your email app may open links in its own
		internal browser. Please open this page in your primary browser in order to continue.
	</p>
{:else if data.status === 'missingCode'}
	<p>This magic link appears to be malformed. Please try again.</p>
{:else if data.status === 'error'}
	<p>An error occurred processing the magic link. Please request a new link and try again.</p>
	<pre>Error: {data.error}</pre>
	<pre>Description: {data.description}</pre>
{/if}
