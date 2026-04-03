<script lang="ts">
	import { stateLabel, stateBadge } from '$lib/utils/stateLabels.js';
	import type { MarketListItem } from '$shared/game.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import Icon from '$lib/components/shared/Icon.svelte';

	let { onJoin }: { onJoin?: (marketName: string) => void } = $props();

	let marketsData = $state<MarketListItem[]>([]);
	let loading = $state(true);
	let fetchError = $state<string | null>(null);

	async function fetchMarkets() {
		try {
			const params = new URLSearchParams();
			if (connection.playerToken) params.set('token', connection.playerToken);
			const res = await fetch(`/api/markets?${params}`);
			if (res.ok) {
				marketsData = await res.json();
				fetchError = null;
			} else {
				fetchError = 'Could not reach the server. Retrying automatically...';
			}
			loading = false;
		} catch {
			fetchError = 'Could not reach the server. Retrying automatically...';
			loading = false;
		}
	}

	$effect(() => {
		fetchMarkets();
		const timer = setInterval(fetchMarkets, 5_000);

		function onVisible() {
			if (document.visibilityState === 'visible') fetchMarkets();
		}
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	function canJoin(market: MarketListItem): boolean {
		if (market.state === 'forming') return true;
		if (market.isMember && (market.state === 'running' || market.state === 'completed')) return true;
		return false;
	}
</script>

{#if loading}
	<div
		class="border-border-light flex flex-col items-center rounded-lg border bg-surface px-8 py-12 text-center shadow-xs"
		role="status"
	>
		<div
			class="bg-maroon-faint border-maroon mb-3 h-8 w-8 animate-pulse rounded-full border-2 opacity-25"
			aria-hidden="true"
		></div>
		<p class="text-text-muted max-w-[320px] text-sm">Fetching available markets...</p>
	</div>
{:else}
	{#if fetchError}
		<div
			class="bg-warning-bg border-warning/20 text-warning mb-3 flex items-center gap-2 rounded border px-4 py-2 text-sm"
		>
			<span>{fetchError}</span>
		</div>
	{/if}
	<div class="mb-2 flex justify-end">
		<button
			class="text-text-muted hover:text-maroon -mr-2 flex min-h-11 items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs transition-colors duration-100"
			onclick={() => fetchMarkets()}
			aria-label="Refresh market list"
		>
			<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
				><path
					d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"
				/><path
					fill-rule="evenodd"
					d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"
				/></svg
			>
			Refresh
		</button>
	</div>
	{#if marketsData.length === 0}
		<div
			class="border-border-light flex flex-col items-center rounded-lg border bg-surface px-8 py-12 text-center shadow-xs"
		>
			<Icon name="warning" size={36} class="text-maroon mb-3 opacity-15" />
			<h4 class="text-text-secondary mb-2">No Active Markets</h4>
			<p class="text-text-muted max-w-[320px] text-sm">
				Ask your instructor to create a market, then it will appear here.
			</p>
		</div>
	{:else}
		<ul class="border-border-light m-0 list-none overflow-hidden rounded-lg border bg-surface p-0 shadow-xs">
			{#each marketsData as market}
				<li
					class="border-border-light ease-brand hover:bg-maroon-faint flex items-center justify-between border-b px-4 py-3 transition-[background] duration-100 last:border-b-0"
				>
					<div class="flex min-w-0 items-center gap-3">
						<span class="text-text-primary truncate text-base font-semibold">{market.name}</span>
						<span class="badge {stateBadge(market.state)}">{stateLabel(market.state)}</span>
					</div>
					<div class="flex items-center gap-4">
						<span class="text-text-muted flex items-center gap-1 font-mono text-sm">
							<svg
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="currentColor"
								aria-hidden="true"
							>
								<path
									d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-.828.396-1.855 1.156-2.72.29-.33.614-.628.96-.89zM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275zM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
								/>
							</svg>
							{market.playerCount}{market.maxPlayers > 0 ? ` / ${market.maxPlayers}` : ''}
						</span>
						{#if onJoin}
							{#if canJoin(market)}
								<button
									class="btn btn-primary btn-sm min-w-16"
									onclick={() => onJoin(market.name)}
								>
									{market.state === 'completed' ? 'View Results' : market.isMember ? 'Rejoin' : 'Join'}
								</button>
							{:else}
								<span class="text-text-muted w-16 text-center text-sm">&mdash;</span>
							{/if}
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
