# Queens: Psicoinformática Proyecto 2

Aplicación SvelteKit para el experimento Queens. La interfaz y el almacenamiento local están implementados, pero **no debe iniciarse recolección real** hasta aprobar protocolo, textos, tableros y configurar Supabase.

## Ejecutar

Requiere Node.js 26 o una versión compatible con las dependencias declaradas.

```bash
npm install
npm run dev
```

Comprobaciones disponibles:

```bash
npm run check
npm run build
```

## Probar la aplicación

1. Abra `/` y lea el consentimiento informado.
2. Ingrese un nombre y marque **Acepto lo antes expuesto**.
3. En la pantalla siguiente, el correo es opcional y solo se solicita si desea conocer sus resultados relativos a su grupo.
4. Complete el tutorial y las tres tareas experimentales.
5. Para ver Configuración, ingrese con `diegoneira@gmail.com` como correo opcional.

La sesión de navegación se conserva localmente en el navegador. Las rutas que dependen de una persona conectada redirigen al consentimiento si no existe una sesión local.

## Rutas

| Ruta | Responsabilidad |
| --- | --- |
| `/` | Consentimiento informado e identificación. |
| `/menu` | Menú de una persona conectada. |
| `/tutorial` | Tutorial interactivo del experimento. |
| `/experiment` | Tres tareas experimentales cronometradas. |
| `/free_play` | Juego libre sin límite de tiempo. |
| `/settings` | Configuración para correos autorizados. |
| `/validacion_tutorial` | Tutorial y tablero 303 de validación de aprendizaje. |
| `/validacion_dificultades` | Identificación y evaluación de dificultad sin límite temporal. |

La lógica común de las rutas principales está en `src/lib/components/QueensApp.svelte`. `QueensBoard` admite cualquier matriz cuadrada de regiones.

## Secuencia experimental predeterminada

| Grupo | Tarea 1 | Tarea 2 | Tarea 3 |
| --- | --- | --- | --- |
| A, control | 103, fácil | 303, intermedio | 310 |
| B | 468 modificado, difícil | 178 modificado, difícil | 310 |
| C | 468 modificado, difícil | 178 modificado, difícil | 310 |

Los grupos B y C reciben información adicional antes del tutorial. La asignación actual es aleatoria entre A, B y C.

## Modo libre y configuración

- Una persona conectada puede abrir **Juego libre**, que escoge aleatoriamente un tablero del catálogo y no limita el tiempo. Sus movimientos no se guardan.
- El catálogo generado en `data/queensgame-catalog.json` añade 1.402 tableros de 6×6, 7×7, 8×8 y 9×9 para Juego libre. Proviene de los archivos en `tableros/`; se puede regenerar con `npm run boards:catalog`.
- **Configuración** se muestra solo para correos autorizados. La coincidencia de correo sin verificación es temporal y no constituye autenticación robusta.
- Configuración permite registrar un nombre de participante separado del nombre y correo del experimentador que abre la sesión. El valor se guarda en `sessions.participant_name`.
- La configuración todavía no persiste ni publica cambios. La carga definitiva validará matriz 9x9, nueve regiones, conectividad y soluciones, y publicará versiones nuevas sin alterar sesiones históricas.

## Medición y envío

- Cada puzle experimental inicia un reloj monótono de 120 segundos al pulsar `Iniciar tarea`. Las validaciones de tutorial y dificultad no tienen límite de tiempo.
- Por movimiento se conserva índice, tipo, inicio y fin relativos, duración, latencia, cambios de celdas y cierre normal o cancelado. La lista `movement_latencies_ms` se deriva de esos eventos.
- Los intentos terminados se guardan primero en IndexedDB y se reintentan al recuperar conexión. La aplicación solo muestra `Resultados enviados` cuando `PUT /api/attempts/{id}` responde correctamente.
- Sin Supabase configurado, la sesión y los intentos quedan pendientes localmente. No se simula una confirmación de envío.
- En Configuración, los botones de respaldo descargan dos CSV de la cola pendiente: intentos y movimientos. No incluyen nombre ni correo, y solo contienen los registros almacenados en el navegador actual.

Para habilitar el backend, copie `.env.example` a `.env` y configure `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` solo en el entorno de servidor. Aplique todas las migraciones de `supabase/migrations/` en orden, incluida `202611060006_extend_difficulty_validation_to_seven_attempts.sql`. La clave de servicio no se expone al navegador.

Actualmente Configuración permite cargar un JSON **solo durante la página abierta** para probar un tablero en Juego libre. Puede ser un tablero individual o un catálogo cuyo objeto raíz contiene `boards`. El archivo `data/queensgame-9x9.json` es un catálogo listo para cargar. Cada tablero debe contener `regions`, una matriz cuadrada de letras mayúsculas; cada letra representa una región y debe formar una zona conexa por sus lados. Debe haber tantas regiones como filas. `queenRowsByColumn` es una lista con una entrada por columna, de izquierda a derecha, que indica la fila donde se ubica la reina de la solución declarada.

Los tableros pueden tener cualquier tamaño cuadrado y usar letras hasta `Z`:

```json
{
  "id": "tablero-prueba-01",
  "label": "Tablero de prueba",
  "availability": "both",
  "regions": [["A", "A", "A", "A", "A", "A", "A", "A", "A"], ["B", "B", "B", "B", "B", "B", "B", "B", "B"], ["C", "C", "C", "C", "C", "C", "C", "C", "C"], ["D", "D", "D", "D", "D", "D", "D", "D", "D"], ["E", "E", "E", "E", "E", "E", "E", "E", "E"], ["F", "F", "F", "F", "F", "F", "F", "F", "F"], ["G", "G", "G", "G", "G", "G", "G", "G", "G"], ["H", "H", "H", "H", "H", "H", "H", "H", "H"], ["I", "I", "I", "I", "I", "I", "I", "I", "I"]],
  "queenRowsByColumn": [1, 3, 5, 7, 9, 2, 4, 6, 8]
}
```

`availability` admite `experimental`, `free_play` o `both`. La carga comprueba que las posiciones declaradas no compartan fila ni región y que no haya reinas adyacentes. La persistencia y un solver independiente que cuente soluciones se implementarán junto con Supabase.

## Validación de dificultades

`/validacion_dificultades` guarda los mismos datos de intento y movimiento que el experimento, pero no aplica un límite temporal y permite abandonar un tablero mediante **No seguir con este tablero**. Evalúa 310, 137, 468 modificado, 178 modificado, 158, 130 y 103.

## Datos sintéticos

`data/synthetic-results/` contiene datos ficticios para probar análisis estadístico: 60 participantes, 20 por cada grupo A, B y C. Para regenerarlos:

```bash
npm run results:synthetic
```

## Convertir mapas de origen

Los diez mapas suministrados en `../diez_mapas_9x9.json` se convirtieron a `data/queensgame-9x9.json`. Para regenerar ese archivo tras cambiar el origen:

```bash
npm run boards:convert
```

El conversor traduce regiones numéricas a letras, conserva identificador y URL de origen, y calcula una solución válida por búsqueda exhaustiva con las reglas de filas, columnas, regiones y adyacencia. Para regenerar el catálogo completo de `tableros/`:

```bash
npm run boards:catalog
```
