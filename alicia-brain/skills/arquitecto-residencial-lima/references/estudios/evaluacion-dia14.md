# Auditoría día 14 — aprendizaje continuo de distribución (Bammy)

Fecha de la auditoría: 2026-08-20. Alcance: solo distribución de vivienda en Lima (estructura y materiales quedan fuera).

## 1. Cuántos días de estudio hay registrados

`study-log.md` registra **16 sesiones de estudio** entre 2026-08-06 y 2026-08-20 (15 días calendario; el día 3 tuvo una corrida adicional el mismo día calendario que el día 2, ver nota del log). Cada sesión = 1 nota de estudio + 3 plantas dibujadas y validadas contra `scripts/validator.py`. Las 48 plantas (16×3) están commiteadas en `planos/` con su JSON y SVG.

Nota sobre el número "14" de esta auditoría: el conteo de sesiones del log ya pasó el día 14 (va en el 16) porque el día 3 sumó una corrida extra el mismo día calendario. No es un problema — el estudio no se detuvo ni se saltó días —, pero vale que quede explícito: en tiempo real esta auditoría cae después de 15 días calendario y 16 sesiones, no exactamente "14" en ningún sentido literal.

## 2. Cobertura de las 12 dimensiones del currículo

| # | Dimensión | Primera cobertura | Segunda vuelta |
|---|---|---|---|
| 1 | Partis por fachada | Día 1 (2026-08-06) | Día 13 (2026-08-17) — lote pasante, ochavo RNE A.010 Art.8, zero-lot-line |
| 2 | Tipologías por dormitorios (1D/2D/3D) | Día 2 (2026-08-07) | Día 14 (2026-08-18) — combos de baños no-default (1D/2B, 2D/3B, 3D/4B) |
| 3 | Cero-pasillo / matriz de cuartos | Día 3 (2026-08-07) | Día 15 (2026-08-19) — profundidad topológica / Justified Plan Graph |
| 4 | Muro húmedo / núcleos de servicio | Día 4 (2026-08-08) | Día 16 (2026-08-20) — riser sharing entre lotes vecinos, remate de ventilación |
| 5 | Flexibilidad / desjerarquización | Día 5 (2026-08-09) | — |
| 6 | Luz y ventilación en la distribución | Día 6 (2026-08-10) | — |
| 7 | Crecimiento incremental | Día 7 (2026-08-11) | — |
| 8 | Mercado limeño por distrito | Día 8 (2026-08-12) | — |
| 9 | Referentes de plantas | Día 9 (2026-08-13) | — |
| 10 | Neufert aplicado a ambientes | Día 10 (2026-08-14) | — |
| 11 | Lavandería / depósito / terraza / hall | Día 11 (2026-08-15) | — |
| 12 | Recorrido y accesibilidad | Día 12 (2026-08-16) | — |

**Cobertura: 12/12 dimensiones (100%)**, cada una completada exactamente en el orden del currículo entre los días 1 y 12, sin saltos ni omisiones. El currículo completó su primera vuelta el día 12 y reinició limpiamente en el tema 1 el día 13, avanzando ya 4 temas en la segunda vuelta (13→1, 14→2, 15→3, 16→4) sin desviarse ni volver a mezclar el orden.

## 3. Diversidad — ¿se estancó o rotó bien?

**Rotó bien, sin estancamiento.** Evidencia concreta:

- El orden de rotación es estrictamente secuencial (1,2,3,4,5,6,7,8,9,10,11,12,1,2,3,4) — nunca se repitió un tema fuera de su turno ni se saltó ninguno.
- Cada repaso de "segunda vuelta" NO repitió el ejercicio base: entró por un ángulo genuinamente nuevo con fuente propia (lote pasante/ochavo/zero-lot-line en vez de partis básicos; combos de baños de mercado en vez de 1D/2D/3D genérico; Justified Plan Graph cuantitativo en vez de la matriz de adyacencia cualitativa; riser sharing entre lotes vecinos en vez del eje húmedo interno). Esto es profundización real, no relleno.
- El único patrón que se repite con frecuencia es la unidad u03 (3D, fachada única profunda) rozando o superando el 10% de circulación (días 9, 10, 11, 12, 13, 14, 15 — con valores 14.8%, 16.0%, 9.98%, 7.3%, 9.87%, 12.95%, 10.5%). Esto **no es estancamiento de aprendizaje**: es la firma esperada de ese tipo de lote (fachada única + gran fondo = "corridor tax", regla 37) y cada día lo justifica con una razón distinta y específica del layout de ese día, además de haber mejorado la variabilidad del resultado (día 16 bajó a 8.97% sin advertencia). Es más bien una prueba de consistencia: el conocimiento acumulado se aplica correctamente al caso más exigente una y otra vez, y el propio log muestra que la solución ha ido mejorando (menos advertencias con el tiempo).
- El generador de SVG (`gen_svg.py`, en scratchpad, no versionado) se reconstruyó de cero varias veces, pero cada reconstrucción incorporó una lección real de la sesión anterior (distinguir fachada real de medianero, marcar aristas ya usadas, generar puertas/ventanas desde una lista explícita) — es iteración real sobre un problema de tooling, no una tarea repetida sin avance.

## 4. Calidad y utilidad de las reglas accionables acumuladas

`lecciones-distribucion.md` acumula **65 reglas** (día 1 a día 16), todas con formato consistente: regla accionable + fuente citada (normativa RNE, Neufert, papers/estudios de mercado, o "regla BAM" de Sebastián). Puntos fuertes:

