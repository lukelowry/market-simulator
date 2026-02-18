<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { send } from '$lib/services/websocket.js';

	let offerValues: Record<string, string> = $state({});
	let lastPeriod = $state(-1);

	$effect(() => {
		const currentPeriod = game.state.period;
		const periodChanged = currentPeriod !== untrack(() => lastPeriod);
		if (periodChanged) lastPeriod = currentPeriod;

		for (const gen of Object.values(game.state.gens)) {
			if ((connection.role === 'admin' || connection.participantName === gen.owner) && (periodChanged || !(gen.id in offerValues))) {
				offerValues[gen.id] = String(gen.offer);
			}
		}
	});

	// Unit labels: "Unit 1", "Unit 2", etc. based on player's gen order
	const genLabels: Record<string, string> = $derived.by(() => {
		const labels: Record<string, string> = {};
		const playerGens = Object.values(game.state.gens)
			.filter(g => g.owner === connection.participantName)
			.sort((a, b) => {
				const numA = parseInt(a.id.replace(/\D/g, ''));
				const numB = parseInt(b.id.replace(/\D/g, ''));
				return numA - numB;
			});
		playerGens.forEach((gen, i) => {
			labels[gen.id] = `Unit ${i + 1}`;
		});
		return labels;
	});

	// Offer submission tracking
	let showSubmitToast = $state(false);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;
	onDestroy(() => { if (toastTimeout) clearTimeout(toastTimeout); });

	const myPlayer = $derived(game.state.players[connection.participantName] ?? null);
	const hasSubmittedThisPeriod = $derived(
		myPlayer !== null && myPlayer.last_offer_time > game.state.last_advance_time
	);

	function submitOffers() {
		const maxOffer = game.state.options?.max_offer_price ?? 200;
		const offers: Record<string, number> = {};
		for (const [genId, value] of Object.entries(offerValues)) {
			const gen = game.state.gens[genId];
			if (gen && gen.owner === connection.participantName) {
				const parsed = parseFloat(value);
				const clamped = isNaN(parsed) ? gen.offer : Math.min(Math.max(parsed, 0), maxOffer);
				offers[genId] = clamped;
				offerValues[genId] = String(clamped);
			}
		}
		send({ type: 'submitOffers', payload: { offers } });

		// Show transient toast
		showSubmitToast = true;
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => {
			showSubmitToast = false;
		}, 2500);
	}

	const isParticipantRunning = $derived(connection.role === 'participant' && game.state.state === 'running');
</script>

<section class="card relative mb-6" aria-label="Generator list">
	<div class="card-header flex items-center justify-between">
		<span>Generators</span>
		{#if isParticipantRunning}
			<button
				type="button"
				class="btn btn-sm py-1 px-4"
				class:btn-primary={!hasSubmittedThisPeriod}
				class:btn-success={hasSubmittedThisPeriod}
				onclick={submitOffers}
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
				</svg>
				{hasSubmittedThisPeriod ? 'Update Offers' : 'Submit Offers'}
			</button>
		{/if}
	</div>

	{#if isParticipantRunning}
		{#if hasSubmittedThisPeriod}
			<div class="py-3 px-5 bg-success-bg border-b border-border-light text-sm text-success flex items-center gap-2">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
				</svg>
				Offers submitted for this period. You may update and resubmit until the period clears.
			</div>
		{:else}
			<div class="py-3 px-5 bg-gold-faint border-b border-border-light text-sm text-text-secondary">
				Set your offer price for each generator ($0–${game.state.options?.max_offer_price ?? 200}). You may update until the period clears.
			</div>
		{/if}
	{/if}

	{#if showSubmitToast}
		<div class="submit-toast absolute top-3 right-5 flex items-center gap-2 py-2 px-4 bg-success text-white rounded-sm text-sm font-semibold shadow z-10" role="status" aria-live="polite">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
			</svg>
			Offers submitted
		</div>
	{/if}

	<div class="table-wrap border-none rounded-none shadow-none">
		<table>
			<thead>
				<tr>
					<th scope="col">Unit</th>
					<th scope="col">Capacity (MW)</th>
					<th scope="col">Cost ($/MWh)</th>
					<th scope="col">Offer ($/MWh)</th>
				</tr>
			</thead>
			<tbody>
				{#each Object.values(game.state.gens) as gen}
					{#if connection.role === 'admin' || connection.participantName === gen.owner}
						<tr>
							<td>{genLabels[gen.id] ?? gen.id}</td>
							<td>{gen.capacity}</td>
							<td>{gen.cost}</td>
							<td>
								{#if isParticipantRunning && gen.owner === connection.participantName}
									<input
										type="number"
										class="w-[90px] py-1 px-2 font-mono text-sm border-[1.5px] border-border rounded-sm bg-white text-text-primary transition-[border-color,box-shadow,background] duration-200 ease-brand hover:border-maroon-light focus:outline-none focus:border-maroon focus:shadow-[0_0_0_3px_rgba(80,0,0,0.1)]"
										min="0"
										max={game.state.options?.max_offer_price ?? 200}
										step="1"
										bind:value={offerValues[gen.id]}
										aria-label="Offer price for {genLabels[gen.id] ?? gen.id}"
									/>
								{:else}
									{gen.offer}
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.submit-toast {
		animation: slideInRight 0.3s var(--ease-brand) both, fadeOutAfterDelay 2.5s ease-in both;
	}
	@keyframes slideInRight {
		from { opacity: 0; transform: translateX(100%); }
		to { opacity: 1; transform: translateX(0); }
	}
	@keyframes fadeOutAfterDelay {
		0%, 80% { opacity: 1; }
		100% { opacity: 0; }
	}
</style>
