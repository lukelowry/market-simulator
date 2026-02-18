/**
 * @module stateLabels
 * UI label, badge-class, and abbreviation lookups for GameState.state strings.
 * Badge strings map to CSS utility classes defined in the TAMU design system (app.css).
 * The `connecting` entry is a frontend-only pseudo-state used during the WS handshake — never sent by the server.
 */

const STATES: Record<string, { label: string; badge: string; abbr: string }> = {
	uninitialized: { label: 'Not Started', badge: 'badge-muted', abbr: 'New' },
	forming:       { label: 'Open for Players', badge: 'badge-success', abbr: 'Open' },
	full:          { label: 'Full', badge: 'badge-warning', abbr: 'Full' },
	running:       { label: 'In Progress', badge: 'badge-info', abbr: 'Live' },
	completed:     { label: 'Completed', badge: 'badge-maroon', abbr: 'Done' },
	connecting:    { label: 'Connecting', badge: 'badge-muted', abbr: '...' }
};

/** Human-readable label for display in headers and status text. */
export function stateLabel(state: string): string {
	return STATES[state]?.label ?? state;
}

/** CSS class name for badge styling. */
export function stateBadge(state: string): string {
	return STATES[state]?.badge ?? 'badge-muted';
}

/** Short abbreviated label for sidebar/compact displays. */
export function stateAbbr(state: string | null | undefined): string {
	if (!state) return 'Empty';
	return STATES[state]?.abbr ?? state;
}

/** Short payment method label: 'PAO' or 'LAO'. */
export function paymentLabel(method: string | undefined): string {
	return method === 'pay_as_offered' ? 'PAO' : 'LAO';
}
