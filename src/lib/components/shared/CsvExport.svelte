<script lang="ts">
	import { connection } from '$lib/stores/connectionStore.svelte.js';
	import { game } from '$lib/stores/gameStore.svelte.js';
	import { generateCsvFromData, downloadCsv } from '$lib/utils/csv.js';

	function handleDownload() {
		const isAdmin = connection.role === 'admin';
		const csvData = generateCsvFromData(
			{
				periods: game.state.periods,
				players: game.state.players,
				gens: game.state.gens,
				options: game.state.options
			},
			isAdmin,
			connection.participantName
		);
		downloadCsv(csvData);
	}
</script>

<button
	type="button"
	class="btn btn-secondary mb-8"
	onclick={handleDownload}
	aria-label="Download game data as CSV"
>
	<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
		<path
			d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"
		/>
		<path
			d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"
		/>
	</svg>
	Download CSV
</button>
