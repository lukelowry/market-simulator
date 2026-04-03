<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import type { GameOptions, PaymentMethod } from '$shared/game.js';

	let {
		onclose,
		oncreate
	}: {
		onclose: () => void;
		oncreate: (name: string, config: GameOptions) => void;
	} = $props();

	let name = $state('');
	let maxParticipants = $state('6');
	let numPeriods = $state('24');
	let autoAdvanceTime = $state('180');
	let paymentMethod = $state<PaymentMethod>('last_accepted_offer');
	let selectedPreset = $state<'quick' | 'standard' | 'extended' | null>('standard');

	const presets = {
		quick: {
			maxParticipants: '4',
			numPeriods: '12',
			autoAdvanceTime: '60',
			paymentMethod: 'last_accepted_offer' as PaymentMethod,
			label: 'Quick',
			desc: '4 players, 12 periods, 60s'
		},
		standard: {
			maxParticipants: '6',
			numPeriods: '24',
			autoAdvanceTime: '180',
			paymentMethod: 'last_accepted_offer' as PaymentMethod,
			label: 'Standard',
			desc: '6 players, 24 periods, 3m'
		},
		extended: {
			maxParticipants: '10',
			numPeriods: '48',
			autoAdvanceTime: '120',
			paymentMethod: 'last_accepted_offer' as PaymentMethod,
			label: 'Extended',
			desc: '10 players, 48 periods, 2m'
		}
	};

	function applyPreset(key: 'quick' | 'standard' | 'extended') {
		const p = presets[key];
		maxParticipants = p.maxParticipants;
		numPeriods = p.numPeriods;
		autoAdvanceTime = p.autoAdvanceTime;
		paymentMethod = p.paymentMethod;
		selectedPreset = key;
	}

	function onFieldChange() {
		selectedPreset = null;
	}

	const estimatedDuration = $derived.by(() => {
		const p = parseInt(numPeriods) || 24;
		const t = parseInt(autoAdvanceTime) || 180;
		const mins = Math.round((p * t) / 60);
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	});

	let submitting = $state(false);
	const canSubmit = $derived(name.trim().length > 0 && !submitting);

	function buildConfig(): GameOptions {
		return {
			max_participants: parseInt(maxParticipants) || 6,
			num_periods: parseInt(numPeriods) || 24,
			auto_advance_time: parseInt(autoAdvanceTime) || 180,
			payment_method: paymentMethod,
			max_offer_price: 200,
			starting_money: 0,
			gen_preset: 'standard',
			load_profile: 'realistic',
			scarcity_price: 0,
			load_jitter: 0
		};
	}

	function handleSubmit() {
		if (!canSubmit) return;
		submitting = true;
		try {
			oncreate(name.trim(), buildConfig());
		} catch {
			submitting = false;
		}
	}

	const titleId = `gcm-title-${crypto.randomUUID().slice(0, 8)}`;

	let nameInput: HTMLInputElement | undefined;
	onMount(() => {
		nameInput?.focus();
	});
</script>

