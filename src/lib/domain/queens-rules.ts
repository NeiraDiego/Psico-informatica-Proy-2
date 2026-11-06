import type { CellState, PuzzleDefinition } from './types';

export function isSolved(cells: CellState[], puzzle: PuzzleDefinition) {
	const size = puzzle.regions.length;
	if (cells.length !== size ** 2) return false;
	const queens = cells.flatMap((cell, index) => cell === 'queen' ? [index] : []);
	if (queens.length !== size) return false;
	const rows = new Set<number>();
	const columns = new Set<number>();
	const regions = new Set<string>();
	for (const index of queens) {
		const row = Math.floor(index / size);
		const column = index % size;
		const region = puzzle.regions[row][column];
		if (rows.has(row) || columns.has(column) || regions.has(region)) return false;
		rows.add(row);
		columns.add(column);
		regions.add(region);
	}
	for (const index of queens) {
		const row = Math.floor(index / size);
		const column = index % size;
		for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
			for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
				if (rowOffset === 0 && columnOffset === 0) continue;
				const neighbor = (row + rowOffset) * size + column + columnOffset;
				if (row + rowOffset >= 0 && row + rowOffset < size && column + columnOffset >= 0 && column + columnOffset < size && cells[neighbor] === 'queen') return false;
			}
		}
	}
	return true;
}
