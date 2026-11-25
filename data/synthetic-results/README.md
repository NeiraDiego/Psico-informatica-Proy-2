# Resultados sintéticos

Estos archivos contienen datos **ficticios** para probar análisis, gráficos e importaciones. No proceden de participantes reales y no deben mezclarse con datos de recolección.

- 60 participantes: 20 por grupo experimental A, B y C.
- 180 intentos: tres por participante.
- B y C comparten los tableros 1 y 2 (`queensgame-58`, `queensgame-60`).
- A, B y C comparten el tablero 3 (`queensgame-47`), marcado como `is_primary_outcome`.

`participants.csv`, `sessions.csv` y `puzzle_attempts.csv` siguen las columnas de las tablas de Supabase. Los nombres y correos usan el dominio no enrutable `example.invalid`.

`analysis_attempts.csv` es una versión plana, conveniente para análisis estadístico. `queens_found` y `mean_latency_ms` son variables derivadas simuladas para facilitar pruebas; no son columnas propias de la tabla `puzzle_attempts`.

La simulación incorpora intencionalmente diferencias entre grupos: para la tarea 3, el número de éxitos es A=16/20, B=11/20 y C=8/20. Esto permite comprobar que los análisis detectan una diferencia, pero **no constituye una hipótesis confirmada ni un resultado esperado del estudio**.

Para regenerar los archivos de manera determinista:

```bash
node scripts/generate-synthetic-results.mjs
```
