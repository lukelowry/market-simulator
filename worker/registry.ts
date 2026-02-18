/**
 * @module registry
 * MarketRegistry DO communication. Handles snapshot diffing to avoid
 * redundant cross-DO RPCs, and provides push/remove operations.
 */

import type { GameState } from './types';

/** Build a JSON snapshot of registry-relevant fields for diff comparison. */
export function buildSnapshot(game: GameState): string {
	return JSON.stringify({
		state: game.state,
		visibility: game.visibility,
		nplayers: game.nplayers,
		maxPlayers: game.options?.max_participants ?? 0
	});
}

/** Push current game state to the global MarketRegistry DO. Returns true on success. */
export async function pushToRegistry(
	registryNS: DurableObjectNamespace,
	marketName: string,
	game: GameState
): Promise<boolean> {
	if (!marketName) return false;
	try {
		const registryId = registryNS.idFromName('global');
		const registry = registryNS.get(registryId);

		if (game.state === 'uninitialized') {
			await registry.fetch(new Request('https://registry/remove', {
				method: 'POST',
				body: JSON.stringify({ name: marketName })
			}));
		} else {
			await registry.fetch(new Request('https://registry/update', {
				method: 'POST',
				body: JSON.stringify({
					name: marketName,
					state: game.state,
					visibility: game.visibility,
					playerCount: game.nplayers,
					maxPlayers: game.options?.max_participants ?? 0,
					updatedAt: Date.now()
				})
			}));
		}
		return true;
	} catch (err) {
		console.error('Registry update failed:', err);
		return false;
	}
}

/** Remove a market from the global MarketRegistry DO. */
export async function removeFromRegistry(
	registryNS: DurableObjectNamespace,
	marketName: string
): Promise<void> {
	if (!marketName) return;
	try {
		const registryId = registryNS.idFromName('global');
		const registry = registryNS.get(registryId);
		await registry.fetch(new Request('https://registry/remove', {
			method: 'POST',
			body: JSON.stringify({ name: marketName })
		}));
	} catch (err) {
		console.error('Registry remove failed:', err);
	}
}
