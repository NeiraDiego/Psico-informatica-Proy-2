<script lang="ts">
	import { onMount } from 'svelte';
	import QueensBoard from '$lib/components/QueensBoard.svelte';
	import { flushAttemptOutbox, queueAttempt } from '$lib/client/outbox';
	import { isSolved } from '$lib/domain/queens-rules';
	import { addMovement, completeAttempt, createAttempt, type AttemptDraft, type CompletedAttempt } from '$lib/experiment/measurement';
	import { difficultyValidationPuzzles } from '$lib/protocol/demo';
	import type { BoardMovement } from '$lib/domain/types';

	type Screen = 'identify' | 'options' | 'tutorial' | 'boards' | 'complete';

	let screen = $state<Screen>('identify');
	let name = $state('');
	let registered = $state(false);
	let registrationMessage = $state('');
	let boardIndex = $state(0);
	let activeAttempt = $state<AttemptDraft | null>(null);
	let completedAttempts = $state<CompletedAttempt[]>([]);
	let boardLocked = $state(false);
	let moveCount = $state(0);
	let deliveryStatus = $state<'idle' | 'pending' | 'sent'>('idle');

	const activePuzzle = $derived(difficultyValidationPuzzles[boardIndex]);

	onMount(() => {
		void flushSavedAttempts();
		const retry = () => void flushSavedAttempts();
		window.addEventListener('online', retry);
		return () => window.removeEventListener('online', retry);
	});

	async function registerIdentity() {
		const normalizedName = name.trim();
		if (!normalizedName) {
			registrationMessage = 'Ingresa un nombre para continuar.';
			return;
		}
		const keyName = `queens-difficulty-validation-session:${normalizedName.toLowerCase()}`;
		let idempotencyKey = localStorage.getItem(keyName);
		if (!idempotencyKey) {
			idempotencyKey = crypto.randomUUID();
			localStorage.setItem(keyName, idempotencyKey);
		}
		const technicalEmail = `difficulty-${idempotencyKey}@example.invalid`;
		try {
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: normalizedName, email: technicalEmail, participant_name: normalizedName, idempotency_key: idempotencyKey }),
				credentials: 'same-origin'
			});
			registrationMessage = response.ok
				? 'Identificación registrada. Puedes continuar.'
				: 'No se pudo conectar al servidor. Los intentos quedarán guardados localmente hasta poder enviarlos.';
		} catch {
			registrationMessage = 'Sin conexión al servidor. Los intentos quedarán guardados localmente hasta poder enviarlos.';
		}
		registered = true;
		screen = 'options';
	}

	function beginBoards() {
		boardIndex = 0;
		activeAttempt = null;
		completedAttempts = [];
		moveCount = 0;
		screen = 'boards';
	}

	function startCurrentBoard() {
		activeAttempt = createAttempt(activePuzzle, boardIndex + 1, performance.now(), null, boardIndex === difficultyValidationPuzzles.length - 1);
		moveCount = 0;
		boardLocked = false;
	}

	function recordMovement(movement: BoardMovement) {
		if (!activeAttempt || boardLocked) return;
		const recorded = addMovement(activeAttempt, movement);
		if (!recorded) return;
		moveCount = activeAttempt.movements.length;
		if (isSolved(activeAttempt.final_board, activePuzzle)) finishAttempt('solved');
	}

	function finishAttempt(outcome: 'solved' | 'interrupted') {
		if (!activeAttempt || boardLocked) return;
		boardLocked = true;
		const completed = completeAttempt(activeAttempt, outcome, performance.now(), outcome === 'solved');
		completedAttempts = [...completedAttempts, completed];
		void saveAttempt(completed);
		activeAttempt = null;
		if (boardIndex === difficultyValidationPuzzles.length - 1) {
			screen = 'complete';
			return;
		}
		boardIndex += 1;
	}

	async function saveAttempt(attempt: CompletedAttempt) {
		deliveryStatus = 'pending';
		await queueAttempt(attempt);
		await flushSavedAttempts();
	}

	async function flushSavedAttempts() {
		try {
			const result = await flushAttemptOutbox();
			deliveryStatus = result.pending === 0 ? 'sent' : 'pending';
		} catch {
			deliveryStatus = 'pending';
		}
	}
