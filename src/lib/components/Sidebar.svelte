<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { createCountdown } from '$lib/utils/countdown.svelte.js';

	const myPlayer = $derived(game.state.players[connection.participantName] ?? null);
	const totalPlayers = $derived(Object.keys(game.state.players).length);
	const isActive = $derived(game.isActive);
	const hasSubmittedThisPeriod = $derived(
		myPlayer !== null && myPlayer.last_offer_time > game.state.last_advance_time
	);

	const countdown = createCountdown();
	const countdownSeconds = $derived(countdown.active ? countdown.seconds : null);

	const shouldCountdown = $derived(game.state.state === 'running' && game.state.auto_advance);

	$effect(() => {
		if (shouldCountdown) {
			countdown.start();
		} else {
			countdown.stop();
		}
		return () => countdown.stop();
	});
</script>

<aside class="sticky top-8 flex flex-col gap-5 stagger max-h-[calc(100vh-140px)] overflow-y-auto" aria-label="Player information">
	<!-- Rank + Balance hero card -->
	{#if isActive && myPlayer}
		<div class="card overflow-hidden">
			<!-- Rank strip -->
			{#if game.playerRank}
				<div class="flex items-center justify-between py-2.5 px-5 bg-gradient-to-r from-maroon to-maroon-dark">
					<span class="text-xs font-semibold uppercase tracking-brand text-text-inverse/70">
						{game.state.state === 'completed' ? 'Final Rank' : 'Rank'}
					</span>
					<div class="flex items-baseline gap-0.5">
						<span class="font-mono text-lg font-bold text-gold">#{game.playerRank}</span>
						<span class="text-xs text-text-inverse/50 ml-1">of {totalPlayers}</span>
					</div>
				</div>
			{/if}
			<!-- Balance -->
			<div class="py-5 px-5 text-center">
				<span class="block font-mono text-3xl font-bold leading-none" class:text-success={myPlayer.money > 0} class:text-danger={myPlayer.money < 0} class:text-text-primary={myPlayer.money === 0}>
					${myPlayer.money.toLocaleString()}
				</span>
				<span class="block text-xs font-semibold uppercase tracking-brand text-text-muted mt-2">Balance</span>
			</div>
		</div>
	{/if}

	<!-- Game Info Card -->
	<div class="card">
		<div class="card-header">Game</div>
		<div class="card-body text-sm">
			<div class="sb-row">
				<span class="sb-label">Market</span>
				<span class="font-mono font-medium text-text-primary">{connection.marketName}</span>
			</div>
			<div class="sb-row">
				<span class="sb-label">Players</span>
				<span class="font-mono font-medium text-text-primary">{game.playerCount}</span>
			</div>
			<div class="sb-row">
				<span class="sb-label">Period</span>
				<span class="font-mono font-medium text-text-primary">{game.state.period} / {game.state.options?.num_periods ?? '—'}</span>
			</div>
			{#if game.state.state === 'running'}
				<div class="sb-row">
					<span class="sb-label">Timer</span>
					<span class="font-mono font-medium transition-[color] duration-200 ease-brand {countdownSeconds !== null && countdownSeconds < 10 ? 'text-danger font-bold animate-pulse' : 'text-text-primary'}">
						{#if countdownSeconds !== null}
							{countdownSeconds}s
						{:else}
							<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="inline-block align-[-2px] text-text-muted" aria-label="Paused"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>
						{/if}
					</span>
				</div>
				<div class="sb-row">
					<span class="sb-label">Offers</span>
					{#if hasSubmittedThisPeriod}
						<span class="badge badge-success">Submitted</span>
					{:else}
						<span class="badge badge-warning">Pending</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Status message for non-active states -->
	{#if !isActive && game.statusMessage && game.state.state !== 'forming'}
		<div class="card">
			<div class="card-body text-center text-sm text-text-muted italic">
				{game.statusMessage}
			</div>
		</div>
	{/if}
</aside>

<style>
	.sb-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border-light);
	}
	.sb-row:first-child { padding-top: 0; }
	.sb-row:last-child { border-bottom: none; padding-bottom: 0; }

	.sb-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
	}
</style>
