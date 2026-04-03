import { test, expect } from './fixtures.js';

test.describe('Connection Resilience', () => {
	test('player state survives page refresh', async ({ adminPage, playerPage }) => {
		const { marketName } = adminPage;

		// Player joins
		const player = await playerPage(marketName, 'Refresher');

		// Verify player is in game
		await expect(player.getByText('Refresher', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Refresh the page
		await player.reload();

		// Player should still see the game (auto-reconnect via session storage)
		await expect(player.getByText('Refresher', { exact: true }).first()).toBeVisible({
			timeout: 15_000
		});
	});

	test('admin state survives page refresh', async ({ adminPage }) => {
		const { page: admin } = adminPage;

		// Verify admin dashboard is loaded
		await expect(admin.getByRole('button', { name: 'New Market' })).toBeVisible();

		// Refresh the page
		await admin.reload();

		// Admin session should survive — still on admin dashboard, not login page
		await expect(admin.getByRole('button', { name: 'New Market' })).toBeVisible({
			timeout: 20_000
		});
	});

	test('WebSocket reconnects after brief disconnect', async ({ adminPage, playerPage }) => {
		const { page: admin, marketName } = adminPage;

		const player = await playerPage(marketName, 'Reconnector');
		await expect(admin.getByText('Reconnector', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});

		// Simulate network disconnect by going offline
		await player.context().setOffline(true);

		// Wait briefly for disconnect to register
		await player.waitForTimeout(2000);

		// Go back online
		await player.context().setOffline(false);

		// Player should reconnect and see their state restored
		await expect(player.getByText('Reconnector', { exact: true }).first()).toBeVisible({
			timeout: 20_000
		});
	});
});
