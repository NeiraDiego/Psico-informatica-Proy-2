import type { BoardAvailability, PuzzleDefinition } from './types';

type UploadPayload = {
	id?: unknown;
	label?: unknown;
	availability?: unknown;
	regions?: unknown;
};

function isAvailability(value: unknown): value is BoardAvailability {
	return value === 'experimental' || value === 'free_play' || value === 'both';
}

function hasConnectedRegions(regions: number[][], regionIds: number[]) {
	for (const regionId of regionIds) {
		const cells: Array<[number, number]> = [];
		for (let row = 0; row < 9; row += 1) {
			for (let column = 0; column < 9; column += 1) {
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
				if (nextRow >= 0 && nextRow < 9 && nextColumn >= 0 && nextColumn < 9 && regions[nextRow][nextColumn] === regionId) {
					pending.push([nextRow, nextColumn]);
				}
			}
		}
		if (visited.size !== cells.length) return false;
	}
	return true;
}

export function validateUploadedBoard(payload: UploadPayload): { puzzle?: PuzzleDefinition; error?: string } {
	if (typeof payload.id !== 'string' || !/^[a-z0-9-]+$/i.test(payload.id)) {
		return { error: 'El identificador debe contener letras, numeros o guiones.' };
	}
	if (typeof payload.label !== 'string' || !payload.label.trim()) return { error: 'El tablero necesita un nombre.' };
	if (!isAvailability(payload.availability)) return { error: 'La disponibilidad debe ser experimental, free_play o both.' };
	if (!Array.isArray(payload.regions) || payload.regions.length !== 9 || !payload.regions.every((row) => Array.isArray(row) && row.length === 9)) {
		return { error: 'La matriz regions debe ser de 9 por 9.' };
	}
	if (!payload.regions.flat().every((cell) => Number.isInteger(cell))) return { error: 'Los identificadores de region deben ser numeros enteros.' };
	const regions = payload.regions as number[][];
	const regionIds = [...new Set(regions.flat())];
	if (regionIds.length !== 9) return { error: 'El tablero debe tener exactamente nueve regiones.' };
	if (!hasConnectedRegions(regions, regionIds)) return { error: 'Cada region debe ser conexa por sus lados.' };
	return {
		puzzle: {
			id: payload.id,
			version: 'local-upload-1',
			label: payload.label.trim(),
			availability: payload.availability,
			status: 'pending_validation',
			regions
		}
	};
}
