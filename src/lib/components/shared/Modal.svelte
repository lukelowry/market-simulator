<script lang="ts">
	import { focusTrap } from '$lib/utils/focusTrap.js';
	import type { Snippet } from 'svelte';

	let {
		title,
		titleId,
		maxWidth = '600px',
		depth = 0,
		onclose,
		children
	}: {
		title: string;
		titleId?: string;
		maxWidth?: string;
		depth?: number;
		onclose: () => void;
		children: Snippet;
	} = $props();

	let overlayEl: HTMLDivElement;
	let mouseDownOnBackdrop = false;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		}
	}
</script>

<div
	class="modal-overlay"
	role="dialog"
	aria-modal="true"
	aria-label={titleId ? undefined : title}
	aria-labelledby={titleId ?? undefined}
	onkeydown={handleKeydown}
	tabindex="-1"
	bind:this={overlayEl}
	use:focusTrap
	style:--modal-depth={depth}
>
	<div
		class="modal-backdrop"
		onmousedown={(e) => { mouseDownOnBackdrop = e.target === e.currentTarget; }}
		onmouseup={(e) => { if (mouseDownOnBackdrop && e.target === e.currentTarget) onclose(); mouseDownOnBackdrop = false; }}
		role="presentation"
	></div>
	<div class="modal-card animate-in" style:max-width="min({maxWidth}, calc(100vw - 2rem))">
		{@render children()}
	</div>
</div>
