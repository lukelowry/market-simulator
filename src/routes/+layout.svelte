<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/shared/Navbar.svelte';

	let { children } = $props();
</script>

<a href="#main" class="skip-link">Skip to content</a>
<Navbar />
<main id="main" class="min-h-[calc(100vh-var(--navbar-height))] pt-8 pb-12">
	{@render children()}
</main>

<style>
	.skip-link {
		position: absolute;
		left: -9999px;
		top: 0;
		z-index: calc(var(--z-modal) + 1);
		padding: 0.75rem 1.25rem;
		background: var(--color-maroon);
		color: var(--color-text-inverse);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		border-radius: 0 0 var(--radius-sm) 0;
		text-decoration: none;
	}
	.skip-link:focus {
		left: 0;
	}
</style>
