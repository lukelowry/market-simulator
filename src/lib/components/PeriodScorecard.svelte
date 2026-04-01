<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';

	let scrolledBottom = $state(false);

	function onLogScroll(e: Event) {
		const el = e.target as HTMLElement;
		scrolledBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
	}

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

		for (const p of ps) {
			totalPrice += p.marginal_cost ?? 0;
			totalProfit += p.players[connection.participantName]?.profit ?? 0;
		}

		return {
			avgPrice: Math.round(totalPrice / ps.length),
			avgProfit: Math.round(totalProfit / ps.length)
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
			<span class="block text-[11px] font-semibold uppercase tracking-brand text-text-muted mt-1.5">Clearing Price</span>
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
					<span class="block text-[11px] font-semibold uppercase tracking-brand text-text-muted mt-1">Your Last Profit</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Period Log -->
	{#if periods.length > 0}
		<div class="period-log-wrap" class:scrolled-bottom={scrolledBottom}>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="period-log" tabindex="0" role="region" aria-label="Period history log" onscroll={onLogScroll}>
			<table class="log-table">
				<thead>
					<tr class="log-header">
						<th scope="col">Per</th>
						<th scope="col">Load</th>
						<th scope="col">Price</th>
						<th scope="col" class="text-right">Profit</th>
					</tr>
				</thead>
				<tbody>
					{#each periods as period}
						{@const rawProfit = period.players[connection.participantName]?.profit}
						{@const profit = rawProfit != null ? Math.round(rawProfit) : null}
						<tr class="log-row">
							<td class="text-text-muted">{period.number}</td>
							<td>{period.load} MW</td>
							<td>${period.marginal_cost != null ? Math.round(period.marginal_cost) : '—'}</td>
							<td class="text-right"
								class:text-success={profit !== null && profit > 0}
								class:text-danger={profit !== null && profit < 0}
							>
								{profit !== null ? `${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}` : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
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
			<div class="stat-row last">
				<span class="stat-label">Avg Profit</span>
				<span class="font-mono text-xs" class:text-success={stats.avgProfit > 0} class:text-danger={stats.avgProfit < 0} class:text-text-primary={stats.avgProfit === 0}>${stats.avgProfit.toLocaleString()}</span>
			</div>
		</div>
	{/if}
</section>

<style>
	.period-log {
		max-height: 220px;
		overflow-y: auto;
		position: relative;
	}
	/* Bottom fade to hint at scrollable content */
	.period-log-wrap {
		position: relative;
	}
	.period-log-wrap::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 24px;
		background: linear-gradient(to bottom, transparent, white);
		pointer-events: none;
		opacity: 1;
		transition: opacity 150ms ease;
	}
	.period-log-wrap.scrolled-bottom::after {
		opacity: 0;
	}

	.log-table {
		width: 100%;
		border-collapse: collapse;
	}
	/* Override global table styles for this compact log */
	.log-table :global(thead) {
		background: none;
		color: inherit;
	}
	.log-table :global(tbody tr:nth-child(even)) {
		background: none;
	}
	.log-table :global(tbody td) {
		padding: 0;
		font-variant-numeric: normal;
	}

	.log-header th {
		padding: 6px 4px;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border-light);
		position: sticky;
		top: 0;
		background: white;
		text-align: left;
		white-space: nowrap;
	}
	.log-header th:first-child { padding-left: 20px; width: 36px; }
	.log-header th:last-child { padding-right: 20px; }

	.log-row td {
		padding: 5px 4px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
	}
	.log-row td:first-child { padding-left: 20px; width: 36px; }
	.log-row td:last-child { padding-right: 20px; }
	.log-row {
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
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
	}
</style>
