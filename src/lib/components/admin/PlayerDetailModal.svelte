<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { send } from '$lib/websocket.js';
	import Modal from '$lib/components/shared/Modal.svelte';
	import ConfirmModal from '$lib/components/shared/ConfirmModal.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

	let { playerId, onclose }: { playerId: string; onclose: () => void } = $props();

	let closeBtn: HTMLButtonElement | undefined;
	onMount(() => closeBtn?.focus());

	let customReward = $state('');
	let showKickConfirm = $state(false);

	const player = $derived(game.state.players[playerId]);
	const online = $derived(game.state.connectedClients?.includes(playerId) ?? false);
	const isRunningOrCompleted = $derived(game.isActive);
	const isForming = $derived(game.state.state === 'forming');

	const playerGens = $derived(Object.values(game.state.gens).filter((g) => g.owner === playerId));

	const periodData = $derived.by(() => {
		return game.state.periods.map((p) => ({
			number: p.number,
			load: p.load,
			marginal: p.marginal_cost,
			revenue: p.players[playerId]?.revenue,
			costs: p.players[playerId]?.costs,
			profit: p.players[playerId]?.profit,
			money: p.players[playerId]?.money
		}));
	});

	let rewardCooldown = $state(false);

	function rewardPlayer(amount: number) {
		if (rewardCooldown) return;
		rewardCooldown = true;
		send({ type: 'rewardPlayer', payload: { playerId, amount } });
		setTimeout(() => { rewardCooldown = false; }, 500);
	}

	function rewardCustom() {
		const amt = parseInt(customReward);
		if (!amt || isNaN(amt)) return;
		rewardPlayer(amt);
		customReward = '';
	}

	function kickPlayer() {
		send({ type: 'kickPlayer', payload: { playerId } });
		showKickConfirm = false;
		onclose();
	}
</script>

<Modal title="Player details" titleId="pdm-title" maxWidth="700px" onclose={onclose}>
	<div class="detail-modal">
		<!-- Sticky header -->
		<div class="modal-header">
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				<div class="min-w-0 flex-1">
					<h2 id="pdm-title" class="m-0 truncate text-xl">{playerId}</h2>
					{#if player?.uin}
						<span class="text-text-muted block font-mono text-xs">UIN {player.uin}</span>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<span
						class="status-dot {online
							? 'status-dot-online'
							: 'status-dot-offline'}"
						role="img"
						aria-label={online ? 'Online' : 'Offline'}
					></span>
					<span class="text-text-muted text-xs whitespace-nowrap"
						>{online ? 'Online' : 'Offline'}</span
					>
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-3">
				{#if player}
					<span
						class="font-mono text-2xl font-bold"
						class:text-success={player.money > 0}
						class:text-danger={player.money < 0}
					>
						{player.money > 0 ? '+' : ''}${player.money.toLocaleString()}
					</span>
				{/if}
				<button class="btn-close" onclick={onclose} aria-label="Close player details" bind:this={closeBtn}>
					<Icon name="close" size={18} />
				</button>
			</div>
		</div>

		<!-- Scrollable body -->
		<div class="modal-body">
			<!-- Actions -->
			{#if player}
				<div class="mb-5 flex flex-wrap items-center gap-3">
					{#if isRunningOrCompleted}
						<div class="flex gap-0.5">
							<input
								type="number"
								class="border-border text-text-primary focus:border-maroon w-20 rounded-l-sm rounded-r-none border bg-surface px-2 py-1 font-mono text-xs focus:outline-none"
								placeholder="$"
								bind:value={customReward}
								aria-label="Reward amount in dollars"
								min={-99999}
								max={99999}
							/>
							<button
								class="btn btn-sm btn-primary rounded-l-none rounded-r-sm px-2 py-1"
								onclick={rewardCustom}>Send</button
							>
						</div>
						<div class="border-border-light flex gap-1 border-l pl-3">
							<button
								class="text-text-muted hover:text-gold hover:bg-gold-faint min-h-11 min-w-11 cursor-pointer rounded-sm px-2 py-1 font-mono text-xs font-bold transition-colors"
								onclick={() => rewardPlayer(100)}>+100</button
							>
							<button
								class="text-text-muted hover:text-gold hover:bg-gold-faint min-h-11 min-w-11 cursor-pointer rounded-sm px-2 py-1 font-mono text-xs font-bold transition-colors"
								onclick={() => rewardPlayer(500)}>+500</button
							>
							<button
								class="text-text-muted hover:text-danger hover:bg-danger-bg min-h-11 min-w-11 cursor-pointer rounded-sm px-2 py-1 font-mono text-xs font-bold transition-colors"
								onclick={() => rewardPlayer(-100)}>−100</button
							>
						</div>
					{/if}
					{#if isForming}
						<button
							class="btn btn-sm btn-danger"
							onclick={() => {
								showKickConfirm = true;
							}}>Kick</button
						>
					{/if}
				</div>
			{/if}

			<!-- Generators -->
			{#if playerGens.length > 0}
				<div class="mb-5">
					<h3 class="tracking-brand text-text-muted mb-3 text-sm font-semibold uppercase">
						Generators
					</h3>
					<div class="table-wrap border-border-light rounded border">
						<table>
							<caption class="sr-only">Generators owned by {playerId}</caption>
							<thead>
								<tr>
									<th scope="col">ID</th>
									<th scope="col">Capacity</th>
									<th scope="col">Cost</th>
									<th scope="col">Offer</th>
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
					<h3 class="tracking-brand text-text-muted mb-3 text-sm font-semibold uppercase">
						Period History
					</h3>
					<div class="table-wrap border-border-light max-h-[min(300px,40vh)] overflow-y-auto rounded border">
						<table>
							<caption class="sr-only">Period performance history for {playerId}</caption>
							<thead>
								<tr>
									<th scope="col">#</th>
									<th scope="col" class="detail-col">Load</th>
									<th scope="col">Marginal</th>
									<th scope="col" class="detail-col">Revenue</th>
									<th scope="col" class="detail-col">Costs</th>
									<th scope="col">Profit</th>
									<th scope="col">Money</th>
								</tr>
							</thead>
							<tbody>
								{#each periodData as pd}
									<tr>
										<td>{pd.number}</td>
										<td class="detail-col">{pd.load}</td>
										<td>{pd.marginal != null ? `$${pd.marginal.toLocaleString()}` : '—'}</td>
										<td class="detail-col">{pd.revenue != null ? `$${pd.revenue.toLocaleString()}` : '—'}</td>
										<td class="detail-col">{pd.costs != null ? `$${pd.costs.toLocaleString()}` : '—'}</td>
										<td
											class:text-success={(pd.profit ?? 0) > 0}
											class:text-danger={(pd.profit ?? 0) < 0}
											>{pd.profit != null ? `${pd.profit > 0 ? '+' : ''}$${pd.profit.toLocaleString()}` : '—'}</td
										>
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
</Modal>

{#if showKickConfirm}
	<ConfirmModal
		title="Kick Player"
		message="Remove {playerId} from the game? They will be disconnected and their generators reassigned."
		confirmLabel="Kick Player"
		variant="danger"
		onconfirm={kickPlayer}
		oncancel={() => {
			showKickConfirm = false;
		}}
	/>
{/if}

<style>
	.detail-modal {
		max-width: 700px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Hide secondary columns (Load, Revenue, Costs) on narrow screens */
	@media (max-width: 520px) {
		.detail-col {
			display: none;
		}
	}
</style>
