<script>
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'

	// Props with default values from your config
	export let spot = 'd7049e621260423b8ad3a067b57eb5e5'
	export let width = '10%'
	export let mobileWidth = '25%'
	export let displayMode = 'capped'
	export let cappedAction = 'click'
	export let cappedValueInMinutes = 10
	export let showCTAButton = true
	export let hideOnComplete = false
	export let closeButtonDelay = 5
	export let disabled = false

	let scriptLoaded = false
	let adInitialized = false

	onMount(() => {
		// Only run in browser environment and if not disabled
		if (!browser || disabled) return

		// Check if script is already loaded
		const existingScript = document.querySelector('script[src*="video.instant.message.js"]')

		if (existingScript) {
			scriptLoaded = true
			initializeAd()
			return
		}

		// Create and load the script
		const script = document.createElement('script')
		script.src = '//cdn.tsyndicate.com/sdk/v1/video.instant.message.js'

		script.onload = () => {
			scriptLoaded = true
			initializeAd()
		}

		script.onerror = () => {
			console.error('Failed to load TrafficStars video instant message script')
		}

		// Append to document head
		document.head.appendChild(script)

		// Cleanup function
		return () => {
			// The ad might create DOM elements, but TrafficStars typically handles cleanup
			// You could add custom cleanup here if needed
		}
	})

	function initializeAd() {
		if (!browser || adInitialized || !window.TSVideoInstantMessage) return

		try {
			window.TSVideoInstantMessage({
				spot,
				width,
				mobileWidth,
				displayMode,
				cappedAction,
				cappedValueInMinutes,
				showCTAButton,
				hideOnComplete,
				closeButtonDelay
			})
			adInitialized = true
		} catch (error) {
			console.error('Failed to initialize TrafficStars video instant message:', error)
		}
	}

	// Reactive statement to reinitialize if props change
	$: if (scriptLoaded && !adInitialized && browser && !disabled) {
		initializeAd()
	}
</script>

<!-- Optional: You can add a placeholder or loading indicator -->
{#if browser && !disabled}
	<!-- The script will handle the video slider functionality -->
	<!-- No visible content needed as the ad creates its own overlay -->
{/if}
