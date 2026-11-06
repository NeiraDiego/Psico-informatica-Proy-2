<script lang="ts">
	import type { CellState, PuzzleDefinition } from '$lib/domain/types';

	let {
		puzzle,
		disabled = false,
		onmove
	}: {
		puzzle: PuzzleDefinition;
		disabled?: boolean;
		onmove?: () => void;
	} = $props();

	let cells = $state<CellState[]>(Array.from({ length: 81 }, () => 'empty'));
	let dragStart = $state<{ x: number; y: number; index: number } | null>(null);
	let dragging = $state(false);
	let dragChanges = $state(0);
	let visitedCells = new Set<number>();
	let suppressClick = false;

	$effect(() => {
		puzzle.id;
		cells = Array.from({ length: 81 }, () => 'empty');
	});

	function nextState(cell: CellState): CellState {
		return cell === 'empty' ? 'mark' : cell === 'mark' ? 'queen' : 'empty';
	}

	function updateCell(index: number) {
		if (disabled) return;
		cells[index] = nextState(cells[index]);
		onmove?.();
	}

	function markForDrag(index: number) {
		if (visitedCells.has(index) || cells[index] !== 'empty') return;
		visitedCells.add(index);
		cells[index] = 'mark';
		dragChanges += 1;
	}

	function startPointer(event: PointerEvent, index: number) {
		if (disabled) return;
		dragStart = { x: event.clientX, y: event.clientY, index };
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

	function finishPointer() {
		if (dragging) {
			suppressClick = true;
			if (dragChanges > 0) onmove?.();
		}
		dragStart = null;
		dragging = false;
	}

	function handleClick(index: number) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		updateCell(index);
	}
</script>

<div class="board" aria-label={puzzle.label}>
	{#each cells as cell, index}
		{@const row = Math.floor(index / 9)}
		{@const column = index % 9}
		{@const regionIndex = puzzle.regions[row][column].charCodeAt(0) - 64}
		<button
			type="button"
			data-cell-index={index}
			class:marked={cell === 'mark'}
			class:queen={cell === 'queen'}
			disabled={disabled}
			style={`--region: ${regionIndex}`}
			aria-label={`Fila ${row + 1}, columna ${column + 1}: ${cell === 'empty' ? 'vacia' : cell === 'mark' ? 'marca X' : 'reina'}`}
			onpointerdown={(event) => startPointer(event, index)}
			onpointermove={movePointer}
			onpointerup={finishPointer}
			onpointercancel={finishPointer}
			onclick={() => handleClick(index)}
		>
			{cell === 'mark' ? 'X' : cell === 'queen' ? 'Q' : ''}
		</button>
	{/each}
</div>

<p class="board-help">Clic para alternar vacia, X y reina. Arrastre sobre celdas vacias para marcar X; todo el gesto cuenta como un movimiento.</p>
