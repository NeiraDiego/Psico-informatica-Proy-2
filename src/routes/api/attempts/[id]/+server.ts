import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { supabaseConfig, supabaseRequest } from '$lib/server/supabase';

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

export async function PUT({ request, params, cookies }) {
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return json({ error: 'Cuerpo JSON invalido.' }, { status: 400 });
	const attempt = body as Record<string, unknown>;
	if (attempt.client_attempt_id !== params.id || typeof attempt.puzzle_id !== 'string' || typeof attempt.puzzle_version !== 'string') {
		return json({ error: 'Identificador de intento o puzle invalido.' }, { status: 400 });
	}
	if (!Number.isInteger(attempt.position) || (attempt.position as number) < 1 || (attempt.position as number) > 3) return json({ error: 'Posicion invalida.' }, { status: 400 });
	if (!Number.isInteger(attempt.duration_ms) || (attempt.duration_ms as number) < 0 || (attempt.duration_ms as number) > 120500) return json({ error: 'Duracion invalida.' }, { status: 400 });
	if (!Array.isArray(attempt.movements) || !Array.isArray(attempt.final_board)) return json({ error: 'Movimientos o tablero final invalidos.' }, { status: 400 });
	if (!supabaseConfig()) return json({ error: 'Persistencia no configurada.' }, { status: 503 });
	const token = cookies.get('queens_session_token');
	if (!token) return json({ error: 'Sesion no autorizada.' }, { status: 401 });
	const sessionResponse = await supabaseRequest(`sessions?select=id&access_token_hash=eq.${hashToken(token)}`);
	if (!sessionResponse.ok) return json({ error: 'No se pudo autorizar la sesion.' }, { status: 502 });
	const [session] = await sessionResponse.json() as Array<{ id: string }>;
	if (!session) return json({ error: 'Sesion no autorizada.' }, { status: 401 });

	const attemptResponse = await supabaseRequest('puzzle_attempts?on_conflict=client_attempt_id', {
		method: 'POST',
		headers: { prefer: 'resolution=merge-duplicates' },
		body: JSON.stringify({
			id: attempt.client_attempt_id,
			client_attempt_id: attempt.client_attempt_id,
			session_id: session.id,
			puzzle_id: attempt.puzzle_id,
			puzzle_version: attempt.puzzle_version,
			position: attempt.position,
			is_primary_outcome: attempt.is_primary_outcome,
			started_at_client: attempt.started_at_client,
			ended_at_client: attempt.ended_at_client,
			duration_ms: attempt.duration_ms,
			time_limit_ms: attempt.time_limit_ms,
			outcome: attempt.outcome,
			success: attempt.success,
			total_moves: attempt.total_moves,
			movement_latencies_ms: attempt.movement_latencies_ms,
			final_board: attempt.final_board
		})
	});
	if (!attemptResponse.ok) return json({ error: 'No se pudo guardar el intento.' }, { status: 502 });
	const movements = (attempt.movements as Array<Record<string, unknown>>).map((movement) => ({
		...movement,
		id: crypto.randomUUID(),
		attempt_id: attempt.client_attempt_id
	}));
	if (movements.length) {
		const movementResponse = await supabaseRequest('movements?on_conflict=attempt_id,index', {
			method: 'POST',
			headers: { prefer: 'resolution=merge-duplicates' },
			body: JSON.stringify(movements)
		});
		if (!movementResponse.ok) return json({ error: 'El intento se guardo, pero no sus movimientos.' }, { status: 502 });
	}
	return json({ accepted: true });
}
