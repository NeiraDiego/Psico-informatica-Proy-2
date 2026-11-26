<script lang="ts">
	import QueensBoard from '$lib/components/QueensBoard.svelte';
	import { isSolved } from '$lib/domain/queens-rules';
	import { catalogPuzzles } from '$lib/protocol/demo';
	import type { BoardDefinition, BoardMovement, CellState, PuzzleDefinition } from '$lib/domain/types';

	type Screen = 'tutorial' | 'validation' | 'complete';

	const tutorialBoards: Array<{ board: BoardDefinition; queenRowsByColumn: Array<number | undefined> }> = [
		{
			board: { id: 'validation-tutorial-marcado', label: 'Tutorial: marcado', regions: [['A', 'A', 'D', 'A', 'A'], ['A', 'C', 'C', 'C', 'A'], ['D', 'C', 'B', 'C', 'D'], ['A', 'C', 'C', 'C', 'A'], ['A', 'A', 'D', 'A', 'A']] },
			queenRowsByColumn: [undefined, undefined, 2, undefined, undefined]
		},
		{
			board: { id: 'validation-tutorial-descarte', label: 'Tutorial: descarte', regions: [['A', 'B', 'B', 'B', 'B'], ['C', 'C', 'B', 'C', 'C'], ['D', 'D', 'D', 'D', 'C'], ['E', 'D', 'E', 'E', 'E'], ['F', 'F', 'F', 'E', 'F']] },
			queenRowsByColumn: [0, 3, 1, 4, 2]
		},
		{
			board: { id: 'validation-tutorial-filas-columnas', label: 'Tutorial: filas y columnas', regions: [['A', 'A', 'A', 'A', 'A'], ['A', 'A', 'C', 'A', 'A'], ['B', 'B', 'C', 'B', 'B'], ['D', 'D', 'D', 'E', 'E'], ['E', 'E', 'E', 'E', 'E']] },
			queenRowsByColumn: [0, 3, 1, 4, 2]
		}
	];
	const validationPuzzle = catalogPuzzles.find((puzzle) => puzzle.id === 'queensgame-7x7-standard-303') as PuzzleDefinition;

	let screen = $state<Screen>('tutorial');
	let tutorialStep = $state(1);
	let tutorialMarkedNeighbors = $state<number[]>([]);
	let tutorialDragComplete = $state(false);
	let tutorialTwoCells = $state<CellState[]>(Array.from({ length: 25 }, () => 'empty'));
	let tutorialThreeCells = $state<CellState[]>(Array.from({ length: 25 }, () => 'empty'));
	let validationCells = $state<CellState[]>(Array.from({ length: validationPuzzle.regions.length ** 2 }, () => 'empty'));
	let validationMoves = $state(0);
	let validationSolved = $state(false);
	let validationRun = $state(0);

	const tutorialTwoQueenCells = [0, 7, 14, 16, 23];
	const tutorialTwoProgress = $derived(tutorialTwoQueenCells.filter((queenIndex) => {
		if (queenIndex === 23) return tutorialTwoCells[queenIndex] === 'queen';
		const row = Math.floor(queenIndex / 5);
		return tutorialTwoCells[queenIndex] === 'queen' && Array.from({ length: 5 }, (_, column) => row * 5 + column).every((index) => index === queenIndex || tutorialTwoCells[index] === 'mark');
	}).length);
	const tutorialTwoComplete = $derived(tutorialTwoProgress === tutorialTwoQueenCells.length);
	const tutorialThreeOrangeCells = [5, 6, 8, 9];
	const tutorialThreeOrangeMarked = $derived(tutorialThreeOrangeCells.every((index) => tutorialThreeCells[index] === 'mark'));
	const tutorialThreeGreenQueen = $derived(tutorialThreeCells[7] === 'queen');
	const tutorialThreeEdgeCells = [18, 19];
	const tutorialThreeComplete = $derived(tutorialThreeOrangeMarked && tutorialThreeGreenQueen && tutorialThreeEdgeCells.every((index) => tutorialThreeCells[index] === 'mark'));

	function initialCells(queenRowsByColumn: Array<number | undefined>) {
		const size = queenRowsByColumn.length;
		const cells = Array.from({ length: size ** 2 }, () => 'empty' as CellState);
		queenRowsByColumn.forEach((row, column) => {
			if (row !== undefined) cells[row * size + column] = 'queen';
		});
		return cells;
	}

	const tutorialInitialStates = tutorialBoards.map((tutorial) => initialCells(tutorial.queenRowsByColumn));
	const tutorialTwoInitialCells: CellState[] = Array.from({ length: 25 }, () => 'empty');
	const tutorialThreeInitialCells: CellState[] = Array.from({ length: 25 }, () => 'empty');

	function trackTutorialFirstMovement(movement: BoardMovement) {
		for (const change of movement.changes) {
			if ([6, 7, 8, 11, 13, 16, 17, 18].includes(change.index)) {
				tutorialMarkedNeighbors = change.next === 'mark'
					? [...new Set([...tutorialMarkedNeighbors, change.index])]
					: tutorialMarkedNeighbors.filter((index) => index !== change.index);
			}
		}
		if (movement.type === 'drag' && tutorialMarkedNeighbors.length === 8 && movement.changes.length > 0) tutorialDragComplete = true;
	}

	function trackTutorialTwoMovement(movement: BoardMovement) {
		for (const change of movement.changes) tutorialTwoCells[change.index] = change.next;
	}

	function trackTutorialThreeMovement(movement: BoardMovement) {
		for (const change of movement.changes) tutorialThreeCells[change.index] = change.next;
	}

	function trackValidationMovement(movement: BoardMovement) {
		if (validationSolved) return;
		for (const change of movement.changes) validationCells[change.index] = change.next;
		if (movement.changes.length) validationMoves += 1;
		if (isSolved(validationCells, validationPuzzle)) {
			validationSolved = true;
			screen = 'complete';
		}
	}

	function restartValidation() {
		validationCells = Array.from({ length: validationPuzzle.regions.length ** 2 }, () => 'empty');
		validationMoves = 0;
		validationSolved = false;
		validationRun += 1;
		screen = 'validation';
	}

	function tutorialCellClass(index: number, state: CellState) {
		if (index === 12) return 'tutorial-queen';
		if ([6, 7, 8, 11, 13, 16, 17, 18].includes(index)) return state === 'mark' ? 'tutorial-marked' : 'tutorial-neighbor';
		return '';
	}

	function tutorialThreeCellClass(index: number) {
		return [15, 16, 17].includes(index) ? 'tutorial-red-region' : '';
	}

