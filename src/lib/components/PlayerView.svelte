<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connect, disconnect } from '$lib/services/websocket.js';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import GeneratorTable from '$lib/components/GeneratorTable.svelte';
	import ProfitChart from '$lib/components/ProfitChart.svelte';
	import PeriodScorecard from '$lib/components/PeriodScorecard.svelte';
	import CsvExport from '$lib/components/CsvExport.svelte';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import MarketList from '$lib/components/MarketList.svelte';
	import { createDisconnectTimer } from '$lib/utils/disconnectTimer.svelte.js';

	let showWelcomeBanner = $state(true);
	let isJoining = $state(false);

	// Paired setup/teardown: co-located via $effect cleanup
	$effect(() => {
		connection.logoutHandler = () => {
			disconnect(true);
			connection.role = null;
			connection.participantName = '';
			connection.uin = '';
		};
		return () => {
			connection.logoutHandler = null;
		};
	});

	// One-time init: URL auto-join and welcome banner (reads reactive stores, must not re-run)
	onMount(() => {
		const urlMarket = $page.url.searchParams.get('market');
		if (urlMarket && connection.participantName) {
			joinMarket(urlMarket);
		}
		setTimeout(() => {
			showWelcomeBanner = false;
		}, 3000);
	});

	function joinMarket(market: string) {
		connection.marketName = market;
		isJoining = true;
		connect(market, 'participant', connection.participantName, undefined, connection.playerToken);
	}

	// Reset isJoining once connected or if reconnecting takes over
	$effect(() => {
		if (connection.connected || connection.reconnecting) {
			isJoining = false;
		}
	});

	const showGame = $derived(connection.connected && game.state.state !== 'uninitialized');
	const showConnectionStatus = $derived(isJoining && !showGame && !connection.connectionError);
	const showDisconnectError = $derived(!connection.connected && !connection.reconnecting && connection.connectionError !== null);
	const showGameData = $derived(
		game.state.state === 'running' || game.state.state === 'completed'
	);
	const isWaiting = $derived(
		game.state.state === 'forming' || game.state.state === 'full'
	);

	function backToMarkets() {
		disconnect(true);
		isJoining = false;
	}

	const playerNames = $derived(Object.keys(game.state.players));
	const genCount = $derived.by(() => {
		const preset = game.state.options?.gen_preset ?? 'standard';
		return preset === 'simple' ? 3 : preset === 'competitive' ? 7 : 5;
	});

	const disconnectTimer = createDisconnectTimer();
	const disconnectedTooLong = $derived(disconnectTimer.tooLong);

</script>

