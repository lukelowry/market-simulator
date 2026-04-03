import { test, expect } from './fixtures.js';

test.describe('Admin Flow', () => {
	test('create a new market', async ({ adminPage }) => {
		const { page, marketName } = adminPage;

		// Market should be visible in the sidebar
		await expect(page.getByRole('button', { name: `Select market ${marketName}` })).toBeVisible();
	});

	test('configure game settings', async ({ adminPage }) => {
		const { page } = adminPage;

		// Open market settings modal
		await page.getByRole('button', { name: 'Market settings' }).click();

		// Modal should be visible
		await expect(page.getByRole('dialog')).toBeVisible();

		// Close modal
		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});

	test('start a game with players', async ({ adminPage, playerPage }) => {
		const { page: admin, marketName } = adminPage;

		// Add a player
		await playerPage(marketName, 'Player1');

		// Wait for player to appear in admin view
		await expect(admin.getByText('Player1', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Start the game
		await admin.getByRole('button', { name: 'Start' }).click();

		// Game state should transition to "running"
		await expect(admin.getByText('In Progress')).toBeVisible({ timeout: 10_000 });
	});

	test('advance periods', async ({ adminPage, playerPage }) => {
		const { page: admin, marketName } = adminPage;

		// Add a player and start the game
		await playerPage(marketName, 'Player1');
		await expect(admin.getByText('Player1', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});
		await admin.getByRole('button', { name: 'Start' }).click();
		await expect(admin.getByText('In Progress')).toBeVisible({ timeout: 10_000 });

		// Advance period
		await admin.getByRole('button', { name: 'Advance' }).click();

		// Should show period 2
		await expect(admin.getByText('Period 2', { exact: true })).toBeVisible({ timeout: 10_000 });
	});
});
