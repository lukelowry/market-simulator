<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { CHART_MAROON, CHART_GOLD, CHART_GOLD_FILL, CHART_TEXT_SECONDARY, CHART_TEXT_MUTED, CHART_TOOLTIP_BG } from '$lib/utils/chartTheme.js';
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
		BarController, BarElement,
		LineController, LineElement, PointElement,
		LinearScale, CategoryScale,
		Legend, Tooltip, Filler
	);

	let canvas: HTMLCanvasElement | undefined;
	let chart = $state<Chart | null>(null);
	let hasData = $state(false);

	onMount(() => {
		if (!canvas) return;
		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: [],
				datasets: [
					{
						type: 'bar' as const,
						label: 'Load (MW)',
						data: [],
						backgroundColor: CHART_GOLD_FILL,
						borderColor: CHART_GOLD,
						borderWidth: 1.5,
						borderRadius: 4,
						borderSkipped: false,
						yAxisID: 'y',
						order: 2
					},
					{
						type: 'line' as const,
						label: 'Clearing Price ($/MWh)',
						data: [],
						borderColor: CHART_MAROON,
						backgroundColor: 'rgba(80, 0, 0, 0.08)',
						borderWidth: 2.5,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: CHART_MAROON,
						pointBorderColor: '#fff',
						pointBorderWidth: 2,
						pointHoverRadius: 6,
						fill: false,
						yAxisID: 'y1',
						order: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					legend: {
						position: 'top',
						align: 'end',
						labels: {
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_TEXT_SECONDARY,
							usePointStyle: true,
							pointStyle: 'circle',
							padding: 16
						}
					},
					tooltip: {
						backgroundColor: CHART_TOOLTIP_BG,
						titleFont: { family: "'Source Sans 3', sans-serif", size: 13 },
						bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
						padding: 12,
						cornerRadius: 8,
						callbacks: {
							title(items) {
								return `Period ${items[0].label}`;
							},
							label(context) {
								if (context.dataset.yAxisID === 'y') {
									return ` Load: ${context.parsed.y} MW`;
								}
								return ` Price: $${context.parsed.y}/MWh`;
							}
						}
					}
				},
				scales: {
					x: {
						title: {
							display: true,
							text: 'Period',
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_TEXT_MUTED
						},
						ticks: {
							font: { family: "'JetBrains Mono', monospace", size: 11 },
							color: CHART_TEXT_MUTED,
							maxRotation: 0,
							autoSkip: true,
							autoSkipPadding: 8
						},
						grid: { display: false },
						border: { display: false }
					},
					y: {
						type: 'linear',
						position: 'left',
						title: {
							display: true,
							text: 'Load (MW)',
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_GOLD
						},
						ticks: {
							font: { family: "'JetBrains Mono', monospace", size: 11 },
							color: CHART_GOLD,
							callback(value) { return value + ' MW'; }
						},
						grid: { color: 'rgba(0, 0, 0, 0.04)' },
						border: { display: false },
						beginAtZero: true
					},
					y1: {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'Price ($/MWh)',
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_MAROON
						},
						ticks: {
							font: { family: "'JetBrains Mono', monospace", size: 11 },
							color: CHART_MAROON,
							callback(value) { return '$' + value; }
						},
						grid: { display: false },
						border: { display: false },
						beginAtZero: true
					}
				}
			}
		});

		return () => { chart?.destroy(); chart = null; };
	});

	$effect(() => {
		if (!chart) return;

		const periods = game.state.periods.filter(p => p.marginal_cost !== null);
		hasData = periods.length > 0;

		chart.data.labels = periods.map(p => `P${p.number}`);
		chart.data.datasets[0].data = periods.map(p => p.load);
		chart.data.datasets[1].data = periods.map(p => p.marginal_cost);
		chart.update();
	});
</script>

<section class="card border-t-3 border-t-gold">
	<div class="card-header">Market History</div>
	<div class="card-body py-4 px-5">
		<div class="relative h-[280px]" class:hidden={!hasData}>
			<canvas bind:this={canvas} aria-label="Bar and line chart showing load and clearing price per period"></canvas>
		</div>
		{#if !hasData}
			<div class="flex flex-col items-center justify-center text-center py-12 px-8 min-h-[280px]">
				<svg class="text-text-muted opacity-20" width="48" height="48" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M4 11H2v3h2v-3zm5-4H7v7h2V7zm5-5h-2v12h2V2zm-2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1h-2zM6 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zM1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3z"/>
				</svg>
				<h4 class="mt-4 mb-2 text-text-secondary text-lg">No Market Data Yet</h4>
				<p class="text-sm text-text-muted max-w-[320px] m-0">Price and load trends will appear as periods clear.</p>
			</div>
		{/if}
	</div>
</section>
