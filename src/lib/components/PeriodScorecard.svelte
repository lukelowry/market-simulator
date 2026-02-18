<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';

	const periods = $derived([...game.state.periods].reverse());
	const lastPeriod = $derived(periods[0] ?? null);

	const lastClearingPrice = $derived(lastPeriod?.marginal_cost != null ? Math.round(lastPeriod.marginal_cost) : null);
	const lastProfit = $derived.by(() => {
		const p = lastPeriod?.players[connection.participantName]?.profit;
		return p != null ? Math.round(p) : null;
	});

	const stats = $derived.by(() => {
		const ps = game.state.periods;
		if (ps.length === 0) return null;

		let totalPrice = 0;
		let totalProfit = 0;
		let profitable = 0;

		for (const p of ps) {
			totalPrice += p.marginal_cost ?? 0;
			const profit = p.players[connection.participantName]?.profit ?? 0;
			totalProfit += profit;
			if (profit > 0) profitable++;
		}

		return {
			avgPrice: Math.round(totalPrice / ps.length),
			avgProfit: Math.round(totalProfit / ps.length),
			profitable,
			total: ps.length
		};
	});
</script>

<section class="card" aria-label="Period scorecard">
	<div class="card-header">Market History</div>

	{#if lastClearingPrice !== null}
		<!-- Hero: Last Clearing Price -->
		<div class="py-4 px-5 border-b border-border-light text-center">
			<span class="block font-mono text-2xl font-bold text-text-primary leading-none">
				${lastClearingPrice}
			</span>
			<span class="block text-[10px] font-semibold uppercase tracking-brand text-text-muted mt-1.5">Clearing Price</span>
			{#if lastProfit !== null}
				<div class="mt-2">
					<span class="inline-block font-mono text-sm font-semibold px-2 py-0.5 rounded-sm"
						class:text-success={lastProfit > 0}
						class:bg-success-bg={lastProfit > 0}
						class:text-danger={lastProfit < 0}
						class:bg-danger-bg={lastProfit < 0}
						class:text-text-muted={lastProfit === 0}
					>
						{lastProfit >= 0 ? '+' : ''}${lastProfit.toLocaleString()}
					</span>
					<span class="block text-[10px] font-semibold uppercase tracking-brand text-text-muted mt-1">Your Last Profit</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Period Log -->
	{#if periods.length > 0}
		<div class="period-log">
			<div class="log-header">
				<span>Per</span>
				<span>Price</span>
				<span class="text-right">Profit</span>
			</div>
			{#each periods as period}
				{@const rawProfit = period.players[connection.participantName]?.profit}
				{@const profit = rawProfit != null ? Math.round(rawProfit) : null}
				<div class="log-row">
					<span class="text-text-muted">{period.number}</span>
					<span>${period.marginal_cost != null ? Math.round(period.marginal_cost) : '—'}</span>
					<span class="text-right"
						class:text-success={profit !== null && profit > 0}
						class:text-danger={profit !== null && profit < 0}
					>
						{profit !== null ? `${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}` : '—'}
					</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="py-6 px-5 text-center text-sm text-text-muted italic">
			No periods cleared yet.
		</div>
	{/if}

	<!-- Summary Stats -->
	{#if stats}
		<div class="px-5 py-3 border-t border-border-light">
			<div class="stat-row">
				<span class="stat-label">Avg Price</span>
				<span class="font-mono text-xs text-text-primary">${stats.avgPrice}/MWh</span>
			</div>
			<div class="stat-row">
				<span class="stat-label">Avg Profit</span>
				<span class="font-mono text-xs" class:text-success={stats.avgProfit > 0} class:text-danger={stats.avgProfit < 0} class:text-text-primary={stats.avgProfit === 0}>${stats.avgProfit.toLocaleString()}</span>
			</div>
			<div class="stat-row last">
				<span class="stat-label">Profitable</span>
				<span class="font-mono text-xs text-text-primary">{stats.profitable} of {stats.total}</span>
			</div>
		</div>
	{/if}
</section>

<style>
	.period-log {
		max-height: 220px;
		overflow-y: auto;
	}

	.log-header {
		display: grid;
		grid-template-columns: 36px 1fr 1fr;
		gap: 4px;
		padding: 6px 20px;
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border-light);
		position: sticky;
		top: 0;
		background: white;
	}

	.log-row {
		display: grid;
		grid-template-columns: 36px 1fr 1fr;
		gap: 4px;
		padding: 5px 20px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
		border-bottom: 1px solid var(--color-border-light);
		transition: background 100ms var(--ease-brand);
	}
	.log-row:last-child { border-bottom: none; }
	.log-row:hover { background: var(--color-gold-faint); }

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 4px 0;
		border-bottom: 1px solid var(--color-border-light);
	}
	.stat-row.last { border-bottom: none; }

	.stat-label {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
	}
</style>
