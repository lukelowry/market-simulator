import { test as base, expect as baseExpect, type Page } from '@playwright/test';

/**
 * Admin password for local dev — matches .dev.vars ADMIN_PASSWORD.
 * Override via ADMIN_PASSWORD env var if different.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

type GameFixtures = {
	/** A page logged in as admin with a fresh market created. */
	adminPage: { page: Page; marketName: string };
	/** Creates a player page joined to a given market. */
	playerPage: (marketName: string, playerName: string) => Promise<Page>;
};

export const test = base.extend<GameFixtures>({
	adminPage: async ({ page }, use) => {
		// Login as admin
		await page.goto('/');
		await page.locator('#signin-name').fill('admin');
		await page.locator('#signin-uin').fill(ADMIN_PASSWORD);
		await page.getByRole('button', { name: 'Sign In' }).click();

		// Wait for admin dashboard — "New Market" button proves it loaded
		await baseExpect(page.getByRole('button', { name: 'New Market' })).toBeVisible({
			timeout: 10_000
		});

		// Create a new market with a unique name
		const marketName = `test-${Date.now()}`;
		await page.getByRole('button', { name: 'New Market' }).click();
		await page.locator('#market-name').fill(marketName);
		await page.getByRole('button', { name: 'Create Market' }).click();

		// Wait for market to appear in admin sidebar — use the specific sidebar button selector
		await baseExpect(page.getByRole('button', { name: `Select market ${marketName}` })).toBeVisible(
			{ timeout: 10_000 }
		);

		await use({ page, marketName });
	},

	playerPage: async ({ browser }, use) => {
		const contexts: Array<{ close: () => Promise<void> }> = [];

		const createPlayerPage = async (marketName: string, playerName: string) => {
			const context = await browser.newContext();
			const page = await context.newPage();

			// Login as player
			await page.goto('/');
			await page.locator('#signin-name').fill(playerName);
			await page.locator('#signin-uin').fill('12345');
			await page.getByRole('button', { name: 'Sign In' }).click();

			// Wait for market list to load
			await baseExpect(page.getByRole('heading', { name: 'Available Markets' })).toBeVisible({
				timeout: 10_000
			});

			// Find the specific market card row (has justify-between class) and click its Join button
			const marketCard = page
				.locator('.flex.items-center.justify-between')
				.filter({ hasText: marketName });
			await marketCard.getByRole('button', { name: /^(Join|Rejoin|View Results)$/ }).click();

			// Wait for game view to load — player name appears in sidebar or game UI
			await baseExpect(page.getByText(playerName, { exact: true }).first()).toBeVisible({
				timeout: 15_000
			});

			contexts.push(context);
			return page;
		};

		await use(createPlayerPage);

		// Cleanup all player contexts
		for (const context of contexts) {
			await context.close();
		}
	}
});

export { expect } from '@playwright/test';

/**
 * Place an offer on a generator.
 * @param page - The player's page
 * @param genIndex - Zero-based index of the generator in the table
 * @param price - Offer price in $/MWh
 */
export async function placeOffer(page: Page, genIndex: number, price: number): Promise<void> {
	const inputs = page.locator('[aria-label^="Offer price for"]');
	await inputs.nth(genIndex).fill(String(price));
}

/**
 * Submit all offers on the current page.
 */
export async function submitOffers(page: Page): Promise<void> {
	await page.locator('form[aria-label="Generator list"] button[type="submit"]').click();
	// Wait for submission confirmation toast
	await page.locator('.submit-toast').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Wait for all generator offer inputs to be present on the page.
 */
export async function waitForGenerators(page: Page): Promise<void> {
	await page.locator('[aria-label^="Offer price for"]').first().waitFor({
		state: 'visible',
		timeout: 10_000
	});
}
