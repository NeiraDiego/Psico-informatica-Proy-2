<script lang="ts">
	import { onMount } from 'svelte';
	import QueensBoard from '$lib/components/QueensBoard.svelte';
	import { flushAttemptOutbox, queueAttempt, queuedAttempts } from '$lib/client/outbox';
	import { validateUploadedBoard } from '$lib/domain/board-validation';
	import { isSolved } from '$lib/domain/queens-rules';
	import { addMovement, completeAttempt, createAttempt, type AttemptDraft, type CompletedAttempt } from '$lib/experiment/measurement';
	import { DEMO_ADMIN_EMAIL, demoPuzzles, demoSequences, getPuzzle, pickDemoGroup } from '$lib/protocol/demo';
	import type { BoardDefinition, BoardMovement, CellState, Group, PuzzleDefinition } from '$lib/domain/types';

	type Screen = 'register' | 'hub' | 'overview' | 'tutorial' | 'prepare' | 'puzzle' | 'transition' | 'complete' | 'free-play' | 'settings';

	let screen = $state<Screen>('register');
	let name = $state('');
	let email = $state('');
	let returning = $state(false);
	let group = $state<Group>('A');
	let puzzlePosition = $state(0);
	let tutorialStep = $state(1);
	let tutorialMarkedNeighbors = $state<number[]>([]);
	let tutorialDragComplete = $state(false);
	let moveCount = $state(0);
	let activeAttempt = $state<AttemptDraft | null>(null);
	let completedAttempts = $state<CompletedAttempt[]>([]);
	let puzzleLocked = $state(false);
	let timeRemainingMs = $state(120000);
	let deliveryStatus = $state<'idle' | 'pending' | 'sent'>('idle');
	let sessionRegistrationStatus = $state<'idle' | 'pending' | 'ready'>('idle');
	let exportMessage = $state('');
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
	const tutorialFirstComplete = $derived(tutorialMarkedNeighbors.length === 8 && tutorialDragComplete);
	const tutorialBoards: Array<{ board: BoardDefinition; queenRowsByColumn: Array<number | undefined> }> = [
		{
			board: { id: 'tutorial-marcado', label: 'Tutorial: marcado', regions: [['A', 'A', 'D', 'A', 'A'], ['A', 'C', 'C', 'C', 'A'], ['D', 'C', 'B', 'C', 'D'], ['A', 'C', 'C', 'C', 'A'], ['A', 'A', 'D', 'A', 'A']] },
			queenRowsByColumn: [undefined, undefined, 2, undefined, undefined]
		},
		{
			board: { id: 'tutorial-descarte', label: 'Tutorial: descarte', regions: [['A', 'B', 'B', 'B', 'B'], ['C', 'C', 'B', 'C', 'C'], ['D', 'D', 'D', 'D', 'C'], ['E', 'D', 'E', 'E', 'E'], ['F', 'F', 'F', 'E', 'F']] },
			queenRowsByColumn: [0, 3, 1, 4, 2]
		},
		{
			board: { id: 'tutorial-filas-columnas', label: 'Tutorial: filas y columnas', regions: [['A', 'A', 'A', 'A', 'A'], ['A', 'A', 'C', 'A', 'A'], ['A', 'A', 'A', 'A', 'A'], ['A', 'C', 'C', 'C', 'A'], ['A', 'A', 'A', 'A', 'A']] },
			queenRowsByColumn: [undefined, 3, 1, undefined, undefined]
		}
	];

	function tutorialInitialCells(queenRowsByColumn: Array<number | undefined>): CellState[] {
		const size = queenRowsByColumn.length;
		const cells = Array.from({ length: size ** 2 }, () => 'empty' as CellState);
		queenRowsByColumn.forEach((row, column) => {
			if (row !== undefined) cells[row * size + column] = 'queen';
		});
		return cells;
	}

	const tutorialInitialStates = tutorialBoards.map((tutorial) => tutorialInitialCells(tutorial.queenRowsByColumn));

	onMount(() => {
		const stored = localStorage.getItem('queens-demo-emails');
		if (stored) {
			try {
				JSON.parse(stored);
			} catch {
				localStorage.removeItem('queens-demo-emails');
			}
		}
		void flushSavedAttempts();
		const retry = () => void flushSavedAttempts();
		window.addEventListener('online', retry);
		return () => window.removeEventListener('online', retry);
	});

	$effect(() => {
		if (screen !== 'puzzle' || !activeAttempt || puzzleLocked) return;
		const updateRemainingTime = () => {
			const remaining = Math.max(0, 120000 - (performance.now() - activeAttempt!.started_at_performance));
			timeRemainingMs = Math.ceil(remaining);
			if (remaining === 0) closeCurrentAttempt('timeout');
		};
		updateRemainingTime();
		const intervalId = window.setInterval(updateRemainingTime, 100);
		return () => window.clearInterval(intervalId);
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

	async function register() {
		const normalized = email.trim().toLowerCase();
		if (!name.trim() || !/^\S+@\S+\.\S+$/.test(normalized)) return;
		returning = hasKnownEmail(normalized);
		if (!returning) {
			const stored = localStorage.getItem('queens-demo-emails');
			const emails = stored ? (JSON.parse(stored) as string[]) : [];
			localStorage.setItem('queens-demo-emails', JSON.stringify([...new Set([...emails, normalized])]));
		}
		email = normalized;
		if (!returning) {
			sessionRegistrationStatus = 'pending';
			const serverGroup = await registerServerSession(name.trim(), normalized);
			group = serverGroup ?? pickDemoGroup();
			sessionRegistrationStatus = serverGroup ? 'ready' : 'idle';
		}
		screen = returning ? 'hub' : 'overview';
	}

	async function registerServerSession(participantName: string, participantEmail: string): Promise<Group | null> {
		const keyName = `queens-session-key:${participantEmail}`;
		let idempotencyKey = localStorage.getItem(keyName);
		if (!idempotencyKey) {
			idempotencyKey = crypto.randomUUID();
			localStorage.setItem(keyName, idempotencyKey);
		}
		try {
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: participantName, email: participantEmail, idempotency_key: idempotencyKey }),
				credentials: 'same-origin'
			});
			if (!response.ok) return null;
			const body = await response.json() as { group?: unknown };
			return body.group === 'A' || body.group === 'B' || body.group === 'C' ? body.group : null;
		} catch {
			return null;
		}
	}

	function beginExperiment() {
		group = pickDemoGroup();
		puzzlePosition = 0;
		moveCount = 0;
		tutorialStep = 1;
		tutorialMarkedNeighbors = [];
		tutorialDragComplete = false;
		screen = 'overview';
	}

	function openPuzzle() {
		moveCount = 0;
		const startedAt = performance.now();
		activeAttempt = createAttempt(activePuzzle, puzzlePosition + 1, startedAt, 120000);
		timeRemainingMs = 120000;
		puzzleLocked = false;
		screen = 'puzzle';
	}

	function closeCurrentAttempt(outcome: 'solved' | 'timeout' | 'interrupted') {
		if (!activeAttempt || puzzleLocked) return;
		puzzleLocked = true;
		const completed = completeAttempt(activeAttempt, outcome, performance.now(), outcome === 'solved');
		completedAttempts = [...completedAttempts, completed];
		void saveAttempt(completed);
		activeAttempt = null;
		if (puzzlePosition === 2) {
			screen = 'complete';
		} else {
			puzzlePosition += 1;
			screen = 'transition';
		}
	}

	function recordExperimentalMovement(movement: BoardMovement) {
		if (!activeAttempt || puzzleLocked) return;
		const recorded = addMovement(activeAttempt, movement);
		if (recorded) {
			moveCount = activeAttempt.movements.length;
			if (isSolved(activeAttempt.final_board, activePuzzle)) closeCurrentAttempt('solved');
		}
	}

	function formatTime(milliseconds: number) {
		const totalSeconds = Math.ceil(milliseconds / 1000);
		return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
	}

	async function saveAttempt(attempt: CompletedAttempt) {
		deliveryStatus = 'pending';
		await queueAttempt(attempt);
		await flushSavedAttempts();
	}

	async function flushSavedAttempts() {
		try {
			const result = await flushAttemptOutbox();
			deliveryStatus = result.pending === 0 ? 'sent' : 'pending';
		} catch {
			deliveryStatus = 'pending';
		}
	}

	function escapeCsv(value: unknown) {
		const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
		return `"${text.replaceAll('"', '""')}"`;
	}

	function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
		const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function exportPendingAttempts() {
		const attempts = await queuedAttempts();
		if (!attempts.length) {
			exportMessage = 'No hay intentos pendientes en este navegador.';
			return;
		}
		downloadCsv('queens-intentos-pendientes.csv', ['client_attempt_id', 'puzzle_id', 'puzzle_version', 'position', 'is_primary_outcome', 'started_at_client', 'ended_at_client', 'duration_ms', 'time_limit_ms', 'outcome', 'success', 'total_moves', 'movement_latencies_ms', 'final_board'], attempts.map((attempt) => [attempt.client_attempt_id, attempt.puzzle_id, attempt.puzzle_version, attempt.position, attempt.is_primary_outcome, attempt.started_at_client, attempt.ended_at_client, attempt.duration_ms, attempt.time_limit_ms, attempt.outcome, attempt.success, attempt.total_moves, attempt.movement_latencies_ms, attempt.final_board]));
		exportMessage = `Se descargaron ${attempts.length} intentos pendientes.`;
	}

	async function exportPendingMovements() {
		const attempts = await queuedAttempts();
		const movements = attempts.flatMap((attempt) => attempt.movements.map((movement) => [attempt.client_attempt_id, movement.index, movement.type, movement.started_at_ms, movement.ended_at_ms, movement.duration_ms, movement.latency_ms, movement.changes, movement.closure]));
		if (!movements.length) {
			exportMessage = 'No hay movimientos pendientes en este navegador.';
			return;
		}
		downloadCsv('queens-movimientos-pendientes.csv', ['client_attempt_id', 'index', 'type', 'started_at_ms', 'ended_at_ms', 'duration_ms', 'latency_ms', 'changes', 'closure'], movements);
		exportMessage = `Se descargaron ${movements.length} movimientos pendientes.`;
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

	function tutorialCellClass(index: number, state: CellState) {
		if (index === 12) return 'tutorial-queen';
		if ([6, 7, 8, 11, 13, 16, 17, 18].includes(index)) return state === 'mark' ? 'tutorial-marked' : 'tutorial-neighbor';
		return '';
	}

	function trackTutorialFirstMovement(movement: BoardMovement) {
		for (const change of movement.changes) {
			if ([6, 7, 8, 11, 13, 16, 17, 18].includes(change.index)) {
				tutorialMarkedNeighbors = change.next === 'mark'
					? [...new Set([...tutorialMarkedNeighbors, change.index])]
					: tutorialMarkedNeighbors.filter((index) => index !== change.index);
			}
		}
		if (movement.type === 'drag' && tutorialMarkedNeighbors.length === 8 && movement.changes.length > 0) {
			tutorialDragComplete = true;
		}
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
			{#if sessionRegistrationStatus === 'idle'}<p class="notice">La sesion quedo pendiente de registro en el servidor. Los intentos se conservaran localmente hasta poder enviarse.</p>{/if}
			{#if sequence.warning}<p class="warning">{sequence.warning}</p>{/if}
			<button onclick={() => screen = 'tutorial'}>Ver tutorial</button>
		</section>
	{:else if screen === 'tutorial'}
		<section class="panel">
			<p class="eyebrow">Tutorial {tutorialStep} de 3</p>
			{#if tutorialStep === 1}
				<h2>Una reina bloquea sus celdas contiguas</h2>
				<p>Debe haber una, y solo una, reina por fila y por columna. Las reinas no pueden estar en celdas contiguas, ni siquiera en diagonal.</p>
				<p>La reina morada ya esta indicada. Marca con X las ocho celdas que la rodean y luego arrastra para practicar el gesto de marcado.</p>
				<QueensBoard board={tutorialBoards[0].board} initialCells={tutorialInitialStates[0]} cellClass={tutorialCellClass} onmove={trackTutorialFirstMovement} />
				{#if tutorialMarkedNeighbors.length === 8 && !tutorialDragComplete}<p>Ahora arrastra con el dedo o mouse sobre celdas vacias para practicar el gesto de marcado.</p>{/if}
				<button disabled={!tutorialFirstComplete} onclick={() => tutorialStep = 2}>Siguiente</button>
			{:else if tutorialStep === 2}
				<h2>Descartar para encontrar una reina</h2>
				<p>Los colores representan regiones. Observa como las cinco reinas indicadas ocupan filas, columnas y regiones diferentes, sin tocarse entre si.</p>
				<QueensBoard board={tutorialBoards[1].board} initialCells={tutorialInitialStates[1]} disabled />
				<button onclick={() => tutorialStep = 3}>Siguiente</button>
			{:else}
				<h2>Una reina por fila y columna</h2>
				<p>Las referencias moradas muestran celdas que debes considerar al descartar opciones por fila, columna, region y contacto diagonal. Una referencia parcial no es una solucion completa.</p>
				<QueensBoard board={tutorialBoards[2].board} initialCells={tutorialInitialStates[2]} disabled />
				<button onclick={() => screen = 'prepare'}>Finalizar tutorial</button>
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
			<div class="game-meta"><span>Tarea {puzzlePosition + 1} de 3</span><span>Movimientos: {moveCount}</span><span>Tiempo restante: {formatTime(timeRemainingMs)}</span></div>
			<QueensBoard board={activePuzzle} disabled={puzzleLocked} onmove={recordExperimentalMovement} />
			<button onclick={() => closeCurrentAttempt('interrupted')} disabled={puzzleLocked}>Finalizar intento</button>
		</section>
	{:else if screen === 'complete'}
		<section class="panel">
			<h2>Demostracion finalizada</h2>
			<p>{deliveryStatus === 'sent' ? 'Resultados enviados.' : 'Resultados guardados localmente y pendientes de envio.'}</p>
			<p>Se registraron {completedAttempts.length} intentos. El cierre, consentimiento y explicacion final son borradores.</p>
			<div class="actions"><button onclick={() => screen = 'hub'}>Opciones de regreso</button>{#if isDemoAdmin}<button class="secondary" onclick={() => screen = 'settings'}>Configuracion</button>{/if}</div>
		</section>
	{:else if screen === 'free-play'}
		<section class="game-layout">
			<div class="game-meta"><span>Juego libre</span><span>Movimientos: {freeMoves}</span><span>Sin limite temporal</span></div>
			<QueensBoard board={freePuzzle} onmove={() => freeMoves += 1} />
			<button onclick={stopFreePlay}>Terminar juego libre</button>
		</section>
	{:else if screen === 'settings'}
		<section class="panel">
			<h2>Configuracion de demostracion</h2>
			<p>Vista reservada al correo autorizado. La autorizacion real se resolvera en servidor mediante <code>ADMIN_EMAILS</code>. Los cambios de esta pantalla solo viven mientras esta pagina permanezca abierta.</p>
			<h3>Tableros publicados</h3>
			<ul>{#each allPuzzles as puzzle}<li>{puzzle.label}: {puzzle.availability}, {puzzle.status}</li>{/each}</ul>
			<h3>Subir tablero JSON</h3>
			<p>Seleccione un archivo con <code>id</code>, <code>label</code>, <code>availability</code>, <code>regions</code> y <code>queenRowsByColumn</code>. Juego libre admite matrices cuadradas; los tableros experimentales siguen siendo exclusivamente de 9 por 9.</p>
			<input type="file" accept="application/json,.json" onchange={uploadBoard} />
			{#if uploadMessage}<p class="upload-message">{uploadMessage}</p>{/if}
			<h3>Respaldo local</h3>
			<p>Descarga los registros que siguen pendientes en este navegador. Los archivos no incluyen nombre ni correo.</p>
			<div class="actions"><button class="secondary" onclick={exportPendingAttempts}>Descargar intentos CSV</button><button class="secondary" onclick={exportPendingMovements}>Descargar movimientos CSV</button></div>
			{#if exportMessage}<p class="upload-message">{exportMessage}</p>{/if}
			<button onclick={() => screen = 'hub'}>Volver</button>
		</section>
	{/if}
</main>
