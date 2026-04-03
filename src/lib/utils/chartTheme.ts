/**
 * @module chartTheme
 * TAMU brand color constants and Chart.js registration.
 *
 * CSS variable resolution happens at import time, which is fine because Chart.js
 * components only render client-side (in onMount) where document is available.
 * For SSR, fallback hex values are used.
 *
 * Chart.js controllers/elements are registered once here so individual chart
 * components don't duplicate the registration call.
 */

import {
	Chart,
	BarController,
	BarElement,
	LineController,
	LineElement,
	PointElement,
	LinearScale,
	CategoryScale,
	Legend,
	Tooltip,
	Filler
} from 'chart.js';

Chart.register(
	BarController,
	BarElement,
	LineController,
	LineElement,
	PointElement,
	LinearScale,
	CategoryScale,
	Legend,
	Tooltip,
	Filler
);

export { Chart };

function cssVar(name: string, fallback: string): string {
	if (typeof document === 'undefined') return fallback;
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const CHART_MAROON = cssVar('--color-maroon', '#500000');
export const CHART_MAROON_LIGHT = cssVar('--chart-maroon-fill', 'rgba(80, 0, 0, 0.08)');
export const CHART_GOLD = cssVar('--color-gold', '#c89b3c');
export const CHART_GOLD_LIGHT = cssVar('--chart-gold-fill', 'rgba(200, 155, 60, 0.08)');
export const CHART_GOLD_FILL = cssVar('--chart-gold-fill-heavy', 'rgba(200, 155, 60, 0.25)');
export const CHART_INFO = cssVar('--color-info', '#4a7c8a');
export const CHART_TEXT_SECONDARY = cssVar('--color-text-secondary', '#5e5953');
export const CHART_TEXT_MUTED = cssVar('--color-text-muted', '#716a63');
export const CHART_TOOLTIP_BG = cssVar('--color-text-primary', '#2d2a26');
export const CHART_CARD_BG = cssVar('--color-surface', '#fdfcfa');
export const CHART_INFO_LIGHT = cssVar('--chart-info-fill', 'rgba(74, 124, 138, 0.12)');
export const CHART_GRID = cssVar('--chart-grid', 'rgba(0, 0, 0, 0.04)');

export const CHART_FONT_BODY = cssVar('--font-body', "'Source Sans 3', sans-serif");
export const CHART_FONT_MONO = cssVar('--font-mono', "'JetBrains Mono', monospace");
