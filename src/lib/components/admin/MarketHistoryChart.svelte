<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import Icon from '$lib/components/shared/Icon.svelte';
	import {
		Chart,
		CHART_MAROON,
		CHART_MAROON_LIGHT,
		CHART_GOLD,
		CHART_GOLD_FILL,
		CHART_TEXT_SECONDARY,
		CHART_TEXT_MUTED,
		CHART_TOOLTIP_BG,
		CHART_CARD_BG,
		CHART_GRID,
		CHART_FONT_BODY,
		CHART_FONT_MONO
	} from '$lib/utils/chartTheme.js';

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
						backgroundColor: CHART_MAROON_LIGHT,
						borderWidth: 2.5,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: CHART_MAROON,
						pointBorderColor: CHART_CARD_BG,
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
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_TEXT_SECONDARY,
							usePointStyle: true,
							pointStyle: 'circle',
							padding: 16
						}
					},
					tooltip: {
						backgroundColor: CHART_TOOLTIP_BG,
						titleFont: { family: CHART_FONT_BODY, size: 13 },
						bodyFont: { family: CHART_FONT_MONO, size: 12 },
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
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_TEXT_MUTED
						},
						ticks: {
							font: { family: CHART_FONT_MONO, size: 11 },
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
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_GOLD
						},
						ticks: {
							font: { family: CHART_FONT_MONO, size: 11 },
							color: CHART_GOLD,
							callback(value) {
								return value + ' MW';
							}
						},
						grid: { color: CHART_GRID },
						border: { display: false },
						beginAtZero: true
					},
					y1: {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'Price ($/MWh)',
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_MAROON
						},
						ticks: {
							font: { family: CHART_FONT_MONO, size: 11 },
							color: CHART_MAROON,
							callback(value) {
								return '$' + value;
							}
						},
						grid: { display: false },
						border: { display: false },
						beginAtZero: true
					}
				}
			}
		});

		return () => {
			chart?.destroy();
			chart = null;
		};
	});

	$effect(() => {
		if (!chart) return;

		const periods = game.state.periods.filter((p) => p.marginal_cost !== null);
		hasData = periods.length > 0;

		chart.data.labels = periods.map((p) => `P${p.number}`);
		chart.data.datasets[0].data = periods.map((p) => p.load);
		chart.data.datasets[1].data = periods.map((p) => p.marginal_cost);
		chart.update();
	});
</script>

<section class="card border-t-gold border-t-3">
	<h3 class="card-header">Market History</h3>
	<div class="card-body px-5 py-4">
		<div class="relative h-[clamp(220px,30vw,360px)]" class:hidden={!hasData}>
			<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
			<canvas
				bind:this={canvas}
				role="img"
				aria-label="Bar and line chart showing load and clearing price per period"
			></canvas>
		</div>
		{#if !hasData}
			<div class="flex min-h-[280px] flex-col items-center justify-center px-8 py-12 text-center">
				<Icon name="chart-bars" size={48} class="text-gold opacity-25" />
				<h4 class="text-text-secondary mt-4 mb-2 text-lg">No Market Data Yet</h4>
				<p class="text-text-muted m-0 max-w-[320px] text-sm">
					Price and load trends will appear as periods clear.
				</p>
			</div>
		{/if}
		{#if hasData}
			<table class="sr-only">
				<caption>Market History: Load and Clearing Price per Period</caption>
				<thead>
					<tr><th scope="col">Period</th><th scope="col">Load (MW)</th><th scope="col">Clearing Price ($/MWh)</th></tr>
				</thead>
				<tbody>
					{#each game.state.periods.filter((p) => p.marginal_cost !== null) as period}
						<tr>
							<td>{period.number}</td>
							<td>{period.load}</td>
							<td>{period.marginal_cost}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</section>
