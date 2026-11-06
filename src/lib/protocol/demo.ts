import type { Group, ProtocolSequence, PuzzleDefinition } from '$lib/domain/types';

const rowRegions = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, () => row + 1));

export const demoPuzzles: PuzzleDefinition[] = [
	{
		id: 'demo-easy',
		version: 'demo-1',
		label: 'Tablero de demostracion 1',
		availability: 'experimental',
		status: 'pending_validation',
		regions: rowRegions
	},
	{
		id: 'demo-challenge',
		version: 'demo-1',
		label: 'Tablero de demostracion 2',
		availability: 'both',
		status: 'pending_validation',
		regions: rowRegions
	},
	{
		id: 'demo-common',
		version: 'demo-1',
		label: 'Tablero comun de demostracion',
		availability: 'both',
		status: 'pending_validation',
		regions: rowRegions
	}
];

export const demoSequences: Record<Group, ProtocolSequence> = {
	A: { group: 'A', puzzleIds: ['demo-easy', 'demo-challenge', 'demo-common'] },
	B: { group: 'B', puzzleIds: ['demo-challenge', 'demo-easy', 'demo-common'] },
	C: {
		group: 'C',
		puzzleIds: ['demo-challenge', 'demo-easy', 'demo-common'],
		warning: 'Algunas tareas pueden resultar muy dificiles. Trabaje a su propio ritmo.'
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
