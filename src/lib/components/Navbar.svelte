<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';

	function logout() {
		connection.logoutHandler?.();
	}
</script>

<nav class="bg-gradient-to-br from-maroon to-maroon-dark relative z-[100] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-gradient-to-r after:from-maroon-dark after:via-gold after:to-maroon-dark" aria-label="Main navigation">
	<div class="flex items-center justify-between max-w-[1280px] mx-auto py-4 px-6">
		<a href="/" class="flex flex-col no-underline text-text-inverse hover:text-text-inverse">
			<span class="font-display text-lg sm:text-xl font-bold tracking-[-0.01em] leading-[1.2]">Energy Market Simulator</span>
			<span class="hidden sm:block text-xs font-normal opacity-70 tracking-[0.1em] uppercase mt-0.5">Texas A&M University</span>
		</a>
		{#if connection.role}
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2 text-text-inverse text-sm font-medium opacity-90">
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"
						/>
					</svg>
					<span>{connection.participantName.toUpperCase()}</span>
				</div>
				<button class="bg-white/10 text-text-inverse border border-white/20 py-1 px-4 font-body text-xs font-semibold rounded-sm cursor-pointer tracking-[0.03em] transition-all duration-200 ease-brand hover:bg-white/20 hover:border-white/40 focus-visible:outline-3 focus-visible:outline-gold focus-visible:outline-offset-2" onclick={logout} aria-label="Log out">Log Out</button>
			</div>
		{/if}
	</div>
</nav>
