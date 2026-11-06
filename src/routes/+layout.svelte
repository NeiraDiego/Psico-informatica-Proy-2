<script lang="ts">
	import '../styles.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Queens | Psicoinformatica</title>
	<meta name="description" content="Demostracion del experimento Queens" />
</svelte:head>

{@render children()}
