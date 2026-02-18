<script lang="ts">
	import type { MarketStorageInfo } from '$lib/types/messages.js';
	import { stateBadge, stateAbbr } from '$lib/utils/stateLabels.js';
	import ConfirmModal from '$lib/components/shared/ConfirmModal.svelte';

	import { untrack } from 'svelte';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { destroyMarket as destroyMarketRemote, purgeMarkets, getMarketInfo, getBulkMarketInfo } from '../../../routes/admin.remote';

	let { isOpen = $bindable() }: { isOpen: boolean } = $props();

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
	const hasRunningMarkets = $derived(marketInfos.some(m => m.state === 'running'));

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
			if (!connection.adminKey) { loading = false; return; }
			const data = await getBulkMarketInfo({ key: connection.adminKey });
			marketInfos = (data.markets ?? []) as MarketStorageInfo[];
		} catch {
			error = 'Failed to fetch storage info.';
			marketInfos = [];
		}
		loading = false;
	}

	async function handleDestroyMarket(name: string) {
		destroyingMarket = name;
		try {
			await destroyMarketRemote({ name, key: connection.adminKey ?? '' });
			marketInfos = marketInfos.filter(m => m.name !== name);
		} catch {
			console.warn('Failed to destroy market:', name);
		}
		destroyingMarket = null;
	}

	async function purgeAll() {
		purging = true;
		showPurgeConfirm = false;
		try {
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
			probeResult = { name: probeName.trim(), ...info };
		} catch {
			probeError = 'Failed to probe DO.';
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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !showPurgeConfirm) close();
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
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Storage Management" onkeydown={handleKeydown} tabindex="-1">
		<div class="modal-backdrop" onclick={close} role="presentation"></div>
		<div class="modal-card animate-in storage-modal">
			<!-- Sticky header -->
			<div class="storage-header">
				<div class="flex items-center gap-3 min-w-0">
					<div class="w-10 h-[3px] bg-gradient-to-r from-maroon to-gold rounded-sm" aria-hidden="true"></div>
					<h3 class="m-0 text-lg">Storage Management</h3>
				</div>
				<button class="w-8 h-8 flex items-center justify-center border-none bg-transparent text-text-muted rounded-sm cursor-pointer transition-all duration-100 ease-brand hover:bg-cream-dark hover:text-text-primary shrink-0" onclick={close} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
				</button>
			</div>

			<!-- Scrollable body -->
			<div class="storage-body">
			<!-- Overview -->
			<div class="px-6 pt-5 pb-1">
				<h4 class="text-[11px] font-semibold uppercase tracking-section text-text-muted m-0 mb-3">Overview</h4>
				<div class="grid grid-cols-3 gap-3 mb-4">
					<div class="flex flex-col gap-0.5 py-2.5 px-3 bg-cream rounded border border-border-light">
						<span class="text-[10px] font-semibold uppercase tracking-brand text-text-muted">Markets</span>
						<span class="font-mono text-sm font-bold text-text-primary">{loading ? '...' : marketInfos.length}</span>
					</div>
					<div class="flex flex-col gap-0.5 py-2.5 px-3 bg-cream rounded border border-border-light">
						<span class="text-[10px] font-semibold uppercase tracking-brand text-text-muted">Est. Storage</span>
						<span class="font-mono text-sm font-bold text-text-primary">{loading ? '...' : formatBytes(totalBytes)}</span>
					</div>
					<div class="flex flex-col items-center justify-center py-2.5 px-3 bg-cream rounded border border-border-light">
						<button
							class="btn btn-danger btn-sm w-full"
							disabled={loading || purging || marketInfos.length === 0}
							onclick={() => { showPurgeConfirm = true; }}
						>
							{purging ? 'Purging...' : 'Purge All'}
						</button>
					</div>
				</div>
			</div>

			<!-- Auto-cleanup notice -->
			<div class="px-6 pb-1">
				<div class="flex items-start gap-2 py-2.5 px-3 bg-cream rounded border border-border-light text-xs text-text-muted">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="shrink-0 mt-0.5 text-text-muted"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
					<span>Completed games are automatically cleaned up after 48 hours. Abandoned games (no connected players, not running) are also cleaned up after 48 hours.</span>
				</div>
			</div>

			<!-- Registered Markets Table -->
			<div class="px-6 pt-2 pb-4">
				<h4 class="text-[11px] font-semibold uppercase tracking-section text-text-muted m-0 mb-3">Registered Markets</h4>

				{#if loading}
					<div class="flex items-center justify-center py-8 text-text-muted text-sm gap-2">
						<div class="w-4 h-4 border-2 border-border-light border-t-maroon rounded-full animate-spin" aria-hidden="true"></div>
						Loading storage info...
					</div>
				{:else if error}
					<div class="callout callout-warning mb-3">{error}</div>
				{:else if marketInfos.length === 0}
					<div class="text-center py-6 text-text-muted text-sm italic">
						No registered markets. Storage is clean.
					</div>
				{:else}
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Name</th>
									<th>State</th>
									<th class="text-right">Players</th>
									<th class="text-right">Size</th>
									<th class="text-right">Action</th>
								</tr>
							</thead>
							<tbody>
								{#each marketInfos as market (market.name)}
									<tr class={market.error ? 'opacity-60' : ''}>
										<td class="font-semibold font-body text-text-primary">{market.name}</td>
										<td>
											{#if market.error}
												<span class="badge py-[1px] px-2 text-[10px] badge-danger" title={market.error}>ERR</span>
											{:else}
												<span class="badge py-[1px] px-2 text-[10px] {stateBadgeClass(market.state)}">
													{stateAbbr(market.state)}
												</span>
											{/if}
										</td>
										<td class="text-right">{market.error ? '–' : market.playerCount}</td>
										<td class="text-right">{market.error ? '–' : formatBytes(market.estimatedStorageBytes ?? 0)}</td>
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
				{/if}
			</div>

			<!-- Probe Orphaned DO -->
			<div class="px-6 pt-2 pb-5 border-t border-border-light">
				<h4 class="text-[11px] font-semibold uppercase tracking-section text-text-muted m-0 mb-2 mt-4">Probe by Name</h4>
				<p class="text-xs text-text-muted m-0 mb-3">Check if a Durable Object exists for a market name not in the registry (orphaned data).</p>
				<div class="flex gap-2 mb-3">
					<input
						type="text"
						class="form-input flex-1 !py-2 !px-3 !text-sm"
						placeholder="Market name..."
						bind:value={probeName}
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') probeMarket(); }}
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
					<div class="bg-cream rounded border border-border-light p-3">
						{#if probeResult.exists}
							<div class="flex items-center justify-between gap-3">
								<div>
									<span class="text-sm font-semibold text-text-primary">{probeResult.name}</span>
									<span class="badge py-[1px] px-2 text-[10px] ml-2 {stateBadgeClass(probeResult.state)}">
										{stateAbbr(probeResult.state)}
									</span>
									<div class="text-xs text-text-muted mt-1">
										{probeResult.playerCount} players &middot; {formatBytes(probeResult.estimatedStorageBytes ?? 0)}
									</div>
								</div>
								<button class="btn btn-danger btn-sm" onclick={destroyProbed}>Destroy</button>
							</div>
						{:else}
							<div class="text-sm text-text-secondary font-semibold">No data found for "{probeResult.name}"</div>
							<div class="text-xs text-text-muted mt-1">This Durable Object has no stored state.</div>
						{/if}
					</div>
				{/if}
			</div>
			</div>
		</div>
	</div>
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
	.storage-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--color-border-light);
		flex-shrink: 0;
	}
	.storage-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>

{#if showPurgeConfirm}
	<ConfirmModal
		title="Purge All Markets"
		message={hasRunningMarkets
			? `WARNING: ${marketInfos.filter(m => m.state === 'running').length} market(s) are currently running. This will permanently destroy ALL ${marketInfos.length} market(s) and their Durable Object storage. This cannot be undone.`
			: `Permanently destroy all ${marketInfos.length} market(s) and their Durable Object storage? This cannot be undone.`}
		confirmLabel="Purge All"
		variant="danger"
		onconfirm={purgeAll}
		oncancel={() => { showPurgeConfirm = false; }}
	/>
{/if}
