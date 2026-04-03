<script lang="ts">
	import { stateBadge, stateAbbr } from '$lib/utils/stateLabels.js';

	interface MarketStorageInfo {
		name?: string;
		marketName: string | null;
		exists: boolean;
		state: string | null;
		playerCount: number;
		periodCount: number;
		currentPeriod: number;
		estimatedStorageBytes: number;
		hasAlarm: boolean;
		connectedWebSockets: number;
		error?: string;
	}
	import Modal from '$lib/components/shared/Modal.svelte';
	import ConfirmModal from '$lib/components/shared/ConfirmModal.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

	import { untrack } from 'svelte';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import {
		destroyMarket as destroyMarketRemote,
		purgeMarkets,
		getMarketInfo,
		getBulkMarketInfo
	} from '../../../routes/admin.remote';

	let {
		isOpen = $bindable(),
		onbeforedestroy
	}: {
		isOpen: boolean;
		onbeforedestroy?: (name: string) => void;
	} = $props();

	let marketInfos: MarketStorageInfo[] = $state([]);
	let loading = $state(false);
	let error = $state('');

	let probeName = $state('');
	let probeResult: MarketStorageInfo | null = $state(null);
	let probeLoading = $state(false);
	let probeError = $state('');

	let showPurgeConfirm = $state(false);
	let purging = $state(false);
	let destroyingMarket: string | null = $state(null);

	const totalBytes = $derived(marketInfos.reduce((s, m) => s + (m.estimatedStorageBytes ?? 0), 0));
	const hasRunningMarkets = $derived(marketInfos.some((m) => m.state === 'running'));

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function stateBadgeClass(state: string | null): string {
		if (!state) return 'badge-muted';
		return stateBadge(state);
	}

	async function fetchAllInfo() {
		loading = true;
		error = '';
		try {
			if (!connection.adminKey) {
				loading = false;
				return;
			}
			const data = await getBulkMarketInfo({ key: connection.adminKey });
			marketInfos = (data.markets ?? []) as MarketStorageInfo[];
		} catch {
			error = 'Could not load market data. Try closing and reopening this panel.';
			marketInfos = [];
		}
		loading = false;
	}

	async function handleDestroyMarket(name: string) {
		destroyingMarket = name;
		try {
			await destroyMarketRemote({ name, key: connection.adminKey ?? '' });
			onbeforedestroy?.(name);
			marketInfos = marketInfos.filter((m) => m.name !== name);
		} catch {
			console.warn('Failed to destroy market:', name);
		}
		destroyingMarket = null;
	}

	async function purgeAll() {
		purging = true;
		showPurgeConfirm = false;
		try {
			// Notify parent to disconnect from any connected market before purge
			for (const m of marketInfos) if (m.name) onbeforedestroy?.(m.name);
			await purgeMarkets({ key: connection.adminKey ?? '', destroyStorage: true });
			marketInfos = [];
		} catch {
			console.warn('Failed to purge markets');
		}
		purging = false;
	}

	async function probeMarket() {
		if (!probeName.trim()) return;
		probeLoading = true;
		probeError = '';
		probeResult = null;
		try {
			const info = await getMarketInfo({ name: probeName.trim(), key: connection.adminKey ?? '' });
			probeResult = { name: probeName.trim(), ...(info as MarketStorageInfo) };
		} catch {
			probeError = 'Could not look up this market. Check the name and try again.';
		}
		probeLoading = false;
	}

	async function destroyProbed() {
		if (!probeResult?.name) return;
		await handleDestroyMarket(probeResult.name);
		probeResult = null;
		probeName = '';
	}

	function close() {
		isOpen = false;
		showPurgeConfirm = false;
	}

	// Fetch data when modal opens — untrack to prevent $effect from tracking
	// reactive reads inside fetchAllInfo (connection.adminKey, command() internals)
	$effect(() => {
		if (isOpen) {
			untrack(() => fetchAllInfo());
		}
	});
</script>

