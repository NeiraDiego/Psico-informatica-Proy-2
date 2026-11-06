import type { CompletedAttempt } from '$lib/experiment/measurement';

const DATABASE = 'queens-outbox';
const STORE = 'attempts';

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'client_attempt_id' });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const request = action(database.transaction(STORE, mode).objectStore(STORE));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export function queueAttempt(attempt: CompletedAttempt) {
	return transaction('readwrite', (store) => store.put(attempt));
}

export function removeQueuedAttempt(clientAttemptId: string) {
	return transaction('readwrite', (store) => store.delete(clientAttemptId));
}

export function queuedAttempts() {
	return transaction<CompletedAttempt[]>('readonly', (store) => store.getAll());
}

export async function flushAttemptOutbox() {
	const attempts = await queuedAttempts();
	let sent = 0;
	for (const attempt of attempts) {
		try {
			const response = await fetch(`/api/attempts/${attempt.client_attempt_id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(attempt),
				credentials: 'same-origin'
			});
			if (response.ok) {
				await removeQueuedAttempt(attempt.client_attempt_id);
				sent += 1;
			}
		} catch {
			break;
		}
	}
	return { sent, pending: attempts.length - sent };
}
