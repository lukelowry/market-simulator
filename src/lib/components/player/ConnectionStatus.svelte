<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import Icon from '$lib/components/shared/Icon.svelte';

	const stage = $derived.by(() => {
		if (connection.connected && game.state.state !== 'uninitialized') return 'connected';
		if (connection.connected) return 'joining';
		return 'connecting';
	});

	const stages = [
		{
			id: 'connecting',
			label: 'Connecting',
			icon: 'signal',
			description: 'Establishing secure connection...'
		},
		{ id: 'joining', label: 'Joining', icon: 'handshake', description: 'Joining market...' },
		{ id: 'connected', label: 'Connected', icon: 'check', description: 'Successfully connected!' }
	];

	const stageIndex = $derived(stages.findIndex((s) => s.id === stage));
</script>

<div class="border-border-light mx-auto w-full max-w-[440px] rounded-lg border bg-surface p-6 shadow-sm min-[480px]:p-8">
	<div class="mb-6 flex items-start gap-3.5">
		<div
			class="ease-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-[background-color,border-color,color] duration-200 {stageIndex >=
			0
				? 'bg-maroon text-text-inverse'
				: 'bg-maroon-faint text-maroon'}"
		>
			{#if stage === 'connecting'}
				<svg
					class="icon-signal h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="2" />
					<circle cx="12" cy="12" r="6" opacity="0.5" />
					<circle cx="12" cy="12" r="10" opacity="0.3" />
				</svg>
			{:else if stage === 'joining'}
				<svg
					class="icon-handshake h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M12 14l4-4M12 14l-4-4" />
					<circle cx="8" cy="18" r="2" />
					<circle cx="16" cy="18" r="2" />
				</svg>
			{:else}
				<svg
					class="icon-check h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					aria-hidden="true"
				>
					<path d="M5 12l5 5L20 7" />
				</svg>
			{/if}
		</div>
		<div class="min-w-0 flex-1">
			<h3 class="font-display text-text-primary mb-1 text-xl leading-[1.2] font-semibold">
				{stages[stageIndex]?.label}
			</h3>
			<p class="text-text-muted text-sm leading-normal">{stages[stageIndex]?.description}</p>
		</div>
	</div>

	{#if connection.connectionError}
		<div
			class="bg-danger-bg border-danger text-danger mb-6 flex items-center gap-2 rounded border px-4 py-3 text-sm"
		>
			<Icon name="warning" size={16} class="shrink-0" />
			<span>{connection.connectionError}</span>
		</div>
	{/if}

	<div class="border-border-light mt-5 flex items-center border-t pt-5" role="group" aria-label="Connection progress">
		{#each stages as s, i}
			<div class="relative flex flex-1 items-center" class:current={i === stageIndex}>
				<div
					class="step-dot ease-brand relative z-[1] h-2.5 w-2.5 rounded-full border transition-[background-color,border-color,box-shadow] duration-200 {i <=
					stageIndex
						? 'bg-maroon border-maroon shadow-[0_0_0_3px_var(--color-maroon-faint)]'
						: 'bg-cream-dark border-border-light'}"
					role="img"
					aria-label="{s.label}: {i < stageIndex ? 'complete' : i === stageIndex ? 'in progress' : 'pending'}"
				></div>
				{#if i < stages.length - 1}
					<div
						class="ease-brand mx-1 h-0.5 flex-1 transition-[background] duration-200 {i <=
						stageIndex
							? 'bg-maroon'
							: 'bg-border-light'}"
					></div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.icon-signal {
		animation: pulse 2s ease-in-out infinite;
	}
	.icon-handshake {
		animation: shake 0.6s ease-in-out infinite;
	}
	.icon-check {
		animation: checkmark 0.5s ease-out;
	}
	.current .step-dot {
		animation: dotPulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(0.95);
		}
	}
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-2px);
		}
		75% {
			transform: translateX(2px);
		}
	}
	@keyframes checkmark {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes dotPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-signal,
		.icon-handshake,
		.icon-check,
		.current .step-dot {
			animation: none;
		}
	}
</style>
