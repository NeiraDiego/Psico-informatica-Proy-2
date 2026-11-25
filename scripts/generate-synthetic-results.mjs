import { mkdir, writeFile } from 'node:fs/promises';

const outputDirectory = new URL('../data/synthetic-results/', import.meta.url);
const groups = ['A', 'B', 'C'];
const puzzles = {
	A: ['queensgame-16', 'queensgame-22', 'queensgame-47'],
	B: ['queensgame-58', 'queensgame-60', 'queensgame-47'],
	C: ['queensgame-58', 'queensgame-60', 'queensgame-47']
};
// Número de aciertos deliberadamente simulado por grupo y posición.
const successes = {
	A: [17, 15, 16],
	B: [7, 6, 11],
	C: [6, 5, 8]
};

let seed = 20261120;
function random() {
	seed = (seed * 1664525 + 1013904223) >>> 0;
	return seed / 2 ** 32;
}

function uuid(serial) {
	return `00000000-0000-4000-8000-${String(serial).padStart(12, '0')}`;
}

function escapeCsv(value) {
	const text = String(value);
	return /[,"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows, columns) {
	return `${columns.join(',')}\n${rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(',')).join('\n')}\n`;
}

function shuffledIndexes() {
	const indexes = Array.from({ length: 20 }, (_, index) => index);
	for (let index = indexes.length - 1; index > 0; index -= 1) {
		const other = Math.floor(random() * (index + 1));
		[indexes[index], indexes[other]] = [indexes[other], indexes[index]];
	}
	return indexes;
}

function boardWithQueens(queenCount, participant, position) {
	const board = Array.from({ length: 81 }, () => 'empty');
	for (let queen = 0; queen < queenCount; queen += 1) {
		board[(participant * 11 + position * 17 + queen * 9) % 81] = 'queen';
	}
	return board;
}

await mkdir(outputDirectory, { recursive: true });

const participants = [];
const sessions = [];
const attempts = [];
const analysisAttempts = [];
let serial = 1;

for (const group of groups) {
	const successfulByPosition = [];
	successes[group].forEach((count, position) => {
		successfulByPosition[position] = new Set(shuffledIndexes().slice(0, count));
	});

	for (let participant = 0; participant < 20; participant += 1) {
		const participantCode = `${group}-${String(participant + 1).padStart(2, '0')}`;
		const participantId = uuid(serial++);
		const sessionId = uuid(serial++);
		const createdAt = new Date(Date.UTC(2026, 10, 1 + participant, 9 + (participant % 6), participant, 0)).toISOString();

		participants.push({
			id: participantId,
			name: `Sintético ${participantCode}`,
			email: `synthetic-${participantCode.toLowerCase()}@example.invalid`,
			created_at: createdAt
		});
		sessions.push({
			id: sessionId,
			participant_id: participantId,
			participant_name: `Participante ${participantCode}`,
			group,
			protocol_version: 'synthetic-1.0.0',
			app_version: 'synthetic-1.0.0',
			assignment_method: 'synthetic_balanced',
			status: 'completed',
			created_at: createdAt,
			completed_at: new Date(Date.parse(createdAt) + 12 * 60 * 1000).toISOString()
		});

		for (let position = 0; position < 3; position += 1) {
			const success = successfulByPosition[position].has(participant);
			const difficultExposure = group !== 'A' && position < 2;
			const baseDuration = difficultExposure ? 102000 : position === 2 ? 85000 : 78000;
			const durationMs = success
				? Math.round(baseDuration + (random() - 0.5) * 28000)
				: 120000;
			const totalMoves = success
				? Math.max(9, Math.round((difficultExposure ? 31 : 22) + random() * 14))
				: Math.max(8, Math.round((difficultExposure ? 35 : 26) + random() * 16));
			const queenCount = success ? 9 : Math.min(8, 4 + Math.floor(random() * 5));
			const latencies = Array.from(
				{ length: totalMoves },
				(_, index) => index === 0 ? 0 : Math.round(500 + random() * (difficultExposure ? 3000 : 2000))
			);
			const attemptId = uuid(serial++);
			const startedAt = new Date(Date.parse(createdAt) + (position + 1) * 180000).toISOString();
			const endedAt = new Date(Date.parse(startedAt) + durationMs).toISOString();
			const record = {
				id: attemptId,
				client_attempt_id: attemptId,
				session_id: sessionId,
				puzzle_id: puzzles[group][position],
				puzzle_version: 'source-1',
				position: position + 1,
				is_primary_outcome: position === 2,
				started_at_client: startedAt,
				ended_at_client: endedAt,
				duration_ms: durationMs,
				time_limit_ms: 120000,
				outcome: success ? 'solved' : 'timeout',
				success,
				total_moves: totalMoves,
				movement_latencies_ms: JSON.stringify(latencies),
				final_board: JSON.stringify(boardWithQueens(queenCount, participant, position)),
				created_at: endedAt
			};
			attempts.push(record);
			analysisAttempts.push({
				participant_code: participantCode,
				group,
				session_id: sessionId,
				attempt_id: attemptId,
				position: position + 1,
				puzzle_id: record.puzzle_id,
				is_primary_outcome: record.is_primary_outcome,
				outcome: record.outcome,
				success: Number(success),
				duration_ms: durationMs,
				duration_seconds: (durationMs / 1000).toFixed(3),
				total_moves: totalMoves,
				queens_found: queenCount,
				mean_latency_ms: Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
			});
		}
	}
}

await Promise.all([
	writeFile(new URL('participants.csv', outputDirectory), csv(participants, ['id', 'name', 'email', 'created_at'])),
	writeFile(new URL('sessions.csv', outputDirectory), csv(sessions, ['id', 'participant_id', 'participant_name', 'group', 'protocol_version', 'app_version', 'assignment_method', 'status', 'created_at', 'completed_at'])),
	writeFile(new URL('puzzle_attempts.csv', outputDirectory), csv(attempts, ['id', 'client_attempt_id', 'session_id', 'puzzle_id', 'puzzle_version', 'position', 'is_primary_outcome', 'started_at_client', 'ended_at_client', 'duration_ms', 'time_limit_ms', 'outcome', 'success', 'total_moves', 'movement_latencies_ms', 'final_board', 'created_at'])),
	writeFile(new URL('analysis_attempts.csv', outputDirectory), csv(analysisAttempts, ['participant_code', 'group', 'session_id', 'attempt_id', 'position', 'puzzle_id', 'is_primary_outcome', 'outcome', 'success', 'duration_ms', 'duration_seconds', 'total_moves', 'queens_found', 'mean_latency_ms']))
]);

console.log(`Datos sintéticos creados: ${participants.length} participantes y ${attempts.length} intentos.`);
