# Día 1 — Partis por fachada (única frente-ancho, única lote-profundo, esquina, pozo)

**Fecha**: 2026-08-06
**Alcance**: solo distribución/layout de vivienda. Fuera de alcance: estructura, materiales, constructabilidad.

## Qué estudié

El tema de hoy es el punto de partida de todo el skill (SKILL.md Paso 2): cómo la forma y orientación del frente disponible determina el *parti* — el esquema organizador de la planta — antes de dimensionar ningún ambiente. Repasé:

1. **`tipologias-lima.md`**, los 12 ejemplares (T01–T12), clasificándolos por tipo de fachada:
   - Fachada única, frente ancho, cero pasillo: T03, T04 (banda social al frente, banda húmeda corrida al fondo — el parti más eficiente y el más frecuente del mercado).
   - Fachada única, lote profundo: T07, T09 (bandas sucesivas: social+terraza / núcleo húmedo / dormitorio+hall / dormitorios al fondo, con núcleo húmedo central para no alargar montantes).
   - Esquina: T05, T08, T10, T11 (sala en el vértice tomando luz de dos frentes; permite 3D sin pasillo porque el hall se acorta).
   - Compacto de inversión (fachada única): T12, con muro húmedo apilado junto al ingreso.
2. **RNE A.020 Art. 11.4** (pozos de luz) contra el texto oficial vigente (RM 188-2021-VIVIENDA), para no arrastrar el error del "1/8" derogado que ya está señalado en `rne.md`. Confirmé con dos fuentes independientes (SlideShare del reglamento ilustrado y el PDF de vivienda.gob.pe) las distancias mínimas de pozo:
   - Unifamiliar: dormitorio/sala/comedor ≥ 2.00 m; cocina y patios de servicio techados ≥ 1.80 m (Cuadro N° 03, Art. 11.4.a).
   - Multifamiliar: la distancia se calcula como % de la altura del paramento opuesto por tramos de 18 m de altura (Cuadro N° 04), pero el **mínimo absoluto nunca baja de 2.10 m** aunque el cálculo por altura dé menos (Art. 11.4.b, nota vi) — este es el número que uso como piso duro en cualquier pozo de multifamiliar, independientemente del cálculo por altura.
   - Fuente primaria: https://ww3.vivienda.gob.pe/ejes/vivienda-y-urbanismo/documentos/Reglamento%20Nacional%20de%20Edificaciones.pdf (RNE oficial, define "pozo de luz" y Art. 20 sobre pozos techados).
   - Fuente secundaria (reglamento ilustrado, confirma Cuadro N° 03 con diagrama D1/D2): https://es.slideshare.net/slideshow/reglamento-ilustrado-a010-a020-a030pdf/259071892

## Ideas clave

- **El parti se elige por las fachadas disponibles, no al revés.** Antes de zonificar día/noche hay que saber cuántos lados dan a la calle, a un patio propio o a un pozo — eso fija dónde puede ir la banda social (necesita el frente más generoso) y dónde el núcleo húmedo (puede vivir sin ventana si está ≤0.30 m de un ambiente iluminado o del perímetro).
- **"Fachada única, lote profundo" no significa que solo el frente tenga luz.** Los ejemplares T07/T09 tratan también el lado y el fondo del rectángulo envolvente como caras válidas para ventana, asumiendo que existe un patio posterior o un pozo lateral dentro del propio lote — es la única forma de iluminar el dormitorio de en medio en una planta profunda sin pasillo central ciego. El checklist (CHK-11) no distingue "fachada real" de "pozo declarado": solo verifica proximidad geométrica al perímetro del rectángulo frente×fondo, así que la responsabilidad de que ese lado realmente dé a algo abierto es del diseñador, no de la validación mecánica.
- **La esquina es el único parti que permite 3D sin pasillo con holgura**, porque la sala puede tomar luz de dos lados desde el vértice y el hall se reduce a lo mínimo — confirmado también por la literatura general de diseño en esquina (tratamiento del vértice como elemento articulador, aplicable a la lógica de plantas residenciales).
- **El "2.10 m absoluto" en pozos multifamiliares es más estricto que muchos cálculos por altura en edificios bajos** (para un edificio de pocos pisos, 30%/25% de la altura del paramento puede dar menos de 2.10 m) — por eso conviene fijar 2.10 m como dato de partida en el programa, no como resultado de un cálculo que se revisa al final.

## Reglas accionables para la distribución en Lima

1. Clasificar el brief por tipo de fachada ANTES de zonificar: única-frente-ancho → sala-comedor central cero-pasillo con banda húmeda posterior corrida (T04); única-lote-profundo → bandas sucesivas con núcleo húmedo central y dormitorios a patio/pozo posterior (T09); esquina → sala en el vértice con doble frente, hall corto o inexistente (T05/T08). — Fuente: `tipologias-lima.md` T04/T05/T09, `SKILL.md` Paso 2.
2. En pozos de luz de multifamiliar, usar **2.10 m como mínimo absoluto no negociable**, incluso si el cálculo por % de altura del paramento opuesto (Cuadro N° 04, tramos de 18 m) diera un valor menor. — Fuente: RNE A.020 Art. 11.4.b nota vi; PDF oficial https://ww3.vivienda.gob.pe/ejes/vivienda-y-urbanismo/documentos/Reglamento%20Nacional%20de%20Edificaciones.pdf
3. En unifamiliar, diferenciar el mínimo de pozo por uso del ambiente servido: 2.00 m si sirve a dormitorio/sala/comedor, 1.80 m si sirve solo a cocina o patio de servicio techado — no aplicar 2.00 m parejo a todo. — Fuente: RNE A.020 Art. 11.4.a, Cuadro N° 03.
4. Cuando el lote es profundo y no hay pasillo lateral con luz propia, verificar explícitamente (con acotado en el plano) que el lado o fondo que ilumina al dormitorio intermedio corresponde a un patio o pozo real dentro del lote — el checklist geométrico (CHK-11) no puede distinguir esto de una medianera ciega, así que es una revisión de criterio, no solo de cómputo.

## Aplicación de hoy en las 3 plantas diseñadas

- **u01** (1D/1B) aplica el parti de **fachada única, frente ancho**: dormitorio y sala-kitchenette comparten el único frente (ambas ventanas en la misma arista), banda húmeda corrida al fondo.
- **u02** (2D/2B) aplica el parti de **esquina**: la sala-comedor toma luz de dos fachadas distintas desde el vértice (dos ventanas en aristas perpendiculares), lo que permite resolver 2D/2B con circulación 0% (cero pasillo).
- **u03** (3D/2B) aplica el parti de **fachada única, lote profundo, con pozo**: cuatro bandas sucesivas (social+terraza / núcleo húmedo en peine / dormitorio+hall+baño / dormitorios al fondo), con los dormitorios intermedios y del fondo iluminando a pozo lateral y patio posterior — el caso donde el mínimo de pozo (regla accionable 2) es crítico.

Detalle de diseño y checklist de las 3 plantas: ver `planos/2026-08-06-u01.json`, `u02.json`, `u03.json` (y sus `.svg`), validados con `scripts/validator.py` (0 bloqueantes) más verificación manual de proporciones (CHK-06), ancho de hall/pasillo (CHK-16), alféizares (CHK-12) y circulación ≤10% (CHK-17, u03 rinde 9.22%, el resto 0% por diseño cero-pasillo).
