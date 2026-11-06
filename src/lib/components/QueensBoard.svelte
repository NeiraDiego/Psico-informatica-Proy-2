<script lang="ts">
	import type { BoardDefinition, BoardChange, BoardMovement, CellState } from '$lib/domain/types';

	let {
		board,
		disabled = false,
		showRowNumbers = false,
		onmove,
		cellClass,
		initialCells
	}: {
		board: BoardDefinition;
		disabled?: boolean;
		showRowNumbers?: boolean;
		onmove?: (movement: BoardMovement) => void;
		cellClass?: (index: number, state: CellState) => string;
		initialCells?: CellState[];
	} = $props();

	let cells = $state<CellState[]>([]);
	let dragStart = $state<{ x: number; y: number; index: number; startedAt: number } | null>(null);
	let dragging = $state(false);
	let dragChanges = $state(0);
	let visitedCells = new Set<number>();
	let suppressClick = false;
	let clickStartedAt = 0;
	const size = $derived(board.regions.length);

	$effect(() => {
		board.id;
		cells = initialCells ? [...initialCells] : Array.from({ length: board.regions.length ** 2 }, () => 'empty');
	});

	function nextState(cell: CellState): CellState {
		return cell === 'empty' ? 'mark' : cell === 'mark' ? 'queen' : 'empty';
	}

	function updateCell(index: number, startedAt: number) {
		if (disabled) return;
		const previous = cells[index];
		const next = nextState(previous);
		cells[index] = next;
		onmove?.({ type: 'click', changes: [{ index, previous, next }], startedAt, endedAt: performance.now(), closure: 'normal' });
	}

	function markForDrag(index: number): BoardChange | undefined {
		if (visitedCells.has(index) || cells[index] !== 'empty') return undefined;
		visitedCells.add(index);
		cells[index] = 'mark';
		dragChanges += 1;
		return { index, previous: 'empty', next: 'mark' };
	}

	function startPointer(event: PointerEvent, index: number) {
		if (disabled) return;
		const startedAt = performance.now();
		dragStart = { x: event.clientX, y: event.clientY, index, startedAt };
		clickStartedAt = startedAt;
		dragging = false;
		dragChanges = 0;
		visitedCells = new Set();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function movePointer(event: PointerEvent) {
		if (!dragStart || disabled) return;
		if (!dragging && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) < 6) return;
		if (!dragging) {
			dragging = true;
			markForDrag(dragStart.index);
		}
		const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell-index]');
		if (target?.dataset.cellIndex) markForDrag(Number(target.dataset.cellIndex));
	}

	function finishPointer(cancelled = false) {
		if (dragging) {
			suppressClick = true;
			if (dragChanges > 0) {
				const changes = [...visitedCells].map((index) => ({ index, previous: 'empty' as const, next: 'mark' as const }));
				onmove?.({ type: 'drag', changes, startedAt: dragStart?.startedAt ?? performance.now(), endedAt: performance.now(), closure: cancelled ? 'cancelled' : 'normal' });
			}
		}
		if (cancelled && !dragging) clickStartedAt = 0;
		dragStart = null;
		dragging = false;
	}

	function handleClick(index: number) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		updateCell(index, clickStartedAt || performance.now());
		clickStartedAt = 0;
	}
</script>

<div class:board-with-row-numbers={showRowNumbers} class="board-container" style={`--board-size: ${size}`}>
	{#if showRowNumbers}
		<div class="row-numbers" aria-hidden="true">{#each Array(size) as _, row}<span>{row + 1}</span>{/each}</div>
	{/if}
	<div class:mini-board={size < 9} class="board" style={`--board-size: ${size}`} aria-label={board.label}>
		{#each cells as cell, index}
			{@const row = Math.floor(index / size)}
			{@const column = index % size}
			{@const regionIndex = board.regions[row][column].charCodeAt(0) - 64}
			<button
				type="button"
				data-cell-index={index}
				class={cellClass?.(index, cell)}
				class:marked={cell === 'mark'}
				class:queen={cell === 'queen'}
				disabled={disabled}
				style={`--region: ${regionIndex}`}
				aria-label={`Fila ${row + 1}, columna ${column + 1}: ${cell === 'empty' ? 'vacía' : cell === 'mark' ? 'marca X' : 'reina'}`}
				onpointerdown={(event) => startPointer(event, index)}
				onpointermove={movePointer}
				onpointerup={() => finishPointer()}
				onpointercancel={() => finishPointer(true)}
				onclick={() => handleClick(index)}
			>
				{cell === 'mark' ? 'X' : cell === 'queen' ? 'Q' : ''}
			</button>
		{/each}
	</div>
</div>

{#if size === 9}
	<p class="board-help">Clic para alternar vacía, X y reina. Arrastre sobre celdas vacías para marcar X; todo el gesto cuenta como un movimiento.</p>
{/if}
