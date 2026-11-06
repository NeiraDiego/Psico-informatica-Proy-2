import { createHash, randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { supabaseConfig, supabaseRequest } from '$lib/server/supabase';

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

function chooseGroup() {
	return ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
}

export async function POST({ request, cookies }) {
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return json({ error: 'Cuerpo JSON inválido.' }, { status: 400 });
	const { name, email, participant_name, idempotency_key } = body as Record<string, unknown>;
	if (typeof name !== 'string' || !name.trim() || name.length > 200) return json({ error: 'Nombre inválido.' }, { status: 400 });
	if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || email.length > 320) return json({ error: 'Correo inválido.' }, { status: 400 });
	if (typeof idempotency_key !== 'string' || !/^[a-f0-9-]{36}$/i.test(idempotency_key)) return json({ error: 'Clave de idempotencia inválida.' }, { status: 400 });
	if (participant_name !== null && participant_name !== undefined && (typeof participant_name !== 'string' || participant_name.length > 200)) return json({ error: 'Participante inválido.' }, { status: 400 });
	if (!supabaseConfig()) return json({ error: 'Persistencia no configurada.' }, { status: 503 });

	const existing = await supabaseRequest(`sessions?select=id,group&idempotency_key=eq.${encodeURIComponent(idempotency_key)}`);
	if (!existing.ok) return json({ error: 'No se pudo consultar la sesión.' }, { status: 502 });
	const sessions = await existing.json() as Array<{ id: string; group: 'A' | 'B' | 'C' | 'D' | 'E' }>;
	if (sessions[0]) return json({ group: sessions[0].group, reused: true });

	const participantResponse = await supabaseRequest('participants', {
		method: 'POST',
		headers: { prefer: 'return=representation' },
		body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() })
	});
	if (!participantResponse.ok) return json({ error: 'No se pudo crear el participante.' }, { status: 502 });
	const [participant] = await participantResponse.json() as Array<{ id: string }>;
	const token = randomUUID() + randomUUID();
	const group = chooseGroup();
	const sessionResponse = await supabaseRequest('sessions', {
		method: 'POST',
		body: JSON.stringify({
			participant_id: participant.id,
			participant_name: typeof participant_name === 'string' && participant_name.trim() ? participant_name.trim() : null,
			group,
			protocol_version: 'draft-0.1.0',
			app_version: '0.1.0',
			assignment_method: 'uniform_random',
			status: 'registered',
			idempotency_key,
			access_token_hash: hashToken(token)
		})
	});
	if (!sessionResponse.ok) return json({ error: 'No se pudo crear la sesión.' }, { status: 502 });
	cookies.set('queens_session_token', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: !import.meta.env.DEV, maxAge: 60 * 60 * 24 * 14 });
	return json({ group, reused: false }, { status: 201 });
}
