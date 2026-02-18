/**
 * @module auth.remote
 * Authentication remote functions. Replaces /api/auth and /api/player-auth REST endpoints.
 */

import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { createAdminToken, createPlayerToken } from '$worker/auth.js';
import { getEnv } from '$lib/server/platform.js';

export const adminLogin = command(
	v.object({ password: v.string() }),
	async ({ password }) => {
		const env = getEnv();
		if (password !== env.ADMIN_PASSWORD) {
			error(401, 'Invalid credentials.');
		}
		const key = await createAdminToken(env.ADMIN_PASSWORD);
		return { key };
	}
);

export const playerLogin = command(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(20), v.regex(/^[a-zA-Z0-9 _-]+$/)),
		uin: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(20), v.regex(/^[a-zA-Z0-9]+$/))
	}),
	async ({ name, uin }) => {
		const env = getEnv();
		const token = await createPlayerToken(name, uin, env.ADMIN_PASSWORD);
		return { token, name };
	}
);
