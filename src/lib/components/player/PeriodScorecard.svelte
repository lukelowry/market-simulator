<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';

	let scrolledBottom = $state(false);
	let sentinel = $state<HTMLDivElement | undefined>();

	// Use IntersectionObserver instead of scroll-event layout reads
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			([entry]) => { scrolledBottom = entry.isIntersecting; },
			{ threshold: 0.1 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	const periods = $derived([...game.state.periods].reverse());
	const lastPeriod = $derived(periods[0] ?? null);

	const lastClearingPrice = $derived(
		lastPeriod?.marginal_cost != null ? Math.round(lastPeriod.marginal_cost) : null
	);
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
	<h3 class="card-header">Market History</h3>

	{#if lastClearingPrice !== null}
		<!-- Hero: Last Clearing Price -->
		<div class="border-border-light border-b px-4 py-3 text-center">
			<span class="text-text-primary block font-mono text-2xl leading-none font-bold">
				${lastClearingPrice}
			</span>
			<span class="tracking-brand text-text-muted mt-1.5 block text-[11px] font-semibold uppercase"
				>Clearing Price</span
			>
			{#if lastProfit !== null}
				<div class="mt-2">
					<span
						class="inline-block rounded-sm px-2 py-0.5 font-mono text-sm font-semibold"
						class:text-success={lastProfit > 0}
						class:bg-success-bg={lastProfit > 0}
						class:text-danger={lastProfit < 0}
						class:bg-danger-bg={lastProfit < 0}
						class:text-text-muted={lastProfit === 0}
					>
						{lastProfit >= 0 ? '+' : ''}${lastProfit.toLocaleString()}
					</span>
					<span
						class="tracking-brand text-text-muted mt-1 block text-[11px] font-semibold uppercase"
						>Your Last Profit</span
					>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Period Log -->
	{#if periods.length > 0}
		<div class="period-log-wrap" class:scrolled-bottom={scrolledBottom}>
			<div
				class="period-log"
				role="region"
				aria-label="Period history log"
			>
				<table class="log-table table-plain">
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
								<td
									class="text-right"
									class:text-success={profit !== null && profit > 0}
									class:text-danger={profit !== null && profit < 0}
								>
									{profit !== null ? `${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}` : '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<div bind:this={sentinel} class="h-px" aria-hidden="true"></div>
			</div>
		</div>
	{:else}
		<div class="text-text-muted px-4 py-5 text-center text-sm italic">No periods cleared yet.</div>
	{/if}

	<!-- Summary Stats -->
	{#if stats}
		<div class="border-border-light border-t px-4 py-2.5">
			<div class="stat-row">
				<span class="label-micro">Avg Price</span>
				<span class="text-text-primary font-mono text-xs">${stats.avgPrice}/MWh</span>
			</div>
			<div class="stat-row last">
				<span class="label-micro">Avg Profit</span>
				<span
					class="font-mono text-xs"
					class:text-success={stats.avgProfit > 0}
					class:text-danger={stats.avgProfit < 0}
					class:text-text-primary={stats.avgProfit === 0}>{stats.avgProfit >= 0 ? '+' : ''}${stats.avgProfit.toLocaleString()}</span
				>
			</div>
		</div>
	{/if}
</section>

<style>
	.period-log {
		max-height: min(13.75rem, 40vh);
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
		background: linear-gradient(to bottom, transparent, var(--color-surface));
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

	.log-header th {
		padding: 6px 4px;
		font-family: var(--font-body);
		font-size: var(--text-micro);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border-light);
		position: sticky;
		top: 0;
		background: var(--color-surface);
		text-align: left;
		/* Headers are short ("Per", "Load", "Price", "Profit") — allow wrapping on narrow containers */
	}
	.log-header th:first-child {
		padding-left: 16px;
		width: 36px;
	}
	.log-header th:last-child {
		padding-right: 16px;
	}

	.log-row td {
		padding: 6px 6px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 500;
	}
	.log-row td:first-child {
		padding-left: 16px;
		width: 36px;
	}
	.log-row td:last-child {
		padding-right: 16px;
	}
	.log-row {
		border-bottom: 1px solid var(--color-border-light);
		transition: background 100ms var(--ease-brand);
	}
	.log-row:last-child {
		border-bottom: none;
	}
	.log-row:hover {
		background: var(--color-gold-faint);
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 4px 0;
		border-bottom: 1px solid var(--color-border-light);
	}
	.stat-row.last {
		border-bottom: none;
	}
</style>
