<script lang="ts">
	import { onMount } from 'svelte';
	import QueensBoard from '$lib/components/QueensBoard.svelte';
	import { validateUploadedBoard } from '$lib/domain/board-validation';
	import { DEMO_ADMIN_EMAIL, demoPuzzles, demoSequences, getPuzzle, pickDemoGroup } from '$lib/protocol/demo';
	import type { Group, PuzzleDefinition } from '$lib/domain/types';

	type Screen = 'register' | 'hub' | 'overview' | 'tutorial' | 'prepare' | 'puzzle' | 'transition' | 'complete' | 'free-play' | 'settings';

	let screen = $state<Screen>('register');
	let name = $state('');
	let email = $state('');
	let returning = $state(false);
	let group = $state<Group>('A');
	let puzzlePosition = $state(0);
	let tutorialQueen = $state(false);
	let tutorialMark = $state(false);
	let moveCount = $state(0);
	let freePuzzle = $state<PuzzleDefinition>(demoPuzzles[1]);
	let freeStartedAt = $state(0);
	let freeMoves = $state(0);
	let elapsedMs = $state(0);
	let uploadedPuzzles = $state<PuzzleDefinition[]>([]);
	let uploadMessage = $state('');

	const isDemoAdmin = $derived(email.trim().toLowerCase() === DEMO_ADMIN_EMAIL);
	const allPuzzles = $derived([...demoPuzzles, ...uploadedPuzzles]);
	const sequence = $derived(demoSequences[group]);
	const activePuzzle = $derived(getPuzzle(sequence.puzzleIds[puzzlePosition]));

	onMount(() => {
		const stored = localStorage.getItem('queens-demo-emails');
		if (stored) {
			try {
				JSON.parse(stored);
			} catch {
				localStorage.removeItem('queens-demo-emails');
			}
		}
	});

	function hasKnownEmail(value: string) {
		const stored = localStorage.getItem('queens-demo-emails');
		if (!stored) return false;
		try {
			return (JSON.parse(stored) as string[]).includes(value);
		} catch {
			return false;
		}
	}

	function register() {
		const normalized = email.trim().toLowerCase();
		if (!name.trim() || !/^\S+@\S+\.\S+$/.test(normalized)) return;
		returning = hasKnownEmail(normalized);
		if (!returning) {
			const stored = localStorage.getItem('queens-demo-emails');
			const emails = stored ? (JSON.parse(stored) as string[]) : [];
			localStorage.setItem('queens-demo-emails', JSON.stringify([...new Set([...emails, normalized])]));
		}
		email = normalized;
		screen = returning ? 'hub' : 'overview';
	}

	function beginExperiment() {
		group = pickDemoGroup();
		puzzlePosition = 0;
		moveCount = 0;
		tutorialQueen = false;
		tutorialMark = false;
		screen = 'overview';
	}

	function openPuzzle() {
		moveCount = 0;
		screen = 'puzzle';
	}

	function finishPuzzle() {
		if (puzzlePosition === 2) {
			screen = 'complete';
		} else {
			puzzlePosition += 1;
			screen = 'transition';
		}
	}

	function openFreePlay() {
		const available = allPuzzles.filter((puzzle) => puzzle.availability === 'free_play' || puzzle.availability === 'both');
		freePuzzle = available[Math.floor(Math.random() * available.length)];
		freeMoves = 0;
		freeStartedAt = performance.now();
		elapsedMs = 0;
		screen = 'free-play';
	}

	function stopFreePlay() {
		elapsedMs = Math.round(performance.now() - freeStartedAt);
		screen = 'hub';
	}

	async function uploadBoard(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const result = validateUploadedBoard(JSON.parse(await file.text()));
			if (!result.puzzle) {
				uploadMessage = result.error ?? 'No se pudo validar el tablero.';
				return;
			}
			if (allPuzzles.some((puzzle) => puzzle.id === result.puzzle?.id)) {
				uploadMessage = 'Ya existe un tablero con ese identificador.';
				return;
			}
			uploadedPuzzles = [...uploadedPuzzles, result.puzzle];
			uploadMessage = `Tablero "${result.puzzle.label}" cargado solo para esta demostracion.`;
		} catch {
			uploadMessage = 'El archivo debe ser JSON valido.';
		} finally {
			input.value = '';
		}
	}
</script>

