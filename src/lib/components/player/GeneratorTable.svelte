<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { send } from '$lib/websocket.js';
	import { hasSubmitted } from '$lib/utils/marketCalcs.js';
	import Icon from '$lib/components/shared/Icon.svelte';

	let offerValues: Record<string, string> = $state({});
	let lastPeriod = $state(-1);

	$effect(() => {
		const currentPeriod = game.state.period;
		const periodChanged = currentPeriod !== untrack(() => lastPeriod);
		if (periodChanged) {
			lastPeriod = currentPeriod;
			// Cancel any pending debounced submit — it was for the old period
			if (submitDebounce) {
				clearTimeout(submitDebounce);
				submitDebounce = null;
				submitPending = false;
			}
		}

		for (const gen of Object.values(game.state.gens)) {
			if (
				(connection.role === 'admin' || connection.participantName === gen.owner) &&
				(periodChanged || !(gen.id in offerValues))
			) {
				offerValues[gen.id] = String(gen.offer);
			}
		}
	});

	// Offer submission tracking
	let showSubmitToast = $state(false);
	let showErrorToast = $state(false);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;
	let submitDebounce: ReturnType<typeof setTimeout> | null = null;
	let submitPending = $state(false);
	onDestroy(() => {
		if (toastTimeout) clearTimeout(toastTimeout);
		if (submitDebounce) clearTimeout(submitDebounce);
	});

	// Watch for server-side rejection of an action (e.g. stale period offer)
	$effect(() => {
		const err = connection.lastActionError;
		if (err) {
			showSubmitToast = false;
			showErrorToast = true;
			connection.lastActionError = null;
			if (toastTimeout) clearTimeout(toastTimeout);
			toastTimeout = setTimeout(() => { showErrorToast = false; }, 3000);
		}
	});

	const myPlayer = $derived(game.state.players[connection.participantName] ?? null);
	const hasSubmittedThisPeriod = $derived(
		myPlayer !== null && hasSubmitted(myPlayer.last_offer_time, game.state.last_advance_time)
	);

	function submitOffers() {
		// Capture period at click-time, not after the debounce delay.
		// If the period advances during the 250ms window, the debounce is cleared
		// by the $effect above, so this value is always current.
		const snapshotPeriod = game.state.period;
		submitPending = true;
		if (submitDebounce) clearTimeout(submitDebounce);
		submitDebounce = setTimeout(() => {
			submitPending = false;
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
			const sent = send({ type: 'submitOffers', payload: { offers, period: snapshotPeriod } });

			if (sent) {
				showSubmitToast = true;
				showErrorToast = false;
				if (toastTimeout) clearTimeout(toastTimeout);
				toastTimeout = setTimeout(() => {
					showSubmitToast = false;
				}, 2500);
			} else {
				showErrorToast = true;
				showSubmitToast = false;
				if (toastTimeout) clearTimeout(toastTimeout);
				toastTimeout = setTimeout(() => { showErrorToast = false; }, 3000);
			}
		}, 250);
	}

	const isParticipantRunning = $derived(
		connection.role === 'participant' && game.state.state === 'running'
	);
</script>

<form
	class="card relative mb-6"
	aria-label="Generator list"
	onsubmit={(e) => {
		e.preventDefault();
		if (isParticipantRunning) submitOffers();
	}}
>
	<h3 class="card-header flex items-center justify-between">
		<span>Generators</span>
		{#if isParticipantRunning}
			<button
				type="submit"
				class="btn btn-sm px-4 py-1"
				class:btn-primary={!hasSubmittedThisPeriod && !submitPending}
				class:btn-success={hasSubmittedThisPeriod && !submitPending}
				class:btn-secondary={submitPending}
				disabled={submitPending}
			>
				{#if submitPending}
					Sending...
				{:else}
					<Icon name="checkmark" size={14} />
					{hasSubmittedThisPeriod ? 'Update Offers' : 'Submit Offers'}
				{/if}
			</button>
		{/if}
	</h3>

	{#if isParticipantRunning}
		{#if hasSubmittedThisPeriod}
			<div
				class="bg-success-bg border-border-light text-success flex items-center gap-2 border-b px-4 py-2.5 text-sm"
			>
				<Icon name="checkmark" size={14} />
				Offers submitted — you can update until the period clears.
			</div>
		{:else}
			<div class="bg-gold-faint border-border-light text-text-secondary border-b px-4 py-2.5 text-sm">
				Set your offer price for each generator ($0–${game.state.options?.max_offer_price ?? 200}).
			</div>
		{/if}
	{/if}

	{#if showSubmitToast}
		<div
			class="submit-toast bg-success text-text-inverse absolute top-3 right-5 z-10 flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold shadow"
			role="status"
			aria-live="polite"
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path
					d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"
				/>
			</svg>
			Offers submitted
		</div>
	{/if}

	{#if showErrorToast}
		<div
			class="submit-toast bg-danger text-text-inverse absolute top-3 right-5 z-10 flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold shadow"
			role="alert"
			aria-live="assertive"
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
			</svg>
			Offer rejected — period may have advanced
		</div>
	{/if}

	<div class="table-wrap rounded-none border-none shadow-none">
		<table>
			<thead>
				<tr>
					<th scope="col">Unit</th>
					<th scope="col"><abbr class="no-underline" title="Capacity (MW)">Cap<span class="hidden min-[480px]:inline">acity</span> <span class="hidden min-[380px]:inline">(MW)</span></abbr></th>
					<th scope="col"><abbr class="no-underline" title="Cost ($/MWh)">Cost<span class="hidden min-[380px]:inline"> ($/MWh)</span></abbr></th>
					<th scope="col"><abbr class="no-underline" title="Offer ($/MWh)">Offer<span class="hidden min-[380px]:inline"> ($/MWh)</span></abbr></th>
				</tr>
			</thead>
			<tbody>
				{#each Object.values(game.state.gens) as gen}
					{#if connection.role === 'admin' || connection.participantName === gen.owner}
						<tr>
							<td>{gen.id}</td>
							<td>{gen.capacity}</td>
							<td>{gen.cost}</td>
							<td>
								{#if isParticipantRunning && gen.owner === connection.participantName}
									<input
										type="number"
										class="border-border text-text-primary ease-brand hover:border-maroon-light focus:border-maroon w-full max-w-[90px] rounded-sm border bg-surface px-2 py-1.5 font-mono text-sm transition-[border-color,box-shadow,background] duration-200 focus:shadow-[0_0_0_2px_var(--color-maroon-faint)] focus:outline-none"
										min="0"
										max={game.state.options?.max_offer_price ?? 200}
										step="1"
										bind:value={offerValues[gen.id]}
										aria-label="Offer price for {gen.id}"
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
</form>

<style>
	.submit-toast {
		animation:
			slideInRight 0.3s var(--ease-brand) both,
			fadeOutAfterDelay 2.5s ease-in both;
	}
	@keyframes slideInRight {
		from {
			opacity: 0;
			transform: translateX(100%);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	@keyframes fadeOutAfterDelay {
		0%,
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.submit-toast {
			animation: none;
			opacity: 1;
		}
	}
</style>
