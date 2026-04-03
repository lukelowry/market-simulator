<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connect, disconnect, send } from '$lib/websocket.js';
	import { stateBadge, stateAbbr } from '$lib/utils/stateLabels.js';
	import type { MarketListItem } from '$shared/game.js';

	let {
		selectedMarket = $bindable(),
		onrequestcreate,
		refreshKey = 0
	}: {
		selectedMarket: string | null;
		onrequestcreate: () => void;
		refreshKey?: number;
	} = $props();

	let marketsStore = $state<MarketListItem[]>([]);

	/** Direct fetch bypasses SvelteKit query cache so polling always gets fresh data. */
	async function fetchMarkets() {
		try {
			const params = new URLSearchParams();
			if (connection.adminKey) params.set('key', connection.adminKey);
			const res = await fetch(`/api/markets?${params}`);
			if (res.ok) marketsStore = await res.json();
		} catch {
			// ignore fetch errors
		}
	}

	$effect(() => {
		const _trigger = refreshKey; // re-run when parent signals a mutation
		if (connection.adminKey) {
			fetchMarkets();
			const timer = setInterval(fetchMarkets, 15_000);

			function onVisible() {
				if (document.visibilityState === 'visible') fetchMarkets();
			}
			document.addEventListener('visibilitychange', onVisible);

			return () => {
				clearInterval(timer);
				document.removeEventListener('visibilitychange', onVisible);
			};
		}
	});

	function selectMarket(name: string) {
		if (selectedMarket === name && connection.connected) return;
		if (connection.connected) disconnect({ keepIdentity: true });
		selectedMarket = name;
		connection.marketName = name;
		connect(name, 'admin', 'admin', connection.adminKey);
	}

	function toggleVisibility(name: string, e: Event) {
		e.stopPropagation();
		const current = getMarketVisibility(name);
		const next = current === 'public' ? 'unlisted' : 'public';
		send({ type: 'setVisibility', payload: { visibility: next } });
	}

	const allMarkets = $derived.by(() => {
		const liveEntry =
			selectedMarket && connection.connected
				? {
						name: selectedMarket,
						state: game.state.state,
						visibility: game.state.visibility,
						playerCount: game.playerCount,
						maxPlayers: game.state.options?.max_participants ?? 0,
						updatedAt: Date.now()
					}
				: null;

		const result = marketsStore.map((m) =>
			liveEntry && m.name === selectedMarket ? { ...m, ...liveEntry } : m
		);

		// If selected market isn't in the polled list yet, prepend it
		if (selectedMarket && !marketsStore.some((m) => m.name === selectedMarket)) {
			result.unshift(
				liveEntry ?? {
					name: selectedMarket,
					state: 'connecting',
					visibility: 'public' as const,
					playerCount: 0,
					maxPlayers: 0,
					updatedAt: Date.now()
				}
			);
		}
		return result;
	});

	function getMarketVisibility(name: string): 'public' | 'unlisted' {
		if (selectedMarket === name && connection.connected) return game.state.visibility;
		const m = marketsStore.find((mk) => mk.name === name);
		return m?.visibility ?? 'public';
	}
</script>

<aside class="sticky top-8 flex max-h-[calc(100vh-var(--navbar-height)-var(--sidebar-offset))] flex-col gap-4">
	<div class="flex items-center justify-between">
		<h4 class="m-0 text-lg">Markets</h4>
		<button
			class="text-text-muted hover:text-maroon -mr-1.5 flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-sm p-2 text-xs transition-colors duration-100"
			onclick={() => fetchMarkets()}
			aria-label="Refresh market list"
		>
			<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
				><path
					d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"
				/><path
					fill-rule="evenodd"
					d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"
				/></svg
			>
		</button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
		{#each allMarkets as market (market.name)}
			{@const visibility = getMarketVisibility(market.name)}
			<div
				class="group font-body market-card relative w-full overflow-hidden rounded border {selectedMarket ===
				market.name
					? 'border-maroon/40 bg-maroon-faint shadow-[inset_2px_0_0_var(--color-maroon)]'
					: 'border-border-light hover:border-border bg-surface hover:shadow-xs'}"
			>
				<button
					type="button"
					class="w-full cursor-pointer border-none bg-transparent px-3 pt-2.5 text-left font-[inherit]"
					onclick={() => selectMarket(market.name)}
					aria-label="Select market {market.name}"
				>
					<div class="mb-0.5 flex items-center justify-between gap-2">
						<span class="text-text-primary truncate text-sm font-semibold" title={market.name}>{market.name}</span>
						<span class="badge px-2 py-[1px] text-[11px] {stateBadge(market.state)}"
							>{stateAbbr(market.state)}</span
						>
					</div>
					<div class="text-text-muted mb-1.5 font-mono text-xs">
						<span>{market.playerCount} player{market.playerCount !== 1 ? 's' : ''}</span>
						{#if market.maxPlayers > 0}
							<span>/ {market.maxPlayers} max</span>
						{/if}
					</div>
				</button>
				{#if selectedMarket === market.name && connection.connected}
				<div class="border-border-light flex gap-2 border-t px-3 py-1.5">
					<button
						type="button"
						class="ease-brand hover:bg-maroon-faint hover:text-maroon flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-0 transition-colors duration-100 {visibility ===
						'public'
							? 'text-maroon'
							: 'text-text-muted'}"
						title={visibility === 'public' ? 'Public (visible to players)' : 'Unlisted (link-only)'}
						aria-label="Toggle visibility for {market.name}"
						aria-pressed={visibility === 'public'}
						onclick={(e: MouseEvent) => toggleVisibility(market.name, e)}
					>
						{#if visibility === 'public'}
							<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
								><path
									d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"
								/><path
									d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"
								/></svg
							>
						{:else}
							<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
								><path
									d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"
								/><path
									d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"
								/><path
									d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884l-12-12 .708-.708 12 12-.708.708z"
								/></svg
							>
						{/if}
					</button>
				</div>
				{/if}
			</div>
		{/each}

		{#if allMarkets.length === 0}
			<div class="text-text-muted px-4 py-8 text-center text-sm italic">
				<p class="mb-1">No markets yet.</p>
				<p class="mb-1">Create one to get started.</p>
			</div>
		{/if}
	</div>

	<button
		class="border-border text-text-muted font-body ease-brand hover:border-maroon/40 hover:text-maroon hover:bg-maroon-faint flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed bg-transparent px-3 py-2 text-sm font-medium transition-all duration-200"
		onclick={() => onrequestcreate()}
	>
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
			><path
				d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
			/></svg
		>
		New Market
	</button>
</aside>

<style>
	/* Card-level focus ring when the select button inside is focused */
	/* :focus-within fallback for browsers without :has() support */
	.market-card:focus-within {
		outline: 3px solid var(--color-gold);
		outline-offset: 2px;
	}
	@supports selector(:has(*)) {
		.market-card:focus-within {
			outline: none;
		}
		.market-card:has(:focus-visible) {
			outline: 3px solid var(--color-gold);
			outline-offset: 2px;
		}
	}
</style>
