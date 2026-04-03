<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { send } from '$lib/websocket.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { paymentLabel } from '$lib/utils/stateLabels.js';
	import { createCountdown } from '$lib/utils/countdown.svelte.js';
	import { getOffersSubmitted, getMarketStats } from '$lib/utils/marketCalcs.js';

	let advancing = $state(false);
	let lastSeenPeriod = $state(game.state.period);
	let lastSeenState = $state(game.state.state);

	function advancePeriod() {
		if (advancing) return;
		advancing = true;
		send({ type: 'advancePeriod' });
	}

	// Reset the advancing guard when the period or game state actually changes,
	// not on every broadcast (which would defeat the double-click guard).
	$effect(() => {
		const currentPeriod = game.state.period;
		const currentState = game.state.state;
		if (currentPeriod !== lastSeenPeriod || currentState !== lastSeenState) {
			lastSeenPeriod = currentPeriod;
			lastSeenState = currentState;
			advancing = false;
		}
	});

	// Also reset if the server rejected the action (period/state won't change in that case).
	$effect(() => {
		if (connection.lastActionError) advancing = false;
	});

	function toggleAutoAdvance() {
		send({ type: 'setAutoAdvance', payload: { enabled: !game.state.auto_advance } });
	}

	const countdown = createCountdown();
	const countdownText = $derived(countdown.text);
	const countdownPercent = $derived(countdown.percent);
	const countdownSeconds = $derived(countdown.seconds);

	const shouldCountdown = $derived(game.state.state === 'running' && game.state.auto_advance);

	$effect(() => {
		if (shouldCountdown) {
			countdown.start();
		} else {
			countdown.stop();
		}
		return () => countdown.stop();
	});

	const periodProgress = $derived.by(() => {
		if (!game.state.options) return 0;
		return (game.state.period / game.state.options.num_periods) * 100;
	});

	const offersSubmitted = $derived(getOffersSubmitted(game.state));

	const offerPct = $derived(
		offersSubmitted.total > 0
			? Math.round((offersSubmitted.submitted / offersSubmitted.total) * 100)
			: 0
	);

	const allOffersIn = $derived(
		offersSubmitted.total > 0 && offersSubmitted.submitted === offersSubmitted.total
	);

	const isUrgent = $derived(countdownSeconds <= 10 && countdownSeconds > 0);

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

<div class="gcp-running-header">
	<div class="flex items-center gap-2.5">
		<div class="gcp-dot gcp-dot--live"></div>
		<span class="label-micro gcp-label">Live</span>
	</div>
	<span class="text-text-inverse/70 font-mono text-xs">
		Period {game.state.period} of {game.state.options?.num_periods ?? '—'}
	</span>
</div>

