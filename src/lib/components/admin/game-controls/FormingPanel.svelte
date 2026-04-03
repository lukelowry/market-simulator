<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { send } from '$lib/websocket.js';

	let starting = $state(false);

	function startGame() {
		if (starting) return;
		starting = true;
		send({ type: 'startGame' });
	}

	// Reset flag if game goes back to forming (e.g. server rejected)
	$effect(() => {
		if (game.state.state !== 'forming') starting = false;
	});

	const canStart = $derived(
		game.state.state === 'forming' && game.playerCount > 0 && !starting
	);

	const joinPct = $derived(
		game.state.options?.max_participants
			? (game.playerCount / game.state.options.max_participants) * 100
			: 0
	);
</script>

<div class="gcp-forming-header">
	<div class="flex items-center gap-2.5">
		<div class="gcp-dot gcp-dot--gold"></div>
		<span class="label-micro gcp-label">Lobby</span>
	</div>
	<span class="text-text-inverse/70 font-mono text-xs"
		>{game.playerCount} / {game.state.options?.max_participants ?? '?'} players</span
	>
</div>

<div class="gcp-forming-body">
	<!-- Player count ring -->
	<div class="gcp-player-ring">
		<svg class="gcp-player-ring-svg" viewBox="0 0 64 64" aria-hidden="true">
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
				stroke="var(--color-gold)"
				stroke-width="3.5"
				pathLength="100"
				stroke-dasharray="{joinPct} 100"
				stroke-linecap="round"
				transform="rotate(-90 32 32)"
				class="gcp-player-ring-arc"
			/>
		</svg>
		<span class="gcp-player-ring-text">
			<span class="gcp-player-ring-count">{game.playerCount}</span>
			<span class="gcp-player-ring-max">/{game.state.options?.max_participants ?? '?'}</span>
		</span>
	</div>

	<!-- Center: join status -->
	<div class="gcp-lobby-status">
		<div>
			<span class="font-display text-text-primary text-lg font-semibold">Players Joining</span>
			<p class="text-text-muted mt-0.5 text-xs">Waiting for players to join</p>
		</div>
		<div class="gcp-lobby-bar">
			<div
				class="bg-border-light h-1.5 overflow-hidden rounded-full"
				role="progressbar"
				aria-valuenow={game.playerCount}
				aria-valuemin={0}
				aria-valuemax={game.state.options?.max_participants ?? 0}
				aria-label="Players joined"
			>
				<div
					class="from-maroon to-gold ease-brand h-full w-full origin-left rounded-full bg-gradient-to-r transition-transform duration-500"
					style="transform: scaleX({joinPct / 100})"
				></div>
			</div>
		</div>
	</div>

	<!-- Right: controls -->
	<div class="gcp-lobby-controls">
		<button class="gcp-start-btn" onclick={startGame} disabled={!canStart}>
			<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path
					d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"
				/>
			</svg>
			Start
		</button>
	</div>
</div>

<style>
	.gcp-forming-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.4375rem 1rem;
		background: var(--color-maroon);
	}

	/* ============ FORMING STATE ============ */
	.gcp-forming-body {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem 1rem;
	}

	/* Player count ring */
	.gcp-player-ring {
		position: relative;
		width: 4rem;
		height: 4rem;
		flex-shrink: 0;
	}
	.gcp-player-ring-svg {
		width: 4rem;
		height: 4rem;
	}
	.gcp-player-ring-arc {
		transition: stroke-dasharray 0.5s var(--ease-brand);
	}
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
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.gcp-player-ring-max {
		font-size: var(--text-xs);
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
	.gcp-lobby-bar {
		margin-top: 0.125rem;
	}

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
		padding: 0.4375rem 1rem;
		font-family: var(--font-body);
		font-size: var(--text-compact);
		font-weight: 600;
		color: var(--color-text-inverse);
		background: var(--color-maroon);
		border: 1px solid var(--color-maroon);
		border-radius: var(--radius);
		cursor: pointer;
		transition:
			background 200ms var(--ease-brand),
			border-color 200ms var(--ease-brand);
		white-space: nowrap;
	}
	.gcp-start-btn:hover:not(:disabled) {
		background: var(--color-maroon-dark);
		border-color: var(--color-maroon-dark);
	}
	.gcp-start-btn:active:not(:disabled) {
		background: var(--color-maroon-dark);
	}
	.gcp-start-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	@media (pointer: coarse) {
		.gcp-start-btn {
			min-height: 44px;
		}
	}
	.gcp-start-btn:focus-visible {
		outline: 3px solid var(--color-gold);
		outline-offset: 2px;
	}

	/* ============ REDUCED MOTION ============ */
	@media (prefers-reduced-motion: reduce) {
		.gcp-player-ring-arc {
			transition: none;
		}
	}

	/* ============ RESPONSIVE ============ */
	@media (max-width: 640px) {
		.gcp-forming-body {
			flex-wrap: wrap;
		}
		.gcp-lobby-controls {
			flex-direction: row;
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
