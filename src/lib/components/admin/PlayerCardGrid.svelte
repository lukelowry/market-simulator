<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';

	let { onselect }: { onselect: (playerId: string) => void } = $props();

	const isRunningOrCompleted = $derived(game.state.state === 'running' || game.state.state === 'completed');

	const offerStatus = $derived.by(() => {
		const result: Record<string, 'submitted' | 'pending' | 'none'> = {};
		for (const [key, player] of Object.entries(game.state.players)) {
			if (player.last_offer_time === 0) result[key] = 'none';
			else if (player.last_offer_time > game.state.last_advance_time) result[key] = 'submitted';
			else result[key] = 'pending';
		}
		return result;
	});

	const sortedPlayers = $derived(
		Object.entries(game.state.players).map(([key, p]) => ({ key, ...p })).sort((a, b) => b.money - a.money)
	);

	// Mini sparkline data: last 8 periods of profit
	function getSparkline(playerId: string): number[] {
		const periods = game.state.periods;
		const startIdx = Math.max(0, periods.length - 8);
		return periods.slice(startIdx).map(p => p.players[playerId]?.profit ?? 0);
	}

	function sparklinePath(data: number[]): string {
		if (data.length < 2) return '';
		const max = Math.max(1, ...data.map(Math.abs));
		const h = 24;
		const w = 60;
		const step = w / (data.length - 1);
		return data.map((v, i) => {
			const x = i * step;
			const y = h / 2 - (v / max) * (h / 2 - 2);
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' ');
	}
</script>

{#if Object.keys(game.state.players).length === 0}
	<section class="card">
		<div class="card-header">Players</div>
		<div class="flex flex-col items-center text-center py-12 px-8">
			<svg class="text-text-muted opacity-20 mb-4" width="36" height="36" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-.828.396-1.855 1.156-2.72.29-.33.614-.628.96-.89z"/>
			</svg>
			<p class="text-sm text-text-muted italic">No players have joined yet.</p>
		</div>
	</section>
{:else}
	<section class="card border-t-3 border-t-maroon">
		<div class="card-header flex justify-between items-center">
			<span>Players</span>
			<span class="font-mono text-xs text-text-muted font-normal normal-case tracking-normal">{Object.keys(game.state.players).length} players</span>
		</div>
		<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 py-4 px-5">
			{#each sortedPlayers as player, i}
				{@const online = game.state.connectedClients?.includes(player.key)}
				{@const sparkData = isRunningOrCompleted ? getSparkline(player.key) : []}
				<button class="flex flex-col gap-2 p-4 bg-white border-[1.5px] border-border-light rounded cursor-pointer text-left font-body transition-all duration-100 ease-brand hover:border-maroon hover:shadow-sm hover:-translate-y-px" onclick={() => onselect(player.key)} aria-label="View details for {player.key}">
					<div class="flex justify-between items-center">
						<span class="font-semibold text-sm text-text-primary">{player.key}</span>
						<span class="w-2 h-2 rounded-full shrink-0 {online ? 'bg-success shadow-[0_0_6px_rgba(45,138,78,0.4)]' : 'bg-border'}"></span>
					</div>
					{#if isRunningOrCompleted}
						<span class="font-mono text-lg font-bold" class:text-success={player.money > 0} class:text-danger={player.money < 0}>
							${player.money.toLocaleString()}
						</span>
						<div class="flex justify-between items-center gap-2">
							<span class="badge" class:badge-success={offerStatus[player.key] === 'submitted'} class:badge-warning={offerStatus[player.key] === 'pending'} class:badge-muted={offerStatus[player.key] === 'none'}>
								{offerStatus[player.key] === 'submitted' ? 'Submitted' : offerStatus[player.key] === 'pending' ? 'Stale' : 'None'}
							</span>
							{#if sparkData.length >= 2}
								<svg class="shrink-0" width="60" height="24" viewBox="0 0 60 24" aria-hidden="true">
									<path d={sparklinePath(sparkData)} fill="none" stroke="var(--color-maroon)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							{/if}
						</div>
					{:else}
						<span class="text-xs text-text-muted italic">{online ? 'Ready' : 'Joined'}</span>
					{/if}
				</button>
			{/each}
		</div>
	</section>
{/if}
