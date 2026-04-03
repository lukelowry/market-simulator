const FOCUSABLE =
	'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Svelte action that traps keyboard focus within a container element.
 * Usage: <div use:focusTrap>...</div>
 */
export function focusTrap(node: HTMLElement) {
	const previouslyFocused = document.activeElement as HTMLElement | null;

	function getFocusable(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
			(el) => el.offsetParent !== null // visible
		);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		const focusable = getFocusable();
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	// Lock body scroll
	const prevOverflow = document.body.style.overflow;
	document.body.style.overflow = 'hidden';

	// Focus the first focusable element on mount
	requestAnimationFrame(() => {
		const focusable = getFocusable();
		if (focusable.length > 0) {
			focusable[0].focus();
		}
	});

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = prevOverflow;
			previouslyFocused?.focus();
		}
	};
}
