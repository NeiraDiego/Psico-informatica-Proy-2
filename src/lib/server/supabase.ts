import { env } from '$env/dynamic/private';

export function supabaseConfig() {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
	return { url: env.SUPABASE_URL.replace(/\/$/, ''), key: env.SUPABASE_SERVICE_ROLE_KEY };
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
	const config = supabaseConfig();
	if (!config) throw new Error('Supabase no está configurado.');
	return fetch(`${config.url}/rest/v1/${path}`, {
		...init,
		headers: {
			apikey: config.key,
			authorization: `Bearer ${config.key}`,
			'content-type': 'application/json',
			...(init.headers ?? {})
		}
	});
}
