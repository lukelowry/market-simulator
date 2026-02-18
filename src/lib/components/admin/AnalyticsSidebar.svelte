<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';

	const isRunningOrCompleted = $derived(game.state.state === 'running' || game.state.state === 'completed');

	const marketStats = $derived.by(() => {
		const completed = game.state.periods;
		const totalCap = Object.values(game.state.gens).reduce((s, g) => s + g.capacity, 0);
		const offers = Object.values(game.state.gens).map(g => g.offer);
		const moneys = Object.values(game.state.players).map(p => p.money);
		return {
			totalLoad: completed.reduce((s, p) => s + p.load, 0),
			periodsCleared: completed.length,
			totalCapacity: totalCap,
			avgOffer: offers.length > 0 ? Math.round(offers.reduce((a, b) => a + b, 0) / offers.length) : null,
			moneySpread: moneys.length < 2 ? null : Math.max(...moneys) - Math.min(...moneys)
		};
	});

	const leaderboard = $derived(Object.entries(game.state.players).map(([key, p]) => ({ key, ...p })).sort((a, b) => b.money - a.money));
	const maxMoney = $derived(Math.max(1, ...Object.values(game.state.players).map(p => Math.max(0, p.money))));
</script>

<div class="flex flex-col gap-5 stagger">
	<!-- Leaderboard -->
	{#if isRunningOrCompleted && leaderboard.length > 0}
		<div class="card">
			<div class="card-header">Leaderboard</div>
			<div class="flex flex-col">
				{#each leaderboard as player, i}
					<div class="flex items-center gap-3 py-3 px-5 border-b border-border-light transition-[background] duration-100 ease-brand last:border-b-0 hover:bg-gold-faint {i === 0 ? 'bg-gradient-to-r from-gold-faint to-transparent' : ''}">
						<span class="w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded-full shrink-0 {i === 0 ? 'bg-gold text-white' : i === 1 ? 'bg-[#b8b8b8] text-white' : i === 2 ? 'bg-[#cd7f32] text-white' : 'bg-cream-dark text-text-muted'}">{i + 1}</span>
						<div class="flex-1 min-w-0">
							<span class="block text-sm font-semibold text-text-primary mb-0.5">{player.key}</span>
							<div class="h-[3px] bg-border-light rounded-full overflow-hidden">
								<div class="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-[width] duration-[400ms] ease-linear" style="width: {Math.max(0, player.money) / maxMoney * 100}%"></div>
							</div>
						</div>
						<span class="font-mono text-sm font-semibold shrink-0" class:text-success={player.money > 0} class:text-danger={player.money < 0}>${player.money.toLocaleString()}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Market Stats (unique data not already shown in the control panel KPI strip) -->
	{#if isRunningOrCompleted && marketStats.periodsCleared > 0}
		<div class="card">
			<div class="card-header">Market Stats</div>
			<div class="card-body">
				<div class="flex justify-between items-baseline py-2 border-b border-border-light first:pt-0 last:border-b-0 last:pb-0"><span class="text-xs font-semibold uppercase tracking-brand text-text-muted">Total Load</span><span class="font-mono text-sm text-text-primary">{marketStats.totalLoad.toLocaleString()} MW</span></div>
				<div class="flex justify-between items-baseline py-2 border-b border-border-light last:border-b-0 last:pb-0"><span class="text-xs font-semibold uppercase tracking-brand text-text-muted">Total Capacity</span><span class="font-mono text-sm text-text-primary">{marketStats.totalCapacity} MW</span></div>
				<div class="flex justify-between items-baseline py-2 border-b border-border-light last:border-b-0 last:pb-0"><span class="text-xs font-semibold uppercase tracking-brand text-text-muted">Avg Offer</span><span class="font-mono text-sm text-text-primary">${marketStats.avgOffer ?? '—'}/MWh</span></div>
				<div class="flex justify-between items-baseline py-2 border-b border-border-light last:border-b-0 last:pb-0"><span class="text-xs font-semibold uppercase tracking-brand text-text-muted">Periods Cleared</span><span class="font-mono text-sm text-text-primary">{marketStats.periodsCleared}</span></div>
				{#if marketStats.moneySpread !== null}
					<div class="flex justify-between items-baseline py-2 last:border-b-0 last:pb-0"><span class="text-xs font-semibold uppercase tracking-brand text-text-muted">Money Spread</span><span class="font-mono text-sm text-text-primary">${marketStats.moneySpread.toLocaleString()}</span></div>
				{/if}
			</div>
		</div>
	{/if}
</div>
