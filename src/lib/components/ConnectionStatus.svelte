<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';

	const stage = $derived.by(() => {
		if (connection.connected && game.state.state !== 'uninitialized') return 'connected';
		if (connection.connected) return 'joining';
		return 'connecting';
	});

	const stages = [
		{ id: 'connecting', label: 'Connecting', icon: 'signal', description: 'Establishing secure connection...' },
		{ id: 'joining', label: 'Joining', icon: 'handshake', description: 'Joining market...' },
		{ id: 'connected', label: 'Connected', icon: 'check', description: 'Successfully connected!' }
	];

	const stageIndex = $derived(stages.findIndex(s => s.id === stage));
</script>

<div class="bg-white border border-border-light rounded-lg p-10 max-w-[440px] mx-auto shadow">
	<div class="flex items-start gap-4 mb-8">
		<div class="w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-200 ease-brand shrink-0 {stageIndex >= 0 ? 'bg-maroon text-white border-maroon' : 'bg-maroon-faint border-transparent text-maroon'}">
			{#if stage === 'connecting'}
				<svg class="icon-signal w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="2"/>
					<circle cx="12" cy="12" r="6" opacity="0.5"/>
					<circle cx="12" cy="12" r="10" opacity="0.3"/>
				</svg>
			{:else if stage === 'joining'}
				<svg class="icon-handshake w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 14l4-4M12 14l-4-4"/>
					<circle cx="8" cy="18" r="2"/>
					<circle cx="16" cy="18" r="2"/>
				</svg>
			{:else}
				<svg class="icon-check w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
					<path d="M5 12l5 5L20 7"/>
				</svg>
			{/if}
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-display text-2xl font-semibold text-text-primary mb-1 leading-[1.2]">{stages[stageIndex]?.label}</h3>
			<p class="text-sm text-text-muted leading-normal">{stages[stageIndex]?.description}</p>
		</div>
	</div>

	{#if connection.connectionError}
		<div class="flex items-center gap-2 py-3 px-4 bg-danger-bg border border-danger rounded text-danger text-sm mb-6">
			<svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
				<path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
			</svg>
			<span>{connection.connectionError}</span>
		</div>
	{/if}

	<div class="flex items-center mt-6 pt-6 border-t border-border-light">
		{#each stages as s, i}
			<div class="relative flex-1 flex items-center" class:current={i === stageIndex}>
				<div class="step-dot w-3 h-3 rounded-full border-2 transition-all duration-200 ease-brand relative z-[1] {i <= stageIndex ? 'bg-maroon border-maroon shadow-[0_0_0_4px_rgba(80,0,0,0.05)]' : 'bg-cream-dark border-border-light'}"></div>
				{#if i < stages.length - 1}
					<div class="flex-1 h-0.5 mx-1 transition-[background] duration-200 ease-brand {i <= stageIndex ? 'bg-maroon' : 'bg-border-light'}"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.icon-signal { animation: pulse 2s ease-in-out infinite; }
	.icon-handshake { animation: shake 0.6s ease-in-out infinite; }
	.icon-check { animation: checkmark 0.5s ease-out; }
	.current .step-dot { animation: dotPulse 1.5s ease-in-out infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.6; transform: scale(0.95); }
	}
	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-2px); }
		75% { transform: translateX(2px); }
	}
	@keyframes checkmark {
		0% { opacity: 0; transform: scale(0.5); }
		50% { transform: scale(1.1); }
		100% { opacity: 1; transform: scale(1); }
	}
	@keyframes dotPulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.2); }
	}
</style>
