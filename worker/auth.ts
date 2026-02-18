/**
 * @module auth
 * HMAC-SHA256 session tokens for admins and players. No third-party JWT library.
 *
 * Admin token format: `{expiryHex}.{hmacHex}`
 * Player token format: `{nameHex}.{uinHex}.{expiryHex}.{hmacHex}`
 *   - Fields are hex-encoded to avoid `.` delimiter collision in the token format.
 *   - HMAC covers `{nameHex}.{uinHex}.{expiryHex}` so all fields are tamper-proof.
 *   - Verification is constant-time via `crypto.subtle.verify`.
 *
 * The signing secret is `ADMIN_PASSWORD` from environment bindings.
 * Tokens are non-revocable — the 24h TTL is the only expiry mechanism.
 */

/** 24h TTL. Tokens cannot be revoked, so this is the sole expiry mechanism. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Import the secret as a non-extractable HMAC key. `extractable: false` prevents raw key exposure through the API. */
async function getKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

function hexFromBuffer(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createAdminToken(secret: string): Promise<string> {
	const expiry = (Date.now() + TOKEN_TTL_MS).toString(16);
	const key = await getKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expiry));
	return `${expiry}.${hexFromBuffer(sig)}`;
}

export async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
	const dot = token.indexOf('.');
	if (dot < 1) return false;

	const expiryHex = token.slice(0, dot);
	const sigHex = token.slice(dot + 1);

	// Check expiry
	const expiry = parseInt(expiryHex, 16);
	if (isNaN(expiry) || expiry < Date.now()) return false;

	// Verify HMAC (constant-time via crypto.subtle.verify)
	if (sigHex.length % 2 !== 0) return false;
	const key = await getKey(secret);
	return crypto.subtle.verify('HMAC', key, hexToBytes(sigHex) as BufferSource, new TextEncoder().encode(expiryHex));
}

/** Convenience wrapper: returns false for null/missing/malformed keys without throwing. Safe in unauthenticated contexts. */
export async function isAdmin(key: string | null | undefined, secret: string): Promise<boolean> {
	if (!key || !key.includes('.')) return false;
	return verifyAdminToken(key, secret);
}

// --- Player tokens ---

function hexFromString(str: string): string {
	return [...new TextEncoder().encode(str)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function stringFromHex(hex: string): string {
	return new TextDecoder().decode(hexToBytes(hex));
}

export async function createPlayerToken(name: string, uin: string, secret: string): Promise<string> {
	const nameHex = hexFromString(name);
	const uinHex = hexFromString(uin);
	const expiryHex = (Date.now() + TOKEN_TTL_MS).toString(16);
	const payload = `${nameHex}.${uinHex}.${expiryHex}`;
	const key = await getKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	return `${payload}.${hexFromBuffer(sig)}`;
}

/** Decoded payload from a verified player token. UIN is only used server-side to prevent name squatting; never broadcast. */
export interface PlayerTokenPayload {
	name: string;
	uin: string;
}

export async function verifyPlayerToken(token: string | null | undefined, secret: string): Promise<PlayerTokenPayload | null> {
	if (!token) return null;

	const parts = token.split('.');
	if (parts.length !== 4) return null;

	const [nameHex, uinHex, expiryHex, sigHex] = parts;

	// Check expiry
	const expiry = parseInt(expiryHex, 16);
	if (isNaN(expiry) || expiry < Date.now()) return null;

	// Verify HMAC (constant-time via crypto.subtle.verify)
	if (sigHex.length % 2 !== 0) return null;
	const payload = `${nameHex}.${uinHex}.${expiryHex}`;
	const key = await getKey(secret);
	const valid = await crypto.subtle.verify('HMAC', key, hexToBytes(sigHex) as BufferSource, new TextEncoder().encode(payload));
	if (!valid) return null;

	try {
		return { name: stringFromHex(nameHex), uin: stringFromHex(uinHex) };
	} catch {
		return null;
	}
}