</script>

<main>
	<header>
		<p class="eyebrow">Validación de aprendizaje</p>
		<h1>Tutorial de Queens</h1>
	</header>

	{#if screen === 'tutorial'}
		<section class="panel">
			<p class="eyebrow">Tutorial {tutorialStep} de 3</p>
			{#if tutorialStep === 1}
				<h2>Una reina bloquea sus celdas contiguas</h2>
				<p>Debe haber una, y solo una, reina por fila y por columna. Las reinas no pueden estar en celdas contiguas, ni siquiera en diagonal.</p>
				<p>Haz clic, dejando presionado, en cualquiera de las ocho celdas verde claro alrededor de la reina y arrastra por las demás para marcarlas con X en un solo movimiento.</p>
				<p>A continuación marca con X las celdas verde oscuro, haciendo un solo clic en cada una de ellas, ya que esa columna y esa fila ya tienen su reina.</p>
				<video class="tutorial-video" controls preload="metadata"><source src="/queens-tutorial.mp4" type="video/mp4" />Tu navegador no puede reproducir este video.</video>
				<QueensBoard board={tutorialBoards[0].board} initialCells={tutorialInitialStates[0]} cellClass={tutorialCellClass} onmove={trackTutorialFirstMovement} />
				{#if tutorialMarkedNeighbors.length === 8 && !tutorialDragComplete}<p>Ahora arrastra con el dedo o mouse sobre celdas vacías para practicar el gesto de marcado.</p>{/if}
				{#if tutorialMarkedNeighbors.length === 8 && tutorialDragComplete}
					<p>Siempre recuerda: apenas encuentres una reina, puedes bloquear las celdas de alrededor y la fila y la columna completa.</p>
					<video class="tutorial-video" controls preload="metadata"><source src="/queens-found-queen.mp4" type="video/mp4" />Tu navegador no puede reproducir este video.</video>
				{/if}
				<div class="actions"><button disabled={!(tutorialMarkedNeighbors.length === 8 && tutorialDragComplete)} onclick={() => tutorialStep = 2}>Siguiente</button></div>
			{:else if tutorialStep === 2}
				<h2>Descartar para encontrar una reina</h2>
				<p>Los colores representan regiones. Debe haber una, y solo una, reina por región. En este tablero.</p>
				<ol class="tutorial-steps">
					<li class:completed={tutorialTwoCells[0] === 'queen'}>Marca la casilla 1A (naranja) como una reina haciendo dos clics.</li>
					{#if tutorialTwoCells[0] === 'queen'}<li class:completed={tutorialTwoProgress >= 1}>Marca el resto de la fila 1 con X, porque ya encontramos la reina de esa fila. Recuerda que puedes arrastrar para marcar en un movimiento.</li>{/if}
					{#if tutorialTwoProgress >= 1}<li class:completed={tutorialTwoCells[7] === 'queen'}>Ahora solo queda una celda amarilla disponible, que está en 2C. Nuestra reina amarilla debe estar ahí: márcala con dos clics y marca el resto de la fila 2 con X.</li>{/if}
					{#if tutorialTwoProgress >= 2}<li class:completed={tutorialTwoComplete}>Repite hasta encontrar todas las reinas y todas las demás celdas con X. El color azul oscuro no tiene reina.</li>{/if}
				</ol>
				<QueensBoard board={tutorialBoards[1].board} initialCells={tutorialTwoInitialCells} showRowNumbers showColumnLetters onmove={trackTutorialTwoMovement} />
				<div class="actions"><button disabled={!tutorialTwoComplete} onclick={() => tutorialStep = 3}>Siguiente</button></div>
			{:else}
				<h2>Una reina por fila y columna</h2>
				<ol class="tutorial-steps">
					<li class:completed={tutorialThreeOrangeMarked}>Si una fila completa es de un solo color, sabemos que la reina de ese color está en esa fila. En este ejemplo, en la fila 1 es completamente naranja, por lo que sabemos que la reina naranja está ahí y podemos descartar las celdas de ese color en la segunda y en el resto del tablero: marca las celdas naranjas de la fila 2 con X.</li>
					{#if tutorialThreeOrangeMarked}<li class:completed={tutorialThreeGreenQueen}>Si en una fila solo queda una casilla, esta debe ser una reina. Marca la reina verde en la segunda fila.</li>{/if}
					{#if tutorialThreeGreenQueen}<li class:completed={tutorialThreeComplete}>Si todas las celdas de un color están en una sola fila o columna, la reina de esa fila o columna debe ser de ese color. Miremos la fila 4: como todas las celdas rojas están en esa única fila, sabemos que en esa fila debe ubicarse la reina roja; por lo tanto, D4 y E4 no pueden ser la reina celeste. Márcalas con X.</li>{/if}
				</ol>
				<QueensBoard board={tutorialBoards[2].board} initialCells={tutorialThreeInitialCells} showRowNumbers showColumnLetters cellClass={tutorialThreeCellClass} onmove={trackTutorialThreeMovement} />
				<div class="actions"><button disabled={!tutorialThreeComplete} onclick={() => screen = 'validation'}>Comenzar validación</button></div>
			{/if}
		</section>
	{:else if screen === 'validation'}
		<section class="game-layout">
			<div class="game-meta"><span>Validación: tablero 303 · 7×7</span><span>Movimientos: {validationMoves}</span><span>Sin límite temporal</span></div>
			<p>Resuelve el tablero aplicando las reglas que acabas de practicar.</p>
			{#key validationRun}
				<QueensBoard board={validationPuzzle} showRowNumbers showColumnLetters disabled={validationSolved} onmove={trackValidationMovement} />
			{/key}
		</section>
	{:else}
		<section class="panel">
			<h2>¡Validación superada!</h2>
			<p>Resolviste el tablero 303 en {validationMoves} movimiento(s), aplicando las reglas del tutorial.</p>
			<div class="actions"><button onclick={restartValidation}>Resolver nuevamente</button></div>
		</section>
	{/if}
</main>