</script>

<main>
	<header>
		<p class="eyebrow">Validación de dificultad</p>
		<h1>Tableros Queens</h1>
	</header>

	{#if screen === 'identify'}
		<section class="panel">
			<h2>Identificación</h2>
			<p>Ingresa tu nombre para respaldar tus intentos de evaluación. Los tableros no tienen límite de tiempo.</p>
			<form onsubmit={(event) => { event.preventDefault(); registerIdentity(); }}>
				<label>Nombre <input id="difficulty-validation-name" name="difficulty-validation-name" bind:value={name} autocomplete="name" required /></label>
				<button>Continuar</button>
			</form>
			{#if registrationMessage}<p class="upload-message">{registrationMessage}</p>{/if}
		</section>
	{:else if screen === 'options'}
		<section class="panel">
			<h2>¿Cómo quieres comenzar?</h2>
			<p>Elige el tutorial para repasar las reglas o comienza directamente la validación de dificultad.</p>
			<div class="actions">
				<button onclick={() => screen = 'tutorial'}>Ver tutorial</button>
				<button class="secondary" onclick={beginBoards}>Ir a tableros</button>
			</div>
			{#if registrationMessage}<p class="upload-message">{registrationMessage}</p>{/if}
		</section>
	{:else if screen === 'tutorial'}
		<section class="panel">
			<h2>Tutorial de Queens</h2>
			<p>Debe haber exactamente una reina por fila, columna y región. Las reinas no pueden estar en celdas contiguas, ni siquiera en diagonal.</p>
			<video class="tutorial-video" controls preload="metadata">
				<source src="/queens-tutorial.mp4" type="video/mp4" />
				Tu navegador no puede reproducir este video.
			</video>
			<ol class="tutorial-steps">
				<li>Usa una X para descartar celdas que no pueden contener una reina.</li>
				<li>Cuando una fila, columna o región solo tiene una posibilidad, esa celda debe contener una reina.</li>
				<li>Las reinas bloquean las ocho celdas que las rodean.</li>
			</ol>
			<div class="actions">
				<button onclick={beginBoards}>Comenzar tableros</button>
				<button class="secondary" onclick={beginBoards}>Saltar tutorial</button>
			</div>
		</section>
	{:else if screen === 'boards'}
		<section class="game-layout">
			<div class="game-meta"><span>Tablero {boardIndex + 1} de {difficultyValidationPuzzles.length}: {activePuzzle.label}</span><span>Movimientos: {moveCount}</span><span>Sin límite temporal</span></div>
			{#if activeAttempt}
				{#key activeAttempt.client_attempt_id}
					<QueensBoard board={activePuzzle} showRowNumbers showColumnLetters disabled={boardLocked} onmove={recordMovement} />
				{/key}
				<div class="actions"><button class="secondary" disabled={boardLocked} onclick={() => finishAttempt('interrupted')}>No seguir con este tablero</button></div>
			{:else}
				<p>Resuelve este tablero con calma. Tu tiempo, movimientos y acciones serán respaldados.</p>
				<button onclick={startCurrentBoard}>Iniciar tablero {boardIndex + 1}</button>
			{/if}
			{#if deliveryStatus === 'pending'}<p class="warning">Resultados pendientes de envío.</p>{:else if deliveryStatus === 'sent'}<p class="upload-message">Resultados respaldados.</p>{/if}
		</section>
	{:else}
		<section class="panel">
			<h2>Evaluación finalizada</h2>
			<p>Completaste o descartaste los {completedAttempts.length} tableros de validación.</p>
			{#if deliveryStatus === 'pending'}<p class="warning">Los resultados están guardados localmente y se enviarán cuando haya conexión.</p>{:else}<p class="upload-message">Resultados respaldados correctamente.</p>{/if}
			<div class="actions"><button onclick={beginBoards}>Repetir evaluación</button></div>
		</section>
	{/if}
</main>
