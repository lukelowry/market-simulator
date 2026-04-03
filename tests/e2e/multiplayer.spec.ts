import { test, expect, placeOffer, submitOffers, waitForGenerators } from './fixtures.js';

test.describe('Multiplayer Trading', () => {
	test('two players trade and clearing produces correct results', async ({
		adminPage,
		playerPage
	}) => {
		const { page: admin, marketName } = adminPage;

		// Two players join
		const player1 = await playerPage(marketName, 'TraderA');
		const player2 = await playerPage(marketName, 'TraderB');
		await expect(admin.getByText('TraderA', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});
		await expect(admin.getByText('TraderB', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Start game
		await admin.getByRole('button', { name: 'Start' }).click();
		await expect(admin.getByText('In Progress')).toBeVisible({ timeout: 10_000 });

		// Wait for generator inputs to appear
		await waitForGenerators(player1);
		await waitForGenerators(player2);

		// Player 1 submits low offers (should be dispatched first)
		const p1Count = await player1.locator('[aria-label^="Offer price for"]').count();
		for (let i = 0; i < p1Count; i++) {
			await placeOffer(player1, i, 20 + i * 5);
		}
		await submitOffers(player1);

		// Player 2 submits higher offers
		const p2Count = await player2.locator('[aria-label^="Offer price for"]').count();
		for (let i = 0; i < p2Count; i++) {
			await placeOffer(player2, i, 80 + i * 10);
		}
		await submitOffers(player2);

		// Admin advances period to trigger clearing
		await admin.getByRole('button', { name: 'Advance' }).click();

		// Both players should see updated period results
		await expect(
			player1.locator('[aria-label="Period scorecard"], [aria-label="Profit chart"]').first()
		).toBeVisible({ timeout: 15_000 });

		await expect(
			player2.locator('[aria-label="Period scorecard"], [aria-label="Profit chart"]').first()
		).toBeVisible({ timeout: 15_000 });
	});

	test('players see each other connect in real time', async ({ adminPage, playerPage }) => {
		const { page: admin, marketName } = adminPage;

		// First player joins
		await playerPage(marketName, 'EarlyBird');
		await expect(admin.getByText('EarlyBird', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Second player joins
		await playerPage(marketName, 'LateComer');
		await expect(admin.getByText('LateComer', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Both still visible
		await expect(admin.getByText('EarlyBird', { exact: true }).first()).toBeVisible();
	});
});
