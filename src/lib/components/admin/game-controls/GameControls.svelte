<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { stateLabel, stateBadge } from '$lib/utils/stateLabels.js';
	import FormingPanel from './FormingPanel.svelte';
	import RunningPanel from './RunningPanel.svelte';
	import CompletedPanel from './CompletedPanel.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

	let { onrequestsettings }: { onrequestsettings?: () => void } = $props();

	// Ribbon deriveds
	const currentStateLabel = $derived(stateLabel(game.state.state));
	const stateBadgeClass = $derived(stateBadge(game.state.state));

	const isForming = $derived(game.state.state === 'forming');
	const isRunning = $derived(game.state.state === 'running');
	const isCompleted = $derived(game.state.state === 'completed');
</script>

<!-- Ribbon header -->
<header class="ribbon">
	<div class="flex min-w-0 items-center gap-3">
		<!-- Maroon accent pip -->
		<div
			class="from-maroon to-gold h-5 w-1 shrink-0 rounded-full bg-gradient-to-b"
			aria-hidden="true"
		></div>
		<h2 class="m-0 truncate text-lg">{connection.marketName}</h2>
		<button
			class="ribbon-settings"
			onclick={() => {
				onrequestsettings?.();
			}}
			aria-label="Market settings"
			title="Settings"
		>
			<Icon name="gear" size={16} />
		</button>
	</div>

	<div class="flex flex-wrap items-center gap-2.5">
		<span class="badge {stateBadgeClass}">{currentStateLabel}</span>
	</div>
</header>

<!-- Game control panel -->
{#if isForming || isRunning || isCompleted}
	<section class="gcp">
		{#if isForming}
			<FormingPanel />
		{:else if isRunning}
			<RunningPanel />
		{:else if isCompleted}
			<CompletedPanel />
		{/if}
	</section>
{/if}

<style>
	/* ---- Ribbon ---- */
	.ribbon {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--color-border-light);
	}

	.ribbon-settings {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition:
			background 150ms var(--ease-brand),
			color 150ms var(--ease-brand);
	}
	.ribbon-settings:hover {
		background: var(--color-maroon-faint);
		color: var(--color-maroon);
	}

	/* ---- Panel shell ---- */
	.gcp {
		background: var(--color-surface);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius);
		box-shadow: var(--shadow-xs);
		overflow: hidden;
	}
</style>
