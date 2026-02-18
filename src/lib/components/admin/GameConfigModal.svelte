<script lang="ts">
	import type { GameOptions, PaymentMethod } from '$lib/types/game.js';

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
		quick: { maxParticipants: '4', numPeriods: '12', autoAdvanceTime: '60', paymentMethod: 'last_accepted_offer' as PaymentMethod, label: 'Quick', desc: '4 players, 12 periods, 60s' },
		standard: { maxParticipants: '6', numPeriods: '24', autoAdvanceTime: '180', paymentMethod: 'last_accepted_offer' as PaymentMethod, label: 'Standard', desc: '6 players, 24 periods, 3m' },
		extended: { maxParticipants: '10', numPeriods: '48', autoAdvanceTime: '120', paymentMethod: 'last_accepted_offer' as PaymentMethod, label: 'Extended', desc: '10 players, 48 periods, 2m' }
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

	const canSubmit = $derived(name.trim().length > 0);

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
		oncreate(name.trim(), buildConfig());
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	let nameInput: HTMLInputElement | undefined = $state();
	$effect(() => {
		if (nameInput) nameInput.focus();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Create New Market" onkeydown={handleKeydown} tabindex="-1">
	<div class="modal-backdrop" onclick={onclose} role="presentation"></div>
	<div class="modal-card animate-in create-modal">
		<!-- Sticky header -->
		<div class="create-header">
			<div>
				<div class="w-10 h-[3px] bg-gradient-to-r from-maroon to-gold rounded-sm mb-3" aria-hidden="true"></div>
				<h3 class="m-0 text-xl">Create New Market</h3>
			</div>
			<button class="w-8 h-8 flex items-center justify-center border-none bg-transparent text-text-muted rounded-sm cursor-pointer transition-all duration-100 ease-brand shrink-0 hover:bg-cream-dark hover:text-text-primary" onclick={onclose} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
			</button>
		</div>

		<!-- Scrollable body -->
		<div class="create-body">
			<div class="mb-6">
				<label for="market-name" class="form-label">Market Name</label>
				<input
					bind:this={nameInput}
					type="text"
					class="form-input text-lg p-4"
					id="market-name"
					placeholder="e.g. Spring 2026 Session"
					bind:value={name}
					autocomplete="off"
				/>
			</div>

			<div class="flex items-center gap-4 mb-5 before:content-[''] before:flex-1 before:h-px before:bg-border-light after:content-[''] after:flex-1 after:h-px after:bg-border-light">
				<span class="text-xs font-semibold uppercase tracking-section text-text-muted whitespace-nowrap">Preset</span>
			</div>

			<div class="grid grid-cols-1 min-[441px]:grid-cols-3 gap-3 mb-6">
				{#each (['quick', 'standard', 'extended'] as const) as key}
					{@const p = presets[key]}
					<button
						class="flex flex-col gap-0.5 py-3 px-4 border-[1.5px] rounded cursor-pointer transition-all duration-100 ease-brand text-left font-body {selectedPreset === key ? 'border-maroon border-l-[3px] bg-maroon-faint' : 'bg-white border-border-light hover:border-border hover:shadow-xs'}"
						onclick={() => applyPreset(key)}
					>
						<span class="font-bold text-sm {selectedPreset === key ? 'text-maroon' : 'text-text-primary'}">{p.label}</span>
						<span class="text-[11px] text-text-muted font-mono">{p.desc}</span>
					</button>
				{/each}
			</div>

			<div class="grid grid-cols-1 min-[441px]:grid-cols-3 gap-x-5 gap-y-0 mb-4">
				<div class="form-group mb-5">
					<label for="cfg-max" class="form-label">Max Players</label>
					<input type="number" class="form-input" id="cfg-max" min="2" max="99" bind:value={maxParticipants} oninput={onFieldChange} />
				</div>
				<div class="form-group mb-5">
					<label for="cfg-periods" class="form-label">Periods</label>
					<input type="number" class="form-input" id="cfg-periods" min="2" max="99" bind:value={numPeriods} oninput={onFieldChange} />
				</div>
				<div class="form-group mb-5">
					<label for="cfg-timer" class="form-label">Timer (sec)</label>
					<input type="number" class="form-input" id="cfg-timer" min="2" max="9999" bind:value={autoAdvanceTime} oninput={onFieldChange} />
				</div>
			</div>

			<div class="mb-6">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="form-label">Payment Method</label>
				<div class="flex border-[1.5px] border-border rounded overflow-hidden">
					<button
						class="flex-1 py-2 px-3 font-body text-sm font-semibold border-none border-r-[1.5px] border-r-border cursor-pointer transition-all duration-100 ease-brand {paymentMethod === 'last_accepted_offer' ? 'bg-maroon text-text-inverse' : 'bg-white text-text-secondary hover:bg-maroon-faint hover:text-maroon'}"
						onclick={() => { paymentMethod = 'last_accepted_offer'; onFieldChange(); }}
						type="button"
					>LAO</button>
					<button
						class="flex-1 py-2 px-3 font-body text-sm font-semibold border-none cursor-pointer transition-all duration-100 ease-brand {paymentMethod === 'pay_as_offered' ? 'bg-maroon text-text-inverse' : 'bg-white text-text-secondary hover:bg-maroon-faint hover:text-maroon'}"
						onclick={() => { paymentMethod = 'pay_as_offered'; onFieldChange(); }}
						type="button"
					>PAO</button>
				</div>
				<span class="block text-xs text-text-muted mt-2 leading-[1.4]">
					{paymentMethod === 'last_accepted_offer'
						? 'LAO (uniform pricing): All dispatched generators paid the clearing price.'
						: 'PAO (discriminatory pricing): Each generator paid its own offer.'}
				</span>
			</div>

			<p class="text-xs text-text-muted mb-5">All other settings (generator portfolio, demand profile, offer cap, etc.) can be tuned in Market Settings after creation.</p>
		</div>

		<!-- Sticky footer -->
		<div class="create-footer">
			<div class="flex flex-row min-[441px]:flex-col items-baseline min-[441px]:items-start gap-2 min-[441px]:gap-[1px]">
				<span class="text-[10px] font-semibold uppercase tracking-brand text-text-muted">Est. Duration</span>
				<span class="font-display text-lg font-bold text-maroon">{estimatedDuration}</span>
			</div>
			<div class="flex gap-3 items-center justify-end">
				<button class="btn btn-secondary btn-sm" onclick={onclose}>Cancel</button>
				<button class="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed" onclick={handleSubmit} disabled={!canSubmit}>
					Create Market
				</button>
			</div>
		</div>
	</div>
</div>

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
		padding: 1.25rem 1.25rem 1rem;
		border-bottom: 1px solid var(--color-border-light);
		flex-shrink: 0;
	}
	@media (min-width: 441px) {
		.create-header { padding: 2rem 2rem 1.25rem; }
	}
	.create-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1.25rem;
	}
	@media (min-width: 441px) {
		.create-body { padding: 1.5rem 2rem; }
	}
	.create-footer {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: stretch;
		padding: 1.25rem;
		border-top: 1px solid var(--color-border-light);
		flex-shrink: 0;
	}
	@media (min-width: 441px) {
		.create-footer {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			padding: 1.25rem 2rem;
		}
	}
</style>
