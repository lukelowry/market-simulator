<script lang="ts">
	import { listMarkets } from '../../routes/markets.remote';
	import { stateLabel, stateBadge } from '$lib/utils/stateLabels.js';
	import type { MarketListItem } from '$lib/types/messages.js';

	let { onJoin }: { onJoin?: (marketName: string) => void } = $props();

	let marketsData = $state<MarketListItem[]>([]);
	let loading = $state(true);
	let fetchError = $state<string | null>(null);

	async function fetchMarkets() {
		try {
			marketsData = await listMarkets(undefined);
			fetchError = null;
			loading = false;
		} catch {
			fetchError = 'Failed to load markets. Retrying...';
			loading = false;
		}
	}

	$effect(() => {
		fetchMarkets();
		const timer = setInterval(fetchMarkets, 10_000);
		return () => clearInterval(timer);
	});

	function canJoin(market: MarketListItem): boolean {
		return market.state === 'forming';
	}
</script>

{#if loading}
	<div class="flex flex-col items-center text-center py-16 px-8 bg-white border border-border-light rounded-lg shadow-sm">
		<div class="w-10 h-10 rounded-full bg-maroon-faint border-3 border-maroon opacity-30 mb-4 animate-pulse" aria-label="Loading markets"></div>
		<p class="text-sm text-text-muted max-w-[320px]">Fetching available markets...</p>
	</div>
{:else}
	{#if fetchError}
		<div class="flex items-center gap-2 py-2 px-4 mb-3 bg-warning-bg border border-warning/20 rounded text-warning text-sm">
			<span>{fetchError}</span>
		</div>
	{/if}
	<div class="flex justify-end mb-2">
		<button class="flex items-center gap-1 text-xs text-text-muted hover:text-maroon transition-colors duration-100" onclick={() => fetchMarkets()} aria-label="Refresh market list">
			<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
			Refresh
		</button>
	</div>
	{#if marketsData.length === 0}
		<div class="flex flex-col items-center text-center py-16 px-8 bg-white border border-border-light rounded-lg shadow-sm">
			<svg class="text-text-muted opacity-30 mb-4" width="48" height="48" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
				<path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
			</svg>
			<h4 class="mb-2 text-text-secondary">No Active Markets</h4>
			<p class="text-sm text-text-muted max-w-[320px]">Ask your instructor to create a market, then it will appear here.</p>
		</div>
	{:else}
		<div class="bg-white border border-border-light rounded-lg shadow-sm overflow-hidden">
			{#each marketsData as market}
				<div class="flex items-center justify-between py-4 px-5 border-b border-border-light last:border-b-0 transition-[background] duration-100 ease-brand hover:bg-maroon-faint">
					<div class="flex items-center gap-3">
						<span class="font-semibold text-base text-text-primary">{market.name}</span>
						<span class="badge {stateBadge(market.state)}">{stateLabel(market.state)}</span>
					</div>
					<div class="flex items-center gap-4">
						<span class="flex items-center gap-1 font-mono text-sm text-text-muted">
							<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
								<path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-.828.396-1.855 1.156-2.72.29-.33.614-.628.96-.89zM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275zM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
							</svg>
							{market.playerCount}{market.maxPlayers > 0 ? ` / ${market.maxPlayers}` : ''}
						</span>
						{#if onJoin}
							{#if canJoin(market)}
								<button class="btn btn-primary btn-sm min-w-[60px]" onclick={() => onJoin(market.name)}>
									Join
								</button>
							{:else}
								<span class="text-text-muted text-sm w-[60px] text-center">&mdash;</span>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}
