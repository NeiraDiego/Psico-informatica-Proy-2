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

1. Ingrese un nombre y un correo de prueba.
2. Recorra la información, el tutorial y las tres tareas.
3. Finalice el experimento para acceder a las opciones de regreso.
4. Vuelva a ingresar con el mismo correo en este navegador para ver el acceso a Juego libre.
5. Para ver Configuración, use `diegoneira@gmail.com` como correo autorizado.

El reconocimiento de regreso se guarda solo en `localStorage` y contiene únicamente la lista de correos de prueba. Es una sustitución temporal de la persistencia de sesiones; no representa el comportamiento final ni debe usarse con datos personales reales.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/lib/domain` | Tipos estables del protocolo, tableros y celdas. |
| `src/lib/protocol/demo.ts` | Secuencias A/B/C, tableros y correo administrativo configurado. |
| `src/lib/components/QueensBoard.svelte` | Presentación del tablero y ciclo de clic. |
| `src/routes/+page.svelte` | Flujo de pantallas del experimento. |
| `src/styles.css` | Estilos de la interfaz. |
| `.env.example` | Forma prevista de declarar correos autorizados en servidor. |

`QueensBoard` admite cualquier matriz cuadrada de regiones y se reutiliza en el tutorial 5x5. La carga de juego libre acepta cualquier tablero cuadrado; la carga de tableros experimentales permanece deliberadamente restringida a 9x9 por el protocolo.

## Modo libre y configuración

- Una persona que vuelve con el mismo correo puede abrir **Juego libre**, que escoge aleatoriamente uno de los diez tableros del catálogo y no limita el tiempo. Sus movimientos no se guardan todavía.
- Tras completar el experimento aparecen las mismas opciones de regreso.
- **Configuración** se muestra solo para el correo autorizado indicado arriba. La versión definitiva consultará `ADMIN_EMAILS` exclusivamente en el servidor. La coincidencia de correo sin verificación no es autenticación robusta y no debe dar acceso a historiales ni datos de participantes.
- La configuración todavía no persiste ni publica cambios. La carga definitiva validará matriz 9x9, nueve regiones, conectividad y soluciones, y publicará versiones nuevas sin alterar sesiones históricas.

## Medición y envío

- Cada puzle experimental inicia un reloj monótono de 120 segundos al pulsar `Iniciar tarea`. El valor mostrado se deriva del instante límite, por lo que no depende de descontar ticks.
- Por movimiento se conserva índice, tipo, inicio y fin relativos, duración, latencia, cambios de celdas y cierre normal o cancelado. La lista `movement_latencies_ms` se deriva de esos eventos.
- Los intentos terminados se guardan primero en IndexedDB y se reintentan al recuperar conexión. La aplicación solo muestra `Resultados enviados` cuando `PUT /api/attempts/{id}` responde correctamente.
- Sin Supabase configurado, la sesión y los intentos quedan pendientes localmente. No se simula una confirmación de envío.
- En Configuración, los botones de respaldo descargan dos CSV de la cola pendiente: intentos y movimientos. No incluyen nombre ni correo, y solo contienen los registros almacenados en el navegador actual.

Para habilitar el backend, copie `.env.example` a `.env` y configure `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` solo en el entorno de servidor. Aplique antes la migración `supabase/migrations/202611060001_initial.sql`. La clave de servicio no se expone al navegador.

Actualmente Configuración permite cargar un JSON **solo durante la página abierta** para probar un tablero en Juego libre. Puede ser un tablero individual o un catálogo cuyo objeto raíz contiene `boards`. El archivo `data/queensgame-9x9.json` es un catálogo listo para cargar. Cada tablero debe contener `regions`, una matriz cuadrada de letras mayúsculas; cada letra representa una región y debe formar una zona conexa por sus lados. Debe haber tantas regiones como filas. `queenRowsByColumn` es una lista con una entrada por columna, de izquierda a derecha, que indica la fila donde se ubica la reina de la solución declarada.

Los tableros marcados como `experimental` o `both` deben ser 9x9 y usar las regiones `A` a `I`. Los tableros solo de `free_play` pueden tener otro tamaño cuadrado y usar letras hasta `Z`:

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

## Convertir mapas de origen

Los diez mapas suministrados en `../diez_mapas_9x9.json` se convirtieron a `data/queensgame-9x9.json`. Para regenerar ese archivo tras cambiar el origen:

```bash
npm run boards:convert
```

El conversor traduce regiones numéricas `0..8` a `A..I`, conserva identificador y URL de origen, y calcula una solución válida por búsqueda exhaustiva con las reglas de filas, columnas, regiones y adyacencia.

La secuencia provisional usa mapas del catálogo: A recibe niveles 16, 22 y 47; B/C reciben 58, 60 y 47. Por tanto, el tercer tablero es el mismo para los tres grupos. Esta secuencia y las etiquetas de dificultad siguen sujetas a aprobación del investigador.
