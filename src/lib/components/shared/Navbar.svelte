<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';

	function logout() {
		connection.logoutHandler?.();
	}
</script>

<nav
	class="from-maroon to-maroon-dark after:from-maroon-dark after:via-gold after:to-maroon-dark relative z-(--z-navbar) bg-gradient-to-br after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[2px] after:bg-gradient-to-r after:content-['']"
	aria-label="Main navigation"
>
	<div class="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
		<a href="/" class="text-text-inverse hover:text-text-inverse flex flex-col no-underline" aria-label="Energy Market Simulator — go to home page">
			<span
				class="font-display m-0 text-lg leading-[1.2] font-bold tracking-[-0.01em] text-inherit sm:text-xl"
			>
				Energy Market Simulator
			</span>
			<span class="mt-0.5 hidden text-xs font-normal tracking-[0.1em] uppercase opacity-80 sm:block"
				>Texas A&M University</span
			>
		</a>
		{#if connection.role}
			<div class="flex items-center gap-4">
				<div class="text-text-inverse flex min-w-0 items-center gap-2 text-sm font-medium opacity-90">
					<svg class="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path
							d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"
						/>
					</svg>
					<span class="max-w-40 truncate uppercase sm:max-w-60">{connection.participantName}</span>
				</div>
				<button
					class="bg-text-inverse/10 text-text-inverse border-text-inverse/15 font-body ease-brand hover:bg-text-inverse/20 hover:border-text-inverse/30 focus-visible:outline-gold cursor-pointer rounded-sm border px-3 py-1 text-xs font-medium tracking-[0.02em] transition-all duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 min-h-11"
					onclick={logout}
					>Log Out</button
				>
			</div>
		{/if}
	</div>
</nav>
