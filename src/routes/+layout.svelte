<script lang="ts">
	import '../styles.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Queens | Psicoinformatica</title>
	<meta name="description" content="Experimento Queens de psicoinformática" />
</svelte:head>

{@render children()}
