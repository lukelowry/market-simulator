<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connect, disconnect } from '$lib/websocket.js';
	import Sidebar from '$lib/components/player/Sidebar.svelte';
	import GeneratorTable from '$lib/components/player/GeneratorTable.svelte';
	import ProfitChart from '$lib/components/player/ProfitChart.svelte';
	import PeriodScorecard from '$lib/components/player/PeriodScorecard.svelte';
	import CsvExport from '$lib/components/shared/CsvExport.svelte';
	import GameOverSummary from '$lib/components/player/GameOverSummary.svelte';
	import ConnectionStatus from '$lib/components/player/ConnectionStatus.svelte';
	import MarketList from '$lib/components/shared/MarketList.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { createDisconnectTimer } from '$lib/utils/disconnectTimer.svelte.js';
	import { GEN_COUNT_BY_PRESET } from '$lib/utils/marketCalcs.js';

	let showWelcomeBanner = $state(true);
	let isJoining = $state(false);

	// Paired setup/teardown: co-located via $effect cleanup
	$effect(() => {
		connection.logoutHandler = () => {
			disconnect({ clearStoredSession: true });
		};
		return () => {
			connection.logoutHandler = null;
		};
	});

	// One-time init: URL auto-join and welcome banner (reads reactive stores, must not re-run)
	onMount(() => {
		const urlMarket = page.url.searchParams.get('market');
		if (urlMarket && connection.participantName) {
			joinMarket(urlMarket);
		}
		const bannerTimer = setTimeout(() => {
			showWelcomeBanner = false;
		}, 3000);
		return () => clearTimeout(bannerTimer);
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

	const showGame = $derived(
		(connection.connected || connection.reconnecting) && game.state.state !== 'uninitialized'
	);
	const showConnectionStatus = $derived(isJoining && !showGame && !connection.connectionError);
	const showDisconnectError = $derived(
		!connection.connected && !connection.reconnecting && connection.connectionError !== null
	);
	const showGameData = $derived(game.isActive);
	const isGameOver = $derived(game.state.state === 'completed');
	const isWaiting = $derived(game.state.state === 'forming');

	function backToMarkets() {
		disconnect({ clearStoredSession: true });
		isJoining = false;
	}

	const playerNames = $derived(Object.keys(game.state.players));
	const genCount = $derived(GEN_COUNT_BY_PRESET[game.state.options?.gen_preset ?? 'standard'] ?? 5);

	const disconnectTimer = createDisconnectTimer();
</script>

{#if showDisconnectError}
	<!-- Kicked / Replaced Error State -->
	<div class="flex min-h-[50vh] items-center justify-center p-8">
		<div
			class="border-border-light mx-auto max-w-[440px] rounded-lg border bg-surface p-10 text-center shadow"
		>
			<div
				class="bg-danger-bg mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
			>
				<Icon name="warning" size={28} class="text-danger" />
			</div>
			<h2 class="text-text-primary mb-2 text-2xl">Disconnected</h2>
			<p class="text-text-muted mb-6 text-sm">{connection.connectionError}</p>
			<button class="btn btn-primary" onclick={backToMarkets}>Back to Markets</button>
		</div>
	</div>
{:else if showConnectionStatus}
	<!-- Connecting State -->
	<div class="flex min-h-[50vh] items-center justify-center p-8">
		<ConnectionStatus />
	</div>
{:else if !showGame}
	<!-- Market Browser -->
	{#if showWelcomeBanner}
		<div
			class="bg-success text-text-inverse welcome-toast pointer-events-none fixed top-4 left-4 right-4 z-(--z-toast) mx-auto flex max-w-[480px] items-center gap-2 rounded px-5 py-3 text-sm font-semibold shadow-lg"
			role="status"
			aria-live="polite"
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="shrink-0"
				><path
					d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"
				/></svg
			>
			Signed in as {connection.participantName}
		</div>
	{/if}

	<div class="animate-in mx-auto max-w-[640px] pt-8">
		<div class="mb-6">
			<div>
				<h2 class="mb-2">Available Markets</h2>
				<p class="text-text-muted text-sm">
					Select a market to join, or rejoin a game in progress.
				</p>
			</div>
		</div>

		<MarketList onJoin={joinMarket} />
	</div>
{:else}
	<!-- Game View -->
	{#if connection.reconnecting && !disconnectTimer.tooLong}
		<div
			class="bg-warning-bg border-warning/20 text-warning mx-auto mb-4 flex max-w-[640px] items-center gap-2 rounded border px-4 py-2 text-sm"
		>
			<div
				class="border-warning/40 border-t-warning h-3 w-3 shrink-0 animate-spin rounded-full border-2"
				aria-hidden="true"
			></div>
			<span>Reconnecting...</span>
		</div>
	{/if}
	{#if disconnectTimer.tooLong}
		<div class="text-text-muted flex flex-col items-center px-8 py-16 text-center">
			<div
				class="spinner spinner-md mb-5"
				aria-hidden="true"
			></div>
			<h2 class="text-text-secondary mb-3 text-2xl">Reconnecting to {connection.marketName}</h2>
			<p class="mb-6 max-w-[340px] text-sm">Connection lost. Attempting to reconnect...</p>
			<button class="btn btn-secondary" onclick={backToMarkets}>Back to Markets</button>
		</div>
	{:else}
		<div class="layout-sidebar">
			<Sidebar />
			<div class="stagger min-w-0" style:container-type="inline-size">
				{#if showGameData}
					{#if isGameOver}
						<GameOverSummary />
						<div class="grid grid-cols-1 items-start gap-4 @min-[640px]:grid-cols-[1fr_260px]">
							<ProfitChart />
							<PeriodScorecard />
						</div>
						<CsvExport />
					{:else}
						<div class="grid grid-cols-1 items-start gap-4 @min-[640px]:grid-cols-[1fr_260px]">
							<GeneratorTable />
							<PeriodScorecard />
						</div>
						<ProfitChart />
						<CsvExport />
					{/if}
				{:else if isWaiting}
					<div class="animate-in flex max-w-[640px] flex-col gap-6">
						<!-- Status Banner -->
						<div
							class="bg-success-bg border-success/20 flex items-center gap-3 rounded-lg border px-5 py-4"
						>
							<div
								class="bg-success/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
							>
								<svg
									class="text-success h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"
									aria-hidden="true"
								>
									<path d="M5 12l5 5L20 7" />
								</svg>
							</div>
							<div>
								<p class="text-text-primary text-sm font-semibold">You're in!</p>
								<p class="text-text-muted text-sm">
									Waiting for the instructor to start the game<span class="waiting-dots"></span>
								</p>
							</div>
						</div>

						<!-- Players Joined -->
						<div class="card border-t-gold border-t-3">
							<h3 class="card-header">Players Joined</h3>
							<div class="card-body">
								<div class="flex flex-wrap gap-2.5">
									{#each playerNames as name}
										<span
											class="bg-cream text-text-primary border-border-light inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium"
										>
											<span
												class="h-2 w-2 shrink-0 rounded-full {name === connection.participantName
													? 'bg-success'
													: 'invisible'}"
											></span>
											{name}
											{#if name === connection.participantName}
												<span class="text-text-muted text-xs">(you)</span>
											{/if}
										</span>
									{/each}
								</div>
								<p class="text-text-muted mt-3 text-xs">
									{game.playerCount} player{game.playerCount !== 1 ? 's' : ''} joined{game.state
										.options?.max_participants
										? ` of ${game.state.options.max_participants} max`
										: ''}
								</p>
							</div>
						</div>

						<!-- How It Works Guide -->
						<div class="card border-t-maroon border-t-3">
							<h3 class="card-header">How It Works</h3>
							<div class="card-body flex flex-col gap-4">
								<div class="flex items-start gap-3">
									<div
										class="bg-maroon text-text-inverse mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
									>1</div>
									<p class="text-text-muted mb-0 text-sm">
										<strong class="text-text-primary">Your Portfolio</strong> — You own {genCount} generators
										with different capacities and costs.
									</p>
								</div>
								<div class="flex items-start gap-3">
									<div
										class="bg-maroon text-text-inverse mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
									>2</div>
									<p class="text-text-muted mb-0 text-sm">
										<strong class="text-text-primary">Submit Offers</strong> — Set a price ($/MW) for each
										generator before the timer runs out.
									</p>
								</div>
								<div class="flex items-start gap-3">
									<div
										class="bg-maroon text-text-inverse mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
									>3</div>
									<p class="text-text-muted mb-0 text-sm">
										<strong class="text-text-primary">Market Clearing</strong> — Offers are ranked cheapest-first.
										The last generator needed to meet demand sets the clearing price.
									</p>
								</div>
								<div class="flex items-start gap-3">
									<div
										class="bg-maroon text-text-inverse mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
									>4</div>
									<p class="text-text-muted mb-0 text-sm">
										<strong class="text-text-primary">Earning Profit</strong> —
										{#if game.state.options?.payment_method === 'pay_as_offered'}
											<strong>Pay-as-Offered:</strong> each dispatched generator is paid its own offer price.
										{:else}
											<strong>Last Accepted Offer:</strong> all dispatched generators are paid the clearing price.
										{/if}
										Profit = revenue minus production cost.
									</p>
								</div>
								<p class="text-text-muted border-border-light mb-0 border-t pt-3 text-sm">
									<strong class="text-gold">Tip:</strong> Offer low to guarantee dispatch, or high for more
									profit per MW — but risk not being selected.
								</p>
							</div>
						</div>

						<!-- Leave Market -->
						<div class="pt-2 text-center">
							<button class="btn btn-secondary btn-sm" onclick={backToMarkets}>Leave Market</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	.welcome-toast {
		animation:
			toastIn 0.35s ease-out both,
			toastOut 0.35s ease-in 2.6s both;
	}
	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateY(-16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes toastOut {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(-16px);
		}
	}
	.waiting-dots::after {
		content: '';
		animation: dots 1.5s steps(4, end) infinite;
	}
	@keyframes dots {
		0% {
			content: '';
		}
		25% {
			content: '.';
		}
		50% {
			content: '..';
		}
		75% {
			content: '...';
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.welcome-toast {
			animation: none;
			opacity: 1;
		}
		.waiting-dots::after {
			animation: none;
			content: '...';
		}
	}
</style>
