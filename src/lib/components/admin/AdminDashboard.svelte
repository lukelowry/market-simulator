<script lang="ts">
	import { onMount } from 'svelte';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connect, disconnect, send } from '$lib/websocket.js';
	import { destroyMarket } from '../../../routes/admin.remote';
	import type { GameOptions } from '$shared/game.js';
	import MarketSidebar from '$lib/components/admin/MarketSidebar.svelte';
	import GameControls from '$lib/components/admin/game-controls/GameControls.svelte';
	import PlayerCardGrid from '$lib/components/admin/PlayerCardGrid.svelte';
	import PlayerDetailModal from '$lib/components/admin/PlayerDetailModal.svelte';
	import MarketHistoryChart from '$lib/components/admin/MarketHistoryChart.svelte';
	import GameConfigModal from '$lib/components/admin/GameConfigModal.svelte';
	import AnalyticsSidebar from '$lib/components/admin/AnalyticsSidebar.svelte';
	import MarketSettingsModal from '$lib/components/admin/MarketSettingsModal.svelte';
	import StorageManagementModal from '$lib/components/admin/StorageManagementModal.svelte';
	import CsvExport from '$lib/components/shared/CsvExport.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { createDisconnectTimer } from '$lib/utils/disconnectTimer.svelte.js';

	let selectedMarket: string | null = $state(null);
	let selectedPlayer: string | null = $state(null);
	let showStorageModal = $state(false);
	let showSettingsModal = $state(false);

	let showCreateModal = $state(false);
	let pendingConfig: GameOptions | null = $state(null);
	let sidebarRefreshKey = $state(0);

	// Paired setup/teardown: co-located via $effect cleanup
	$effect(() => {
		connection.logoutHandler = () => {
			disconnect({ clearStoredSession: true });
			connection.role = null;
			connection.participantName = '';
		};
		return () => {
			connection.logoutHandler = null;
		};
	});

	// One-time init: set identity and sync sidebar (reads reactive stores, must not re-run)
	onMount(() => {
		connection.role = 'admin';
		connection.participantName = 'Admin';

		if (connection.connected && connection.marketName) {
			selectedMarket = connection.marketName;
		}
	});

	// Reset modal state when switching markets to prevent stale data
	$effect(() => {
		const _market = selectedMarket; // read to track dependency
		selectedPlayer = null;
		showStorageModal = false;
		showSettingsModal = false;
	});

	const showSetup = $derived(connection.connected && game.state.state === 'uninitialized');
	const showGame = $derived(connection.connected && !showSetup);
	const isRunningOrCompleted = $derived(game.isActive);
	const showDisconnectError = $derived(
		!connection.connected && !connection.reconnecting && connection.connectionError !== null
	);

	async function handleRemoveMarket(name: string) {
		try {
			if (!connection.adminKey) return;
			// Disconnect BEFORE the server call so the WS close handler (code 4003)
			// doesn't race and flash a "market deleted" error banner.
			if (selectedMarket === name) {
				disconnect({ keepIdentity: true });
				selectedMarket = null;
			}
			await destroyMarket({ name, key: connection.adminKey });
			sidebarRefreshKey++;
		} catch (err) {
			console.warn('Failed to remove market:', err);
		}
	}

	// Create market: connect then send config once ready (lifted from MarketSidebar)
	function handleCreateMarket(name: string, config: GameOptions) {
		pendingConfig = config;
		showCreateModal = false;
		if (connection.connected) disconnect({ keepIdentity: true });
		selectedMarket = name;
		connection.marketName = name;
		connect(name, 'admin', 'admin', connection.adminKey);
		sidebarRefreshKey++;
	}

	// Send createGame when connected to a new uninitialized market with pending config
	$effect(() => {
		if (pendingConfig && connection.connected && game.state.state === 'uninitialized') {
			send({ type: 'createGame', payload: pendingConfig });
			pendingConfig = null;
		}
	});

	const disconnectTimer = createDisconnectTimer();
</script>

