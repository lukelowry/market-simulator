<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { CHART_MAROON, CHART_MAROON_LIGHT, CHART_GOLD, CHART_GOLD_LIGHT, CHART_INFO, CHART_TEXT_SECONDARY, CHART_TEXT_MUTED, CHART_TOOLTIP_BG } from '$lib/utils/chartTheme.js';
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

	let canvas: HTMLCanvasElement | undefined;
	let chart: Chart | null = null;

	onMount(() => {
		if (!canvas) return;
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: [],
				datasets: [
					{
						type: 'bar' as const,
						label: 'Load (MW)',
						data: [],
						backgroundColor: 'rgba(74, 124, 138, 0.12)',
						borderColor: CHART_INFO,
						borderWidth: 1,
						borderRadius: 3,
						borderSkipped: false,
						yAxisID: 'y2',
						order: 3
					},
					{
						label: 'Revenue',
						data: [],
						borderColor: CHART_GOLD,
						backgroundColor: CHART_GOLD_LIGHT,
						borderWidth: 2.5,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: CHART_GOLD,
						pointBorderColor: '#fff',
						pointBorderWidth: 2,
						pointHoverRadius: 6,
						fill: true,
						yAxisID: 'y',
						order: 2
					},
					{
						label: 'Profit',
						data: [],
						borderColor: CHART_MAROON,
						backgroundColor: CHART_MAROON_LIGHT,
						borderWidth: 2.5,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: CHART_MAROON,
						pointBorderColor: '#fff',
						pointBorderWidth: 2,
						pointHoverRadius: 6,
						fill: true,
						yAxisID: 'y',
						order: 1
					},
					{
						label: 'Marginal Price',
						data: [],
						borderColor: CHART_INFO,
						backgroundColor: 'transparent',
						borderWidth: 2,
						borderDash: [6, 3],
						tension: 0.3,
						pointRadius: 3,
						pointBackgroundColor: CHART_INFO,
						pointBorderColor: '#fff',
						pointBorderWidth: 1.5,
						pointHoverRadius: 5,
						fill: false,
						yAxisID: 'y1',
						order: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
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
							label: function (context) {
								const val = context.parsed.y;
								if (context.dataset.label === 'Load (MW)') {
									return `${context.dataset.label}: ${val} MW`;
								}
								if (context.dataset.label === 'Marginal Price') {
									return `${context.dataset.label}: $${val}/MWh`;
								}
								return `${context.dataset.label}: $${val}`;
							}
						}
					}
				},
				scales: {
					y: {
						type: 'linear',
						position: 'left',
						title: {
							display: true,
							text: 'Amount ($)',
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_TEXT_MUTED
						},
						ticks: {
							font: { family: "'JetBrains Mono', monospace", size: 11 },
							color: CHART_TEXT_MUTED,
							callback: function (value) {
								return '$' + value;
							}
						},
						grid: {
							color: 'rgba(0, 0, 0, 0.04)'
						},
						border: {
							display: false
						}
					},
					y1: {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'Marginal Price ($/MWh)',
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_INFO
						},
						ticks: {
							font: { family: "'JetBrains Mono', monospace", size: 11 },
							color: CHART_INFO,
							callback: function (value) {
								return '$' + value;
							}
						},
						grid: {
							display: false
						},
						border: {
							display: false
						}
					},
					y2: {
						type: 'linear',
						display: false,
						beginAtZero: true
					},
					x: {
						title: {
							display: true,
							text: 'Period',
							font: { family: "'Source Sans 3', sans-serif", size: 12, weight: 600 },
							color: CHART_TEXT_MUTED
						},
						ticks: {
							font: { family: "'JetBrains Mono', monospace", size: 11 },
							color: CHART_TEXT_MUTED
						},
						grid: {
							display: false
						},
						border: {
							display: false
						}
					}
				}
			}
		});

		return () => {
			chart?.destroy();
			chart = null;
		};
	});

	let hasData = $state(false);

	$effect(() => {
		if (!chart) return;
		const name = connection.participantName;
		if (!name) return;
		const gs = game.state;

		const load: (number | null)[] = [];
		const revenue: (number | null)[] = [];
		const profit: (number | null)[] = [];
		const marginalPrice: (number | null)[] = [];
		const labels: number[] = [];

		const cleared = gs.periods;
		for (const period of cleared) {
			labels.push(period.number);
			const pp = period.players[name];
			load.push(period.load);
			revenue.push(pp?.revenue ?? null);
			profit.push(pp?.profit ?? null);
			marginalPrice.push(period.marginal_cost ?? null);
		}

		hasData = labels.length > 0;

		chart.data.labels = labels;
		chart.data.datasets[0].data = load;
		chart.data.datasets[1].data = revenue;
		chart.data.datasets[2].data = profit;
		chart.data.datasets[3].data = marginalPrice;
		chart.update();
	});
</script>

<section class="card mb-6" aria-label="Profit chart">
	<div class="card-header">Revenue, Profit & Marginal Price</div>
	<div class="card-body p-5">
		{#if !hasData}
			<div class="flex flex-col items-center justify-center text-center py-12 px-8 min-h-[300px]">
				<svg class="text-text-muted opacity-20" width="48" height="48" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2z"/>
				</svg>
				<h4 class="mt-4 mb-2 text-text-secondary text-lg">No Data Yet</h4>
				<p class="text-sm text-text-muted max-w-[320px] m-0">Revenue and profit data will appear as periods complete.</p>
			</div>
		{/if}
		<div style:display={hasData ? 'block' : 'none'}>
			<canvas bind:this={canvas} aria-label="Line chart showing revenue, profit, and marginal price per period"></canvas>
		</div>
		{#if hasData}
			<table class="sr-only">
				<caption>Revenue, Profit, Load & Marginal Price per Period</caption>
				<thead>
					<tr><th>Period</th><th>Load (MW)</th><th>Revenue ($)</th><th>Profit ($)</th><th>Marginal Price ($/MWh)</th></tr>
				</thead>
				<tbody>
					{#each game.state.periods as period}
						{@const pp = period.players[connection.participantName]}
						<tr>
							<td>{period.number}</td>
							<td>{period.load}</td>
							<td>{pp?.revenue ?? '—'}</td>
							<td>{pp?.profit ?? '—'}</td>
							<td>{period.marginal_cost ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</section>
