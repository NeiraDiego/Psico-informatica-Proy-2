import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
	throw new Error('Uso: node scripts/convert-queens-maps.mjs <entrada.json> <salida.json>');
}

function findSolution(regions) {
	const size = regions.length;
	const rowsByColumn = [];
	const usedRows = new Set();
	const usedRegions = new Set();

	function place(column) {
		if (column === size) return true;
		for (let row = 0; row < size; row += 1) {
			const region = regions[row][column];
			if (usedRows.has(row) || usedRegions.has(region)) continue;
			if (column > 0 && Math.abs(row - rowsByColumn[column - 1]) <= 1) continue;
			rowsByColumn.push(row);
			usedRows.add(row);
			usedRegions.add(region);
			if (place(column + 1)) return true;
			rowsByColumn.pop();
			usedRows.delete(row);
			usedRegions.delete(region);
		}
		return false;
	}

	if (!place(0)) throw new Error('El tablero no tiene solución con las reglas Queens.');
	return rowsByColumn.map((row) => row + 1);
}

function normalizeRegions(regions, size) {
	if (!Array.isArray(regions) || regions.length !== size || !regions.every((row) => Array.isArray(row) && row.length === size)) {
		throw new Error(`La matriz regions debe ser de ${size}x${size}.`);
	}
	const regionIds = [...new Set(regions.flat())];
	if (regionIds.length !== size) throw new Error(`El tablero debe tener ${size} regiones.`);
	const labels = new Map(regionIds.map((region, index) => [region, String.fromCharCode(65 + index)]));
	return regions.map((row) => row.map((region) => labels.get(region)));
}

function fromLegacyMap(map) {
	const size = map.size;
	const regions = normalizeRegions(map.regions, size);
	return {
		id: `queensgame-${map.id}`,
		version: 'source-1',
		label: `QueensGame nivel ${map.id}`,
		availability: 'both',
		status: 'solvable',
		regions,
		queenRowsByColumn: findSolution(regions),
		source: {
			provider: 'queensgame.io',
			difficulty: map.source_difficulty,
			url: map.source_url
		}
	};
}

function fromDownloadedBoard(board) {
	const size = board.size;
	const regions = normalizeRegions(board.regions, size);
	return {
		id: `queensgame-${size}x${size}-${board.kind}-${board.id}`,
		version: 'source-2026-11-24',
		label: `QueensGame ${size}x${size} · ${board.kind} ${board.id}`,
		availability: 'free_play',
		status: 'solvable',
		difficulty: board.source_difficulty ?? undefined,
		regions,
		queenRowsByColumn: findSolution(regions),
		source: {
			provider: 'queensgame.io',
			url: board.source_url,
			solutionCount: board.source_solution_count
		}
	};
}

const input = JSON.parse(await readFile(inputPath, 'utf8'));
const isDownloadedCatalog = Array.isArray(input.boards);
const sourceBoards = isDownloadedCatalog ? input.boards : input.maps;
if (!Array.isArray(sourceBoards)) throw new Error('El archivo de entrada debe incluir una lista boards o maps.');

const boards = sourceBoards.map((board) => isDownloadedCatalog ? fromDownloadedBoard(board) : fromLegacyMap(board));
await writeFile(outputPath, `${JSON.stringify({
	source: input.source ?? input.source_index,
	selection: input.selection ?? `Catálogo descargado de ${input.source_index}`,
	count: boards.length,
	boards
}, null, 2)}\n`);
console.log(`Convertidos ${boards.length} tableros en ${outputPath}`);
