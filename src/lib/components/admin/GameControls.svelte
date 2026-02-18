<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { send } from '$lib/services/websocket.js';
	import { stateLabel, stateBadge } from '$lib/utils/stateLabels.js';
	import { createCountdown } from '$lib/utils/countdown.svelte.js';
	import { getOffersSubmitted } from '$lib/utils/marketCalcs.js';

	let { onrequestsettings }: { onrequestsettings?: () => void } = $props();

	// Ribbon deriveds (from CommandRibbon)
	const currentStateLabel = $derived(stateLabel(game.state.state));
	const stateBadgeClass = $derived(stateBadge(game.state.state));

	// GameControlPanel logic
	function startGame() { send({ type: 'startGame' }); }
	function advancePeriod() { send({ type: 'advancePeriod' }); }

	function toggleAutoAdvance() {
		send({ type: 'setAutoAdvance', payload: { enabled: !game.state.auto_advance } });
	}

	const isForming = $derived(game.state.state === 'forming' || game.state.state === 'full');
	const isRunning = $derived(game.state.state === 'running');
	const isCompleted = $derived(game.state.state === 'completed');
	const canStart = $derived(isForming && game.state.nplayers > 0);

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

	const offerPct = $derived(offersSubmitted.total > 0
		? Math.round((offersSubmitted.submitted / offersSubmitted.total) * 100)
		: 0);

	const allOffersIn = $derived(offersSubmitted.total > 0 && offersSubmitted.submitted === offersSubmitted.total);

	const isUrgent = $derived(countdownSeconds <= 10 && countdownSeconds > 0);

	// KPI stats (integrated — replaces separate KpiRow)
	const marketStats = $derived.by(() => {
		const costs = game.state.periods.map(p => p.marginal_cost).filter((c): c is number => c !== null);
		const totalCap = Object.values(game.state.gens).reduce((s, g) => s + g.capacity, 0);
		return {
			currentMarginal: costs.length > 0 ? costs[costs.length - 1] : null,
			avgMarginal: costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : null,
			peakMarginal: costs.length > 0 ? Math.max(...costs) : null,
			totalCapacity: totalCap,
			currentLoad: game.state.currentLoad ?? 0
		};
	});

	// Player join progress
	const joinPct = $derived(
		game.state.options?.max_participants
			? (game.state.nplayers / game.state.options.max_participants) * 100
			: 0
	);
</script>

<!-- Ribbon header (from CommandRibbon) -->
<header class="ribbon">
	<div class="flex items-center gap-3 min-w-0">
		<!-- Maroon accent pip -->
		<div class="w-1 h-5 bg-gradient-to-b from-maroon to-gold rounded-full shrink-0" aria-hidden="true"></div>
		<h2 class="m-0 text-lg truncate">{connection.marketName}</h2>
		<button
			class="ribbon-settings"
			onclick={() => { onrequestsettings?.(); }}
			aria-label="Market settings"
			title="Settings"
		>
			<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
				<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
			</svg>
		</button>
	</div>

	<div class="flex items-center gap-2.5 flex-wrap">
		<span class="badge {stateBadgeClass}">{currentStateLabel}</span>
	</div>
</header>

