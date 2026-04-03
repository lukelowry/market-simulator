<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { hasSubmitted } from '$lib/utils/marketCalcs.js';

	let { onselect }: { onselect: (playerId: string) => void } = $props();

	const isRunningOrCompleted = $derived(game.isActive);
	const isRunning = $derived(game.state.state === 'running');

	const offerStatus = $derived.by(() => {
		const result: Record<string, 'submitted' | 'pending'> = {};
		for (const [key, player] of Object.entries(game.state.players)) {
			result[key] = hasSubmitted(player.last_offer_time, game.state.last_advance_time) ? 'submitted' : 'pending';
		}
		return result;
	});

	const sortedPlayers = $derived(
		Object.entries(game.state.players)
			.map(([key, p]) => ({ key, ...p }))
			.sort((a, b) => b.money - a.money || a.key.localeCompare(b.key))
	);

	// Sparkline data memoized per-player — recomputes only when periods change
	const sparklines = $derived.by(() => {
		if (!game.isActive) return {} as Record<string, { path: string; trend: string }>;

		const periods = game.state.periods;
		const startIdx = Math.max(0, periods.length - 8);
		const recent = periods.slice(startIdx);
		const result: Record<string, { path: string; trend: string }> = {};

		for (const key of Object.keys(game.state.players)) {
			const data = recent.map((p) => p.players[key]?.profit ?? 0);
			result[key] = { path: buildPath(data), trend: buildTrend(data) };
		}
		return result;
	});

	function buildTrend(data: number[]): string {
		if (data.length < 2) return '';
		const mid = Math.ceil(data.length / 2);
		const avgFirst = data.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
		const avgSecond = data.slice(mid).reduce((a, b) => a + b, 0) / (data.length - mid);
		const diff = avgSecond - avgFirst;
		if (Math.abs(diff) < 1) return 'Profit trend: flat';
		return diff > 0 ? 'Profit trend: increasing' : 'Profit trend: declining';
	}

	function buildPath(data: number[]): string {
		if (data.length < 2) return '';
		const max = Math.max(1, ...data.map(Math.abs));
		const h = 24;
		const w = 60;
		const step = w / (data.length - 1);
		return data
			.map((v, i) => {
				const x = i * step;
				const y = h / 2 - (v / max) * (h / 2 - 2);
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}
</script>

{#if Object.keys(game.state.players).length === 0}
	<section class="card">
		<h3 class="card-header">Players</h3>
		<div class="flex flex-col items-center px-8 py-10 text-center">
			<svg
				class="text-maroon mb-3 opacity-10"
				width="32"
				height="32"
				viewBox="0 0 16 16"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-.828.396-1.855 1.156-2.72.29-.33.614-.628.96-.89z"
				/>
			</svg>
			<p class="text-text-muted text-sm italic">No players have joined yet.</p>
		</div>
	</section>
{:else}
	<section class="card border-t-maroon border-t-2">
		<h3 class="card-header flex items-center justify-between">
			<span>Players</span>
			<span class="text-text-muted font-mono text-xs font-normal tracking-normal normal-case"
				>{Object.keys(game.state.players).length} players</span
			>
		</h3>
		<div
			class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5 px-4 py-3"
			role="group"
			aria-label="Player status cards — {sortedPlayers.length} player{sortedPlayers.length !== 1 ? 's' : ''}"
		>
			{#each sortedPlayers as player}
				{@const online = game.state.connectedClients?.includes(player.key)}
				{@const spark = sparklines[player.key]}
				<button
					class="border-border-light font-body ease-brand hover:border-maroon/40 flex cursor-pointer flex-col gap-1.5 rounded border bg-surface p-3 text-left transition-all duration-100 hover:shadow-sm contain-content"
					onclick={() => onselect(player.key)}
					aria-label="View details for {player.key}"
				>
					<div class="flex items-start justify-between">
						<div class="min-w-0">
							<span class="text-text-primary block truncate text-sm font-semibold"
								>{player.key}</span
							>
							{#if player.uin}
								<span class="text-text-muted block truncate font-mono text-[11px]"
									>{player.uin}</span
								>
							{/if}
						</div>
						<span
							class="status-dot mt-1.5 {online
								? 'status-dot-online'
								: 'status-dot-offline'}"
							role="img"
							aria-label={online ? 'Online' : 'Offline'}
						></span>
					</div>
					{#if isRunningOrCompleted}
						<span
							class="font-mono text-lg font-bold"
							class:text-success={player.money > 0}
							class:text-danger={player.money < 0}
						>
							{player.money > 0 ? '+' : ''}${player.money.toLocaleString()}
						</span>
						<div class="flex items-center justify-between gap-2">
							{#if isRunning}
								<span
									class="badge"
									class:badge-success={offerStatus[player.key] === 'submitted'}
									class:badge-warning={offerStatus[player.key] === 'pending'}
								>
									{offerStatus[player.key] === 'submitted' ? 'Submitted' : 'Pending'}
								</span>
							{/if}
							{#if spark?.path}
								<svg class="shrink-0" width="60" height="24" viewBox="0 0 60 24" aria-hidden="true">
									<path
										d={spark.path}
										fill="none"
										stroke="var(--color-maroon)"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								<span class="sr-only">{spark.trend}</span>
							{/if}
						</div>
					{:else}
						<span class="text-text-muted text-xs italic">{online ? 'Ready' : 'Joined'}</span>
					{/if}
				</button>
			{/each}
		</div>
	</section>
{/if}
