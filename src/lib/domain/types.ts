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
	regions: number[][];
}

export interface ProtocolSequence {
	group: Group;
	puzzleIds: [string, string, string];
	warning?: string;
}