<!-- Game control panel -->
{#if isForming || isRunning || isCompleted}
	<section class="gcp">
		<!-- =================== FORMING STATE =================== -->
		{#if isForming}
			<div class="gcp-forming-header">
				<div class="flex items-center gap-2.5">
					<div class="gcp-dot gcp-dot--gold"></div>
					<span class="gcp-label">Lobby</span>
				</div>
				<span class="font-mono text-xs text-text-inverse/50">{game.state.nplayers} / {game.state.options?.max_participants ?? '?'} players</span>
			</div>

			<div class="gcp-forming-body">
				<!-- Player count ring -->
				<div class="gcp-player-ring">
					<svg class="gcp-player-ring-svg" viewBox="0 0 64 64" aria-hidden="true">
						<circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-border-light)" stroke-width="3" />
						<circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-gold)" stroke-width="3.5"
							pathLength="100" stroke-dasharray="{joinPct} 100"
							stroke-linecap="round" transform="rotate(-90 32 32)"
							class="gcp-player-ring-arc" />
					</svg>
					<span class="gcp-player-ring-text">
						<span class="gcp-player-ring-count">{game.state.nplayers}</span>
						<span class="gcp-player-ring-max">/{game.state.options?.max_participants ?? '?'}</span>
					</span>
				</div>

				<!-- Center: join status -->
				<div class="gcp-lobby-status">
					<div>
						<span class="font-display text-lg font-semibold text-text-primary">Players Joining</span>
						<p class="text-xs text-text-muted mt-0.5">Waiting for players to join</p>
					</div>
					<div class="gcp-lobby-bar">
						<div class="h-1.5 bg-border-light rounded-full overflow-hidden">
							<div class="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-[width] duration-500 ease-brand" style="width: {joinPct}%"></div>
						</div>
					</div>
				</div>

				<!-- Right: controls -->
				<div class="gcp-lobby-controls">
					<button
						class="gcp-start-btn"
						onclick={startGame}
						disabled={!canStart}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
							<path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
						</svg>
						Start
					</button>
				</div>
			</div>

		<!-- =================== RUNNING STATE =================== -->
		{:else if isRunning}
			<div class="gcp-running-header">
				<div class="flex items-center gap-2.5">
					<div class="gcp-dot gcp-dot--live"></div>
					<span class="gcp-label">Live</span>
				</div>
				<span class="font-mono text-xs text-text-inverse/50">
					Period {game.state.period} of {game.state.options?.num_periods ?? '—'}
				</span>
			</div>

			<!-- Main control area -->
			<div class="gcp-running-body">
				<div class="gcp-command-row">
					<!-- Countdown ring -->
					<div class="gcp-countdown" class:gcp-countdown--urgent={isUrgent}>
						<svg class="gcp-countdown-svg" viewBox="0 0 64 64" aria-hidden="true">
							<circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-border-light)" stroke-width="3" />
							<circle cx="32" cy="32" r="27" fill="none" stroke={isUrgent ? 'var(--color-danger)' : 'var(--color-maroon)'} stroke-width="3.5"
								pathLength="100" stroke-dasharray="{countdownPercent} 100"
								stroke-linecap="round" transform="rotate(-90 32 32)"
								class="gcp-countdown-arc" />
						</svg>
						<span class="gcp-countdown-text" class:text-danger={isUrgent}>{countdownText}</span>
					</div>

					<!-- Center: period + offers -->
					<div class="gcp-status-col">
						<div>
							<div class="flex justify-between items-baseline mb-1.5">
								<span class="font-display text-lg font-semibold text-text-primary">Period {game.state.period}</span>
								<span class="font-mono text-xs text-text-muted">{Math.round(periodProgress)}%</span>
							</div>
							<div class="h-1.5 bg-border-light rounded-full overflow-hidden">
								<div class="h-full bg-gradient-to-r from-maroon to-gold rounded-full gcp-progress-fill" style="width: {periodProgress}%"></div>
							</div>
						</div>

						<div class="gcp-offers" class:gcp-offers--complete={allOffersIn}>
							<div class="flex justify-between items-center mb-1">
								<span class="text-xs font-semibold {allOffersIn ? 'text-success' : 'text-text-muted'}">
									{allOffersIn ? 'All Offers In' : 'Offers'}
								</span>
								<span class="font-mono text-xs font-bold text-text-primary">{offersSubmitted.submitted}<span class="text-text-muted font-normal"> / {offersSubmitted.total}</span></span>
							</div>
							<div class="h-1 bg-border-light rounded-full overflow-hidden">
								<div class="h-full rounded-full transition-[width] duration-300 ease-linear {allOffersIn ? 'bg-success' : 'bg-maroon'}" style="width: {offerPct}%"></div>
							</div>
						</div>
					</div>

					<!-- Right: controls -->
					<div class="gcp-controls">
						<label class="toggle">
							<input type="checkbox" role="switch" checked={game.state.auto_advance} onclick={toggleAutoAdvance} aria-label="Toggle auto-advance" />
							<span class="toggle-label">Auto</span>
						</label>
						<button class="btn btn-primary btn-sm" onclick={advancePeriod}>
							Advance
							<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
								<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
							</svg>
						</button>
					</div>
				</div>
			</div>

			<!-- KPI strip -->
			<div class="gcp-kpi-strip">
				<div class="gcp-kpi">
					<span class="gcp-kpi-value">${marketStats.currentMarginal ?? '—'}</span>
					<span class="gcp-kpi-label">Marginal</span>
					<span class="gcp-kpi-sub">avg ${marketStats.avgMarginal ?? '—'} · peak ${marketStats.peakMarginal ?? '—'}</span>
				</div>
				<div class="gcp-kpi-divider"></div>
				<div class="gcp-kpi">
					<span class="gcp-kpi-value">{marketStats.currentLoad}<span class="gcp-kpi-unit"> MW</span></span>
					<span class="gcp-kpi-label">Load</span>
					<span class="gcp-kpi-sub">of {marketStats.totalCapacity} MW capacity</span>
				</div>
				<div class="gcp-kpi-divider"></div>
				<div class="gcp-kpi">
					<span class="gcp-kpi-value">{game.state.connectedClients?.length ?? 0}<span class="gcp-kpi-unit"> / {Object.keys(game.state.players).length}</span></span>
					<span class="gcp-kpi-label">Online</span>
					<span class="gcp-kpi-sub">{game.state.options?.payment_method === 'pay_as_offered' ? 'PAO' : 'LAO'} · {game.state.options?.auto_advance_time ?? '—'}s timer</span>
				</div>
			</div>

		<!-- =================== COMPLETED STATE =================== -->
		{:else if isCompleted}
			<div class="gcp-complete-header">
				<div class="flex items-center gap-2.5">
					<div class="gcp-dot gcp-dot--gold"></div>
					<span class="gcp-label">Complete</span>
				</div>
				<span class="font-mono text-xs text-text-inverse/50">{game.state.options?.num_periods ?? 0} periods played</span>
			</div>

			<div class="gcp-complete-body">
				<div class="gcp-complete-badge">
					<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
					</svg>
				</div>
				<div>
					<span class="block text-sm font-semibold text-text-primary">Game Complete</span>
					<span class="block text-xs text-text-muted mt-0.5">All {game.state.options?.num_periods ?? 0} periods played. Review results below.</span>
				</div>
			</div>

			<!-- Final KPI strip -->
			<div class="gcp-kpi-strip">
				<div class="gcp-kpi">
					<span class="gcp-kpi-value">${marketStats.currentMarginal ?? '—'}</span>
					<span class="gcp-kpi-label">Final Marginal</span>
					<span class="gcp-kpi-sub">avg ${marketStats.avgMarginal ?? '—'} · peak ${marketStats.peakMarginal ?? '—'}</span>
				</div>
				<div class="gcp-kpi-divider"></div>
				<div class="gcp-kpi">
					<span class="gcp-kpi-value">{marketStats.currentLoad}<span class="gcp-kpi-unit"> MW</span></span>
					<span class="gcp-kpi-label">Final Load</span>
					<span class="gcp-kpi-sub">of {marketStats.totalCapacity} MW capacity</span>
				</div>
				<div class="gcp-kpi-divider"></div>
				<div class="gcp-kpi">
					<span class="gcp-kpi-value">{Object.keys(game.state.players).length}</span>
					<span class="gcp-kpi-label">Players</span>
					<span class="gcp-kpi-sub">{game.state.options?.payment_method === 'pay_as_offered' ? 'PAO' : 'LAO'} mode</span>
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	/* ---- Ribbon (from CommandRibbon) ---- */
	.ribbon {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--color-border-light);
	}

	.ribbon-settings {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 150ms var(--ease-brand);
	}
	.ribbon-settings:hover {
		background: var(--color-maroon-faint);
		color: var(--color-maroon);
	}

	/* ---- Panel shell ---- */
	.gcp {
		background: white;
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	/* ---- Shared elements ---- */
	.gcp-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: rgba(245, 242, 237, 0.8);
	}

	.gcp-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.gcp-dot--gold { background: var(--color-gold); }
	.gcp-dot--live { background: var(--color-success); animation: pulse 1.2s ease-in-out infinite; }

	/* ---- Dark header strips ---- */
	.gcp-forming-header,
	.gcp-running-header,
	.gcp-complete-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 1.25rem;
		background: var(--color-maroon);
	}

	/* ============ FORMING STATE ============ */
	.gcp-forming-body {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 1rem 1.25rem;
	}

	/* Player count ring (mirrors countdown ring) */
	.gcp-player-ring {
		position: relative;
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}
	.gcp-player-ring-svg { width: 64px; height: 64px; }
	.gcp-player-ring-arc { transition: stroke-dasharray 0.5s var(--ease-brand); }
	.gcp-player-ring-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		line-height: 1;
	}
	.gcp-player-ring-count {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.gcp-player-ring-max {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	/* Lobby status column */
	.gcp-lobby-status {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.gcp-lobby-bar { margin-top: 0.125rem; }

	/* Lobby controls */
	.gcp-lobby-controls {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.625rem;
		flex-shrink: 0;
	}

	.gcp-start-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem 1.125rem;
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 700;
		color: white;
		background: var(--color-maroon);
		border: 2px solid var(--color-maroon);
		border-radius: var(--radius);
		cursor: pointer;
		transition: all 200ms var(--ease-brand);
		white-space: nowrap;
	}
	.gcp-start-btn:hover:not(:disabled) {
		background: var(--color-maroon-dark);
		box-shadow: var(--shadow-maroon);
		transform: translateY(-1px);
	}
	.gcp-start-btn:active:not(:disabled) { transform: translateY(0); }
	.gcp-start-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.gcp-start-btn:focus-visible { outline: 3px solid var(--color-gold); outline-offset: 2px; }

	/* ============ RUNNING STATE ============ */
	.gcp-running-body {
		padding: 1rem 1.25rem;
	}

	.gcp-command-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	/* Countdown ring */
	.gcp-countdown {
		position: relative;
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}
	.gcp-countdown-svg { width: 64px; height: 64px; }
	.gcp-countdown-arc { transition: stroke-dasharray 0.3s ease, stroke 0.3s ease; }
	.gcp-countdown-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 700;
		color: var(--color-maroon);
	}
	.gcp-countdown--urgent { animation: urgentPulse 0.8s ease-in-out infinite; }

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
		transition: all 300ms var(--ease-brand);
	}
	.gcp-offers--complete {
		background: var(--color-success-bg);
		border-color: rgba(45, 138, 78, 0.15);
	}

	/* Controls column */
	.gcp-controls {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.625rem;
		flex-shrink: 0;
	}

	.gcp-progress-fill { transition: width 400ms ease-linear; }

	/* ============ KPI STRIP ============ */
	.gcp-kpi-strip {
		display: flex;
		border-top: 1px solid var(--color-border-light);
		background: var(--color-cream);
	}

	.gcp-kpi {
		flex: 1;
		padding: 0.625rem 1rem;
		text-align: center;
		min-width: 0;
	}

	.gcp-kpi-value {
		display: block;
		font-family: var(--font-mono);
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text-primary);
		line-height: 1.2;
	}

	.gcp-kpi-unit {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.gcp-kpi-label {
		display: block;
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
		margin-top: 0.125rem;
	}

	.gcp-kpi-sub {
		display: block;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-text-muted);
		margin-top: 0.125rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.gcp-kpi-divider {
		width: 1px;
		background: var(--color-border-light);
		align-self: stretch;
	}

	/* ============ COMPLETED STATE ============ */
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
		background: linear-gradient(135deg, var(--color-gold-faint), rgba(200, 155, 60, 0.2));
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--color-gold);
	}

	/* ============ ANIMATIONS ============ */
	@keyframes urgentPulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.04); }
	}

	/* ============ RESPONSIVE ============ */
	@media (max-width: 640px) {
		.gcp-forming-body,
		.gcp-command-row {
			flex-wrap: wrap;
		}
		.gcp-lobby-controls,
		.gcp-controls {
			flex-direction: row;
			width: 100%;
			justify-content: space-between;
		}
		.gcp-kpi-strip {
			flex-wrap: wrap;
		}
		.gcp-kpi {
			flex-basis: 50%;
		}
		.gcp-kpi-divider {
			display: none;
		}
	}
</style>
