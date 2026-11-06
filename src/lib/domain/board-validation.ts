import type { BoardAvailability, PuzzleDefinition, PuzzleDifficulty } from './types';

type UploadPayload = {
	id?: unknown;
	label?: unknown;
	availability?: unknown;
	difficulty?: unknown;
	regions?: unknown;
	queenRowsByColumn?: unknown;
};

function isAvailability(value: unknown): value is BoardAvailability {
	return value === 'experimental' || value === 'free_play' || value === 'both';
}

function isDifficulty(value: unknown): value is PuzzleDifficulty {
	return value === 'easy' || value === 'medium' || value === 'hard' || value === 'expert';
}

function hasConnectedRegions(regions: string[][], regionIds: string[]) {
	const size = regions.length;
	for (const regionId of regionIds) {
		const cells: Array<[number, number]> = [];
		for (let row = 0; row < size; row += 1) {
			for (let column = 0; column < size; column += 1) {
				if (regions[row][column] === regionId) cells.push([row, column]);
			}
		}
		const visited = new Set<string>();
		const pending = [cells[0]];
		while (pending.length) {
			const [row, column] = pending.pop()!;
			const key = `${row},${column}`;
			if (visited.has(key)) continue;
			visited.add(key);
			for (const [nextRow, nextColumn] of [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]) {
				if (nextRow >= 0 && nextRow < size && nextColumn >= 0 && nextColumn < size && regions[nextRow][nextColumn] === regionId) {
					pending.push([nextRow, nextColumn]);
				}
			}
		}
		if (visited.size !== cells.length) return false;
	}
	return true;
}

function hasValidQueenPositions(regions: string[][], queenRowsByColumn: number[]) {
	const size = regions.length;
	if (queenRowsByColumn.length !== size || !queenRowsByColumn.every((row) => Number.isInteger(row) && row >= 1 && row <= size)) return false;
	const rows = queenRowsByColumn.map((row) => row - 1);
	if (new Set(rows).size !== size) return false;
	const queenRegions = new Set(rows.map((row, column) => regions[row][column]));
	if (queenRegions.size !== size) return false;
	return rows.every((row, column) => column === 0 || Math.abs(row - rows[column - 1]) > 1);
}

export function validateUploadedBoard(payload: UploadPayload): { puzzle?: PuzzleDefinition; error?: string } {
	if (typeof payload.id !== 'string' || !/^[a-z0-9-]+$/i.test(payload.id)) {
		return { error: 'El identificador debe contener letras, numeros o guiones.' };
	}
	if (typeof payload.label !== 'string' || !payload.label.trim()) return { error: 'El tablero necesita un nombre.' };
	if (!isAvailability(payload.availability)) return { error: 'La disponibilidad debe ser experimental, free_play o both.' };
	if (payload.difficulty !== undefined && !isDifficulty(payload.difficulty)) return { error: 'La dificultad debe ser easy, medium, hard o expert.' };
	if (!Array.isArray(payload.regions) || payload.regions.length < 2) {
		return { error: 'La matriz regions debe ser cuadrada y tener al menos 2 filas.' };
	}
	const rawRegions = payload.regions;
	if (!rawRegions.every((row) => Array.isArray(row) && row.length === rawRegions.length)) {
		return { error: 'La matriz regions debe ser cuadrada y tener al menos 2 filas.' };
	}
	if (!rawRegions.flat().every((cell) => typeof cell === 'string' && /^[A-Z]$/.test(cell))) {
		return { error: 'Cada celda de regions debe contener una letra mayuscula.' };
	}
	const regions = rawRegions as string[][];
	const size = regions.length;
	const regionIds = [...new Set(regions.flat())];
	if (regionIds.length !== size) return { error: 'El tablero debe tener exactamente una región por cada fila y columna.' };
	if (!hasConnectedRegions(regions, regionIds)) return { error: 'Cada región debe ser conexa por sus lados.' };
	if (!Array.isArray(payload.queenRowsByColumn)) return { error: `Debe indicar queenRowsByColumn con ${size} filas, una por columna.` };
	const queenRowsByColumn = payload.queenRowsByColumn as number[];
	if (!hasValidQueenPositions(regions, queenRowsByColumn)) {
		return { error: `Las posiciones de reinas deben usar filas 1 a ${size}, sin repetir fila ni región, y sin reinas adyacentes.` };
	}
	return {
		puzzle: {
			id: payload.id,
			version: 'local-upload-1',
			label: payload.label.trim(),
			availability: payload.availability,
			status: 'pending_validation',
			difficulty: payload.difficulty,
			regions,
			queenRowsByColumn
		}
	};
}
