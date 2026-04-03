<script lang="ts">
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import Icon from '$lib/components/shared/Icon.svelte';

	const myPlayer = $derived(game.state.players[connection.participantName] ?? null);
	const periods = $derived(game.state.periods);
	const totalPeriods = $derived(periods.length);

	/** Medal color class based on rank */
	const rankMedal = $derived.by(() => {
		const rank = game.playerRank;
		if (rank === 1) return 'medal-gold';
		if (rank === 2) return 'medal-silver';
		if (rank === 3) return 'medal-bronze';
		return 'medal-default';
	});

	const stats = $derived.by(() => {
		if (!myPlayer || totalPeriods === 0) return null;

		const name = connection.participantName;
		let totalProfit = 0;
		let bestPeriod: { number: number; profit: number } | null = null;
		let worstPeriod: { number: number; profit: number } | null = null;
		let winCount = 0;
		let totalRevenue = 0;
		let totalCosts = 0;
		let totalClearing = 0;
		let clearingCount = 0;

		for (const p of periods) {
			const pp = p.players[name];
			if (!pp) continue;

			const profit = pp.profit ?? 0;
			totalProfit += profit;
			totalRevenue += pp.revenue ?? 0;
			totalCosts += pp.costs ?? 0;

			if (profit > 0) winCount++;

			if (bestPeriod === null || profit > bestPeriod.profit) {
				bestPeriod = { number: p.number, profit };
			}
			if (worstPeriod === null || profit < worstPeriod.profit) {
				worstPeriod = { number: p.number, profit };
			}

			if (p.marginal_cost !== null) {
				totalClearing += p.marginal_cost;
				clearingCount++;
			}
		}

		const avgProfit = Math.round(totalProfit / totalPeriods);
		const avgClearing = clearingCount > 0 ? Math.round(totalClearing / clearingCount) : 0;
		const winRate = Math.round((winCount / totalPeriods) * 100);

		return {
			totalProfit: Math.round(totalProfit),
			totalRevenue: Math.round(totalRevenue),
			totalCosts: Math.round(totalCosts),
			avgProfit,
			avgClearing,
			bestPeriod,
			worstPeriod,
			winRate,
			winCount
		};
	});

	const paymentLabel = $derived(
		game.state.options?.payment_method === 'pay_as_offered'
			? 'Pay-as-Offered'
			: 'Last Accepted Offer'
	);
</script>

