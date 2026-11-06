import type { BoardChange, BoardMovement, CellState, PuzzleDefinition } from '$lib/domain/types';

export type AttemptOutcome = 'solved' | 'timeout' | 'interrupted';

export interface RecordedMovement {
	index: number;
	type: BoardMovement['type'];
	started_at_ms: number;
	ended_at_ms: number;
	duration_ms: number;
	latency_ms: number;
	changes: BoardChange[];
	closure: BoardMovement['closure'];
}

export interface AttemptDraft {
	client_attempt_id: string;
	puzzle_id: string;
	puzzle_version: string;
	position: number;
	is_primary_outcome: boolean;
	started_at_client: string;
	time_limit_ms: number | null;
	started_at_performance: number;
	movements: RecordedMovement[];
	final_board: CellState[];
}

export interface CompletedAttempt extends AttemptDraft {
	ended_at_client: string;
	duration_ms: number;
	outcome: AttemptOutcome;
	success: boolean;
	total_moves: number;
	movement_latencies_ms: number[];
}

export function createAttempt(puzzle: PuzzleDefinition, position: number, startedAt: number, timeLimitMs: number | null, isPrimaryOutcome: boolean): AttemptDraft {
	return {
		client_attempt_id: crypto.randomUUID(),
		puzzle_id: puzzle.id,
		puzzle_version: puzzle.version,
		position,
		is_primary_outcome: isPrimaryOutcome,
		started_at_client: new Date().toISOString(),
		time_limit_ms: timeLimitMs,
		started_at_performance: startedAt,
		movements: [],
		final_board: Array.from({ length: puzzle.regions.length ** 2 }, () => 'empty')
	};
}

export function addMovement(attempt: AttemptDraft, movement: BoardMovement): RecordedMovement | null {
	if (movement.changes.length === 0) return null;
	const started_at_ms = Math.max(0, Math.round(movement.startedAt - attempt.started_at_performance));
	const ended_at_ms = Math.max(started_at_ms, Math.round(movement.endedAt - attempt.started_at_performance));
	const previousEnd = attempt.movements.at(-1)?.ended_at_ms ?? 0;
	const recorded: RecordedMovement = {
		index: attempt.movements.length + 1,
		type: movement.type,
		started_at_ms,
		ended_at_ms,
		duration_ms: ended_at_ms - started_at_ms,
		latency_ms: Math.max(0, started_at_ms - previousEnd),
		changes: movement.changes.map((change) => ({ ...change })),
		closure: movement.closure
	};
	for (const change of recorded.changes) attempt.final_board[change.index] = change.next;
	attempt.movements.push(recorded);
	return recorded;
}

export function completeAttempt(attempt: AttemptDraft, outcome: AttemptOutcome, endedAt: number, success = false): CompletedAttempt {
	const duration_ms = Math.max(0, Math.round(endedAt - attempt.started_at_performance));
	return {
		...attempt,
		ended_at_client: new Date().toISOString(),
		duration_ms,
		outcome,
		success,
		total_moves: attempt.movements.length,
		movement_latencies_ms: attempt.movements.map((movement) => movement.latency_ms)
	};
}
