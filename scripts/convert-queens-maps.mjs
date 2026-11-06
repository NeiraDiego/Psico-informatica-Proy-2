import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
	throw new Error('Uso: node scripts/convert-queens-maps.mjs <entrada.json> <salida.json>');
}

function findSolution(regions) {
	const rowsByColumn = [];
	const usedRows = new Set();
	const usedRegions = new Set();

	function place(column) {
		if (column === 9) return true;
		for (let row = 0; row < 9; row += 1) {
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

	if (!place(0)) throw new Error('El tablero no tiene solucion con las reglas Queens.');
	return rowsByColumn.map((row) => row + 1);
}

const input = JSON.parse(await readFile(inputPath, 'utf8'));
if (!Array.isArray(input.maps)) throw new Error('El archivo de entrada debe incluir una lista maps.');

const boards = input.maps.map((map) => {
	if (map.size !== 9 || !Array.isArray(map.regions) || map.regions.length !== 9 || !map.regions.every((row) => Array.isArray(row) && row.length === 9)) {
		throw new Error(`El mapa ${map.id} no es una matriz 9x9.`);
	}
	const regions = map.regions.map((row) => row.map((region) => String.fromCharCode(65 + region)));
	return {
		id: `queensgame-${map.id}`,
		version: 'source-1',
		label: `QueensGame nivel ${map.id}`,
		availability: 'both',
		status: 'pending_validation',
		regions,
		queenRowsByColumn: findSolution(regions),
		source: {
			provider: 'queensgame.io',
			difficulty: map.source_difficulty,
			url: map.source_url
		}
	};
});

await writeFile(outputPath, `${JSON.stringify({ source: input.source, selection: input.selection, count: boards.length, boards }, null, 2)}\n`);
console.log(`Convertidos ${boards.length} tableros en ${outputPath}`);