<Modal title="Create New Market" {titleId} maxWidth="600px" onclose={onclose}>
	<div class="create-modal">
		<!-- Sticky header -->
		<div class="create-header">
			<h3 id={titleId} class="m-0 text-xl">Create New Market</h3>
			<button class="btn-close" onclick={onclose} aria-label="Close">
				<Icon name="close" size={18} />
			</button>
		</div>

		<!-- Scrollable body -->
		<div class="create-body">
			<div class="mb-6">
				<label for="market-name" class="form-label">Market Name</label>
				<input
					bind:this={nameInput}
					type="text"
					class="form-input"
					id="market-name"
					placeholder="e.g. Spring 2026 Session"
					bind:value={name}
					autocomplete="off"
					maxlength={40}
				/>
			</div>

			<div
				class="before:bg-border-light after:bg-border-light mb-5 flex items-center gap-4 before:h-px before:flex-1 before:content-[''] after:h-px after:flex-1 after:content-['']"
			>
				<span
					class="tracking-section text-text-muted text-xs font-semibold whitespace-nowrap uppercase"
					>Preset</span
				>
			</div>

			<div class="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
				{#each ['quick', 'standard', 'extended'] as const as key}
					{@const p = presets[key]}
					<button
						class="ease-brand font-body flex cursor-pointer flex-col gap-0.5 rounded border px-3 py-2.5 text-left transition-all duration-100 {selectedPreset ===
						key
							? 'border-maroon/40 bg-maroon-faint shadow-[inset_2px_0_0_var(--color-maroon)]'
							: 'border-border-light hover:border-border bg-surface hover:shadow-xs'}"
						onclick={() => applyPreset(key)}
					>
						<span
							class="text-sm font-bold {selectedPreset === key
								? 'text-maroon'
								: 'text-text-primary'}">{p.label}</span
						>
						<span class="text-text-muted font-mono text-[11px]">{p.desc}</span>
					</button>
				{/each}
			</div>

			<div class="mb-4 grid grid-cols-1 gap-x-5 gap-y-0 min-[480px]:grid-cols-3">
				<div class="form-group mb-5">
					<label for="cfg-max" class="form-label">Max Players</label>
					<input
						type="number"
						class="form-input"
						id="cfg-max"
						min="2"
						max="99"
						bind:value={maxParticipants}
						oninput={onFieldChange}
					/>
				</div>
				<div class="form-group mb-5">
					<label for="cfg-periods" class="form-label">Periods</label>
					<input
						type="number"
						class="form-input"
						id="cfg-periods"
						min="2"
						max="99"
						bind:value={numPeriods}
						oninput={onFieldChange}
					/>
				</div>
				<div class="form-group mb-5">
					<label for="cfg-timer" class="form-label">Timer (sec)</label>
					<input
						type="number"
						class="form-input"
						id="cfg-timer"
						min="2"
						max="9999"
						bind:value={autoAdvanceTime}
						oninput={onFieldChange}
					/>
				</div>
			</div>

			<div class="mb-6">
				<span class="form-label" id="gcm-payment-label">Payment Method</span>
				<div
					class="border-border flex overflow-hidden rounded border"
					role="group"
					aria-labelledby="gcm-payment-label"
					aria-describedby="gcm-payment-desc"
				>
					<button
						class="font-body border-r-border ease-brand flex-1 cursor-pointer border-r-accent border-none px-3 py-2 text-sm font-semibold transition-all duration-100 {paymentMethod ===
						'last_accepted_offer'
							? 'bg-maroon text-text-inverse'
							: 'text-text-secondary hover:bg-maroon-faint hover:text-maroon bg-surface'}"
						onclick={() => {
							paymentMethod = 'last_accepted_offer';
							onFieldChange();
						}}
						type="button"
						aria-pressed={paymentMethod === 'last_accepted_offer'}>LAO</button
					>
					<button
						class="font-body ease-brand flex-1 cursor-pointer border-none px-3 py-2 text-sm font-semibold transition-all duration-100 {paymentMethod ===
						'pay_as_offered'
							? 'bg-maroon text-text-inverse'
							: 'text-text-secondary hover:bg-maroon-faint hover:text-maroon bg-surface'}"
						onclick={() => {
							paymentMethod = 'pay_as_offered';
							onFieldChange();
						}}
						type="button"
						aria-pressed={paymentMethod === 'pay_as_offered'}>PAO</button
					>
				</div>
				<span id="gcm-payment-desc" class="text-text-muted mt-2 block text-xs leading-[1.4]">
					{paymentMethod === 'last_accepted_offer'
						? 'Last Accepted Offer: All dispatched generators are paid the same clearing price.'
						: 'Pay As Offered: Each dispatched generator is paid its own offer price.'}
				</span>
			</div>

			<p class="text-text-muted mb-5 text-xs">
				Other settings can be adjusted in Market Settings after creation.
			</p>
		</div>

		<!-- Sticky footer -->
		<div class="create-footer">
			<div
				class="flex flex-row items-baseline gap-2 min-[480px]:flex-col min-[480px]:items-start min-[480px]:gap-px"
			>
				<span class="tracking-brand text-text-muted text-[11px] font-semibold uppercase"
					>Est. Duration</span
				>
				<span class="font-display text-maroon text-lg font-bold">{estimatedDuration}</span>
			</div>
			<div class="flex items-center justify-end gap-3">
				<button class="btn btn-secondary btn-sm" onclick={onclose}>Cancel</button>
				<button
					class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleSubmit}
					disabled={!canSubmit}
				>
					Create Market
				</button>
			</div>
		</div>
	</div>
</Modal>

<style>
	.create-modal {
		max-width: 480px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.create-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--color-border-light);
		flex-shrink: 0;
	}
	@media (min-width: 480px) {
		.create-header {
			padding: 1.25rem 1.5rem;
		}
	}
	.create-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1.25rem;
	}
	@media (min-width: 480px) {
		.create-body {
			padding: 1.25rem 1.5rem;
		}
	}
	.create-footer {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: stretch;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--color-border-light);
		flex-shrink: 0;
	}
	@media (min-width: 480px) {
		.create-footer {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			padding: 1rem 1.5rem;
		}
	}
</style>
