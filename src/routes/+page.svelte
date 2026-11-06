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
	let tutorialStep = $state(1);
	let tutorialCenterClicks = $state(0);
	let tutorialMarkedNeighbors = $state<number[]>([]);
	let tutorialDragStart = $state<{ x: number; y: number } | null>(null);
	let tutorialDragComplete = $state(false);
	let tutorialCandidate = $state(false);
	let tutorialDeduction = $state(false);
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
	const tutorialFirstComplete = $derived(tutorialCenterClicks === 2 && tutorialMarkedNeighbors.length === 8 && tutorialDragComplete);

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
		tutorialStep = 1;
		tutorialCenterClicks = 0;
		tutorialMarkedNeighbors = [];
		tutorialDragComplete = false;
		tutorialCandidate = false;
		tutorialDeduction = false;
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

	function tutorialCellClass(index: number) {
		if (index === 12) return 'tutorial-queen';
		if ([6, 7, 8, 11, 13, 16, 17, 18].includes(index)) return tutorialMarkedNeighbors.includes(index) ? 'tutorial-marked' : 'tutorial-neighbor';
		if (tutorialDragComplete && (Math.floor(index / 5) === 2 || index % 5 === 2)) return 'tutorial-dragged';
		return '';
	}

	function clickTutorialCell(index: number) {
		if (index === 12 && tutorialCenterClicks < 2) {
			tutorialCenterClicks += 1;
			return;
		}
		if (tutorialCenterClicks === 2 && [6, 7, 8, 11, 13, 16, 17, 18].includes(index) && !tutorialMarkedNeighbors.includes(index)) {
			tutorialMarkedNeighbors = [...tutorialMarkedNeighbors, index];
		}
	}

	function startTutorialDrag(event: PointerEvent) {
		if (tutorialCenterClicks === 2 && tutorialMarkedNeighbors.length === 8) {
			tutorialDragStart = { x: event.clientX, y: event.clientY };
		}
	}

	function moveTutorialDrag(event: PointerEvent) {
		if (!tutorialDragStart || tutorialDragComplete) return;
		if (Math.hypot(event.clientX - tutorialDragStart.x, event.clientY - tutorialDragStart.y) >= 12) tutorialDragComplete = true;
	}

	function tutorialCellText(index: number) {
		if (index === 12) return tutorialCenterClicks === 0 ? '' : tutorialCenterClicks === 1 ? 'X' : 'Q';
		if (tutorialMarkedNeighbors.includes(index) || (tutorialDragComplete && (Math.floor(index / 5) === 2 || index % 5 === 2))) return 'X';
		return '';
	}

	async function uploadBoard(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const parsed = JSON.parse(await file.text());
			const candidates = Array.isArray(parsed.boards) ? parsed.boards : [parsed];
			const puzzles: PuzzleDefinition[] = [];
			for (const candidate of candidates) {
				const result = validateUploadedBoard(candidate);
				if (!result.puzzle) {
					uploadMessage = result.error ?? 'No se pudo validar el tablero.';
					return;
				}
				puzzles.push(result.puzzle);
			}
			const existingIds = new Set(allPuzzles.map((puzzle) => puzzle.id));
			if (puzzles.some((puzzle) => existingIds.has(puzzle.id)) || new Set(puzzles.map((puzzle) => puzzle.id)).size !== puzzles.length) {
				uploadMessage = 'El catalogo contiene un identificador de tablero ya cargado o repetido.';
				return;
			}
			uploadedPuzzles = [...uploadedPuzzles, ...puzzles];
			uploadMessage = `${puzzles.length} tablero(s) cargado(s) solo para esta demostracion.`;
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
			<h2>Bienvenidos a este mini-experimento</h2>
			<p>Consiste en jugar a un juego llamado Queens, disponible en varios lugares, entre ellos LinkedIn. Si ya lo conoces, por favor informa a la persona que te invito a participar.</p>
			<h3>Explicacion</h3>
			<p>El experimento consiste en buscar, en un tablero parecido a uno de ajedrez, nueve reinas ocultas. Se medira cuanto tiempo te demoras en encontrarlas y cuantos movimientos necesitas para hacerlo. Si no lo consigues, se medira cuantas reinas pudiste encontrar.</p>
			<h3>Proteccion de datos</h3>
			<p>Los datos se reportaran de forma completamente anonima. Aunque puedes optar, solo si quieres, a conocer tu lugar en el ranking de jugadores de tu grupo. No sabras los nombres de los demas ni ellos el tuyo.</p>
			<p>Tus datos se almacenaran por el tiempo necesario para realizar los analisis y podrian utilizarse en una extension de este mismo estudio, siempre de forma anonima. Todo dato personal sera desechado en un plazo no mayor a dos anos.</p>
			<h3>Consentimiento</h3>
			<p>El puntaje obtenido solo refleja el desempeno puntual y no pretende medir ningun tipo de inteligencia.</p>
			<p>Al presionar Aceptar, informas que leiste y estas de acuerdo con lo anterior. Luego veras un pequeno tutorial y tres tableros que deberas resolver en 120 segundos.</p>
			<form onsubmit={(event) => { event.preventDefault(); register(); }}>
				<label>Nombre <input bind:value={name} autocomplete="name" required /></label>
				<label>Correo <input bind:value={email} type="email" autocomplete="email" required /></label>
				<button>Aceptar y continuar</button>
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
			<p>Resolveras tres tableros. Cada tarea tendra un limite de 120 segundos.</p>
			{#if sequence.warning}<p class="warning">{sequence.warning}</p>{/if}
			<button onclick={() => screen = 'tutorial'}>Ver tutorial</button>
		</section>
	{:else if screen === 'tutorial'}
		<section class="panel">
			<p class="eyebrow">Tutorial {tutorialStep} de 3</p>
			{#if tutorialStep === 1}
				<h2>Una reina bloquea sus celdas contiguas</h2>
				<p>Debe haber una, y solo una, reina por fila y por columna. Las reinas no pueden estar en celdas contiguas, ni siquiera en diagonal.</p>
				<p>Primero presiona dos veces la celda morada del centro: ahi hay una reina.</p>
				<div class="tutorial-grid five">
					{#each Array.from({ length: 25 }) as _, index}
						<button type="button" class={tutorialCellClass(index)} onclick={() => clickTutorialCell(index)} onpointerdown={startTutorialDrag} onpointermove={moveTutorialDrag} onpointerup={() => tutorialDragStart = null}>{tutorialCellText(index)}</button>
					{/each}
				</div>
				{#if tutorialCenterClicks === 2 && tutorialMarkedNeighbors.length < 8}<p>Ahora marca con X las ocho celdas que rodean a la reina.</p>{/if}
				{#if tutorialCenterClicks === 2 && tutorialMarkedNeighbors.length === 8 && !tutorialDragComplete}<p>Ahora arrastra con el dedo o mouse para marcar una fila y una columna.</p>{/if}
				<button disabled={!tutorialFirstComplete} onclick={() => tutorialStep = 2}>Siguiente</button>
			{:else if tutorialStep === 2}
				<h2>Descartar para encontrar una reina</h2>
				<p>La reina en 1,1 bloquea sus celdas contiguas. Las celdas verdes ya descartadas dejan una unica celda verde disponible: marquela como reina.</p>
				<div class="tutorial-grid three">
					{#each Array.from({ length: 9 }) as _, index}
						<button type="button" class:mini-queen={index === 0} class:mini-marked={[3, 4, 6, 7].includes(index)} class:mini-candidate={index === 8} onclick={() => { if (index === 8) tutorialCandidate = true; }}>{index === 0 ? 'Q' : [3, 4, 6, 7].includes(index) ? 'X' : index === 8 && tutorialCandidate ? 'Q' : ''}</button>
					{/each}
				</div>
				<button disabled={!tutorialCandidate} onclick={() => tutorialStep = 3}>Siguiente</button>
			{:else}
				<h2>Una reina por fila y columna</h2>
				<p>En la fila verde todas las celdas estan marcadas excepto la central: debe haber al menos una reina en cada fila y columna. En la fila inferior, las celdas laterales estan marcadas porque solo puede haber una reina por fila y columna.</p>
				<div class="tutorial-grid five">
					{#each Array.from({ length: 25 }) as _, index}
						{@const row = Math.floor(index / 5)}
						{@const column = index % 5}
						<button type="button" class:mini-row={row === 1} class:mini-marked={(row === 1 && column !== 2) || (row === 3 && (column === 0 || column === 4))} class:mini-candidate={(row === 1 && column === 2) || (row === 3 && column === 2)} onclick={() => { if (row === 1 && column === 2) tutorialDeduction = true; }}>{((row === 1 && column !== 2) || (row === 3 && (column === 0 || column === 4))) ? 'X' : row === 1 && column === 2 && tutorialDeduction ? 'Q' : ''}</button>
					{/each}
				</div>
				<button disabled={!tutorialDeduction} onclick={() => screen = 'prepare'}>Finalizar tutorial</button>
			{/if}
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
