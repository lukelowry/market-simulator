<script lang="ts">
	import { onMount } from 'svelte';

	let {
		title,
		message,
		confirmLabel = 'Confirm',
		variant = 'danger',
		onconfirm,
		oncancel
	}: {
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: 'danger' | 'warning';
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	let overlayEl: HTMLDivElement;

	onMount(() => {
		overlayEl?.focus();
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onkeydown={handleKeydown} tabindex="-1" bind:this={overlayEl}>
	<div class="modal-backdrop" onclick={oncancel} role="presentation"></div>
	<div class="modal-card animate-in confirm-modal">
		<div class="confirm-body">
			<div class="w-10 h-[3px] rounded-sm mb-4 {variant === 'danger' ? 'bg-danger' : 'bg-warning'}" aria-hidden="true"></div>
			<h3 class="mb-2 text-lg">{title}</h3>
			<p class="text-sm text-text-secondary mb-6 leading-normal">{message}</p>
		</div>
		<div class="confirm-footer">
			<button class="btn btn-secondary btn-sm" onclick={oncancel}>Cancel</button>
			<button class="btn btn-sm" class:btn-danger={variant === 'danger'} class:btn-warning={variant === 'warning'} onclick={onconfirm}>
				{confirmLabel}
			</button>
		</div>
	</div>
</div>

<style>
	.confirm-modal {
		max-width: 400px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.confirm-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1.5rem;
	}
	.confirm-footer {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding: 0 1.5rem 1.5rem;
		flex-shrink: 0;
	}
</style>
