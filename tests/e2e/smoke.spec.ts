import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

test.describe('Smoke Tests', () => {
	test('landing page loads with sign-in form', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('#signin-name')).toBeVisible();
		await expect(page.locator('#signin-uin')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
	});

	test('landing page shows available markets heading', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Available Markets' })).toBeVisible();
	});

	test('sign in as player shows market list', async ({ page }) => {
		await page.goto('/');
		await page.locator('#signin-name').fill('TestPlayer');
		await page.locator('#signin-uin').fill('12345');
		await page.getByRole('button', { name: 'Sign In' }).click();

		// Player view should now be active — the "Available Markets" heading is unique
		await expect(page.getByRole('heading', { name: 'Available Markets' })).toBeVisible({
			timeout: 10_000
		});
	});

	test('sign in as admin shows admin dashboard', async ({ page }) => {
		await page.goto('/');
		await page.locator('#signin-name').fill('admin');
		await page.locator('#signin-uin').fill(ADMIN_PASSWORD);
		await page.getByRole('button', { name: 'Sign In' }).click();

		// Admin should see the New Market button
		await expect(page.getByRole('button', { name: 'New Market' })).toBeVisible({ timeout: 10_000 });
	});
});
