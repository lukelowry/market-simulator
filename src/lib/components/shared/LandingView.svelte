<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { adminLogin, playerLogin } from '../../../routes/auth.remote';
	import MarketList from '$lib/components/shared/MarketList.svelte';

	let nameInput = $state('');
	let uinInput = $state('');
	let formError = $state('');
	let loading = $state(false);

	function isValidName(name: string): boolean {
		return name.length >= 1 && name.length <= 20 && /^[a-zA-Z0-9 _-]+$/.test(name);
	}

	async function handleSignIn(e: Event) {
		e.preventDefault();

		const trimmedName = nameInput.trim();
		const trimmedUin = uinInput.trim();

		if (!trimmedName) {
			formError = 'Name is required.';
			return;
		}
		if (!trimmedUin) {
			formError = 'UIN is required.';
			return;
		}

		loading = true;
		formError = '';

		// Admin detection (case-insensitive)
		if (trimmedName.toLowerCase() === 'admin') {
			try {
				const result = await adminLogin({ password: trimmedUin });
				connection.adminKey = result.key;
				connection.role = 'admin';
				connection.participantName = 'Admin';
			} catch (err) {
				console.warn('Admin auth failed:', err);
				formError = 'Invalid credentials.';
			}
			loading = false;
			return;
		}

		// Player sign-in
		if (!isValidName(trimmedName)) {
			formError = 'Letters, numbers, spaces, hyphens, and underscores only (max 20 chars).';
			loading = false;
			return;
		}

		try {
			const result = await playerLogin({ name: trimmedName, uin: trimmedUin });
			connection.playerToken = result.token;
			connection.participantName = result.name;
			connection.role = 'participant';
		} catch (err) {
			console.warn('Player auth failed:', err);
			formError = 'Could not connect to the server. Check your connection and try again.';
		}
		loading = false;
	}
</script>

<div class="animate-in mx-auto max-w-240 pt-8">
	<div class="grid grid-cols-1 items-start gap-8 md:grid-cols-[380px_1fr]">
		<!-- Left: Sign-in -->
		<div>
			<div class="card p-6">
				<h2 class="mb-1.5 text-xl">Sign In</h2>
				<p class="text-text-muted mb-5 text-sm">Enter your name and UIN to get started.</p>
				<div aria-live="assertive" aria-atomic="true">
					{#if formError}
						<div class="callout callout-warning mb-5" id="signin-error">{formError}</div>
					{/if}
				</div>
				<form onsubmit={handleSignIn}>
					<div class="form-group">
						<label for="signin-name" class="form-label">Name</label>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							class="form-input"
							id="signin-name"
							placeholder="e.g. Your Name"
							bind:value={nameInput}
							autocomplete="off"
							maxlength={20}
							required
							aria-required="true"
							aria-describedby={formError ? 'signin-error' : undefined}
							autofocus
						/>
					</div>
					<div class="form-group">
						<label for="signin-uin" class="form-label">UIN</label>
						<input
							type="text"
							class="form-input"
							id="signin-uin"
							placeholder="e.g. 123456789"
							bind:value={uinInput}
							autocomplete="off"
							required
							aria-required="true"
							aria-describedby={formError ? 'signin-error' : undefined}
						/>
					</div>
					<button type="submit" class="btn btn-primary w-full" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>
				</form>
			</div>
		</div>

		<!-- Right: Market Preview -->
		<div>
			<div class="mb-6">
				<h3 class="mb-2">Available Markets</h3>
				<p class="text-text-muted text-sm">Sign in to join a market.</p>
			</div>

			<MarketList />
		</div>
	</div>
</div>