<!-- Main control area -->
<div class="gcp-running-body">
	<div class="gcp-command-row">
		<!-- Countdown ring -->
		<div class="gcp-countdown" class:gcp-countdown--urgent={isUrgent}>
			<svg class="gcp-countdown-svg" viewBox="0 0 64 64" aria-hidden="true">
				<circle
					cx="32"
					cy="32"
					r="27"
					fill="none"
					stroke="var(--color-border-light)"
					stroke-width="3"
				/>
				<circle
					cx="32"
					cy="32"
					r="27"
					fill="none"
					stroke={isUrgent ? 'var(--color-danger)' : 'var(--color-maroon)'}
					stroke-width="3.5"
					pathLength="100"
					stroke-dasharray="{countdownPercent} 100"
					stroke-linecap="round"
					transform="rotate(-90 32 32)"
					class="gcp-countdown-arc"
				/>
			</svg>
			<span class="gcp-countdown-text" class:text-danger={isUrgent}>
				{#if countdownText}
					{countdownText}
				{:else}
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="currentColor"
						aria-label="Paused"
						><path
							d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"
						/></svg
					>
				{/if}
			</span>
		</div>

		<!-- Center: period + offers -->
		<div class="gcp-status-col">
			<div>
				<div class="mb-1.5 flex items-baseline justify-between">
					<span class="font-display text-text-primary text-lg font-semibold"
						>Period {game.state.period}</span
					>
					<span class="text-text-muted font-mono text-xs">{Math.round(periodProgress)}%</span>
				</div>
				<div
					class="bg-border-light h-1.5 overflow-hidden rounded-full"
					role="progressbar"
					aria-valuenow={Math.round(periodProgress)}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="Period progress"
				>
					<div
						class="from-maroon to-gold gcp-progress-fill h-full w-full origin-left rounded-full bg-gradient-to-r"
						style="transform: scaleX({periodProgress / 100})"
					></div>
				</div>
			</div>

			<div class="gcp-offers" class:gcp-offers--complete={allOffersIn}>
				<div class="mb-1 flex items-center justify-between">
					<span
						class="text-xs font-semibold {allOffersIn ? 'text-success' : 'text-text-muted'}"
					>
						{allOffersIn ? 'All Offers In' : 'Offers'}
					</span>
					<span class="text-text-primary font-mono text-xs font-bold"
						>{offersSubmitted.submitted}<span class="text-text-muted font-normal">
							/ {offersSubmitted.total}</span
						></span
					>
				</div>
				<div
					class="bg-border-light h-1 overflow-hidden rounded-full"
					role="progressbar"
					aria-valuenow={offersSubmitted.submitted}
					aria-valuemin={0}
					aria-valuemax={offersSubmitted.total}
					aria-label="Offers submitted"
				>
					<div
						class="h-full w-full origin-left rounded-full transition-transform duration-300 ease-linear {allOffersIn
							? 'bg-success'
							: 'bg-maroon'}"
						style="transform: scaleX({offerPct / 100})"
					></div>
				</div>
			</div>
		</div>

		<!-- Right: controls -->
		<div class="gcp-controls">
			<label class="toggle">
				<input
					type="checkbox"
					role="switch"
					checked={game.state.auto_advance}
					onclick={toggleAutoAdvance}
					aria-label="Toggle auto-advance"
				/>
				<span class="toggle-label">Auto</span>
			</label>
			<button class="btn btn-primary btn-sm" onclick={advancePeriod} disabled={advancing}>
				Advance
				<svg
					width="12"
					height="12"
					viewBox="0 0 16 16"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>

<!-- KPI strip -->
<div class="gcp-kpi-strip">
	{@render kpiPair('')}
	<div class="gcp-kpi">
		<span class="gcp-kpi-value"
			>{game.state.connectedClients?.length ?? 0}<span class="gcp-kpi-unit">
				/ {Object.keys(game.state.players).length}</span
			></span
		>
		<span class="label-micro gcp-kpi-label">Online</span>
		<span class="gcp-kpi-sub"
			>{paymentLabel(game.state.options?.payment_method)} · {game.state.options
				?.auto_advance_time ?? '—'}s timer</span
		>
	</div>
</div>

<style>
	.gcp-running-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.4375rem 1rem;
		background: var(--color-maroon);
	}

	/* ============ RUNNING STATE ============ */
	.gcp-running-body {
		padding: 0.875rem 1rem;
	}

	.gcp-command-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	/* Countdown ring */
	.gcp-countdown {
		position: relative;
		width: 4rem;
		height: 4rem;
		flex-shrink: 0;
	}
	.gcp-countdown-svg {
		width: 4rem;
		height: 4rem;
	}
	.gcp-countdown-arc {
		transition:
			stroke-dasharray var(--duration-slow) var(--ease-brand),
			stroke var(--duration-slow) var(--ease-brand);
	}
	.gcp-countdown-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--color-maroon);
	}
	.gcp-countdown--urgent {
		animation: urgentPulse 0.8s ease-in-out infinite;
	}

	/* Status column */
	.gcp-status-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	/* Offers status */
	.gcp-offers {
		padding: 0.5rem 0.75rem;
		background: var(--color-cream);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-sm);
		transition:
			background var(--duration-slow) var(--ease-brand),
			border-color var(--duration-slow) var(--ease-brand);
	}
	.gcp-offers--complete {
		background: var(--color-success-bg);
		border-color: var(--color-success-bg);
	}

	/* Controls column */
	.gcp-controls {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.625rem;
		flex-shrink: 0;
	}

	.gcp-progress-fill {
		transition: transform var(--duration-slow) linear;
	}

	/* ============ ANIMATIONS ============ */
	@keyframes urgentPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.04);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gcp-countdown--urgent {
			animation: none;
		}
	}

	@media (max-width: 640px) {
		.gcp-command-row {
			flex-wrap: wrap;
		}
		.gcp-controls {
			flex-direction: row;
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
