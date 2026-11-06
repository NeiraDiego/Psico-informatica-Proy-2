export type Group = 'A' | 'B' | 'C';
export type BoardAvailability = 'experimental' | 'free_play' | 'both';
export type PuzzleStatus = 'solvable' | 'unsolvable' | 'pending_validation';
export type CellState = 'empty' | 'mark' | 'queen';

export interface PuzzleDefinition {
	id: string;
	version: string;
	label: string;
	availability: BoardAvailability;
	status: PuzzleStatus;
	regions: string[][];
	/** Fila (1 a 9) de la reina de cada columna, de izquierda a derecha. */
	queenRowsByColumn: number[];
}

export interface ProtocolSequence {
	group: Group;
	puzzleIds: [string, string, string];
	warning?: string;
}
