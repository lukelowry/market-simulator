<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { createCountdown } from '$lib/utils/countdown.svelte.js';
	import { hasSubmitted } from '$lib/utils/marketCalcs.js';

	const myPlayer = $derived(game.state.players[connection.participantName] ?? null);
	const totalPlayers = $derived(game.playerCount);
	const isActive = $derived(game.isActive);
	const hasSubmittedThisPeriod = $derived(
		myPlayer !== null && hasSubmitted(myPlayer.last_offer_time, game.state.last_advance_time)
	);

	const countdown = createCountdown();
	const countdownSeconds = $derived(countdown.active ? countdown.seconds : null);

	const shouldCountdown = $derived(game.state.state === 'running' && game.state.auto_advance);

	/** Last cleared period's load (MW). */
	const lastLoad = $derived.by(() => {
		const ps = game.state.periods;
		return ps.length > 0 ? ps[ps.length - 1].load : null;
	});

	/** Next period's forecasted load (MW). Sent by server to participants. */
	const nextLoad = $derived(game.state.nextLoad ?? null);

	$effect(() => {
		if (shouldCountdown) {
			countdown.start();
		} else {
			countdown.stop();
		}
		return () => countdown.stop();
	});
</script>

<aside
	class="stagger flex flex-col gap-5 min-[769px]:sticky min-[769px]:top-8 min-[769px]:max-h-[calc(100vh-var(--navbar-height)-var(--sidebar-offset))] min-[769px]:overflow-y-auto"
	aria-label="Player information"
>
	<!-- Rank + Balance hero card -->
	{#if isActive && myPlayer}
		<div class="card overflow-hidden">
			<!-- Rank strip -->
			{#if game.playerRank}
				<div
					class="from-maroon to-maroon-dark flex items-center justify-between bg-gradient-to-r px-4 py-2"
				>
					<span class="tracking-brand text-text-inverse/70 text-xs font-semibold uppercase">
						{game.state.state === 'completed' ? 'Final Rank' : 'Rank'}
					</span>
					<div class="flex items-baseline gap-0.5">
						<span class="text-gold font-mono text-lg font-bold">#{game.playerRank}</span>
						<span class="text-text-inverse/70 ml-1 text-xs">of {totalPlayers}</span>
					</div>
				</div>
			{/if}
			<!-- Balance -->
			<div class="px-4 py-4 text-center">
				<span
					class="block font-mono text-3xl leading-none font-bold"
					class:text-success={myPlayer.money > 0}
					class:text-danger={myPlayer.money < 0}
					class:text-text-primary={myPlayer.money === 0}
				>
					{myPlayer.money > 0 ? '+' : ''}${myPlayer.money.toLocaleString()}
				</span>
				<span class="tracking-brand text-text-muted mt-2 block text-xs font-semibold uppercase"
					>Balance</span
				>
			</div>
		</div>
	{/if}

	<!-- Game Info Card -->
	<div class="card">
		<h3 class="card-header">Game</h3>
		<div class="card-body text-sm">
			<div class="kv-row">
				<span class="label-micro">Market</span>
				<span class="text-text-primary min-w-0 truncate font-mono font-medium" title={connection.marketName}
					>{connection.marketName}</span
				>
			</div>
			<div class="kv-row">
				<span class="label-micro">Players</span>
				<span class="text-text-primary font-mono font-medium">{game.playerCount}</span>
			</div>
			<div class="kv-row">
				<span class="label-micro">Period</span>
				<span class="text-text-primary font-mono font-medium"
					>{game.state.period} / {game.state.options?.num_periods ?? '—'}</span
				>
			</div>
			{#if game.state.state === 'running'}
				<div class="kv-row">
					<span class="label-micro">Timer</span>
					<span
						class="ease-brand font-mono font-medium transition-[color] duration-200 {countdownSeconds !==
							null && countdownSeconds < 10
							? 'text-danger font-bold'
							: 'text-text-primary'}"
					>
						{#if countdownSeconds !== null}
							{countdownSeconds}s
						{:else}
							<svg
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="currentColor"
								class="text-text-muted inline-block align-[-2px]"
								aria-label="Paused"
								><path
									d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"
								/></svg
							>
						{/if}
					</span>
				</div>
				<div class="kv-row">
					<span class="label-micro">Offers</span>
					{#if hasSubmittedThisPeriod}
						<span class="badge badge-success">Submitted</span>
					{:else}
						<span class="badge badge-warning">Pending</span>
					{/if}
				</div>
			{/if}
			{#if isActive && (lastLoad !== null || nextLoad !== null)}
				<div class="kv-row">
					<span class="label-micro">Load</span>
					<span class="text-text-primary font-mono font-medium">
						{lastLoad !== null ? `${lastLoad} MW` : '—'}
					</span>
				</div>
				{#if nextLoad !== null && game.state.state === 'running'}
					<div class="kv-row">
						<span class="label-micro">Next Load</span>
						<span class="text-info font-mono font-medium">{nextLoad} MW</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Status message for non-active states -->
	{#if !isActive && game.statusMessage && game.state.state !== 'forming'}
		<div class="card">
			<div class="card-body text-text-muted text-center text-sm italic">
				{game.statusMessage}
			</div>
		</div>
	{/if}
</aside>
