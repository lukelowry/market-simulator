<script lang="ts">
	import { onMount } from 'svelte';
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { connect, loadSession } from '$lib/services/websocket.js';
	import LandingView from '$lib/components/LandingView.svelte';
	import PlayerView from '$lib/components/PlayerView.svelte';
	import AdminDashboard from '$lib/components/admin/AdminDashboard.svelte';

	let restoringSession = $state(true);

	onMount(() => {
		const session = loadSession();

		if (session?.role === 'admin' && session.key) {
			connection.adminKey = session.key;
			connection.role = 'admin';
			connection.participantName = 'Admin';
			connection.marketName = session.market;
			connect(session.market, 'admin', 'admin', session.key);
		} else if (session?.role === 'participant' && session.token && session.name && session.market) {
			connection.playerToken = session.token;
			connection.participantName = session.name;
			connection.marketName = session.market;
			connection.role = 'participant';
			connect(session.market, 'participant', session.name, undefined, session.token);
		} else {
			// Clean up all legacy separate keys (now handled by unified msim_session)
			sessionStorage.removeItem('playerToken');
			sessionStorage.removeItem('participantName');
		}

		restoringSession = false;
	});
</script>

<div class="container">
	{#if restoringSession}
		<!-- Sub-frame pause while checking sessionStorage; prevents landing page flash -->
	{:else if !connection.role}
		<LandingView />
	{:else if connection.role === 'admin' && connection.adminKey}
		<AdminDashboard />
	{:else}
		<PlayerView />
	{/if}
</div>