{#if isOpen}
	<Modal title="Storage Management" titleId="smm-title" maxWidth="900px" onclose={close}>
		<div class="storage-modal">
			<!-- Sticky header -->
			<div class="modal-header gap-3">
				<div class="flex min-w-0 items-center gap-3">
					<h3 id="smm-title" class="m-0 text-lg">Storage Management</h3>
				</div>
				<button class="btn-close" onclick={close} aria-label="Close">
					<Icon name="close" size={18} />
				</button>
			</div>

			<!-- Scrollable body -->
			<div class="modal-body p-0">
				<!-- Overview -->
				<div class="px-6 pt-5 pb-1">
					<h4 class="tracking-section text-text-muted m-0 mb-3 text-[11px] font-bold uppercase">
						Overview
					</h4>
					<div class="mb-4 grid grid-cols-2 gap-3 min-[480px]:grid-cols-3">
						<div
							class="bg-cream border-border-light flex flex-col gap-0.5 rounded border px-3 py-2.5"
						>
							<span class="tracking-brand text-text-muted text-[11px] font-semibold uppercase"
								>Markets</span
							>
							<span class="text-text-primary font-mono text-sm font-bold"
								>{loading ? '...' : marketInfos.length}</span
							>
						</div>
						<div
							class="bg-cream border-border-light flex flex-col gap-0.5 rounded border px-3 py-2.5"
						>
							<span class="tracking-brand text-text-muted text-[11px] font-semibold uppercase"
								>Est. Storage</span
							>
							<span class="text-text-primary font-mono text-sm font-bold"
								>{loading ? '...' : formatBytes(totalBytes)}</span
							>
						</div>
						<div
							class="bg-cream border-border-light flex flex-col items-center justify-center rounded border px-3 py-2.5"
						>
							<button
								class="btn btn-danger btn-sm w-full"
								disabled={loading || purging || marketInfos.length === 0}
								onclick={() => {
									showPurgeConfirm = true;
								}}
							>
								{purging ? 'Purging...' : 'Purge All'}
							</button>
						</div>
					</div>
				</div>

				<!-- Auto-cleanup notice -->
				<div class="px-6 pb-1">
					<div
						class="bg-cream border-border-light text-text-muted flex items-start gap-2 rounded border px-3 py-2.5 text-xs"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="currentColor"
							class="text-text-muted mt-0.5 shrink-0"
							><path
								d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"
							/><path
								d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
							/></svg
						>
						<span
							>Completed games are automatically cleaned up after 48 hours. Abandoned games (no
							connected players, not running) are also cleaned up after 48 hours.</span
						>
					</div>
				</div>

				<!-- Registered Markets Table -->
				<div class="px-6 pt-2 pb-4">
					<h4 class="tracking-section text-text-muted m-0 mb-3 text-[11px] font-bold uppercase">
						Registered Markets
					</h4>

					{#if loading}
						<div
							class="text-text-muted flex items-center justify-center gap-2 py-8 text-sm"
							role="status"
						>
							<div
								class="spinner spinner-sm"
								aria-hidden="true"
							></div>
							Loading storage info...
						</div>
					{:else if error}
						<div class="callout callout-warning mb-3">{error}</div>
					{:else if marketInfos.length === 0}
						<div class="text-text-muted py-6 text-center text-sm italic">
							No registered markets. Storage is clean.
						</div>
					{:else}
						<!-- Desktop table (hidden on small screens) -->
						<div class="smm-table-desktop table-wrap overflow-x-auto">
							<table>
								<thead>
									<tr>
										<th scope="col">Name</th>
										<th scope="col">State</th>
										<th scope="col" class="text-right">Players</th>
										<th scope="col" class="text-right">Size</th>
										<th scope="col" class="text-right">Action</th>
									</tr>
								</thead>
								<tbody>
									{#each marketInfos as market (market.name)}
										<tr class={market.error ? 'opacity-60' : ''}>
											<td class="font-body text-text-primary font-semibold">{market.name}</td>
											<td>
												{#if market.error}
													<span
														class="badge badge-danger px-2 py-[1px] text-[11px]"
														title={market.error}>ERR</span
													>
												{:else}
													<span
														class="badge px-2 py-[1px] text-[11px] {stateBadgeClass(market.state)}"
													>
														{stateAbbr(market.state)}
													</span>
												{/if}
											</td>
											<td class="text-right">{market.error ? '–' : market.playerCount}</td>
											<td class="text-right"
												>{market.error ? '–' : formatBytes(market.estimatedStorageBytes ?? 0)}</td
											>
											<td class="text-right">
												<button
													class="btn btn-danger btn-sm"
													disabled={destroyingMarket === market.name}
													onclick={() => handleDestroyMarket(market.name!)}
												>
													{destroyingMarket === market.name ? '...' : 'Destroy'}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Mobile card list (shown on small screens) -->
						<div class="smm-cards-mobile flex flex-col gap-2">
							{#each marketInfos as market (market.name)}
								<div
									class="border-border-light bg-cream flex items-center justify-between gap-3 rounded border px-3 py-2.5"
									class:opacity-60={market.error}
								>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-text-primary truncate text-sm font-semibold">{market.name}</span>
											{#if market.error}
												<span class="badge badge-danger px-2 py-[1px] text-[11px]" title={market.error}>ERR</span>
											{:else}
												<span class="badge px-2 py-[1px] text-[11px] {stateBadgeClass(market.state)}">
													{stateAbbr(market.state)}
												</span>
											{/if}
										</div>
										<div class="text-text-muted mt-0.5 text-xs">
											{market.error ? '–' : `${market.playerCount} players · ${formatBytes(market.estimatedStorageBytes ?? 0)}`}
										</div>
									</div>
									<button
										class="btn btn-danger btn-sm shrink-0"
										disabled={destroyingMarket === market.name}
										onclick={() => handleDestroyMarket(market.name!)}
									>
										{destroyingMarket === market.name ? '...' : 'Destroy'}
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Probe Orphaned DO -->
				<div class="border-border-light border-t px-6 pt-2 pb-5">
					<h4
						class="tracking-section text-text-muted m-0 mt-4 mb-2 text-[11px] font-bold uppercase"
					>
						Probe by Name
					</h4>
					<p class="text-text-muted m-0 mb-3 text-xs">
						Check if a Durable Object exists for a market name not in the registry (orphaned data).
					</p>
					<div class="mb-3 flex gap-2">
						<label for="probe-market-name" class="sr-only">Market name to look up</label>
						<input
							id="probe-market-name"
							type="text"
							class="form-input flex-1 !px-3 !py-2 !text-sm"
							placeholder="Market name..."
							bind:value={probeName}
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter') probeMarket();
							}}
						/>
						<button
							class="btn btn-secondary btn-sm"
							disabled={probeLoading || !probeName.trim()}
							onclick={probeMarket}
						>
							{probeLoading ? '...' : 'Check'}
						</button>
					</div>

					{#if probeError}
						<div class="callout callout-warning text-xs">{probeError}</div>
					{/if}

					{#if probeResult}
						<div class="bg-cream border-border-light rounded border p-3">
							{#if probeResult.exists}
								<div class="flex items-center justify-between gap-3">
									<div>
										<span class="text-text-primary text-sm font-semibold">{probeResult.name}</span>
										<span
											class="badge ml-2 px-2 py-[1px] text-[11px] {stateBadgeClass(
												probeResult.state
											)}"
										>
											{stateAbbr(probeResult.state)}
										</span>
										<div class="text-text-muted mt-1 text-xs">
											{probeResult.playerCount} players &middot; {formatBytes(
												probeResult.estimatedStorageBytes ?? 0
											)}
										</div>
									</div>
									<button class="btn btn-danger btn-sm" onclick={destroyProbed}>Delete</button>
								</div>
							{:else}
								<div class="text-text-secondary text-sm font-semibold">
									No data found for "{probeResult.name}"
								</div>
								<div class="text-text-muted mt-1 text-xs">
									No stored game data found for this market.
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</Modal>
{/if}

{#if showPurgeConfirm}
	<ConfirmModal
		title="Purge All Markets"
		message={hasRunningMarkets
			? `WARNING: ${marketInfos.filter((m) => m.state === 'running').length} market(s) are currently running. This will permanently delete ALL ${marketInfos.length} market(s) and their game data. This cannot be undone.`
			: `Permanently delete all ${marketInfos.length} market(s) and their game data? This cannot be undone.`}
		confirmLabel="Purge All"
		variant="danger"
		onconfirm={purgeAll}
		oncancel={() => {
			showPurgeConfirm = false;
		}}
	/>
{/if}

<style>
	.storage-modal {
		max-width: 640px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Mobile: show cards, hide table */
	.smm-cards-mobile {
		display: flex;
	}
	.smm-table-desktop {
		display: none;
	}

	/* Desktop (≥480px): show table, hide cards */
	@media (min-width: 480px) {
		.smm-cards-mobile {
			display: none;
		}
		.smm-table-desktop {
			display: block;
		}
	}
</style>