<div class="animate-in mx-auto max-w-[1440px] pb-16">
	<div
		class="grid min-h-[calc(100vh-160px)] grid-cols-1 items-start gap-6 md:grid-cols-[280px_1fr]"
	>
		<div class="sticky top-8 flex max-h-[calc(100vh-var(--navbar-height)-var(--sidebar-offset))] flex-col gap-4">
			<MarketSidebar
				bind:selectedMarket
				onrequestcreate={() => {
					showCreateModal = true;
				}}
				refreshKey={sidebarRefreshKey}
			/>
			<button
				class="border-border-light text-text-muted font-body ease-brand hover:border-maroon/40 hover:text-maroon hover:bg-maroon-faint flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded border bg-surface px-3 py-1.5 text-xs font-medium transition-all duration-200"
				onclick={() => {
					showStorageModal = true;
				}}
			>
				<Icon name="storage" size={14} />
				Storage Management
			</button>
		</div>

		<div class="min-w-0">
			{#if !selectedMarket}
				<div class="text-text-muted flex flex-col items-center px-8 py-12 text-center">
					<svg
						class="text-maroon mb-4 opacity-10"
						width="40"
						height="40"
						viewBox="0 0 16 16"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13z"
						/>
						<path
							d="M5 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 5 8zm0-2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"
						/>
					</svg>
					<h2 class="text-text-secondary mb-2 text-xl">Select a Market</h2>
					<p class="max-w-[340px] text-sm">
						Choose a market from the sidebar or create a new one.
					</p>
				</div>
			{:else if showDisconnectError}
				<div class="text-text-muted flex flex-col items-center px-8 py-12 text-center">
					<div
						class="bg-danger-bg mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg"
					>
						<Icon name="warning" size={22} class="text-danger" />
					</div>
					<h2 class="text-text-secondary mb-2 text-xl">Disconnected</h2>
					<p class="mb-5 max-w-[340px] text-sm">{connection.connectionError}</p>
					<button
						class="btn btn-primary"
						onclick={() => {
							connection.connectionError = null;
							selectedMarket = null;
						}}
					>
						Back to Markets
					</button>
				</div>
			{:else if !connection.connected && !connection.reconnecting}
				<div
					class="text-text-muted flex flex-col items-center px-8 py-12 text-center"
					role="status"
					aria-live="polite"
				>
					<div
						class="spinner spinner-md mb-4"
						aria-hidden="true"
					></div>
					<h2 class="text-text-secondary mb-2 text-xl">Connecting to {selectedMarket}</h2>
					<p class="max-w-[340px] text-sm">Establishing connection...</p>
				</div>
			{:else if disconnectTimer.tooLong}
				<div
					class="text-text-muted flex flex-col items-center px-8 py-12 text-center"
					role="status"
					aria-live="polite"
				>
					<div
						class="spinner spinner-md mb-4"
						aria-hidden="true"
					></div>
					<h2 class="text-text-secondary mb-2 text-xl">Reconnecting to {selectedMarket}</h2>
					<p class="max-w-[340px] text-sm">Connection lost. Attempting to reconnect...</p>
				</div>
			{:else}
				{#if connection.reconnecting}
					<div
						class="bg-warning-bg border-warning/20 text-warning mb-4 flex items-center gap-2 rounded border px-4 py-2 text-sm"
					>
						<div
							class="border-warning/40 border-t-warning h-3 w-3 shrink-0 animate-spin rounded-full border-2"
							aria-hidden="true"
						></div>
						<span>Reconnecting...</span>
					</div>
				{/if}
				<div class="stagger flex flex-col gap-6">
					<GameControls
						onrequestsettings={() => {
							showSettingsModal = true;
						}}
					/>

					{#if showSetup}
						<div
							class="border-border-light flex flex-col items-center rounded-lg border bg-surface px-8 py-10 text-center shadow-xs"
						>
							<Icon name="gear" size={32} class="text-maroon mb-4 opacity-15" />
							<h2 class="text-text-secondary mb-2 text-xl">Uninitialized Market</h2>
							<p class="text-text-muted max-w-[340px] text-sm">
								No game configuration. Create a new market from the sidebar.
							</p>
						</div>
					{:else if showGame}
						<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_260px]">
							<div class="flex min-w-0 flex-col gap-6">
								<PlayerCardGrid
									onselect={(id) => {
										selectedPlayer = id;
									}}
								/>
								{#if isRunningOrCompleted}
									<MarketHistoryChart />
									<CsvExport />
								{/if}
							</div>
							<AnalyticsSidebar />
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- All modals rendered at component root for correct z-index layering -->
{#if selectedPlayer}
	<PlayerDetailModal
		playerId={selectedPlayer}
		onclose={() => {
			selectedPlayer = null;
		}}
	/>
{/if}

{#if showCreateModal}
	<GameConfigModal
		onclose={() => {
			showCreateModal = false;
		}}
		oncreate={handleCreateMarket}
	/>
{/if}

{#if showSettingsModal}
	<MarketSettingsModal
		bind:isOpen={showSettingsModal}
		marketName={connection.marketName}
		ondelete={() => {
			if (selectedMarket) handleRemoveMarket(selectedMarket);
		}}
	/>
{/if}

{#if showStorageModal}
	<StorageManagementModal
		bind:isOpen={showStorageModal}
		onbeforedestroy={(name) => {
			if (selectedMarket === name && connection.connected) {
				disconnect({ keepIdentity: true });
				selectedMarket = null;
				sidebarRefreshKey++;
			}
		}}
	/>
{/if}
