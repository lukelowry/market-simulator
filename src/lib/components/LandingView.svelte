<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { adminLogin, playerLogin } from '../../routes/auth.remote';
	import MarketList from '$lib/components/MarketList.svelte';

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

		if (!trimmedName) { formError = 'Name is required.'; return; }
		if (!trimmedUin) { formError = 'UIN is required.'; return; }

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
			connection.uin = trimmedUin;
			connection.role = 'participant';
		} catch (err) {
			console.warn('Player auth failed:', err);
			formError = 'Connection failed. Please try again.';
		}
		loading = false;
	}

</script>

<div class="pt-8 max-w-[960px] mx-auto animate-in">
	<div class="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-8 items-start">
		<!-- Left: Sign-in -->
		<div>
			<div class="card p-8">
				<div class="w-10 h-[3px] bg-gradient-to-r from-maroon to-gold rounded-sm mb-5" aria-hidden="true"></div>
				<h3 class="mb-2">Sign In</h3>
				<p class="text-text-muted text-sm mb-6">Enter your name and UIN to get started.</p>
				{#if formError}
					<div class="callout callout-warning mb-5">{formError}</div>
				{/if}
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
						/>
					</div>
					<button type="submit" class="btn btn-primary w-full py-3" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>
				</form>
			</div>
		</div>

		<!-- Right: Market Preview -->
		<div>
			<div class="mb-6">
				<div class="w-10 h-[3px] bg-gradient-to-r from-maroon to-gold rounded-sm mb-5" aria-hidden="true"></div>
				<h3 class="mb-2">Available Markets</h3>
				<p class="text-text-muted text-sm">Sign in to join a market.</p>
			</div>

			<MarketList />
		</div>
	</div>
</div>
