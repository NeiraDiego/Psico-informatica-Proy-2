import type { BoardAvailability, Group, ProtocolSequence, PuzzleDefinition, PuzzleStatus } from '$lib/domain/types';
import queensGameCatalog from '../../../data/queensgame-9x9.json';

export const demoPuzzles: PuzzleDefinition[] = queensGameCatalog.boards.map((board) => ({
	id: board.id,
	version: board.version,
	label: board.label,
	availability: board.availability as BoardAvailability,
	status: board.status as PuzzleStatus,
	regions: board.regions,
	queenRowsByColumn: board.queenRowsByColumn
}));

export const demoSequences: Record<Group, ProtocolSequence> = {
	A: { group: 'A', puzzleIds: ['queensgame-16', 'queensgame-22', 'queensgame-47'] },
	B: { group: 'B', puzzleIds: ['queensgame-58', 'queensgame-60', 'queensgame-47'] },
	C: {
		group: 'C',
		puzzleIds: ['queensgame-58', 'queensgame-60', 'queensgame-47'],
		warning: 'Debido a que este experimento busca medir el desempeno despues de haber sido expuestos a tareas extremadamente dificiles, es posible que se te presenten desafios muy dificiles o incluso imposibles de resolver en el tiempo previsto. Luego de eso pueden presentarse otros de dificultad moderada.'
	}
};

export const DEMO_ADMIN_EMAIL = 'diegoneira@gmail.com';

export function pickDemoGroup(): Group {
	return (['A', 'B', 'C'] as const)[Math.floor(Math.random() * 3)];
}

export function getPuzzle(id: string): PuzzleDefinition {
	const puzzle = demoPuzzles.find((item) => item.id === id);
	if (!puzzle) throw new Error(`Tablero desconocido: ${id}`);
	return puzzle;
}