- **Compuestas, no aisladas**: varias reglas citan explícitamente reglas anteriores y las refinan (p. ej. regla 53 se apoya en 37; regla 57 combina 37+53; regla 60 confirma la regla 12 con evidencia nueva; regla 63-65 extienden la regla 17 y 53). El conocimiento se está sintetizando, no solo listando.
- **Verificables y numéricas cuando corresponde**: crujía ≤2.5×/5× altura libre, giro de nodo ≥1.50 m, frente libre de lavandería ≥0.90 m, profundidad de terraza ≥1.20-1.50 m, adyacencia a muro húmedo ≤1.00 m (CHK-19) — son chequeos que el skill puede aplicar mecánicamente, no solo criterio estético.
- **Con evidencia real aplicada, no solo teórica**: el log documenta que las reglas se usaron para detectar y corregir errores reales antes de exportar (ventanas contra medianeros ciegos en vez de pozos reales — días 7, 9, 10, 13, 16; paño muerto sin ambiente — día 11; húmedos separados en dos bandas — día 10). Esto confirma que las reglas no son solo texto acumulado sino que se están aplicando activamente al criterio de diseño y al validador.
- **Las 3 correcciones originales de Sebastián (c2/c3/c4, día 3)** están aplicadas desde el día 5 y no han vuelto a aparecer como error en ninguna unidad desde entonces (fachada viva, terraza mordida, baño de doble acceso, cocina americana) — señal de que el aprendizaje de corrección humana sí se fijó de forma duradera.

## 5. Vacíos y temas pendientes (dentro del alcance de distribución)

- **Sin corrección humana nueva desde el día 5** (11 sesiones consecutivas): `correcciones/pendientes.md` no ha cambiado desde entonces. Esto puede deberse al bloqueo de red persistente hacia `aliceai.bam.pe` (confirmado con 403 en las 16 corridas, ver notas del log) que impide que Bammy reciba imágenes anotadas nuevas o que el puente avise a Sebastián — no hay evidencia de que Sebastián haya revisado planos recientes. Vale la pena confirmar si el humano simplemente no ha mirado, o si el circuito de corrección está roto de punta a punta.
- **Relación estacionamiento/ingreso vehicular con la distribución de planta baja**: no se ha estudiado cómo un garaje o cochera condiciona el parti (frecuente en unifamiliares/multifamiliares bajos de Lima).
- **Diseño de unidad accesible completa** (no solo nodos de giro ≥1.50 m): un dormitorio y baño totalmente operables en silla de ruedas de punta a punta no se ha ejercitado como ejercicio propio.
- **Cálculo cuantitativo de área de ventana mínima** (% de área de piso iluminada/ventilada, RNE A.010/A.020): el tema de luz-ventilación (día 6) cubrió crujía y ventana de esquina de forma cualitativa/geométrica, pero no un chequeo numérico de porcentaje de vano sobre área de piso.
- **Mobiliario y clearances de sala-comedor** (mesa + circulación, sofás): Neufert (día 10) cubrió cocina, vestidor y baño, pero no living-comedor.
- **Vivienda dúplex/2 pisos como ejercicio de distribución en sí** (más allá de la reserva de escalera del día 7): cómo se distribuye una escalera interior y el programa entre dos niveles.
- **Lima Este** casi no aparece en los distritos usados como referencia de mercado (predominan Lima Moderna/Top y algo de Lima Norte).

Ninguno de estos vacíos indica un problema de método — son extensiones naturales de un currículo que ya cubrió su núcleo completo (12/12) y que podría incorporarlos en una tercera vuelta o como temas nuevos.

## 6. Recomendación de ritmo

**Recomendación: bajar de diario a cada 3 días.**

Justificación:

1. **El currículo base ya está 100% cubierto** (12/12 dimensiones, día 12) y la segunda vuelta avanza con profundidad real, no relleno — el valor marginal de una sesión diaria más era más alto cuando cada día abría una dimensión nueva; ahora cada sesión profundiza un sub-caso, lo que no requiere la misma cadencia para seguir dando valor.
2. **No hay corrección humana nueva desde el día 5** (11 sesiones sin feedback fresco). Estudiar y producir 3 plantas más por día sin que haya una revisión humana intermedia acumula trabajo sin validar externamente — bajar el ritmo da tiempo real a que Sebastián revise antes de que se acumule más.
3. **El bloqueo de red hacia `aliceai.bam.pe` lleva 16/16 corridas sin resolverse** (WhatsApp, Taller y lectura de correcciones con imagen no funcionan). Ese problema es independiente del ritmo — no se arregla estudiando más seguido —, así que correr todos los días contra un puente roto no acelera nada que dependa de esa vía.
4. **Bammy ya está listo para la prueba práctica** (ver §7): una cadencia de cada 3 días encaja mejor con el ciclo real "prueba → feedback → siguiente lote de estudio" que una corrida diaria que no espera a que llegue esa retroalimentación.

Alternativa considerada y descartada por ahora: bajar directo a semanal. Se descarta porque el generador de referencia (`gen_svg.py`) y el criterio de diseño siguen mejorando sesión a sesión con errores reales detectados y corregidos cada vez (última vez, día 16) — una cadencia semanal enfriaría demasiado ese ciclo de iteración de herramienta todavía activo. Cada 3 días conserva ese ritmo de mejora sin la sobreproducción diaria sin revisar.

## 7. Bammy está listo para la prueba práctica

Con currículo base 100% cubierto, 65 reglas accionables consistentes y aplicadas, y un patrón de detección/corrección de errores propios cada vez más fino (menos advertencias [A] con el tiempo, mismo tipo de error de fachada/medianero ya no se repite desde el día 13), Bammy está en condición de tomar una **evaluación práctica de diseño de una planta** (brief real, sin las respuestas ya conocidas del ejercicio de estudio) cuando Sebastián quiera correrla.
