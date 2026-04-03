<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import Icon from '$lib/components/shared/Icon.svelte';
	import {
		Chart,
		CHART_MAROON,
		CHART_MAROON_LIGHT,
		CHART_GOLD,
		CHART_GOLD_LIGHT,
		CHART_INFO,
		CHART_INFO_LIGHT,
		CHART_TEXT_SECONDARY,
		CHART_TEXT_MUTED,
		CHART_TOOLTIP_BG,
		CHART_CARD_BG,
		CHART_GRID,
		CHART_FONT_BODY,
		CHART_FONT_MONO
	} from '$lib/utils/chartTheme.js';

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
						backgroundColor: CHART_INFO_LIGHT,
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
						pointBorderColor: CHART_CARD_BG,
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
						pointBorderColor: CHART_CARD_BG,
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
						pointBorderColor: CHART_CARD_BG,
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
							label: function (context) {
								const val = context.parsed.y;
								if (val == null) return '';
								const rounded = Math.round(val);
								if (context.dataset.label === 'Load (MW)') {
									return `${context.dataset.label}: ${rounded} MW`;
								}
								if (context.dataset.label === 'Marginal Price') {
									return `${context.dataset.label}: $${rounded}/MWh`;
								}
								return `${context.dataset.label}: $${rounded.toLocaleString()}`;
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
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_TEXT_MUTED
						},
						ticks: {
							font: { family: CHART_FONT_MONO, size: 11 },
							color: CHART_TEXT_MUTED,
							callback: function (value) {
								return '$' + value;
							}
						},
						grid: {
							color: CHART_GRID
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
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_INFO
						},
						ticks: {
							font: { family: CHART_FONT_MONO, size: 11 },
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
							font: { family: CHART_FONT_BODY, size: 12, weight: 600 },
							color: CHART_TEXT_MUTED
						},
						ticks: {
							font: { family: CHART_FONT_MONO, size: 11 },
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

	// Only re-derive chart data when periods change (not on every game state mutation)
	const chartData = $derived.by(() => {
		const name = connection.participantName;
		if (!name) return null;

		const cleared = game.state.periods;
		if (cleared.length === 0) return null;

		const load: (number | null)[] = [];
		const revenue: (number | null)[] = [];
		const profit: (number | null)[] = [];
		const marginalPrice: (number | null)[] = [];
		const labels: number[] = [];

		for (const period of cleared) {
			labels.push(period.number);
			const pp = period.players[name];
			load.push(period.load);
			revenue.push(pp?.revenue ?? null);
			profit.push(pp?.profit ?? null);
			marginalPrice.push(period.marginal_cost ?? null);
		}

		return { labels, load, revenue, profit, marginalPrice };
	});

	$effect(() => {
		if (!chart) return;
		const d = chartData;
		hasData = d !== null;
		if (!d) return;

		chart.data.labels = d.labels;
		chart.data.datasets[0].data = d.load;
		chart.data.datasets[1].data = d.revenue;
		chart.data.datasets[2].data = d.profit;
		chart.data.datasets[3].data = d.marginalPrice;
		chart.update();
	});
</script>

<section class="card mb-6" aria-label="Profit chart">
	<h3 class="card-header">Revenue, Profit & Marginal Price</h3>
	<div class="card-body p-5">
		{#if !hasData}
			<div class="flex min-h-[300px] flex-col items-center justify-center px-8 py-12 text-center">
				<Icon name="chart-bars" size={48} class="text-gold opacity-25" />
				<h4 class="text-text-secondary mt-4 mb-2 text-lg">No Data Yet</h4>
				<p class="text-text-muted m-0 max-w-[320px] text-sm">
					Revenue and profit data will appear as periods complete.
				</p>
			</div>
		{/if}
		<div style:display={hasData ? 'block' : 'none'}>
			<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
			<canvas
				bind:this={canvas}
				role="img"
				aria-label="Line chart showing revenue, profit, and marginal price per period"
			></canvas>
		</div>
		{#if hasData}
			<table class="sr-only">
				<caption>Revenue, Profit, Load & Marginal Price per Period</caption>
				<thead>
					<tr
						><th scope="col">Period</th><th scope="col">Load (MW)</th><th scope="col">Revenue ($)</th><th scope="col">Profit ($)</th><th scope="col"
							>Marginal Price ($/MWh)</th
						></tr
					>
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
