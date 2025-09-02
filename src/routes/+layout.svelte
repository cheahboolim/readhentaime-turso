<script>
	// Keep your existing imports
	import { browser } from '$app/environment'
	import '../app.css'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { afterNavigate } from '$app/navigation'
	import { seo } from '$lib/seo.ts'
	import AAdsMiddleBanner from '$lib/components/AAdsMiddleBanner.svelte'
	import MainNav from '$lib/components/MainNav.svelte'
	import Footer from '$lib/components/Footer.svelte'
	import BannerAd from '$lib/components/adsterra/BannerAd.svelte'
	import BlueBallsAd from '$lib/components/ownads/BlueBallsAd.svelte'
	import AppInstallBanner from '$lib/components/AppInstallBanner.svelte'
	import AAdsBanner from '$lib/components/AAdsBanner.svelte'
	import ExoClickSlider from '$lib/components/ExoClickSlider.svelte'
	import ExoOutstreamAd from '$lib/components/ExoOutstreamAd.svelte'
	import Coinpoll from '$lib/components/ownads/coinpoll.svelte'

	// ✅ Google Analytics removed
</script>

<svelte:head>
	<meta name="theme-color" content="#000000" />
	<meta name="msapplication-TileColor" content="#000000" />
	<link rel="manifest" href="/manifest.webmanifest" />

	<link
		rel="icon"
		type="image/png"
		sizes="16x16"
		href="{import.meta.env.PUBLIC_CDN_BASE_URL}/favicon/favicon-16x16.png"
	/>
	<link
		rel="icon"
		type="image/png"
		sizes="32x32"
		href="{import.meta.env.PUBLIC_CDN_BASE_URL}/favicon/favicon-32x32.png"
	/>
	<link rel="icon" href="{import.meta.env.PUBLIC_CDN_BASE_URL}/favicon/favicon.ico" sizes="any" />
	<link
		rel="apple-touch-icon"
		href="{import.meta.env.PUBLIC_CDN_BASE_URL}/favicon/apple-touch-icon.png"
	/>
	<link
		rel="icon"
		type="image/png"
		sizes="192x192"
		href="{import.meta.env.PUBLIC_CDN_BASE_URL}/favicon/android-chrome-192x192.png"
	/>
	<link
		rel="icon"
		type="image/png"
		sizes="512x512"
		href="{import.meta.env.PUBLIC_CDN_BASE_URL}/favicon/android-chrome-512x512.png"
	/>

	<!-- ✅ Google Analytics removed -->
</svelte:head>

<div class="relative flex min-h-screen flex-col bg-background text-foreground antialiased">
	<MainNav />

	<div class="container mx-auto px-4 py-2">
		<AAdsMiddleBanner />
	</div>

	<main class="flex-1">
		<slot />
	</main>

	<div class="container mx-auto px-4 py-2">
		<AppInstallBanner />
	</div>

	<Footer />
</div>