{#if myPlayer && stats}
	<section class="gos-root animate-in" aria-label="Game results summary">
		<!-- Hero Banner -->
		<div class="gos-hero">
			<div class="gos-hero-bg" aria-hidden="true"></div>
			<div class="gos-hero-content">
				<div class="gos-hero-left">
					<div class="gos-label-inverse">Market Complete</div>
					<h3 class="gos-hero-title">
						{connection.marketName}
					</h3>
					<div class="gos-hero-meta">
						{totalPeriods} period{totalPeriods !== 1 ? 's' : ''} &middot; {game.playerCount} player{game
							.playerCount !== 1
							? 's'
							: ''} &middot; {paymentLabel}
					</div>
				</div>

				{#if game.playerRank}
					<div
						class="gos-rank-container"
						role="status"
						aria-label="Final rank: {game.playerRank} of {game.playerCount}"
					>
						<div class="gos-rank-badge {rankMedal}" aria-hidden="true">
							<span class="gos-rank-hash">#</span>
							<span class="gos-rank-number" class:rank-compact={game.playerRank >= 10}
								>{game.playerRank}</span
							>
						</div>
						<div class="gos-rank-label">
							of {game.playerCount} player{game.playerCount !== 1 ? 's' : ''}
						</div>
					</div>
				{/if}
			</div>

			<!-- Balance strip -->
			<div class="gos-balance-strip">
				<div class="gos-balance-item">
					<span class="gos-balance-label">Final Balance</span>
					<span
						class="gos-balance-value font-mono"
						class:text-success={myPlayer.money > 0}
						class:text-danger={myPlayer.money < 0}
					>
						${myPlayer.money.toLocaleString()}
					</span>
				</div>
				<div class="gos-balance-divider" aria-hidden="true"></div>
				<div class="gos-balance-item">
					<span class="gos-balance-label">Net Profit</span>
					<span
						class="gos-balance-value font-mono"
						class:text-success={stats.totalProfit > 0}
						class:text-danger={stats.totalProfit < 0}
					>
						{stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toLocaleString()}
					</span>
				</div>
				<div class="gos-balance-divider" aria-hidden="true"></div>
				<div class="gos-balance-item">
					<span class="gos-balance-label">Win Rate</span>
					<span
						class="gos-balance-value font-mono"
						class:text-success={stats.winRate >= 50}
						class:text-warning={stats.winRate > 0 && stats.winRate < 50}
						class:text-danger={stats.winRate === 0}
					>
						{stats.winRate}%
					</span>
				</div>
			</div>
		</div>

		<!-- Stats Grid -->
		<div class="gos-stats-grid">
			<div class="gos-stat-card">
				<div class="gos-stat-icon gos-stat-icon-gold" aria-hidden="true">
					<Icon name="dollar" size={18} />
				</div>
				<div class="gos-stat-value font-mono">${stats.totalRevenue.toLocaleString()}</div>
				<div class="label-micro">Total Revenue</div>
			</div>

			<div class="gos-stat-card">
				<div class="gos-stat-icon gos-stat-icon-maroon" aria-hidden="true">
					<Icon name="chart-bars" size={18} />
				</div>
				<div class="gos-stat-value font-mono">${stats.totalCosts.toLocaleString()}</div>
				<div class="label-micro">Total Costs</div>
			</div>

			<div class="gos-stat-card">
				<div class="gos-stat-icon gos-stat-icon-success" aria-hidden="true">
					<Icon name="trend-up" size={18} />
				</div>
				<div class="gos-stat-value font-mono">${stats.avgProfit.toLocaleString()}</div>
				<div class="label-micro">Avg Profit / Period</div>
			</div>

			<div class="gos-stat-card">
				<div class="gos-stat-icon gos-stat-icon-info" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
						<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
						<path
							d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
						/>
					</svg>
				</div>
				<div class="gos-stat-value font-mono">${stats.avgClearing}/MWh</div>
				<div class="label-micro">Avg Clearing Price</div>
			</div>
		</div>

		<!-- Best / Worst Period Highlight -->
		{#if stats.bestPeriod && stats.worstPeriod && totalPeriods > 1}
			<div class="gos-highlights">
				<div class="gos-highlight gos-highlight-best">
					<div class="gos-highlight-header">
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="currentColor"
							class="text-success"
							aria-hidden="true"
						>
							<path
								d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5c0 .538-.012 1.05-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33.076 33.076 0 0 1 2.5.5zm.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.398-.588-2.797-.72-3.935zm10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.138-.388 2.537-.72 3.935z"
							/>
						</svg>
						<span class="label-micro">Best Period</span>
					</div>
					<div class="gos-highlight-body">
						<span class="gos-highlight-period">Period {stats.bestPeriod.number}</span>
						<span class="gos-highlight-value text-success font-mono"
							>{stats.bestPeriod.profit >= 0 ? '+' : ''}${Math.round(
								stats.bestPeriod.profit
							).toLocaleString()}</span
						>
					</div>
				</div>
				<div class="gos-highlight gos-highlight-worst">
					<div class="gos-highlight-header">
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="currentColor"
							class="text-danger"
							aria-hidden="true"
						>
							<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
							<path
								d="M4.285 12.433a.5.5 0 0 0 .683-.183A3.498 3.498 0 0 1 8 10.5c1.295 0 2.426.703 3.032 1.75a.5.5 0 0 0 .866-.5A4.498 4.498 0 0 0 8 9.5a4.5 4.5 0 0 0-3.898 2.25.5.5 0 0 0 .183.683zM7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zm4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5z"
							/>
						</svg>
						<span class="label-micro">Worst Period</span>
					</div>
					<div class="gos-highlight-body">
						<span class="gos-highlight-period">Period {stats.worstPeriod.number}</span>
						<span class="gos-highlight-value text-danger font-mono">
							{stats.worstPeriod.profit >= 0 ? '+' : ''}${Math.round(
								stats.worstPeriod.profit
							).toLocaleString()}
						</span>
					</div>
				</div>
				<div class="gos-highlight gos-highlight-consistency">
					<div class="gos-highlight-header">
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="currentColor"
							class="text-info"
							aria-hidden="true"
						>
							<path
								d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.399l-.31 0 .07-.334 2.16-.33h-.002zm-.41-3.35a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
							/>
						</svg>
						<span class="label-micro">Profitable Periods</span>
					</div>
					<div class="gos-highlight-body">
						<span class="gos-highlight-period">{stats.winCount} of {totalPeriods}</span>
						<span class="gos-highlight-value text-info font-mono">{stats.winRate}%</span>
					</div>
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	.gos-root {
		margin-bottom: 1.5rem;
	}

	/* ── Hero Banner ── */
	.gos-hero {
		position: relative;
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow);
	}

	.gos-hero-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			var(--color-maroon) 0%,
			var(--color-maroon-dark) 55%,
			color-mix(in srgb, var(--color-maroon-dark) 70%, black) 100%
		);
	}
	.gos-hero-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				ellipse at 80% 20%,
				color-mix(in srgb, var(--color-gold) 15%, transparent) 0%,
				transparent 60%
			),
			radial-gradient(
				ellipse at 20% 80%,
				color-mix(in srgb, var(--color-gold) 8%, transparent) 0%,
				transparent 50%
			);
	}

	.gos-hero-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 1.5rem 1.25rem;
		gap: 1.5rem;
	}

	.gos-hero-left {
		flex: 1;
		min-width: 0;
	}

	.gos-label-inverse {
		font-family: var(--font-body);
		font-size: var(--text-micro);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-section);
		color: var(--color-gold);
		margin-bottom: 0.5rem;
	}

	.gos-hero-title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text-inverse);
		line-height: 1.2;
		margin-bottom: 0.375rem;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.gos-hero-meta {
		font-family: var(--font-body);
		font-size: var(--text-compact);
		color: color-mix(in srgb, var(--color-text-inverse) 60%, transparent);
	}

	/* ── Rank Badge ── */
	.gos-rank-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		animation: rankReveal 0.6s var(--ease-brand) 0.2s both;
	}

	@keyframes rankReveal {
		from {
			opacity: 0;
			transform: scale(0.7);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.gos-rank-badge {
		width: 3.75rem;
		height: 3.75rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--color-text-inverse) 15%, transparent),
			var(--shadow-sm);
	}

	.gos-rank-badge.medal-gold {
		background: linear-gradient(145deg, var(--color-gold-light) 0%, var(--color-gold) 50%, var(--color-gold-dark) 100%);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--color-gold) 30%, transparent),
			0 0 12px color-mix(in srgb, var(--color-gold) 20%, transparent);
	}
	.gos-rank-badge.medal-silver {
		background: linear-gradient(145deg, var(--color-silver-light) 0%, var(--color-silver) 50%, var(--color-silver-dark) 100%);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--color-silver) 30%, transparent),
			0 0 12px color-mix(in srgb, var(--color-silver) 15%, transparent);
	}
	.gos-rank-badge.medal-bronze {
		background: linear-gradient(145deg, var(--color-bronze-light) 0%, var(--color-bronze) 50%, var(--color-bronze-dark) 100%);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--color-bronze) 30%, transparent),
			0 0 12px color-mix(in srgb, var(--color-bronze) 15%, transparent);
	}
	.gos-rank-badge.medal-default {
		background: linear-gradient(
			145deg,
			color-mix(in srgb, var(--color-text-inverse) 12%, transparent) 0%,
			color-mix(in srgb, var(--color-text-inverse) 5%, transparent) 100%
		);
		border: 1px solid color-mix(in srgb, var(--color-text-inverse) 18%, transparent);
	}

	.gos-rank-hash {
		font-family: var(--font-mono);
		font-size: var(--text-base);
		font-weight: 600;
		opacity: 0.6;
		color: var(--color-text-primary);
		margin-right: 1px;
	}
	.gos-rank-number {
		font-family: var(--font-mono);
		font-size: 1.625rem;
		font-weight: 800;
		line-height: 1;
		color: var(--color-text-primary);
	}
	.gos-rank-number.rank-compact {
		font-size: 1.25rem;
	}
	.medal-default .gos-rank-hash,
	.medal-default .gos-rank-number {
		color: var(--color-text-inverse);
	}

	.gos-rank-label {
		font-family: var(--font-body);
		font-size: var(--text-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: color-mix(in srgb, var(--color-text-inverse) 50%, transparent);
	}

	/* ── Balance Strip ── */
	.gos-balance-strip {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 0.75rem 1.5rem;
		background: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
		border-top: 1px solid color-mix(in srgb, var(--color-text-inverse) 6%, transparent);
	}

	.gos-balance-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	.gos-balance-label {
		font-family: var(--font-body);
		font-size: var(--text-micro);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-brand);
		color: color-mix(in srgb, var(--color-text-inverse) 50%, transparent);
	}

	.gos-balance-value {
		font-size: var(--text-lg);
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.gos-balance-divider {
		width: 1px;
		height: 32px;
		background: color-mix(in srgb, var(--color-text-inverse) 10%, transparent);
	}

	/* ── Stats Grid ── */
	.gos-stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.gos-stat-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius);
		padding: 0.875rem 0.75rem 0.75rem;
		text-align: center;
		box-shadow: var(--shadow-xs);
		min-width: 0;
		overflow: hidden;
	}

	.gos-stat-icon {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 0.5rem;
	}
	.gos-stat-icon-gold {
		background: var(--color-gold-faint);
		color: var(--color-gold);
	}
	.gos-stat-icon-maroon {
		background: var(--color-maroon-faint);
		color: var(--color-maroon);
	}
	.gos-stat-icon-success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}
	.gos-stat-icon-info {
		background: var(--color-info-bg);
		color: var(--color-info);
	}

	.gos-stat-value {
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--color-text-primary);
		line-height: 1.2;
		margin-bottom: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Highlights Row ── */
	.gos-highlights {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.gos-highlight {
		background: var(--color-surface);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius);
		padding: 0.75rem 0.875rem;
		box-shadow: var(--shadow-xs);
		min-width: 0;
	}

	.gos-highlight-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.gos-highlight-body {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.gos-highlight-period {
		font-family: var(--font-body);
		font-size: var(--text-compact);
		font-weight: 600;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.gos-highlight-value {
		font-size: var(--text-base);
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* ── Responsive ── */

	/* Stats grid: use container query since parent content area width
	   varies with sidebar. 4-col when ≥640px, 2-col below, 1-col on very narrow. */
	@container (max-width: 640px) {
		.gos-stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@container (max-width: 360px) {
		.gos-stats-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Hero and balance strip: use container query for layout shifts */
	@container (max-width: 500px) {
		.gos-hero-content {
			flex-direction: column;
			text-align: center;
			padding: 1.5rem;
		}

		.gos-hero-title {
			font-size: 1.375rem;
		}

		.gos-balance-strip {
			flex-direction: column;
			gap: 0.75rem;
			padding: 1rem;
		}

		.gos-balance-divider {
			width: 40px;
			height: 1px;
		}

		.gos-highlights {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gos-rank-container {
			animation: none;
		}
	}
</style>
