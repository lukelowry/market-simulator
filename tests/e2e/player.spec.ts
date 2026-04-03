import { test, expect, placeOffer, submitOffers, waitForGenerators } from './fixtures.js';

test.describe('Player Flow', () => {
	test('join a game', async ({ adminPage, playerPage }) => {
		const { marketName } = adminPage;
		const player = await playerPage(marketName, 'Trader1');

		// Player should see the game interface with their name
		await expect(player.getByText('Trader1', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});
	});

	test('place and submit offers', async ({ adminPage, playerPage }) => {
		const { page: admin, marketName } = adminPage;

		// Join and start game
		const player = await playerPage(marketName, 'Trader1');
		await expect(admin.getByText('Trader1', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});
		await admin.getByRole('button', { name: 'Start' }).click();
		await expect(admin.getByText('In Progress')).toBeVisible({ timeout: 10_000 });

		// Wait for generator inputs to appear
		await waitForGenerators(player);

		// Place offer on first generator and submit
		await placeOffer(player, 0, 50);
		await submitOffers(player);

		// Verify submission toast
		await expect(player.locator('.submit-toast')).toBeVisible();
	});

	test('see P&L after clearing', async ({ adminPage, playerPage }) => {
		const { page: admin, marketName } = adminPage;

		// Two players join
		const player1 = await playerPage(marketName, 'Seller1');
		const player2 = await playerPage(marketName, 'Buyer2');
		await expect(admin.getByText('Seller1', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});
		await expect(admin.getByText('Buyer2', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Start game
		await admin.getByRole('button', { name: 'Start' }).click();
		await expect(admin.getByText('In Progress')).toBeVisible({ timeout: 10_000 });

		// Wait for generator inputs
		await waitForGenerators(player1);
		await waitForGenerators(player2);

		// Both players submit offers on all their generators
		const count1 = await player1.locator('[aria-label^="Offer price for"]').count();
		for (let i = 0; i < count1; i++) {
			await placeOffer(player1, i, 30 + i * 10);
		}
		await submitOffers(player1);

		const count2 = await player2.locator('[aria-label^="Offer price for"]').count();
		for (let i = 0; i < count2; i++) {
			await placeOffer(player2, i, 40 + i * 10);
		}
		await submitOffers(player2);

		// Admin advances period to trigger clearing
		await admin.getByRole('button', { name: 'Advance' }).click();

		// Players should see period scorecard or profit chart update
		await expect(
			player1.locator('[aria-label="Period scorecard"], [aria-label="Profit chart"]').first()
		).toBeVisible({ timeout: 15_000 });
	});

	test('non-member does not see Rejoin for running game', async ({ adminPage, playerPage, browser }) => {
		const { page: admin, marketName } = adminPage;

		// Player 1 joins the game
		const player1 = await playerPage(marketName, 'Member1');
		await expect(admin.getByText('Member1', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

		// Admin starts the game (game is now 'running')
		await admin.getByRole('button', { name: 'Start' }).click();
		await expect(admin.getByText('In Progress')).toBeVisible({ timeout: 10_000 });

		// Player 2 signs in but has never joined this market
		const ctx2 = await browser.newContext();
		const outsider = await ctx2.newPage();
		await outsider.goto('/');
		await outsider.locator('#signin-name').fill('Outsider');
		await outsider.locator('#signin-uin').fill('99999');
		await outsider.getByRole('button', { name: 'Sign In' }).click();
		await expect(outsider.getByRole('heading', { name: 'Available Markets' })).toBeVisible({ timeout: 10_000 });

		// The running market should NOT show a Join/Rejoin button for the outsider
		const marketCard = outsider
			.locator('.flex.items-center.justify-between')
			.filter({ hasText: marketName });
		await expect(marketCard).toBeVisible({ timeout: 10_000 });
		await expect(marketCard.getByRole('button', { name: /^(Join|Rejoin|View Results)$/ })).not.toBeVisible();

		await ctx2.close();
	});
});
