<script>
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'

	// Props
	export let spotId = '87c0aebcf1cb4e23aaa36c0e783e9716'
	export let disabled = false

	let scriptLoaded = false

	onMount(() => {
		// Only run in browser environment and if not disabled
		if (!browser || disabled) return

		// Check if script is already loaded to avoid duplicates
		const existingScript = document.querySelector('script[src*="tsyndicate.com/sdk/v1/p.js"]')
		if (existingScript) {
			scriptLoaded = true
			return
		}

		// Create and load the script
		const script = document.createElement('script')
		script.type = 'text/javascript'
		script.src = '//cdn.tsyndicate.com/sdk/v1/p.js'
		script.setAttribute('data-ts-spot', spotId)
		script.async = true
		script.defer = true

		script.onload = () => {
			scriptLoaded = true
		}

		script.onerror = () => {
			console.error('Failed to load TrafficStars script')
		}

		// Append to document head
		document.head.appendChild(script)

		// Cleanup function
		return () => {
			// Remove script when component is destroyed
			const scriptElement = document.querySelector(`script[data-ts-spot="${spotId}"]`)
			if (scriptElement) {
				scriptElement.remove()
			}
		}
	})
</script>

<!-- Optional: You can add a placeholder or loading indicator -->
{#if browser && !disabled}
	<!-- The script will handle the popunder functionality -->
	<!-- No visible content needed for popunder ads -->
{/if}
