import type { BoardAvailability, Group, PuzzleDefinition, PuzzleDifficulty, PuzzleStatus } from '$lib/domain/types';
import queensGameCatalog from '../../../data/queensgame-9x9.json';

export const demoPuzzles: PuzzleDefinition[] = queensGameCatalog.boards.map((board) => ({
	id: board.id,
	version: board.version,
	label: board.label,
		availability: board.availability as BoardAvailability,
		status: board.status as PuzzleStatus,
		difficulty: board.source.difficulty as PuzzleDifficulty,
	regions: board.regions,
	queenRowsByColumn: board.queenRowsByColumn
}));

export const DEMO_ADMIN_EMAIL = 'diegoneira@gmail.com';

export const groupCWarning = 'Debido a que este experimento busca medir el desempeño después de haber sido expuestos a tareas extremadamente difíciles, es posible que se te presenten desafíos muy difíciles o incluso imposibles de resolver en el tiempo previsto. Luego de eso pueden presentarse otros de dificultad moderada.';

export function pickDemoGroup(groupCount: number): Group {
	const groups: Group[] = ['A', 'B', 'C', 'D'];
	return groups[Math.floor(Math.random() * groupCount)];
}

export function getPuzzle(id: string): PuzzleDefinition {
	const puzzle = demoPuzzles.find((item) => item.id === id);
	if (!puzzle) throw new Error(`Tablero desconocido: ${id}`);
	return puzzle;
}
