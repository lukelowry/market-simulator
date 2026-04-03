<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { getTotalCapacity } from '$lib/utils/marketCalcs.js';

	const isRunningOrCompleted = $derived(game.isActive);

	const marketStats = $derived.by(() => {
		const completed = game.state.periods;
		const offers = Object.values(game.state.gens).map((g) => g.offer);
		const moneys = Object.values(game.state.players).map((p) => p.money);
		return {
			totalLoad: completed.reduce((s, p) => s + p.load, 0),
			periodsCleared: completed.length,
			totalCapacity: getTotalCapacity(game.state.gens),
			avgOffer:
				offers.length > 0 ? Math.round(offers.reduce((a, b) => a + b, 0) / offers.length) : null,
			moneySpread: moneys.length < 2 ? null : Math.max(...moneys) - Math.min(...moneys)
		};
	});

	const leaderboard = $derived(
		Object.entries(game.state.players)
			.map(([key, p]) => ({ key, ...p }))
			.sort((a, b) => b.money - a.money)
	);
	const maxMoney = $derived(
		Math.max(1, ...Object.values(game.state.players).map((p) => Math.max(0, p.money)))
	);
</script>

<div class="stagger flex flex-col gap-5">
	<!-- Leaderboard -->
	{#if isRunningOrCompleted && leaderboard.length > 0}
		<div class="card">
			<h3 class="card-header">Leaderboard</h3>
			<ol class="flex flex-col" aria-label="Player rankings by balance">
				{#each leaderboard as player, i}
					<li
						class="border-border-light ease-brand hover:bg-gold-faint flex items-center gap-2.5 border-b px-4 py-2 transition-[background] duration-100 last:border-b-0 {i ===
						0
							? 'from-gold-faint bg-gradient-to-r to-transparent'
							: ''}"
					>
						<span
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold {i ===
							0
								? 'bg-gold text-text-inverse'
								: i === 1
									? 'bg-silver text-text-inverse'
									: i === 2
										? 'bg-bronze text-text-inverse'
										: 'bg-cream-dark text-text-muted'}" aria-hidden="true">{i + 1}</span
						>
						<div class="min-w-0 flex-1">
							<span class="text-text-primary mb-0.5 block truncate text-sm font-semibold">{player.key}</span>
							<div class="bg-border-light h-[2px] overflow-hidden rounded" aria-hidden="true">
								<div
									class="from-maroon to-gold h-full w-full origin-left rounded bg-gradient-to-r transition-transform duration-[400ms] ease-linear"
									style="transform: scaleX({Math.max(0, player.money) / maxMoney})"
								></div>
							</div>
						</div>
						<span
							class="shrink-0 font-mono text-sm font-semibold"
							class:text-success={player.money > 0}
							class:text-danger={player.money < 0}>{player.money > 0 ? '+' : ''}${player.money.toLocaleString()}</span
						>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<!-- Market Stats (unique data not already shown in the control panel KPI strip) -->
	{#if isRunningOrCompleted && marketStats.periodsCleared > 0}
		<div class="card">
			<h3 class="card-header">Market Stats</h3>
			<div class="card-body">
				<div class="kv-row">
					<span class="label-micro">Total Load</span><span
						class="text-text-primary font-mono text-sm"
						>{marketStats.totalLoad.toLocaleString()} MW</span
					>
				</div>
				<div class="kv-row">
					<span class="label-micro">Total Capacity</span><span
						class="text-text-primary font-mono text-sm">{marketStats.totalCapacity} MW</span
					>
				</div>
				<div class="kv-row">
					<span class="label-micro">Avg Offer</span><span
						class="text-text-primary font-mono text-sm">${marketStats.avgOffer ?? '—'}/MWh</span
					>
				</div>
				<div class="kv-row">
					<span class="label-micro">Periods Cleared</span><span
						class="text-text-primary font-mono text-sm">{marketStats.periodsCleared}</span
					>
				</div>
				{#if marketStats.moneySpread !== null}
					<div class="kv-row">
						<span class="label-micro">Money Spread</span><span
							class="text-text-primary font-mono text-sm"
							>${marketStats.moneySpread.toLocaleString()}</span
						>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