{#if showDisconnectError}
	<!-- Kicked / Replaced Error State -->
	<div class="flex items-center justify-center min-h-[50vh] p-8">
		<div class="bg-white border border-border-light rounded-lg p-10 max-w-[440px] mx-auto shadow text-center">
			<div class="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center mx-auto mb-5">
				<svg class="w-7 h-7 text-danger" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
					<path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
				</svg>
			</div>
			<h3 class="mb-2 text-text-primary">Disconnected</h3>
			<p class="text-sm text-text-muted mb-6">{connection.connectionError}</p>
			<button class="btn btn-primary" onclick={backToMarkets}>Back to Markets</button>
		</div>
	</div>
{:else if showConnectionStatus}
	<!-- Connecting State -->
	<div class="flex items-center justify-center min-h-[50vh] p-8">
		<ConnectionStatus />
	</div>
{:else if !showGame}
	<!-- Market Browser -->
	{#if showWelcomeBanner}
		<div class="fixed top-4 left-1/2 -translate-x-1/2 z-[9000] w-auto max-w-[480px] px-5 py-3 bg-success text-white rounded shadow-lg text-sm font-semibold flex items-center gap-2 welcome-toast pointer-events-none">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="shrink-0"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
			Welcome, {connection.participantName}! Select a market below to join.
		</div>
	{/if}

	<div class="max-w-[640px] mx-auto pt-8 animate-in">
		<div class="mb-6">
			<div>
				<div class="w-10 h-[3px] bg-gradient-to-r from-maroon to-gold rounded-sm mb-5" aria-hidden="true"></div>
				<h2 class="mb-2">Available Markets</h2>
				<p class="text-text-muted text-sm">Select a market to join. Only markets in the "Open" state are accepting players.</p>
			</div>
		</div>

		<MarketList onJoin={joinMarket} />
	</div>
{:else}
	<!-- Game View -->
	{#if connection.reconnecting && !disconnectedTooLong}
		<div class="flex items-center gap-2 py-2 px-4 mb-4 bg-warning-bg border border-warning/20 rounded text-warning text-sm max-w-[640px] mx-auto">
			<div class="w-3 h-3 border-2 border-warning/40 border-t-warning rounded-full animate-spin shrink-0" aria-hidden="true"></div>
			<span>Reconnecting...</span>
		</div>
	{/if}
	{#if disconnectedTooLong}
		<div class="flex flex-col items-center text-center py-16 px-8 text-text-muted">
			<div class="w-8 h-8 border-3 border-border-light border-t-maroon rounded-full animate-spin mb-5" aria-hidden="true"></div>
			<h3 class="mb-3 text-text-secondary">Reconnecting to {connection.marketName}</h3>
			<p class="text-sm max-w-[340px] mb-6">Connection lost. Attempting to reconnect...</p>
			<button class="btn btn-secondary" onclick={backToMarkets}>Back to Markets</button>
		</div>
	{:else}
		<div class="layout-sidebar">
			<Sidebar />
			<div class="min-w-0 stagger">
				{#if showGameData}
					<div class="grid grid-cols-1 min-[900px]:grid-cols-[1fr_260px] gap-4 items-start">
						<GeneratorTable />
						<PeriodScorecard />
					</div>
					<ProfitChart />
					<CsvExport />
				{:else if isWaiting}
					<div class="flex flex-col gap-6 max-w-[640px] animate-in">
						<!-- Status Banner -->
						<div class="flex items-center gap-3 py-4 px-5 bg-success-bg border border-success/20 rounded-lg">
							<div class="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
								<svg class="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
									<path d="M5 12l5 5L20 7"/>
								</svg>
							</div>
							<div>
								<p class="font-semibold text-text-primary text-sm">You're in!</p>
								<p class="text-text-muted text-sm">Waiting for the instructor to start the game<span class="waiting-dots"></span></p>
							</div>
						</div>

						<!-- Players Joined -->
						<div class="card border-t-3 border-t-gold">
							<div class="card-header">Players Joined</div>
							<div class="card-body">
								<div class="flex flex-wrap gap-2">
									{#each playerNames as name}
										<span class="inline-flex items-center gap-1.5 py-1.5 px-3 bg-cream rounded-full text-sm font-medium text-text-primary border border-border-light">
											{#if name === connection.participantName}
												<span class="w-2 h-2 rounded-full bg-success shrink-0"></span>
											{/if}
											{name}
											{#if name === connection.participantName}
												<span class="text-text-muted text-xs">(you)</span>
											{/if}
										</span>
									{/each}
								</div>
								<p class="text-xs text-text-muted mt-3">{game.playerCount} player{game.playerCount !== 1 ? 's' : ''} joined{game.state.options?.max_participants ? ` of ${game.state.options.max_participants} max` : ''}</p>
							</div>
						</div>

						<!-- How It Works Guide -->
						<div class="card border-t-3 border-t-maroon">
							<div class="card-header">How It Works</div>
							<div class="card-body flex flex-col gap-5">
								<div class="flex gap-3">
									<div class="w-7 h-7 rounded-full bg-maroon text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
									<div>
										<p class="font-semibold text-sm text-text-primary mb-0.5">Your Portfolio</p>
										<p class="text-sm text-text-muted">You own {genCount} power generators, each with a different capacity (MW) and production cost ($/MW). Larger generators are cheaper to run.</p>
									</div>
								</div>
								<div class="flex gap-3">
									<div class="w-7 h-7 rounded-full bg-maroon text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
									<div>
										<p class="font-semibold text-sm text-text-primary mb-0.5">Submit Offers</p>
										<p class="text-sm text-text-muted">Each period, set a price ($/MW) for each generator. This is the minimum price you'll accept to supply power. You must submit before the timer runs out.</p>
									</div>
								</div>
								<div class="flex gap-3">
									<div class="w-7 h-7 rounded-full bg-maroon text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
									<div>
										<p class="font-semibold text-sm text-text-primary mb-0.5">Market Clearing</p>
										<p class="text-sm text-text-muted">All offers are ranked cheapest to most expensive. Demand is filled from the bottom up. The last generator needed to meet demand sets the market clearing price.</p>
									</div>
								</div>
								<div class="flex gap-3">
									<div class="w-7 h-7 rounded-full bg-maroon text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</div>
									<div>
										<p class="font-semibold text-sm text-text-primary mb-0.5">Earning Profit</p>
										{#if game.state.options?.payment_method === 'pay_as_offered'}
											<p class="text-sm text-text-muted">This market uses <strong>Pay-as-Offered (PAO)</strong> pricing. Each dispatched generator is paid exactly what it offered — not the clearing price. Offer too high and you won't be dispatched; offer too low and you leave money on the table. Your profit is revenue minus production cost.</p>
										{:else}
											<p class="text-sm text-text-muted">This market uses <strong>Last Accepted Offer (LAO)</strong> pricing. All dispatched generators are paid the same clearing price — the offer of the last generator needed to meet demand. Your profit is the clearing price minus your production cost, times your capacity.</p>
										{/if}
									</div>
								</div>
								<div class="flex gap-3 pt-3 border-t border-border-light">
									<div class="w-7 h-7 rounded-full bg-gold text-white flex items-center justify-center shrink-0 mt-0.5">
										<svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
											<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.399l-.31 0 .07-.334 2.16-.33h-.002zm-.41-3.35a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
										</svg>
									</div>
									<div>
										<p class="font-semibold text-sm text-text-primary mb-0.5">Strategy Tip</p>
										<p class="text-sm text-text-muted">Offering low ensures your generator gets dispatched, but you might leave money on the table. Offering high means more profit per MW, but you risk not being dispatched at all. Find the balance!</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	.welcome-toast {
		animation: toastIn 0.35s ease-out both, toastOut 0.35s ease-in 2.6s both;
	}
	@keyframes toastIn {
		from { opacity: 0; transform: translate(-50%, -16px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}
	@keyframes toastOut {
		from { opacity: 1; transform: translate(-50%, 0); }
		to { opacity: 0; transform: translate(-50%, -16px); }
	}
	.waiting-dots::after {
		content: '';
		animation: dots 1.5s steps(4, end) infinite;
	}
	@keyframes dots {
		0% { content: ''; }
		25% { content: '.'; }
		50% { content: '..'; }
		75% { content: '...'; }
	}
</style>
