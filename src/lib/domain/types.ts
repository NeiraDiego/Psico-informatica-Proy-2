export type Group = 'A' | 'B' | 'C';
export type BoardAvailability = 'experimental' | 'free_play' | 'both';
export type PuzzleStatus = 'solvable' | 'unsolvable' | 'pending_validation';
export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type CellState = 'empty' | 'mark' | 'queen';

export interface BoardDefinition {
	id: string;
	label: string;
	regions: string[][];
}

export interface PuzzleDefinition extends BoardDefinition {
	version: string;
	availability: BoardAvailability;
	status: PuzzleStatus;
	difficulty?: PuzzleDifficulty;
	/** Fila (1 al tamaño del tablero) de la reina de cada columna, de izquierda a derecha. */
	queenRowsByColumn: number[];
}

export interface BoardChange {
	index: number;
	previous: CellState;
	next: CellState;
}

export interface BoardMovement {
	type: 'click' | 'drag';
	changes: BoardChange[];
	startedAt: number;
	endedAt: number;
	closure: 'normal' | 'cancelled';
}

export interface ProtocolSequence {
	group: Group;
	puzzleIds: string[];
	warning?: string;
}
