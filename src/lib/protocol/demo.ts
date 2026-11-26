import type { BoardAvailability, Group, PuzzleDefinition, PuzzleDifficulty, PuzzleStatus } from '$lib/domain/types';
import queensGameCatalog from '../../../data/queensgame-9x9.json';
import queensGameFullCatalog from '../../../data/queensgame-catalog.json';

function toPuzzleDefinition(board: typeof queensGameCatalog.boards[number]): PuzzleDefinition {
	return {
	id: board.id,
	version: board.version,
	label: board.label,
		availability: board.availability as BoardAvailability,
		status: board.status as PuzzleStatus,
	difficulty: board.source.difficulty as PuzzleDifficulty,
	regions: board.regions,
	queenRowsByColumn: board.queenRowsByColumn
	};
}

export const demoPuzzles: PuzzleDefinition[] = queensGameCatalog.boards.map(toPuzzleDefinition);

export const catalogPuzzles: PuzzleDefinition[] = queensGameFullCatalog.boards.map((board) => ({
	id: board.id,
	version: board.version,
	label: board.label,
	availability: board.availability as BoardAvailability,
	status: board.status as PuzzleStatus,
	difficulty: board.difficulty as PuzzleDifficulty | undefined,
	regions: board.regions,
	queenRowsByColumn: board.queenRowsByColumn
}));

function catalogPuzzle(id: string) {
	const puzzle = catalogPuzzles.find((item) => item.id === id);
	if (!puzzle) throw new Error(`Tablero de catálogo desconocido: ${id}`);
	return puzzle;
}

const base468 = catalogPuzzle('queensgame-6x6-standard-468');

export const modified468Puzzle: PuzzleDefinition = {
	...base468,
	id: 'queensgame-6x6-standard-468-modified',
	version: 'difficulty-validation-1',
	label: 'QueensGame 6x6 · standard 468 modificado',
	availability: 'experimental',
	regions: base468.regions.map((row, rowIndex) => row.map((region, columnIndex) => (
		(rowIndex === 2 || rowIndex === 3) && columnIndex === 5 ? base468.regions[2][4] : region
	)))
};

const base178 = catalogPuzzle('queensgame-8x8-standard-178');

export const modified178Puzzle: PuzzleDefinition = {
	...base178,
	id: 'queensgame-8x8-standard-178-modified',
	version: 'difficulty-validation-1',
	label: 'QueensGame 8x8 · standard 178 modificado',
	availability: 'experimental',
	regions: base178.regions.map((row, rowIndex) => row.map((region, columnIndex) => {
		if (rowIndex === 0 && columnIndex === 2) return base178.regions[0][3]; // C1 → D1
		if (rowIndex === 4 && columnIndex === 2) return base178.regions[4][3]; // C5 → D5
		if (rowIndex === 1 && columnIndex === 6) return base178.regions[2][6]; // G2 → G3
		return region;
	}))
};

export const difficultyValidationPuzzles: PuzzleDefinition[] = [
	catalogPuzzle('queensgame-7x7-standard-310'),
	catalogPuzzle('queensgame-7x7-standard-137'),
	modified468Puzzle,
	modified178Puzzle,
	catalogPuzzle('queensgame-7x7-standard-158'),
	catalogPuzzle('queensgame-7x7-standard-130'),
	catalogPuzzle('queensgame-7x7-standard-103')
];

export const AUTHORIZED_EMAILS = ['diegoneira@gmail.com', 'a@b.c', 'coni@udec.cl'];

export const groupCWarning = 'Debido a que este experimento busca medir el desempeño después de haber sido expuestos a tareas extremadamente difíciles, es posible que se te presenten desafíos muy difíciles o incluso imposibles de resolver en el tiempo previsto. Luego de eso pueden presentarse otros de dificultad moderada.';

export function pickDemoGroup(): Group {
	const groups: Group[] = ['A', 'B', 'C'];
	return groups[Math.floor(Math.random() * groups.length)];
}

export function getPuzzle(id: string): PuzzleDefinition {
	const puzzle = [...demoPuzzles, ...catalogPuzzles].find((item) => item.id === id);
	if (!puzzle) throw new Error(`Tablero desconocido: ${id}`);
	return puzzle;
}
