# Día 22 — 2026-08-26 — Neufert aplicado a ambientes, segunda vuelta: holguras de mobiliario que dimensionan el ancho útil real

El tema (10) se cubrió por primera vez el día 10 desde el triángulo de trabajo de cocina, el vestidor-buffer como walk-in caminable y el layout de baño por combinación de aparatos. Hoy entra en su segunda vuelta desde un ángulo distinto: las **holguras de circulación alrededor del mobiliario** (cama, mesa de comedor, armario, sofá-TV) que Neufert fija en centímetros exactos — y que deberían dimensionar el ancho útil real de cada ambiente, no solo el área mínima de la tabla del skill. Un dormitorio puede cumplir el área mínima (10.5 m²) y aun así no entrar una cama queen con paso a los dos lados si el ancho útil no se calculó contra el mobiliario real.

## Qué se investigó

- **Circulación alrededor de la cama**: la práctica estándar (documentos de dimensionamiento derivados de Neufert) recomienda dejar **al menos 0.70 m alrededor de la cama en todas las direcciones** para permitir el paso y el acceso a los dos lados; esto reproduce el criterio que el propio SKILL.md ya cita (Neufert p. 257: cama 2.00 + 0.75 por lado → frente 3.50 para una plaza y media/dos plazas) pero lo hace explícito como regla de verificación del ancho útil, no solo del área.
- **Mesa de comedor**: la separación mínima entre el borde de la mesa y una pared es de **0.75 m** (silla 0.50 m ocupada + margen), y sube a **≥1.00 m** si esa franja también funciona como paso de circulación — no es lo mismo comer en un rincón fijo que comer junto a un paso de tránsito. La distancia entre el tablero y el respaldo de la silla contigua es de 0.40-0.50 m (Neufert, "El arte de proyectar en arquitectura").
- **Armario/clóset**: la profundidad estándar para colgar ropa sin arrugarla es **0.55-0.60 m** — este es el ancho mínimo útil real de cualquier ambiente "vestidor" o de un tramo de clóset embebido en un dormitorio; un vestidor bien dimensionado para una persona no necesita mucho más que 1.5-2.0× esa profundidad de ancho para tener paso a ambos lados del riel.
- **Sofá-televisor**: la distancia recomendada entre el sofá y la pantalla es de aproximadamente **3 veces la diagonal del televisor** (una pantalla de 50" ≈ 1.27 m de diagonal → ~3.8 m) — un criterio blando (no hay campo de mobiliario en el JSON del skill) pero que conviene tener en la cabeza al fijar la profundidad de una sala-comedor amplia, para que el eje sala-TV no quede comprimido detrás del comedor.

## Ideas clave

1. El área mínima de la tabla del Paso 5 (SKILL.md) es una condición **necesaria pero no suficiente**: un dormitorio principal de 10.5 m² con proporción 3.50×3.00 cumple el área pero si el ancho útil real es, por ejemplo, 2.60 m, una cama queen (1.60 m) más 0.70 m de paso por lado ya pide 3.00 m — la habitación "pasa" el checklist mecánico y sin embargo no entra el mobiliario previsto. La verificación correcta es doble: área ≥ mínimo Y ancho útil ≥ ancho del mueble más grande + sus holguras de uso.
2. La misma lógica aplica al comedor dentro de una sala-comedor: si la silla retirada + el paso de servicio hacia la cocina comparten la misma franja, esa franja necesita ≥1.00 m, no los 0.75 m de una pared que no es también un paso.
3. Un "vestidor-buffer" (zona buffer del requisito de Sebastián) no debe sobredimensionarse "porque hay espacio" — un vestidor de 7 m² para una persona es tan remanente (CHK-23) como un tramo de muro sin función; el ancho correcto es 1.5-2.0× la profundidad del riel (0.55-0.60 m), es decir, un vestidor caminable de una persona funciona bien en ~1.6-2.2 m de ancho, no más.
4. Cuando el criterio de "todos los húmedos a ≤1.00 m del mismo muro húmedo" (CHK-19) choca con el ideal de "baño principal en suite dentro del propio dormitorio", el criterio geométrico duro gana: hay que aceptar un baño "adyacente por un hall corto" en vez de un ensuite aislado, tal como ya se resolvió el día 11. Hoy se repitió ese mismo trade-off en la unidad 3D (ver más abajo), y conviene declararlo como patrón recurrente, no como una excepción aislada.

## Reglas accionables para la distribución en Lima

- **Verificar el ancho útil de cada dormitorio contra el ancho de la cama prevista + 0.70 m de paso por lado (mínimo 0.60 m), no solo contra el área mínima de la tabla**: una cama de 1.60 m (queen) pide ≥3.00 m de ancho útil; una cama de 1.35 m (2 plazas) o un box individual pide ≥2.40-2.60 m. — Fuente: síntesis de holguras de circulación de cama basadas en Neufert ("El arte de proyectar en arquitectura"), consistente con SKILL.md Paso 5 (Neufert p. 257).
- **La franja entre la mesa de comedor y una pared/mueble debe ser ≥0.75 m si es solo zona de silla, y ≥1.00 m si esa misma franja también sirve de paso de circulación** (p. ej. hacia la cocina) — no basta con que el comedor "quepa" en el área mínima si la silla retirada bloquea el paso de servicio. — Fuente: Demarques, [Cuánto espacio debe haber entre las sillas del comedor](https://demarques.es/blog-de-decoracion-e-interiorismo/cuanto-espacio-debe-haber-entre-las-sillas-del-comedor-guia-completa--b284.html); DIAZCARO, [Distancia de seguridad de tablero de mesa y respaldo de silla](https://www.diazcaro.com/distancia-de-seguridad-de-tablero-de-mesa-y-respaldo-de-silla/) (cita "El arte de Proyectar en Arquitectura" de Neufert).
- **Dimensionar cualquier ambiente "vestidor"/walk-in por la profundidad estándar de colgado de ropa (0.55-0.60 m), no por el espacio sobrante del lote**: un vestidor de una persona funciona en ~1.6-2.2 m de ancho (riel + paso); superar ese rango sin agregar función (banca, cajonera, isla) es un remanente que CHK-23 debería objetar aunque el JSON no module mobiliario. — Fuente: Mesarte, [Guía Completa: Medidas de Armario Ropero](https://mesarte.es/medidas-armario-ropero/); Mi Hogar, [Medidas estándar armarios roperos](https://mihogar.blog/guias/medidas-estandar-armarios-roperos/).
- **Cuando 3 dormitorios y sus baños deben compartir un único muro húmedo (CHK-19) en un lote de fachada única, priorizar esa condición geométrica sobre el ideal de "baño en suite aislado" para el dormitorio principal**: si el baño más cercano al dormitorio principal no cabe a ≤1.00 m del mismo eje húmedo que sirve a los otros dormitorios, resolverlo como "baño adyacente vía un hall corto" (no ensuite) y compensar con más área de clóset dentro del propio dormitorio — mismo patrón ya usado el día 11, hoy confirmado como recurrente en lotes de fachada única con 3+ dormitorios. — Fuente: síntesis de CHK-19 (Neufert p. 57 y 277) aplicada al ejercicio u03 de hoy.

Estas 4 reglas se agregaron a `lecciones-distribucion.md` como reglas 86-89.

## Aplicación en los 3 ejercicios de hoy

- **u01 (1D/1B, San Isidro-Barranco, 7.20×7.60, 48.0 m²)**: el dormitorio principal se dimensionó a 3.20×3.475 m (ancho útil 3.20 m) precisamente para alojar una cama queen (1.60 m) con 0.70 m de paso a cada lado más un margen de 0.20 m para un tramo de clóset lateral — no el mínimo normativo de 2.90 m. El baño (2.475×3.75 a 4.275×5.85) tiene doble acceso: desde el vestidor (suite) y directo desde la sala-comedor (visita), sin que la visita cruce el dormitorio — aplicando la corrección c2 de Sebastián.
- **u02 (2D/2B esquina, Surco-La Molina, 8.30×9.60, 70.5 m²)**: dormitorio principal a 3.40 m de ancho (holgura de cama completa) y dormitorio 2 a 2.60 m (cama de 1.35 m + 0.60+0.45 m de paso asimétrico, un lado contra el medianero). El comedor dentro de la sala-comedor (18.0 m², ancho útil 4.00 m) tiene margen de sobra para la franja ≥1.00 m de silla+paso hacia la cocina sin comprometer el sofá.
- **u03 (3D/2B fachada única frente ancho, La Molina-Surco, 8.50×12.05, 90.0 m²)**: los 3 dormitorios se dimensionaron a 3.00/2.55/2.40 m de ancho útil (cama queen, cama de 1.35 m y cama de 1.20 m respectivamente, cada una con su holgura de paso). Al intentar dar al dormitorio principal un baño en suite dentro de su propia huella, el eje húmedo único (cocina+lavandería+baño principal+baño 2, los cuatro alineados sobre la misma línea a ≤0.08 m) quedó demasiado lejos del dormitorio principal (>1.00 m) — se resolvió, como ya ocurrió el día 11, sirviendo el baño principal desde el hall corto (sin cruzar ningún dormitorio) en vez de forzar un ensuite aislado que hubiera roto CHK-19.

## Autocrítica (Paso 8) — resumen

Los 3 JSON pasan `scripts/validator.py` sin errores ni advertencias:

```
✓ 2026-08-26-u01 OK
✓ 2026-08-26-u02 OK
✓ 2026-08-26-u03 OK
```

Verificación manual complementaria (lo que el validador mecánico no chequea):
- **CHK-06 (proporciones)**: todos los ambientes dentro de rango; el caso más ajustado es "baño principal" de u03 (3.60/1.50 = 2.40, exactamente en el máximo admitido para baños) — aceptado sin advertencia por estar dentro del límite, no por encima.
- **CHK-11 (ventanas solo en fachada/pozo real)**: verificado ambiente por ambiente contra la lista explícita de aristas de fachada/pozo de cada unidad (no por detección automática) antes de exportar los SVG — igual que los días 7, 9, 10, 13, 16, 18, 20; se confirmó visualmente con capturas de Chromium headless que ninguna ventana cae sobre un medianero.
- **CHK-17 (circulación ≤10%)**: u01 0% (cero pasillo), u02 hall 3.45/70.5 = 4.9%, u03 hall 8.25/90.0 = 9.2% — dentro del límite pero ajustado en u03, mismo razonamiento de "corridor tax" de las reglas 37/57/84 (fachada única frente ancho con hall de ancho completo sirviendo 3 dormitorios + 4 húmedos).
- **CHK-18 (privacidad de baño)**: en u02 y u03, al menos un baño (baño 2 en ambos casos) es alcanzable desde el ingreso sin cruzar ningún dormitorio.
- **CHK-19 (húmedos al muro húmedo)**: en las 3 unidades, cada húmedo queda a ≤0.15 m del segmento `muro_humedo` declarado (muy por debajo del máximo de 1.00 m), con solape proyectado ≥0.60 m en todos los casos.

Advertencia [A] aceptada y justificada: en u03, el baño principal no es un ensuite aislado sino que se sirve desde el hall (ver regla 89) — se documenta explícitamente en el nombre de la unidad para que no se lea como un olvido de diseño.

## Correcciones de Sebastián (paso 2b)

`correcciones/pendientes.md` sigue igual que desde el día 5 (c2/c3/c4, ya aplicado) — sin corrección nueva del puente que leer hoy; se revisaron igualmente las 3 imágenes anotadas por completitud (no cambiaron respecto a días anteriores). Las 3 unidades de hoy siguen aplicando ese criterio como regla dura: fachada viva en las 3 (ningún muro ciego al frente — el frente lo ocupan sala-comedor + dormitorio en u01, sala-comedor + dormitorio principal en u02, sala-comedor + estudio en u03); cocina americana rotulada en u01 (sin ambiente "cocina" separado, integrada y descrita en el nombre de la unidad); baño de doble acceso suite/visita en u01; terraza siempre presente y dimensionada ≥10 m² en las 3, nunca como remanente pequeño.

## Estado de red

No se llamó a `aliceai.bam.pe` (bloqueo de egreso de la sesión, confirmado en todas las corridas previas) — se prioriza commit+push a la rama para que el puente en Railway levante las plantas y avise por WhatsApp. La investigación de hoy se hizo con `WebSearch` (Tavily no está autorizado en esta sesión).
