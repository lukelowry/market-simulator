<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { paymentLabel } from '$lib/utils/stateLabels.js';
	import { getMarketStats } from '$lib/utils/marketCalcs.js';

	const marketStats = $derived(getMarketStats(game.state));
</script>

{#snippet kpiPair(prefix: string)}
	<div class="gcp-kpi">
		<span class="gcp-kpi-value">${marketStats.currentMarginal ?? '—'}</span>
		<span class="label-micro gcp-kpi-label">{prefix}Marginal</span>
		<span class="gcp-kpi-sub"
			>avg ${marketStats.avgMarginal ?? '—'} · peak ${marketStats.peakMarginal ?? '—'}</span
		>
	</div>
	<div class="gcp-kpi-divider"></div>
	<div class="gcp-kpi">
		<span class="gcp-kpi-value"
			>{marketStats.currentLoad}<span class="gcp-kpi-unit"> MW</span></span
		>
		<span class="label-micro gcp-kpi-label">{prefix}Load</span>
		<span class="gcp-kpi-sub">of {marketStats.totalCapacity} MW capacity</span>
	</div>
	<div class="gcp-kpi-divider"></div>
{/snippet}

<div class="gcp-complete-header">
	<div class="flex items-center gap-2.5">
		<div class="gcp-dot gcp-dot--gold"></div>
		<span class="label-micro gcp-label">Complete</span>
	</div>
	<span class="text-text-inverse/70 font-mono text-xs"
		>{game.state.options?.num_periods ?? 0} periods played</span
	>
</div>

<div class="gcp-complete-body">
	<div class="gcp-complete-badge">
		<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path
				d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"
			/>
		</svg>
	</div>
	<div>
		<span class="text-text-primary block text-sm font-semibold">Game Complete</span>
		<span class="text-text-muted mt-0.5 block text-xs"
			>All {game.state.options?.num_periods ?? 0} periods played. Review results below.</span
		>
	</div>
</div>

<!-- Final KPI strip -->
<div class="gcp-kpi-strip">
	{@render kpiPair('Final ')}
	<div class="gcp-kpi">
		<span class="gcp-kpi-value">{Object.keys(game.state.players).length}</span>
		<span class="label-micro gcp-kpi-label">Players</span>
		<span class="gcp-kpi-sub">{paymentLabel(game.state.options?.payment_method)} mode</span>
	</div>
</div>

<style>
	.gcp-complete-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 1.25rem;
		background: var(--color-maroon);
	}

	.gcp-complete-body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
	}

	.gcp-complete-badge {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-gold-faint);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--color-gold);
	}
</style>
