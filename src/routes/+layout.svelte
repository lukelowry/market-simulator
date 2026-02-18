<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';

	let { children } = $props();
</script>

<Navbar />
<main class="pt-8 pb-12 min-h-[calc(100vh-72px)]">
	{@render children()}
</main>
