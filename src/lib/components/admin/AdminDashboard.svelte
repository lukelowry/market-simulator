<script lang="ts">
	import { onMount } from 'svelte';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connect, disconnect, send, softDisconnect } from '$lib/services/websocket.js';
	import { destroyMarket } from '../../../routes/admin.remote';
	import type { GameOptions } from '$lib/types/game.js';
	import MarketSidebar from '$lib/components/admin/MarketSidebar.svelte';
	import GameControls from '$lib/components/admin/GameControls.svelte';
	import PlayerCardGrid from '$lib/components/admin/PlayerCardGrid.svelte';
	import PlayerDetailModal from '$lib/components/admin/PlayerDetailModal.svelte';
	import MarketHistoryChart from '$lib/components/admin/MarketHistoryChart.svelte';
	import GameConfigModal from '$lib/components/admin/GameConfigModal.svelte';
	import AnalyticsSidebar from '$lib/components/admin/AnalyticsSidebar.svelte';
	import MarketSettingsModal from '$lib/components/admin/MarketSettingsModal.svelte';
	import StorageManagementModal from '$lib/components/admin/StorageManagementModal.svelte';
	import CsvExport from '$lib/components/CsvExport.svelte';
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
			disconnect(true); // true = clear stored WebSocket session
			connection.role = null;
			connection.participantName = '';
		};
		return () => { connection.logoutHandler = null; };
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
				softDisconnect();
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
		if (connection.connected) softDisconnect();
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

<div class="max-w-[1440px] mx-auto pb-16 animate-in">
	<div class="grid grid-cols-1 min-[901px]:grid-cols-[280px_1fr] gap-6 items-start min-h-[calc(100vh-160px)]">
		<div class="flex flex-col gap-4 sticky top-8 max-h-[calc(100vh-140px)]">
			<MarketSidebar
				bind:selectedMarket
				onrequestcreate={() => { showCreateModal = true; }}
				refreshKey={sidebarRefreshKey}
			/>
			<button
				class="w-full py-2 px-4 border-[1.5px] border-border-light rounded bg-white text-text-muted font-body text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 ease-brand shrink-0 hover:border-maroon hover:text-maroon hover:bg-maroon-faint"
				onclick={() => { showStorageModal = true; }}
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v2A1.5 1.5 0 0 1 13.5 7h-11A1.5 1.5 0 0 1 1 5.5v-2zM2.5 3a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-11zm0 6A1.5 1.5 0 0 0 1 10.5v2A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 13.5 9h-11zM2 10.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-2z"/>
				</svg>
				Storage Management
			</button>
		</div>

		<main class="min-w-0">
			{#if !selectedMarket}
				<div class="flex flex-col items-center text-center py-16 px-8 text-text-muted">
					<svg class="opacity-15 mb-5" width="48" height="48" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13z"/>
						<path d="M5 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 5 8zm0-2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/>
					</svg>
					<h3 class="mb-3 text-text-secondary">Select a Market</h3>
					<p class="text-sm max-w-[340px]">Choose a market from the sidebar, or create a new one to get started.</p>
				</div>
			{:else if showDisconnectError}
				<div class="flex flex-col items-center text-center py-16 px-8 text-text-muted">
					<div class="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center mx-auto mb-5">
						<svg class="w-7 h-7 text-danger" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
							<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
							<path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
						</svg>
					</div>
					<h3 class="mb-3 text-text-secondary">Disconnected</h3>
					<p class="text-sm max-w-[340px] mb-6">{connection.connectionError}</p>
					<button class="btn btn-primary" onclick={() => { connection.connectionError = null; selectedMarket = null; }}>
						Back to Markets
					</button>
				</div>
			{:else if !connection.connected && !connection.reconnecting}
				<div class="flex flex-col items-center text-center py-16 px-8 text-text-muted">
					<div class="w-8 h-8 border-3 border-border-light border-t-maroon rounded-full animate-spin mb-5" aria-hidden="true"></div>
					<h3 class="mb-3 text-text-secondary">Connecting to {selectedMarket}</h3>
					<p class="text-sm max-w-[340px]">Establishing connection...</p>
				</div>
			{:else if disconnectTimer.tooLong}
				<div class="flex flex-col items-center text-center py-16 px-8 text-text-muted">
					<div class="w-8 h-8 border-3 border-border-light border-t-maroon rounded-full animate-spin mb-5" aria-hidden="true"></div>
					<h3 class="mb-3 text-text-secondary">Reconnecting to {selectedMarket}</h3>
					<p class="text-sm max-w-[340px]">Connection lost. Attempting to reconnect...</p>
				</div>
			{:else}
				{#if connection.reconnecting}
					<div class="flex items-center gap-2 py-2 px-4 mb-4 bg-warning-bg border border-warning/20 rounded text-warning text-sm">
						<div class="w-3 h-3 border-2 border-warning/40 border-t-warning rounded-full animate-spin shrink-0" aria-hidden="true"></div>
						<span>Reconnecting...</span>
					</div>
				{/if}
				<div class="flex flex-col gap-6 stagger">
					<GameControls
						onrequestsettings={() => { showSettingsModal = true; }}
					/>

					{#if showSetup}
						<div class="flex flex-col items-center text-center py-12 px-8 bg-white border border-border-light rounded-lg shadow-sm">
							<svg class="text-text-muted opacity-30 mb-5" width="40" height="40" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
								<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
								<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
							</svg>
							<h3 class="mb-3 text-text-secondary">Uninitialized Market</h3>
							<p class="text-sm text-text-muted max-w-[340px]">This market has no game configuration. Create a new market from the sidebar to get started.</p>
						</div>
					{:else if showGame}

						<div class="grid grid-cols-1 min-[1101px]:grid-cols-[1fr_260px] gap-6 items-start">
							<div class="min-w-0 flex flex-col gap-6">
								<PlayerCardGrid onselect={(id) => { selectedPlayer = id; }} />
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
		</main>
	</div>
</div>

<!-- All modals rendered at component root for correct z-index layering -->
{#if selectedPlayer}
	<PlayerDetailModal playerId={selectedPlayer} onclose={() => { selectedPlayer = null; }} />
{/if}

{#if showCreateModal}
	<GameConfigModal
		onclose={() => { showCreateModal = false; }}
		oncreate={handleCreateMarket}
	/>
{/if}

{#if showSettingsModal}
	<MarketSettingsModal
		bind:isOpen={showSettingsModal}
		marketName={connection.marketName}
		ondelete={() => { if (selectedMarket) handleRemoveMarket(selectedMarket); }}
	/>
{/if}

{#if showStorageModal}
	<StorageManagementModal bind:isOpen={showStorageModal} />
{/if}