<main>
	<header>
		<p class="eyebrow">Psicoinformatica · Queens</p>
		<h1>Demostracion estructural</h1>
		<p class="notice">Esta version usa textos, tableros y registros sinteticos. No esta habilitada para recoleccion.</p>
	</header>

	{#if screen === 'register'}
		<section class="panel">
			<h2>Registro de demostracion</h2>
			<p>Ingrese datos de prueba para recorrer el flujo. El correo se recuerda solo en este navegador para mostrar el acceso de regreso.</p>
			<form onsubmit={(event) => { event.preventDefault(); register(); }}>
				<label>Nombre <input bind:value={name} autocomplete="name" required /></label>
				<label>Correo <input bind:value={email} type="email" autocomplete="email" required /></label>
				<button>Continuar</button>
			</form>
		</section>
	{:else if screen === 'hub'}
		<section class="panel">
			<h2>Bienvenida de regreso</h2>
			<p>Puede iniciar una nueva demostracion experimental o jugar sin limite temporal. No se muestran intentos anteriores.</p>
			<div class="actions">
				<button onclick={beginExperiment}>Iniciar experimento</button>
				<button class="secondary" onclick={openFreePlay}>Juego libre</button>
				{#if isDemoAdmin}<button class="secondary" onclick={() => screen = 'settings'}>Configuracion</button>{/if}
			</div>
		</section>
	{:else if screen === 'overview'}
		<section class="panel">
			<h2>Informacion general</h2>
			<p>Resolvera tres tableros. Cada tarea tendra un limite de 120 segundos en la version experimental definitiva.</p>
			{#if sequence.warning}<p class="warning">{sequence.warning}</p>{/if}
			<button onclick={() => screen = 'tutorial'}>Ver tutorial</button>
		</section>
	{:else if screen === 'tutorial'}
		<section class="panel">
			<h2>Tutorial interactivo</h2>
			<p>Las reglas y gestos definitivos se implementaran despues. Para continuar, confirme ambos controles.</p>
			<div class="actions">
				<button class:secondary={tutorialQueen} onclick={() => tutorialQueen = true}>{tutorialQueen ? 'Reina colocada' : 'Colocar reina'}</button>
				<button class:secondary={tutorialMark} onclick={() => tutorialMark = true}>{tutorialMark ? 'Arrastre comprobado' : 'Simular arrastre de X'}</button>
			</div>
			<button disabled={!tutorialQueen || !tutorialMark} onclick={() => screen = 'prepare'}>Continuar</button>
		</section>
	{:else if screen === 'prepare' || screen === 'transition'}
		<section class="panel">
			<h2>Preparacion de tarea</h2>
			<p>El tablero esta cargado. El temporizador no empezara hasta pulsar iniciar.</p>
			<button onclick={openPuzzle}>Iniciar tarea {puzzlePosition + 1}</button>
		</section>
	{:else if screen === 'puzzle'}
		<section class="game-layout">
			<div class="game-meta"><span>Tarea {puzzlePosition + 1} de 3</span><span>Movimientos: {moveCount}</span><span>Tiempo demo: sin limite</span></div>
			<QueensBoard puzzle={activePuzzle} onmove={() => moveCount += 1} />
			<button onclick={finishPuzzle}>Finalizar tarea de demostracion</button>
		</section>
	{:else if screen === 'complete'}
		<section class="panel">
			<h2>Demostracion finalizada</h2>
			<p>En esta entrega no se envio ningun resultado. El cierre, consentimiento y explicacion final son borradores.</p>
			<div class="actions"><button onclick={() => screen = 'hub'}>Opciones de regreso</button>{#if isDemoAdmin}<button class="secondary" onclick={() => screen = 'settings'}>Configuracion</button>{/if}</div>
		</section>
	{:else if screen === 'free-play'}
		<section class="game-layout">
			<div class="game-meta"><span>Juego libre</span><span>Movimientos: {freeMoves}</span><span>Sin limite temporal</span></div>
			<QueensBoard puzzle={freePuzzle} onmove={() => freeMoves += 1} />
			<button onclick={stopFreePlay}>Terminar juego libre</button>
		</section>
	{:else if screen === 'settings'}
		<section class="panel">
			<h2>Configuracion de demostracion</h2>
			<p>Vista reservada al correo autorizado. La autorizacion real se resolvera en servidor mediante <code>ADMIN_EMAILS</code>. Los cambios de esta pantalla solo viven mientras esta pagina permanezca abierta.</p>
			<h3>Tableros publicados</h3>
			<ul>{#each allPuzzles as puzzle}<li>{puzzle.label}: {puzzle.availability}, {puzzle.status}</li>{/each}</ul>
			<h3>Subir tablero JSON</h3>
			<p>Seleccione un archivo con <code>id</code>, <code>label</code>, <code>availability</code>, <code>regions</code> y <code>queenRowsByColumn</code>. Se comprueban nueve regiones A-I conexas y una posicion valida para las nueve reinas.</p>
			<input type="file" accept="application/json,.json" onchange={uploadBoard} />
			{#if uploadMessage}<p class="upload-message">{uploadMessage}</p>{/if}
			<button onclick={() => screen = 'hub'}>Volver</button>
		</section>
	{/if}
</main>
