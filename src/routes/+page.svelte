<script lang="ts">
	import { onMount } from 'svelte';
	import QueensBoard from '$lib/components/QueensBoard.svelte';
	import { flushAttemptOutbox, queueAttempt, queuedAttempts } from '$lib/client/outbox';
	import { validateUploadedBoard } from '$lib/domain/board-validation';
	import { isSolved } from '$lib/domain/queens-rules';
	import { addMovement, completeAttempt, createAttempt, type AttemptDraft, type CompletedAttempt } from '$lib/experiment/measurement';
	import { AUTHORIZED_EMAILS, demoPuzzles, getPuzzle, groupCWarning, pickDemoGroup } from '$lib/protocol/demo';
	import type { BoardDefinition, BoardMovement, CellState, Group, PuzzleDefinition, PuzzleDifficulty } from '$lib/domain/types';

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
	let tutorialTwoCells = $state<CellState[]>(Array.from({ length: 25 }, () => 'empty'));
	let tutorialThreeCells = $state<CellState[]>(Array.from({ length: 25 }, () => 'empty'));
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
	let showBoardCatalog = $state(false);
	let participantName = $state('');
	let additionalInfoGroups = $state<Record<Group, boolean>>({ A: false, B: false, C: true, D: false, E: false });
	let freePlayDifficulty = $state<PuzzleDifficulty | null>(null);
	let experimentConfig = $state({
		puzzleCount: 3,
		assignments: {
			A: ['queensgame-16', 'queensgame-22', 'queensgame-47'],
			B: ['queensgame-58', 'queensgame-60', 'queensgame-47'],
			C: ['queensgame-58', 'queensgame-60', 'queensgame-47'],
			D: ['queensgame-16', 'queensgame-22', 'queensgame-47'],
			E: ['queensgame-16', 'queensgame-22', 'queensgame-47']
		} as Record<Group, string[]>
	});

	const isDemoAdmin = $derived(AUTHORIZED_EMAILS.includes(email.trim().toLowerCase()));
	const allPuzzles = $derived([...demoPuzzles, ...uploadedPuzzles]);
	const activeGroups: Group[] = ['A', 'B', 'C'];
	const activePuzzle = $derived(getPuzzle(experimentConfig.assignments[group][puzzlePosition]));
	const difficultyOptions: Array<{ value: PuzzleDifficulty; label: string }> = [{ value: 'easy', label: 'Fácil' }, { value: 'medium', label: 'Medio' }, { value: 'hard', label: 'Difícil' }, { value: 'expert', label: 'Experto' }];
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
			board: { id: 'tutorial-filas-columnas', label: 'Tutorial: filas y columnas', regions: [['A', 'A', 'A', 'A', 'A'], ['A', 'A', 'C', 'A', 'A'], ['B', 'B', 'B', 'B', 'B'], ['B', 'D', 'D', 'D', 'E'], ['E', 'E', 'E', 'E', 'E']] },
			queenRowsByColumn: [0, 3, 1, 4, 2]
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
	const tutorialTwoInitialCells: CellState[] = Array.from({ length: 25 }, () => 'empty');
	const tutorialThreeInitialCells: CellState[] = Array.from({ length: 25 }, () => 'empty');
	const tutorialTwoQueenCells = [0, 7, 14, 16, 23];
	const tutorialTwoProgress = $derived(tutorialTwoQueenCells.filter((queenIndex) => {
		const row = Math.floor(queenIndex / 5);
		return tutorialTwoCells[queenIndex] === 'queen' && Array.from({ length: 5 }, (_, column) => row * 5 + column).every((index) => index === queenIndex || tutorialTwoCells[index] === 'mark');
	}).length);
	const tutorialTwoComplete = $derived(tutorialTwoProgress === tutorialTwoQueenCells.length);
	const tutorialThreeOrangeCells = [5, 6, 8, 9];
	const tutorialThreeOrangeMarked = $derived(tutorialThreeOrangeCells.every((index) => tutorialThreeCells[index] === 'mark'));
	const tutorialThreeGreenQueen = $derived(tutorialThreeCells[7] === 'queen');
	const tutorialThreeEdgeCells = [15, 19];
	const tutorialThreeComplete = $derived(tutorialThreeOrangeMarked && tutorialThreeGreenQueen && tutorialThreeEdgeCells.every((index) => tutorialThreeCells[index] === 'mark'));

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
			const serverGroup = await registerServerSession(name.trim(), normalized, participantName.trim() || null);
			group = serverGroup ?? pickDemoGroup();
			localStorage.setItem(`queens-assigned-group:${normalized}`, group);
			sessionRegistrationStatus = serverGroup ? 'ready' : 'idle';
		} else {
			const savedGroup = localStorage.getItem(`queens-assigned-group:${normalized}`);
			if (savedGroup === 'A' || savedGroup === 'B' || savedGroup === 'C' || savedGroup === 'D' || savedGroup === 'E') group = savedGroup;
		}
		screen = returning ? 'hub' : 'overview';
	}

	async function registerServerSession(experimenterName: string, experimenterEmail: string, registeredParticipantName: string | null): Promise<Group | null> {
		const keyName = `queens-session-key:${experimenterEmail}`;
		let idempotencyKey = localStorage.getItem(keyName);
		if (!idempotencyKey) {
			idempotencyKey = crypto.randomUUID();
			localStorage.setItem(keyName, idempotencyKey);
		}
		try {
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: experimenterName, email: experimenterEmail, participant_name: registeredParticipantName, idempotency_key: idempotencyKey }),
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
		if (!activeGroups.includes(group)) group = pickDemoGroup();
		puzzlePosition = 0;
		moveCount = 0;
		tutorialStep = 1;
		tutorialMarkedNeighbors = [];
		tutorialDragComplete = false;
		tutorialTwoCells = Array.from({ length: 25 }, () => 'empty');
		tutorialThreeCells = Array.from({ length: 25 }, () => 'empty');
		screen = 'overview';
	}

	function changeUser() {
		name = '';
		email = '';
		returning = false;
		sessionRegistrationStatus = 'idle';
		screen = 'register';
	}

	function openPuzzle() {
		moveCount = 0;
		const startedAt = performance.now();
		activeAttempt = createAttempt(activePuzzle, puzzlePosition + 1, startedAt, 120000, puzzlePosition + 1 === experimentConfig.puzzleCount);
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
		if (puzzlePosition === experimentConfig.puzzleCount - 1) {
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

	function resizeExperiment(puzzleCount: number) {
		experimentConfig.puzzleCount = puzzleCount;
		const fallbackPuzzleId = allPuzzles[0]?.id ?? '';
		for (const groupCode of activeGroups) {
			const assignments = experimentConfig.assignments[groupCode];
			while (assignments.length < puzzleCount) assignments.push(fallbackPuzzleId);
			experimentConfig.assignments[groupCode] = assignments.slice(0, puzzleCount);
		}
	}

	function assignPuzzle(groupCode: Group, position: number, puzzleId: string) {
		experimentConfig.assignments[groupCode][position] = puzzleId;
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

	function exportCurrentAttempts() {
		if (!completedAttempts.length) {
			exportMessage = 'No hay intentos de la sesión actual para descargar.';
			return;
		}
		downloadCsv('queens-sesion-actual-intentos.csv', ['client_attempt_id', 'puzzle_id', 'puzzle_version', 'position', 'is_primary_outcome', 'started_at_client', 'ended_at_client', 'duration_ms', 'time_limit_ms', 'outcome', 'success', 'total_moves', 'movement_latencies_ms', 'final_board'], completedAttempts.map((attempt) => [attempt.client_attempt_id, attempt.puzzle_id, attempt.puzzle_version, attempt.position, attempt.is_primary_outcome, attempt.started_at_client, attempt.ended_at_client, attempt.duration_ms, attempt.time_limit_ms, attempt.outcome, attempt.success, attempt.total_moves, attempt.movement_latencies_ms, attempt.final_board]));
		exportMessage = `Se descargaron ${completedAttempts.length} intentos de la sesión actual.`;
	}

	function exportCurrentMovements() {
		const movements = completedAttempts.flatMap((attempt) => attempt.movements.map((movement) => [attempt.client_attempt_id, movement.index, movement.type, movement.started_at_ms, movement.ended_at_ms, movement.duration_ms, movement.latency_ms, movement.changes, movement.closure]));
		if (!movements.length) {
			exportMessage = 'No hay movimientos de la sesión actual para descargar.';
			return;
		}
		downloadCsv('queens-sesion-actual-movimientos.csv', ['client_attempt_id', 'index', 'type', 'started_at_ms', 'ended_at_ms', 'duration_ms', 'latency_ms', 'changes', 'closure'], movements);
		exportMessage = `Se descargaron ${movements.length} movimientos de la sesión actual.`;
	}

	function freePlayPuzzles(difficulty: PuzzleDifficulty | null) {
		return allPuzzles.filter((puzzle) => (puzzle.availability === 'free_play' || puzzle.availability === 'both') && (!difficulty || puzzle.difficulty === difficulty));
	}

	function openFreePlay(difficulty: PuzzleDifficulty | null = null) {
		const available = freePlayPuzzles(difficulty);
		if (!available.length) return;
		freePuzzle = available[Math.floor(Math.random() * available.length)];
		freePlayDifficulty = difficulty;
		freeMoves = 0;
		freeStartedAt = performance.now();
		elapsedMs = 0;
		screen = 'free-play';
	}

	function stopFreePlay() {
		elapsedMs = Math.round(performance.now() - freeStartedAt);
		screen = 'hub';
	}

	function hasFreePlayPuzzle(difficulty: PuzzleDifficulty) {
		return freePlayPuzzles(difficulty).length > 0;
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

	function trackTutorialTwoMovement(movement: BoardMovement) {
		for (const change of movement.changes) tutorialTwoCells[change.index] = change.next;
	}

	function trackTutorialThreeMovement(movement: BoardMovement) {
		for (const change of movement.changes) tutorialThreeCells[change.index] = change.next;
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
				uploadMessage = 'El catálogo contiene un identificador de tablero ya cargado o repetido.';
				return;
			}
			uploadedPuzzles = [...uploadedPuzzles, ...puzzles];
			uploadMessage = `${puzzles.length} tablero(s) cargado(s) para esta sesión.`;
		} catch {
			uploadMessage = 'El archivo debe ser JSON válido.';
		} finally {
			input.value = '';
		}
	}
</script>

<main>
	<header>
		<p class="eyebrow">Psicoinformática · Queens</p>
	</header>

	{#if screen === 'register'}
		<section class="panel">
			<h2>Bienvenidos a este mini-experimento</h2>
			<p>Consiste en jugar a un juego llamado Queens, disponible en varios lugares, entre ellos LinkedIn. Si ya lo conoces, por favor informa a la persona que te invito a participar.</p>
			<h3>Explicación</h3>
			<p>El experimento consiste en buscar, en un tablero parecido a uno de ajedrez, reinas ocultas. Se medirá cuánto tiempo te demoras en encontrarlas y cuántos movimientos necesitas para hacerlo. Si no lo consigues, se medirá cuántas reinas pudiste encontrar.</p>
			<h3>Protección de datos</h3>
			<p>Los datos se reportarán de forma completamente anónima. Aunque puedes optar, solo si quieres, a conocer tu lugar en el ranking de jugadores de tu grupo. No sabrás los nombres de los demás ni ellos el tuyo.</p>
			<p>Tus datos se almacenarán por el tiempo necesario para realizar los análisis y podrían utilizarse en una extensión de este mismo estudio, siempre de forma anónima. Todo dato personal será desechado en un plazo no mayor a dos años.</p>
			<h3>Consentimiento</h3>
			<p>El puntaje obtenido solo refleja el desempeño puntual y no pretende medir ningún tipo de inteligencia.</p>
			<p>Al presionar Aceptar, informas que leíste y estás de acuerdo con lo anterior. Luego verás un pequeño tutorial y tres tableros que deberás resolver en 120 segundos.</p>
			<form onsubmit={(event) => { event.preventDefault(); register(); }}>
				<label>Nombre <input bind:value={name} autocomplete="name" required /></label>
				<label>Correo electrónico <input bind:value={email} type="email" autocomplete="email" required /></label>
				<button>Aceptar y continuar</button>
			</form>
		</section>
	{:else if screen === 'hub'}
		<section class="panel">
			<h2>Bienvenida de regreso</h2>
			<p>Puedes iniciar un nuevo experimento o jugar sin límite temporal. No se muestran intentos anteriores.</p>
			<div class="actions">
				<button onclick={beginExperiment}>Iniciar experimento</button>
				<button class="secondary" onclick={() => openFreePlay()}>Juego libre</button>
				<button class="secondary" onclick={changeUser}>Cambiar de usuario</button>
				{#if isDemoAdmin}<button class="secondary" onclick={() => screen = 'settings'}>Configuración</button>{/if}
			</div>
		</section>
	{:else if screen === 'overview'}
		<section class="panel">
			<h2>Información general</h2>
			<p>Resolverás {experimentConfig.puzzleCount} tableros. Cada tarea tendrá un límite de 120 segundos.</p>
			{#if additionalInfoGroups[group]}<p class="warning">{groupCWarning}</p>{/if}
			<button onclick={() => screen = 'tutorial'}>Ver tutorial</button>
		</section>
	{:else if screen === 'tutorial'}
		<section class="panel">
			<p class="eyebrow">Tutorial {tutorialStep} de 3</p>
			{#if tutorialStep === 1}
				<h2>Una reina bloquea sus celdas contiguas</h2>
				<p>Debe haber una, y solo una, reina por fila y por columna. Las reinas no pueden estar en celdas contiguas, ni siquiera en diagonal.</p>
				<p>Marca con X, haciendo un solo clic, en las cuatro celdas verde oscuro de los bordes. Luego haz clic en cualquiera de las ocho celdas verde claro alrededor de la reina y arrastra por las demás para marcarlas en un solo movimiento.</p>
				<QueensBoard board={tutorialBoards[0].board} initialCells={tutorialInitialStates[0]} cellClass={tutorialCellClass} onmove={trackTutorialFirstMovement} />
				{#if tutorialMarkedNeighbors.length === 8 && !tutorialDragComplete}<p>Ahora arrastra con el dedo o mouse sobre celdas vacías para practicar el gesto de marcado.</p>{/if}
				<div class="actions"><button disabled={!tutorialFirstComplete} onclick={() => tutorialStep = 2}>Siguiente</button><button class="secondary" onclick={() => screen = 'hub'}>Volver al menú inicial</button></div>
			{:else if tutorialStep === 2}
				<h2>Descartar para encontrar una reina</h2>
				<p>Los colores representan regiones. Debe haber una, y solo una, reina por región. Solo en este tablero trabajaremos solo con filas para simplificar la explicación.</p>
				<p>NO debes marcar adivinando, solo usando razonamiento lógico y conclusiones de la información que ya tienes.</p>
				<ol class="tutorial-steps">
					<li class:completed={tutorialTwoCells[0] === 'queen'}>Marca la casilla naranja como una reina haciendo dos clics.</li>
					{#if tutorialTwoCells[0] === 'queen'}<li class:completed={tutorialTwoProgress >= 1}>Marca la fila completa con X, ya que ya encontramos la reina de esa fila. Recuerda que puedes arrastrar para marcar en un movimiento.</li>{/if}
					{#if tutorialTwoProgress >= 1}<li class:completed={tutorialTwoCells[7] === 'queen'}>Ahora solo queda una celda amarilla. Nuestra reina amarilla debe estar ahí: márcala con dos clics y marca el resto de la fila con X.</li>{/if}
					{#if tutorialTwoProgress >= 2}<li class:completed={tutorialTwoComplete}>Repite hasta encontrar todas las reinas.</li>{/if}
				</ol>
				<QueensBoard board={tutorialBoards[1].board} initialCells={tutorialTwoInitialCells} onmove={trackTutorialTwoMovement} />
				<div class="actions"><button disabled={!tutorialTwoComplete} onclick={() => tutorialStep = 3}>Siguiente</button><button class="secondary" onclick={() => screen = 'hub'}>Volver al menú inicial</button></div>
			{:else}
				<h2>Una reina por fila y columna</h2>
				<ol class="tutorial-steps">
					<li class:completed={tutorialThreeOrangeMarked}>Si una fila completa es de un solo color, sabemos que la reina de ese color está en esa fila. Por lo tanto, en la primera fila sabemos que está la reina naranja y podemos descartar las celdas de ese color en la segunda fila: márcalas con X.</li>
					{#if tutorialThreeOrangeMarked}<li class:completed={tutorialThreeGreenQueen}>Si en una fila solo queda una casilla, esta debe ser una reina. Marca la reina verde en la segunda fila.</li>{/if}
					{#if tutorialThreeGreenQueen}<li class:completed={tutorialThreeComplete}>Si todas las celdas de un color están en una sola fila o columna, la reina de esa fila o columna debe ser de ese color. Por lo tanto, en la fila 4 puedes marcar con X las celdas de los extremos.</li>{/if}
				</ol>
				<QueensBoard board={tutorialBoards[2].board} initialCells={tutorialThreeInitialCells} showRowNumbers onmove={trackTutorialThreeMovement} />
				<div class="actions"><button disabled={!tutorialThreeComplete} onclick={() => screen = 'prepare'}>Comenzar experimento</button><button class="secondary" onclick={() => screen = 'hub'}>Volver al menú inicial</button></div>
			{/if}
		</section>
	{:else if screen === 'prepare' || screen === 'transition'}
		<section class="panel">
			<h2>Preparacion de tarea</h2>
			<p>El tablero está cargado. El temporizador no empezará hasta pulsar Iniciar.</p>
			<button onclick={openPuzzle}>Iniciar tarea {puzzlePosition + 1}</button>
		</section>
	{:else if screen === 'puzzle'}
		<section class="game-layout">
			<div class="game-meta"><span>Tarea {puzzlePosition + 1} de {experimentConfig.puzzleCount}</span><span>Movimientos: {moveCount}</span><span>Tiempo restante: {formatTime(timeRemainingMs)}</span></div>
			<QueensBoard board={activePuzzle} disabled={puzzleLocked} onmove={recordExperimentalMovement} />
			<button onclick={() => closeCurrentAttempt('interrupted')} disabled={puzzleLocked}>Finalizar intento</button>
		</section>
	{:else if screen === 'complete'}
		<section class="panel">
			<h2>Experimento finalizado</h2>
			<p>A algunos participantes, elegidos al azar, se les presentaron tableros con dificultades artificialmente altas para ver cómo esto influía en tableros posteriores. Te invitamos a que juegues libremente tableros reales con dificultades reales cuando quieras, entrando con tu correo electrónico a esta misma página.</p>
			<p>Perteneciste al grupo <strong>{group}</strong>.</p>
			{#if group === 'A'}
				<p>Las dificultades no fueron alteradas y se mantuvieron estables.</p>
			{:else if group === 'B' || group === 'C'}
				<p>Las dificultades fueron artificialmente altas excepto en el último tablero, que fue de dificultad intermedia e idéntico para todos los grupos.</p>
			{/if}
			<div class="actions"><button onclick={() => openFreePlay()}>Juego libre</button><button class="secondary" onclick={() => screen = 'hub'}>Opciones de regreso</button>{#if isDemoAdmin}<button class="secondary" onclick={() => screen = 'settings'}>Configuración</button>{/if}</div>
		</section>
	{:else if screen === 'free-play'}
		<section class="game-layout">
			<div class="game-meta"><span>Juego libre{freePlayDifficulty ? `: ${difficultyOptions.find((option) => option.value === freePlayDifficulty)?.label}` : ''}</span><span>Movimientos: {freeMoves}</span><span>Sin límite temporal</span></div>
			<QueensBoard board={freePuzzle} onmove={() => freeMoves += 1} />
			<div class="actions"><button onclick={stopFreePlay}>Terminar juego libre</button>{#each difficultyOptions as option}<button class="secondary" disabled={!hasFreePlayPuzzle(option.value)} onclick={() => openFreePlay(option.value)}>Nuevo tablero: {option.label}</button>{/each}</div>
		</section>
	{:else if screen === 'settings'}
		<section class="panel">
			<h2>Configuración</h2>
			<p>Vista reservada al correo autorizado. La autorización real se resolverá en servidor mediante <code>ADMIN_EMAILS</code>. Los cambios de esta pantalla solo viven mientras esta página permanezca abierta.</p>
			<h3>Estructura del experimento</h3>
			<label>Participante (en caso de ser distinto al experimentador que ingresó con correo electrónico):
				<input bind:value={participantName} autocomplete="name" />
			</label>
			<div class="settings-grid">
				<p>Grupos experimentales: A, B y C. La asignación se realiza aleatoriamente con probabilidad 1/3 para cada grupo.</p>
				<label>Tableros por experimento
					<select value={experimentConfig.puzzleCount} onchange={(event) => resizeExperiment(Number(event.currentTarget.value))}>
						<option value="2">2 tableros</option><option value="3">3 tableros</option><option value="4">4 tableros</option><option value="5">5 tableros</option>
					</select>
				</label>
			</div>
			<h3>Información adicional</h3>
			<p>Selecciona los grupos a los que se les mostrará la información adicional antes del tutorial.</p>
			<div class="checkboxes">{#each activeGroups as groupCode}<label><input type="checkbox" bind:checked={additionalInfoGroups[groupCode]} /> Grupo {groupCode}</label>{/each}</div>
			{#each activeGroups as groupCode}
				<h3>Grupo {groupCode}</h3>
				<div class="settings-grid">
					{#each experimentConfig.assignments[groupCode] as puzzleId, position}
						<label>Tablero {position + 1}
							<select value={puzzleId} onchange={(event) => assignPuzzle(groupCode, position, event.currentTarget.value)}>
								{#each allPuzzles as puzzle}<option value={puzzle.id}>{puzzle.label}</option>{/each}
							</select>
						</label>
					{/each}
				</div>
			{/each}
			<h3>Subir tablero JSON</h3>
			<p>Seleccione un archivo con <code>id</code>, <code>label</code>, <code>availability</code>, <code>regions</code> y <code>queenRowsByColumn</code>. Se admiten matrices cuadradas de cualquier tamaño.</p>
			<div class="actions"><input type="file" accept="application/json,.json" onchange={uploadBoard} /><button class="secondary" onclick={() => showBoardCatalog = !showBoardCatalog}>{showBoardCatalog ? 'Ocultar tableros' : 'Ver tableros cargados'}</button></div>
			{#if showBoardCatalog}<ul>{#each allPuzzles as puzzle}<li>{puzzle.label}: {puzzle.regions.length}x{puzzle.regions.length}, {puzzle.availability}</li>{/each}</ul>{/if}
			{#if uploadMessage}<p class="upload-message">{uploadMessage}</p>{/if}
			<h3>Respaldo local</h3>
			<p>Descarga los registros pendientes o la sesión actual. Los archivos no incluyen nombre ni correo.</p>
			<div class="actions"><button class="secondary" onclick={exportPendingAttempts}>Descargar intentos pendientes</button><button class="secondary" onclick={exportPendingMovements}>Descargar movimientos pendientes</button><button class="secondary" onclick={exportCurrentAttempts}>Descargar intentos de sesión actual</button><button class="secondary" onclick={exportCurrentMovements}>Descargar movimientos de sesión actual</button></div>
			{#if exportMessage}<p class="upload-message">{exportMessage}</p>{/if}
			<button onclick={() => screen = 'hub'}>Volver</button>
		</section>
	{/if}
</main>
