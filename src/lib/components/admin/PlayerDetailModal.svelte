<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { send } from '$lib/services/websocket.js';
	import ConfirmModal from '$lib/components/shared/ConfirmModal.svelte';

	let { playerId, onclose }: { playerId: string; onclose: () => void } = $props();

	let customReward = $state('');
	let showKickConfirm = $state(false);

	const player = $derived(game.state.players[playerId]);
	const online = $derived(game.state.connectedClients?.includes(playerId) ?? false);
	const isRunningOrCompleted = $derived(game.isActive);
	const isFormingOrFull = $derived(game.state.state === 'forming' || game.state.state === 'full');

	const playerGens = $derived(
		Object.values(game.state.gens).filter(g => g.owner === playerId)
	);

	const periodData = $derived.by(() => {
		return game.state.periods.map(p => ({
			number: p.number,
			load: p.load,
			marginal: p.marginal_cost,
			revenue: p.players[playerId]?.revenue,
			costs: p.players[playerId]?.costs,
			profit: p.players[playerId]?.profit,
			money: p.players[playerId]?.money
		}));
	});

	function rewardPlayer(amount: number) {
		send({ type: 'rewardPlayer', payload: { playerId, amount } });
	}

	function rewardCustom() {
		const amt = parseInt(customReward);
		if (!amt || isNaN(amt)) return;
		send({ type: 'rewardPlayer', payload: { playerId, amount: amt } });
		customReward = '';
	}

	function kickPlayer() {
		send({ type: 'kickPlayer', payload: { playerId } });
		showKickConfirm = false;
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !showKickConfirm) onclose();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Player details" onkeydown={handleKeydown} tabindex="-1">
	<div class="modal-backdrop" onclick={onclose} role="presentation"></div>
	<div class="modal-card animate-in detail-modal">
		<!-- Sticky header -->
		<div class="detail-header">
			<div class="flex items-center gap-2 min-w-0">
				<h3 class="m-0 text-xl truncate">{playerId}</h3>
				<span class="w-2 h-2 rounded-full shrink-0 {online ? 'bg-success shadow-[0_0_6px_rgba(45,138,78,0.4)]' : 'bg-border'}"></span>
				<span class="text-xs text-text-muted whitespace-nowrap">{online ? 'Online' : 'Offline'}</span>
			</div>
			<div class="flex items-center gap-3 shrink-0">
				{#if player}
					<span class="font-mono text-2xl font-bold" class:text-success={player.money > 0} class:text-danger={player.money < 0}>
						${player.money.toLocaleString()}
					</span>
				{/if}
				<button class="w-8 h-8 flex items-center justify-center border-none bg-transparent text-text-muted rounded-sm cursor-pointer transition-all duration-100 ease-brand hover:bg-cream-dark hover:text-text-primary" onclick={onclose} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
				</button>
			</div>
		</div>

		<!-- Scrollable body -->
		<div class="detail-body">
			<!-- Actions -->
			{#if player}
				<div class="flex items-center gap-2 flex-wrap mb-5">
					{#if isRunningOrCompleted}
						<button class="btn btn-sm bg-gold-faint text-gold border-transparent font-bold font-mono hover:bg-gold hover:text-white" onclick={() => rewardPlayer(100)}>+$100</button>
						<button class="btn btn-sm bg-gold-faint text-gold border-transparent font-bold font-mono hover:bg-gold hover:text-white" onclick={() => rewardPlayer(500)}>+$500</button>
						<button class="btn btn-sm bg-danger-bg text-danger border-transparent font-bold font-mono hover:bg-danger hover:text-white" onclick={() => rewardPlayer(-100)}>-$100</button>
						<div class="flex gap-0.5">
							<input
								type="number"
								class="w-[70px] py-1 px-2 font-mono text-xs border-[1.5px] border-border rounded-l-sm rounded-r-none bg-white text-text-primary focus:outline-none focus:border-maroon"
								placeholder="$"
								bind:value={customReward}
								aria-label="Custom reward"
							/>
							<button class="btn btn-sm btn-primary rounded-l-none rounded-r-sm py-1 px-2" onclick={rewardCustom}>Send</button>
						</div>
					{/if}
					{#if isFormingOrFull}
						<button class="btn btn-sm btn-danger" onclick={() => { showKickConfirm = true; }}>Kick</button>
					{/if}
				</div>
			{/if}

			<!-- Generators -->
			{#if playerGens.length > 0}
				<div class="mb-5">
					<h4 class="text-sm font-semibold uppercase tracking-brand text-text-muted mb-3">Generators</h4>
					<div class="table-wrap border border-border-light rounded">
						<table>
							<thead>
								<tr>
									<th>ID</th>
									<th>Capacity</th>
									<th>Cost</th>
									<th>Offer</th>
								</tr>
							</thead>
							<tbody>
								{#each playerGens as gen}
									<tr>
										<td>{gen.id}</td>
										<td>{gen.capacity} MW</td>
										<td>${gen.cost}</td>
										<td>${gen.offer}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Period History -->
			{#if periodData.length > 0}
				<div class="mb-5">
					<h4 class="text-sm font-semibold uppercase tracking-brand text-text-muted mb-3">Period History</h4>
					<div class="table-wrap border border-border-light rounded max-h-[300px] overflow-y-auto">
						<table>
							<thead>
								<tr>
									<th>#</th>
									<th>Load</th>
									<th>Marginal</th>
									<th>Revenue</th>
									<th>Costs</th>
									<th>Profit</th>
									<th>Money</th>
								</tr>
							</thead>
							<tbody>
								{#each periodData as pd}
									<tr>
										<td>{pd.number}</td>
										<td>{pd.load}</td>
										<td>{pd.marginal != null ? `$${pd.marginal.toLocaleString()}` : '—'}</td>
										<td>{pd.revenue != null ? `$${pd.revenue.toLocaleString()}` : '—'}</td>
										<td>{pd.costs != null ? `$${pd.costs.toLocaleString()}` : '—'}</td>
										<td class:text-success={(pd.profit ?? 0) > 0} class:text-danger={(pd.profit ?? 0) < 0}>{pd.profit != null ? `$${pd.profit.toLocaleString()}` : '—'}</td>
										<td>{pd.money != null ? `$${pd.money.toLocaleString()}` : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.detail-modal {
		max-width: 700px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 2px solid var(--color-border-light);
		flex-shrink: 0;
	}
	.detail-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1.5rem;
	}
</style>

{#if showKickConfirm}
	<ConfirmModal
		title="Kick Player"
		message="Remove {playerId} from the game?"
		confirmLabel="Kick"
		variant="danger"
		onconfirm={kickPlayer}
		oncancel={() => { showKickConfirm = false; }}
	/>
{/if}
