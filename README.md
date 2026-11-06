# Queens: Psicoinformatica Proyecto 2

Aplicacion SvelteKit para el experimento Queens. Esta primera entrega es una demostracion navegable con configuracion y datos sinteticos. **No esta habilitada para recolectar datos reales.**

## Ejecutar

Requiere Node.js 26 o una version compatible con las dependencias declaradas.

```bash
npm install
npm run dev
```

Comprobaciones disponibles:

```bash
npm run check
npm run build
```

## Probar la demostracion

1. Ingrese un nombre y un correo de prueba.
2. Recorra la informacion, el tutorial y las tres tareas sinteticas.
3. Finalice la demostracion para acceder a las opciones de regreso.
4. Vuelva a ingresar con el mismo correo en este navegador para ver el acceso a juego libre.
5. Para ver Configuracion, use `diegoneira@gmail.com` como correo de demostracion.

El reconocimiento de regreso se guarda solo en `localStorage` y contiene unicamente la lista de correos de prueba. Es una sustitucion temporal de la persistencia de sesiones; no representa el comportamiento final ni debe usarse con datos personales reales.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/lib/domain` | Tipos estables del protocolo, tableros y celdas. |
| `src/lib/protocol/demo.ts` | Secuencias A/B/C, tableros y correo administrativo exclusivamente sintéticos. |
| `src/lib/components/QueensBoard.svelte` | Presentacion del tablero y ciclo de clic de demostracion. |
| `src/routes/+page.svelte` | Flujo de pantallas local; no asigna ni persiste grupos reales. |
| `src/styles.css` | Estilos de la interfaz. |
| `.env.example` | Forma prevista de declarar correos autorizados en servidor. |

## Modo libre y configuracion

- Una persona que vuelve con el mismo correo puede abrir **Juego libre**, que escoge aleatoriamente un tablero marcado como disponible y no limita el tiempo. Sus movimientos no se guardan todavía.
- Tras completar la demostracion aparecen las mismas opciones de regreso.
- **Configuracion** se muestra solo para el correo sintético indicado arriba. La version definitiva consultara `ADMIN_EMAILS` exclusivamente en el servidor. La coincidencia de correo sin verificacion no es autenticacion robusta y no debe dar acceso a historiales ni datos de participantes.
- La configuracion todavia no persiste ni publica cambios. La carga definitiva validara matriz 9x9, nueve regiones, conectividad y soluciones, y publicara versiones nuevas sin alterar sesiones historicas.

Actualmente Configuracion permite cargar un JSON **solo durante la pagina abierta** para probar un tablero en juego libre. El archivo debe tener este formato; `regions` debe contener nueve filas de nueve enteros y cada identificador debe formar una region conexa por sus lados:

```json
{
  "id": "tablero-prueba-01",
  "label": "Tablero de prueba",
  "availability": "both",
  "regions": [[1, 1, 1, 1, 1, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2, 2, 2, 2], [3, 3, 3, 3, 3, 3, 3, 3, 3], [4, 4, 4, 4, 4, 4, 4, 4, 4], [5, 5, 5, 5, 5, 5, 5, 5, 5], [6, 6, 6, 6, 6, 6, 6, 6, 6], [7, 7, 7, 7, 7, 7, 7, 7, 7], [8, 8, 8, 8, 8, 8, 8, 8, 8], [9, 9, 9, 9, 9, 9, 9, 9, 9]]
}
```

`availability` admite `experimental`, `free_play` o `both`. La carga persistente y la validacion de soluciones se implementaran junto con Supabase.

## Decisiones pendientes antes de recoleccion

- Aprobar textos de consentimiento, retirada, proteccion de datos, cierre explicativo y advertencia de grupo C.
- Definir los tableros reales, su estado de solucion y su validacion independiente.
- Confirmar la secuencia final del grupo A y el significado operativo del segundo tablero de B/C.
- Definir poblacion, criterios, muestra, plan analitico y politica de dispositivos e interrupciones.
- Implementar API, Supabase con RLS, cookies seguras, cola IndexedDB, validacion de servidor y exportaciones privadas.
- Implementar reglas completas, gestos de arrastre, reloj monotono de 120 segundos y pruebas del protocolo.
