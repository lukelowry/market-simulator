<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { send } from '$lib/services/websocket.js';
	import type { GameOptions, GenPreset, LoadProfile, PaymentMethod } from '$lib/types/game.js';

	let {
		isOpen = $bindable(),
		marketName,
		ondelete
	}: {
		isOpen: boolean;
		marketName: string;
		ondelete?: () => void;
	} = $props();

	let showResetConfirm = $state(false);

	const editable = $derived(game.state.state === 'forming' || game.state.state === 'full');
	const hasOptions = $derived(!!game.state.options);

	function updateOption<K extends keyof GameOptions>(key: K, value: GameOptions[K]) {
		send({ type: 'updateOptions', payload: { [key]: value } });
	}

	function handleNumberChange(key: keyof GameOptions, e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		if (!isNaN(val)) updateOption(key, val as any);
	}

	function toggleVisibility() {
		const newVisibility = game.state.visibility === 'public' ? 'unlisted' : 'public';
		send({ type: 'setVisibility', payload: { visibility: newVisibility } });
	}

	function executeReset() {
		send({ type: 'resetGame' });
		showResetConfirm = false;
		isOpen = false;
	}

	function handleDelete() {
		isOpen = false;
		ondelete?.();
	}

	function close() {
		isOpen = false;
		showResetConfirm = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	const canReset = $derived(game.state.state !== 'running');

	const paymentLabel = $derived(
		game.state.options?.payment_method === 'pay_as_offered' ? 'Pay-as-Offered' : 'Last Accepted Offer'
	);
	const paymentAbbr = $derived(
		game.state.options?.payment_method === 'pay_as_offered' ? 'PAO' : 'LAO'
	);

	const genPresetLabels: Record<string, string> = { standard: 'Std', simple: 'Sim', competitive: 'Cmp' };
	const genPresetTitles: Record<string, string> = { standard: 'Standard (5 gens)', simple: 'Simple (3 gens)', competitive: 'Competitive (7 gens)' };
	const loadProfileLabels: Record<string, string> = { realistic: 'Real', flat: 'Flat', peak: 'Peak', volatile: 'Vol' };
	const loadProfileTitles: Record<string, string> = { realistic: 'Realistic demand curve', flat: 'Flat (constant) demand', peak: 'Peak-heavy demand', volatile: 'Volatile demand swings' };

	const genPresetAbbr = $derived(genPresetLabels[game.state.options?.gen_preset ?? 'standard'] ?? 'Std');
	const genPresetTitle = $derived(genPresetTitles[game.state.options?.gen_preset ?? 'standard'] ?? 'Standard');
	const loadProfileAbbr = $derived(loadProfileLabels[game.state.options?.load_profile ?? 'realistic'] ?? 'Real');
	const loadProfileTitle = $derived(loadProfileTitles[game.state.options?.load_profile ?? 'realistic'] ?? 'Realistic');

	function formatTimer(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return s > 0 ? `${m}m ${s}s` : `${m}m`;
	}
</script>

{#snippet paymentDescription()}
	{#if game.state.options?.payment_method === 'pay_as_offered'}
		<strong>Pay-as-Offered:</strong> Each generator is paid its own offer price. Players must strategically mark up above cost to maximize profit.
	{:else}
		<strong>Last Accepted Offer:</strong> All dispatched generators are paid the clearing price (highest accepted offer). Players compete by bidding near their true cost.
	{/if}
{/snippet}

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Market Settings" onkeydown={handleKeydown} tabindex="-1">
		<div class="modal-backdrop" onclick={close} role="presentation"></div>
		<div class="settings-modal animate-in">
			<!-- Header -->
			<div class="settings-header">
				<div class="settings-header-inner">
					<div class="flex items-center gap-3 min-w-0">
						<div class="settings-icon">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
								<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
								<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
							</svg>
						</div>
						<div class="min-w-0">
							<h3 class="settings-title">{marketName}</h3>
							<span class="settings-subtitle">Market Settings</span>
						</div>
					</div>
					<button class="settings-close" onclick={close} aria-label="Close">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
					</button>
				</div>
			</div>

			<div class="settings-body">
				<!-- Game Configuration -->
				{#if hasOptions}
					{#if editable}
						<!-- EDITABLE configuration (forming/full) -->
						<div class="editable-banner">
							Settings are editable before game starts
						</div>

						<!-- Game Structure -->
						<div class="settings-section">
							<div class="settings-section-label">Game Structure</div>
							<div class="grid grid-cols-3 gap-3">
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label">Max Players</label>
									<input type="number" class="edit-input" min="2" max="99"
										value={game.state.options?.max_participants}
										onchange={(e) => handleNumberChange('max_participants', e)} />
								</div>
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label">Periods</label>
									<input type="number" class="edit-input" min="2" max="99"
										value={game.state.options?.num_periods}
										onchange={(e) => handleNumberChange('num_periods', e)} />
								</div>
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label">Timer (sec)</label>
									<input type="number" class="edit-input" min="2" max="9999"
										value={game.state.options?.auto_advance_time}
										onchange={(e) => handleNumberChange('auto_advance_time', e)} />
								</div>
							</div>
						</div>

						<!-- Market Rules -->
						<div class="settings-section">
							<div class="settings-section-label">Market Rules</div>

							<!-- Payment Method -->
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="edit-label">Payment Method</label>
							<div class="flex border-[1.5px] border-border rounded overflow-hidden mb-2">
								<button
									class="flex-1 py-2 px-3 font-body text-sm font-semibold border-none border-r-[1.5px] border-r-border cursor-pointer transition-all duration-100 ease-brand {game.state.options?.payment_method === 'last_accepted_offer' ? 'bg-maroon text-text-inverse' : 'bg-white text-text-secondary hover:bg-maroon-faint hover:text-maroon'}"
									onclick={() => updateOption('payment_method', 'last_accepted_offer')}
									type="button"
								>LAO</button>
								<button
									class="flex-1 py-2 px-3 font-body text-sm font-semibold border-none cursor-pointer transition-all duration-100 ease-brand {game.state.options?.payment_method === 'pay_as_offered' ? 'bg-maroon text-text-inverse' : 'bg-white text-text-secondary hover:bg-maroon-faint hover:text-maroon'}"
									onclick={() => updateOption('payment_method', 'pay_as_offered')}
									type="button"
								>PAO</button>
							</div>
							<p class="text-xs text-text-muted leading-[1.4] mb-4">{@render paymentDescription()}</p>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label">Max Offer Price</label>
									<input type="number" class="edit-input" min="1" max="9999"
										value={game.state.options?.max_offer_price}
										onchange={(e) => handleNumberChange('max_offer_price', e)} />
								</div>
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label">Starting Money</label>
									<input type="number" class="edit-input" min="0" max="999999"
										value={game.state.options?.starting_money}
										onchange={(e) => handleNumberChange('starting_money', e)} />
								</div>
							</div>
						</div>

						<!-- Supply & Demand -->
						<div class="settings-section">
							<div class="settings-section-label">Supply & Demand</div>

							<!-- Generator Preset -->
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="edit-label">Generator Portfolio</label>
							<div class="grid grid-cols-3 gap-2 mb-4">
								{#each (['standard', 'simple', 'competitive'] as const) as preset}
									<button
										class="preset-btn {game.state.options?.gen_preset === preset ? 'preset-btn--active' : ''}"
										onclick={() => updateOption('gen_preset', preset)}
										type="button"
									>
										<span class="font-bold text-xs">{preset === 'standard' ? 'Standard' : preset === 'simple' ? 'Simple' : 'Competitive'}</span>
										<span class="text-[10px] text-text-muted font-mono">{preset === 'standard' ? '5 gens' : preset === 'simple' ? '3 gens' : '7 gens'}</span>
									</button>
								{/each}
							</div>

							<!-- Load Profile -->
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="edit-label">Demand Profile</label>
							<div class="grid grid-cols-4 gap-2 mb-4">
								{#each (['realistic', 'flat', 'peak', 'volatile'] as const) as profile}
									<button
										class="preset-btn {game.state.options?.load_profile === profile ? 'preset-btn--active' : ''}"
										onclick={() => updateOption('load_profile', profile)}
										type="button"
									>
										<span class="font-bold text-xs capitalize">{profile}</span>
									</button>
								{/each}
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label" title="When demand exceeds total supply, override clearing price to this value. 0 = disabled.">Scarcity Price</label>
									<input type="number" class="edit-input" min="0" max="99999"
										value={game.state.options?.scarcity_price ?? 0}
										onchange={(e) => handleNumberChange('scarcity_price', e)} />
									<span class="text-[10px] text-text-muted mt-0.5 block">0 = disabled</span>
								</div>
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="edit-label" title="Random +/- variation applied to each period's load. 0 = exact profile.">Load Jitter (%)</label>
									<input type="number" class="edit-input" min="0" max="30"
										value={game.state.options?.load_jitter ?? 0}
										onchange={(e) => handleNumberChange('load_jitter', e)} />
									<span class="text-[10px] text-text-muted mt-0.5 block">0 = exact profile</span>
								</div>
							</div>
						</div>
					{:else}
						<!-- READ-ONLY configuration (running/completed) -->
						<div class="settings-section">
							<div class="settings-section-label">Configuration</div>
							<div class="config-grid">
								<div class="config-cell">
									<span class="config-value">{game.state.options?.max_participants}</span>
									<span class="config-label">Players</span>
								</div>
								<div class="config-cell">
									<span class="config-value">{game.state.options?.num_periods}</span>
									<span class="config-label">Periods</span>
								</div>
								<div class="config-cell">
									<span class="config-value">{formatTimer(game.state.options?.auto_advance_time ?? 180)}</span>
									<span class="config-label">Timer</span>
								</div>
								<div class="config-cell" title={paymentLabel}>
									<span class="config-value">{paymentAbbr}</span>
									<span class="config-label">Pricing</span>
								</div>
								<div class="config-cell" title={genPresetTitle}>
									<span class="config-value">{genPresetAbbr}</span>
									<span class="config-label">Gens</span>
								</div>
								<div class="config-cell" title={loadProfileTitle}>
									<span class="config-value">{loadProfileAbbr}</span>
									<span class="config-label">Demand</span>
								</div>
							</div>
							<!-- Additional read-only details -->
							<div class="config-grid mt-2">
								<div class="config-cell">
									<span class="config-value">${game.state.options?.max_offer_price}</span>
									<span class="config-label">Offer Cap</span>
								</div>
								<div class="config-cell">
									<span class="config-value">${game.state.options?.starting_money}</span>
									<span class="config-label">Start $</span>
								</div>
								<div class="config-cell" title={(game.state.options?.scarcity_price ?? 0) > 0 ? `$${game.state.options?.scarcity_price}/MW` : 'Disabled'}>
									<span class="config-value">{(game.state.options?.scarcity_price ?? 0) > 0 ? `$${game.state.options?.scarcity_price}` : 'Off'}</span>
									<span class="config-label">Scarcity</span>
								</div>
							</div>
							{#if (game.state.options?.load_jitter ?? 0) > 0}
								<p class="text-[10px] text-text-muted mt-2 px-1">Load jitter: +/-{game.state.options?.load_jitter}%</p>
							{/if}
							<p class="text-xs text-text-muted mt-2 leading-[1.4] px-1">{@render paymentDescription()}</p>
						</div>
					{/if}
				{/if}

				<!-- Visibility -->
				<div class="settings-section">
					<div class="settings-section-label">Visibility</div>
					<div class="settings-row">
						<div class="settings-row-info">
							<div class="settings-row-icon" class:settings-row-icon--active={game.state.visibility === 'public'}>
								{#if game.state.visibility === 'public'}
									<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>
								{:else}
									<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884l-12-12 .708-.708 12 12-.708.708z"/></svg>
								{/if}
							</div>
							<div>
								<span class="settings-row-title">
									{game.state.visibility === 'public' ? 'Public' : 'Unlisted'}
								</span>
								<span class="settings-row-desc">
									{game.state.visibility === 'public' ? 'Visible in the player market browser' : 'Only accessible via direct link'}
								</span>
							</div>
						</div>
						<label class="toggle">
							<input type="checkbox" role="switch" checked={game.state.visibility === 'public'} onclick={toggleVisibility} aria-label="Toggle visibility" />
						</label>
					</div>
				</div>

				<!-- Danger Zone -->
				<div class="settings-section settings-danger-section">
					<div class="settings-section-label settings-section-label--danger">Danger Zone</div>

					<div class="danger-actions">
						{#if canReset}
							{#if !showResetConfirm}
								<button class="danger-action" onclick={() => { showResetConfirm = true; }}>
									<div class="danger-action-icon">
										<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
											<path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
											<path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
										</svg>
									</div>
									<div>
										<span class="danger-action-title">Reset Game</span>
										<span class="danger-action-desc">Clear all data and return to setup</span>
									</div>
								</button>
							{:else}
								<div class="danger-confirm">
									<p class="danger-confirm-msg">Reset all game data? This cannot be undone.</p>
									<div class="danger-confirm-btns">
										<button class="btn btn-secondary btn-sm" onclick={() => { showResetConfirm = false; }}>Cancel</button>
										<button class="btn btn-sm bg-danger text-white border-danger hover:bg-[#a33729]" onclick={executeReset}>Confirm Reset</button>
									</div>
								</div>
							{/if}
						{/if}

						{#if ondelete}
							<button class="danger-action danger-action--delete" onclick={handleDelete}>
								<div class="danger-action-icon danger-action-icon--delete">
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
										<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1h2a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
									</svg>
								</div>
								<div>
									<span class="danger-action-title">Delete Market</span>
									<span class="danger-action-desc">Permanently destroy this market and all data</span>
								</div>
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ---- Modal shell ---- */
	.settings-modal {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 480px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: white;
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	/* ---- Header ---- */
	.settings-header {
		background: var(--color-maroon);
		padding: 1px 0 0; /* 1px top accent */
		background-image: linear-gradient(
			to right,
			var(--color-maroon),
			var(--color-maroon) 70%,
			color-mix(in srgb, var(--color-gold) 30%, var(--color-maroon)) 100%
		);
	}
	.settings-header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.875rem 1.25rem;
		background: white;
	}
	.settings-icon {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		background: var(--color-maroon-faint);
		color: var(--color-maroon);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.settings-title {
		margin: 0;
		font-size: 1rem;
		line-height: 1.2;
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.settings-subtitle {
		display: block;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
		margin-top: 1px;
	}
	.settings-close {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 150ms var(--ease-brand);
		flex-shrink: 0;
	}
	.settings-close:hover {
		background: var(--color-cream-dark);
		color: var(--color-text-primary);
	}

	/* ---- Body ---- */
	.settings-body {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	/* ---- Editable banner ---- */
	.editable-banner {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--tracking-section);
		color: var(--color-maroon);
		background: var(--color-maroon-faint);
		text-align: center;
		padding: 0.375rem 1rem;
		border-bottom: 1px solid rgba(80, 0, 0, 0.08);
	}

	/* ---- Sections ---- */
	.settings-section {
		padding: 1.125rem 1.25rem;
		border-bottom: 1px solid var(--color-border-light);
	}
	.settings-section:last-child {
		border-bottom: none;
	}
	.settings-section-label {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-section);
		color: var(--color-text-muted);
		margin-bottom: 0.75rem;
	}
	.settings-section-label--danger {
		color: var(--color-danger);
	}

	/* ---- Edit inputs ---- */
	.edit-label {
		display: block;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		margin-bottom: 4px;
	}
	.edit-input {
		width: 100%;
		padding: 0.5rem 0.625rem;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-primary);
		background: var(--color-cream);
		border: 1.5px solid var(--color-border-light);
		border-radius: var(--radius-sm);
		transition: all 150ms var(--ease-brand);
		box-sizing: border-box;
	}
	.edit-input:focus {
		outline: none;
		border-color: var(--color-maroon);
		box-shadow: 0 0 0 3px rgba(80, 0, 0, 0.08);
	}

	/* ---- Preset buttons ---- */
	.preset-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 0.5rem 0.375rem;
		border: 1.5px solid var(--color-border-light);
		border-radius: var(--radius-sm);
		background: white;
		cursor: pointer;
		transition: all 100ms var(--ease-brand);
		font-family: var(--font-body);
	}
	.preset-btn:hover {
		border-color: var(--color-border);
		box-shadow: var(--shadow-xs);
	}
	.preset-btn--active {
		border-color: var(--color-maroon);
		box-shadow: inset 3px 0 0 var(--color-maroon);
		background: var(--color-maroon-faint);
	}
	.preset-btn--active span:first-child {
		color: var(--color-maroon);
	}

	/* ---- Config grid (read-only) ---- */
	.config-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0;
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.config-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 0.625rem 0.5rem;
		background: var(--color-cream);
	}
	.config-cell:not(:last-child) {
		border-right: 1px solid var(--color-border-light);
	}
	.config-value {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-text-primary);
		line-height: 1.2;
	}
	.config-label {
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: var(--color-text-muted);
	}

	@media (max-width: 440px) {
		.config-grid { grid-template-columns: repeat(2, 1fr); }
		.config-cell:nth-child(even) { border-right: none; }
		.config-cell:not(:nth-last-child(-n+2)) { border-bottom: 1px solid var(--color-border-light); }
	}

	/* ---- Settings row ---- */
	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 0.75rem;
		background: var(--color-cream);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-sm);
	}
	.settings-row-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.settings-row-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		background: var(--color-cream-dark);
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 200ms var(--ease-brand);
	}
	.settings-row-icon--active {
		background: var(--color-maroon-faint);
		color: var(--color-maroon);
	}
	.settings-row-title {
		display: block;
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-primary);
		line-height: 1.2;
	}
	.settings-row-desc {
		display: block;
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--color-text-muted);
		margin-top: 1px;
	}

	/* ---- Danger zone ---- */
	.settings-danger-section {
		background: linear-gradient(180deg, transparent 0%, rgba(196, 69, 54, 0.02) 100%);
	}

	.danger-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.danger-action {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: white;
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		font-family: var(--font-body);
		transition: all 150ms var(--ease-brand);
	}
	.danger-action:hover {
		border-color: var(--color-danger);
		background: var(--color-danger-bg);
	}
	.danger-action--delete:hover {
		border-color: var(--color-danger);
	}

	.danger-action-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		background: var(--color-warning-bg);
		color: var(--color-warning);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 150ms var(--ease-brand);
	}
	.danger-action:hover .danger-action-icon {
		background: rgba(196, 69, 54, 0.12);
		color: var(--color-danger);
	}
	.danger-action-icon--delete {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.danger-action-title {
		display: block;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-primary);
		line-height: 1.2;
	}
	.danger-action-desc {
		display: block;
		font-size: 11px;
		color: var(--color-text-muted);
		margin-top: 1px;
	}

	/* ---- Reset confirm ---- */
	.danger-confirm {
		padding: 0.75rem;
		background: var(--color-warning-bg);
		border: 1px solid rgba(184, 125, 10, 0.2);
		border-radius: var(--radius-sm);
	}
	.danger-confirm-msg {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #7a5206;
		margin: 0 0 0.75rem;
	}
	.danger-confirm-btns {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

</style>
