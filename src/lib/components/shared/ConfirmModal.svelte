<script lang="ts">
	import Modal from '$lib/components/shared/Modal.svelte';

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

	const titleId = `confirm-title-${crypto.randomUUID().slice(0, 8)}`;
</script>

<Modal {title} {titleId} maxWidth="400px" depth={1} onclose={oncancel}>
	<div class="confirm-modal">
		<div class="confirm-body">
			<div
				class="mb-3 h-[2px] w-8 rounded-sm {variant === 'danger' ? 'bg-danger' : 'bg-warning'}"
				aria-hidden="true"
			></div>
			<h3 id={titleId} class="mb-1.5 text-base">{title}</h3>
			<p class="text-text-secondary mb-5 text-sm leading-normal">{message}</p>
		</div>
		<div class="confirm-footer">
			<button class="btn btn-secondary btn-sm" onclick={oncancel}>Cancel</button>
			<button
				class="btn btn-sm"
				class:btn-danger={variant === 'danger'}
				class:btn-warning={variant === 'warning'}
				onclick={onconfirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</Modal>

<style>
	.confirm-modal {
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
		padding: 1.25rem;
	}
	.confirm-footer {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding: 0 1.25rem 1.25rem;
		flex-shrink: 0;
	}
</style>
