<script lang="ts">
	import { page } from '$app/stores'
	import { Auth } from '@supabase/auth-ui-svelte'
	import { ThemeSupa } from '@supabase/auth-ui-shared'

	let next = $derived($page.url.searchParams.get('next'))

	let redirectTo = $derived(
		next
			? `${$page.url.origin}/auth/callback?next=${encodeURIComponent(next)}`
			: `${$page.url.origin}/auth/callback`
	)
</script>

<svelte:head>
	<title>Sign In | ReadHentai.me</title>
	<meta name="description" content="Login to ReadHentai.me to access your account and favorite hentai manga." />
	<link rel="canonical" href="https://readhentai.me/auth" />
	<meta name="keywords" content="login, hentai, manga, doujinshi, adult comics, account" />
	<meta name="robots" content="noindex, nofollow" />
	<!-- Open Graph tags -->
	<meta property="og:title" content="Sign In | ReadHentai.me" />
	<meta property="og:description" content="Login to ReadHentai.me to access your account and favorite hentai manga." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://readhentai.me/auth" />
	<meta property="og:site_name" content="Read Hentai" />
	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Sign In | ReadHentai.me" />
	<meta name="twitter:description" content="Login to ReadHentai.me to access your account and favorite hentai manga." />
	<!-- Structured Data: WebPage JSON-LD -->
	<script type="application/ld+json">
		{JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			'name': 'Sign In | ReadHentai.me',
			'description': 'Login to ReadHentai.me to access your account and favorite hentai manga.',
			'url': 'https://readhentai.me/auth'
		})}
	</script>
</svelte:head>

<div>
	<Auth
		supabaseClient={$page.data.supabase}
		theme="dark"
		view="magic_link"
		appearance={{
			theme: ThemeSupa
		}}
		{redirectTo}
		showLinks={false}
		additionalData={{}}
	/>
</div>

<style>
	div {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
	}
</style>
