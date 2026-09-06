# Flujo limpio Cabida → Tweedledum/Tweedledee — diseño

_2026-09-05_

## 1. Problema

Hay tres generaciones de agente arquitecto conviviendo (Feyd, Bammy, Tweedledum/Tweedledee),
dos caminos para generar una planta, nombres que ya no dicen lo que hacen y dos lenguajes
gráficos. El síntoma que lo vuelve inusable: **el ciclo produce ocho tipologías malas y
parecidas, Tweedledee las critica, y al volver a pedir se dibujan ocho tipologías malas
encima.** No converge.

Tres causas, ninguna resoluble con mejores prompts:

1. **Se pide el lote entero de una vuelta.** Pedirle N tipologías a un modelo produce N
   variaciones de una sola idea (colapso de modo). No son N opciones: es una idea repetida.
2. **La crítica no ata.** Tweedledee devuelve prosa; la siguiente llamada a Tweedledum
   recibe el mismo brief que la primera. La crítica entró como comentario, no como
   restricción, así que la salida se repite.
3. **No hay memoria de la corrida.** Nadie registra «este hallazgo ya se señaló», así que
   un error puede repetirse indefinidamente sin que el sistema lo note.

## 2. Objetivo

Desde los números de Cabida, **una propuesta de piso decente y validada en ~5 minutos**,
con realimentación inmediata entre los dos agentes y sin intervención obligatoria.

## 3. Alcance

**Entra:** la planta típica del proyecto activo — reparto de unidades y núcleo sobre la
huella, más el interior de cada unidad. Cambios de UI en Cabida y en el Editor de Planos.
Retiro de Feyd.

**No entra:** primer piso, azotea, sótanos y estacionamientos. El estudio nocturno de Bammy
y su Taller quedan como están. La lámina en lenguaje FDC es trabajo aparte (§10).

## 4. Cambios de interfaz

### 4.1 Cabida

- Los números se quedan como están.
- **Se agrega, al pie del panel, un botón `Tweedledum · crear polígonos`** que dispara la
  cadena de §5 con el brief que Cabida ya tiene resuelto (lote, huella, pisos, circulación,
  mix `d1/d2/d3`, área objetivo).
- **Se elimina el botón `→ plano`** que hay por tipología (`EsquemaPlanta.jsx:545`, handler
  `enviarBrief()` en la línea 390). Hoy solo marca «brief listo ✓» y no produce nada
  observable: es la flecha que no hace nada.
- **Se conserva** «Aceptar y enviar a Planos» (`EsquemaPlanta.jsx:492`, vía `acceptedFloorId`),
  que sí es el camino real y es el que consume `splitAcceptedFloor`. En el flujo nuevo pasa
  a dispararse solo al converger la cadena; el botón queda como confirmación manual.
- **Se conserva** el botón de vista 3D.

Nota de estado: `EsquemaPlanta.jsx` ya importa `planFloorWithTweedledum`, o sea que Cabida
ya llama a Tweedledum para proponer pisos. Lo que falta es la cadena completa, no el enganche.

### 4.2 Editor de Planos

- **Se eliminan los pasos.** Hoy hay modales de «paso 2 · distribución» y «paso 3», con su
  panel lateral y su visor. Todo eso sale.
- En su lugar, **una sola superficie `Architecture`**: la propuesta llega resuelta desde
  Cabida y el Editor sirve para revisarla, editarla y pedir la pasada final.
- El Editor **edita, no genera desde cero**. Eso elimina el segundo camino de generación.

## 5. La cadena

Una sola dirección. Cabida es el único origen.

| # | Etapa | Quién | Estado |
|---|---|---|---|
| 0 | Brief versionado del proyecto | `cabidaVersionId()` | existe |
| 1 | Tres partis de piso (núcleo + reparto) | Tweedledum | llamada existe · **diversidad §6.1 es nueva** |
| 2 | Validación de topología del piso | determinista | existe |
| 3 | Decisiones de interior por unidad | Tweedledum | existe |
| 4 | Materializar: rectángulos, puertas, amoblado | `distribucion.js` + `reglas.js` | existe |
| 5 | Validar CHK-01..23 | `validacion.js` | existe |
| 6 | Crítica de calidad (no de norma) | Tweedledee | existe |
| 7 | Revisión acotada | `materializeWithOneRevision` | existe |
| 8 | Lámina | `lamina.js` (FDC pendiente, §10) | parcial |

Casi todo existe. **Lo que falta es la tubería que las encadene** y borrar los caminos viejos.

### Principios

- **Moneda única:** el layout JSON del skill `arquitecto-residencial-lima` es el único
  formato que viaja entre etapas.
- **Los agentes deciden, el motor materializa.** Tweedledum no emite vértices: emite
  decisiones (dónde el núcleo, qué tipología, dónde el muro húmedo). La geometría la hace
  código determinista, en milisegundos y sin costo.
- **Un solo camino.** Cabida genera; el Editor edita.

## 6. Los tres mecanismos anti-repetición

Son el corazón del diseño: sin ellos la cadena vuelve a ser la de hoy.

### 6.1 Variantes de parti, no de dibujo — y tres, no ocho

Un **parti** es una decisión estructural: posición del núcleo, reparto de unidades sobre la
huella, qué fachada gana lo social. Tweedledum propone **exactamente 3, obligatoriamente
distintos**.

La diversidad se verifica de forma determinista, no se pide por prompt: dos partis son
«iguales» si coinciden en posición de núcleo y en el reparto de anchos dentro de ±0.30 m.
Si el chequeo detecta dos iguales, se descarta uno y se vuelve a pedir con los ya vistos
como exclusión explícita. **No es posible obtener ocho iguales si el sistema no acepta dos.**

### 6.2 La crítica es una restricción, no un texto

Tweedledee emite hallazgos **estructurados**:

```json
{ "unidad": "B", "ambiente": "dormitorio 2", "regla": "ancho_util",
  "medida": 2.30, "esperado": 2.40, "severidad": "bloqueante",
  "nivel": "interior" }
```

Esos hallazgos entran a la siguiente llamada de Tweedledum como lista `must_fix`, y **el
validador determinista comprueba que desaparecieron**. Un hallazgo que sobrevive dos vueltas
detiene la cadena y se reporta; no se reintenta lo mismo por tercera vez.

Se lleva un **libro de hallazgos de la corrida**: si Tweedledum reintroduce un hallazgo ya
resuelto, es una regresión y el validador la marca sin gastar una llamada a Tweedledee.

### 6.3 Lazo de dos niveles: interior y volumen

Cuando el interior no cierra, con frecuencia **el problema no es el interior sino el
reparto**. Caso real medido: un 3D de 72.5 m² en un sobre de 7.40 × 9.80 con solo dos
fachadas no admite sala + tres dormitorios + cocina con ventana; la fachada no alcanza.

Por eso cada hallazgo lleva `nivel`:

- `nivel: "interior"` → Tweedledum corrige el layout de la unidad.
- `nivel: "volumen"` → el hallazgo **sube**: Tweedledum corrige el ancho de esa unidad sobre
  la huella, reequilibrando las vecinas para conservar el área techada del piso. Se registra
  como cambio de volumen y se re-valida la topología (etapa 2) antes de rebajar a interiores.

Es lo que hoy no ocurre: hoy el interior se reintenta contra un sobre imposible.

## 7. Orden de resolución

**La unidad más restrictiva primero.** Se ordenan las unidades por dificultad —menor área,
menor número de fachadas, menor relación fachada/fondo— y se resuelve la peor primero.

Razón: la unidad difícil es la que fuerza cambios de reparto. Empezar por la fácil garantiza
rehacer el piso entero cuando la difícil no entra.

Una vez que la primera converge, **se propaga a las demás usando la resuelta como ejemplar**
en el contexto de Tweedledum. Las siguientes convergen en menos vueltas.

## 8. Frenos, presupuesto y persistencia

- Máximo **3 vueltas por unidad**; máximo **10 llamadas de agente por piso**. El tope de
  piso manda: si se agota con unidades sin resolver, la cadena corta ahí y reporta cuáles
  quedaron pendientes, aunque a esas unidades les quedaran vueltas disponibles.
- **Cada etapa persiste apenas termina.** Una caída no pierde lo hecho — la lección del
  subagente que corrió 27 minutos, murió sin escribir un archivo y costó US$ 13.60.
- Salida estructurada obligatoria y tope de tokens por llamada (ya hay precedente:
  `perf(architecture): bound Tweedledum output latency`).
- Si no converge dentro de los topes, **se entrega la mejor propuesta y se reporta
  explícitamente qué quedó sin resolver**. Nunca se entrega en silencio.
- Se registra el `usage` de cada corrida y se muestra el costo en la UI, junto al área
  techada.

## 9. Retiros y renombres

**Se retira:**
- `POST /api/arquitecto/disenar` y `POST /api/arquitecto/corregir` (`server.js`).
- `disenarConFeyd` y `corregirConFeyd` (`planos/feyd.js`).
- La herramienta de delegación de Alicia a Feyd (`tools.js`).
- `generarTipoConFeyd` (`EditorPlanos.jsx`), ya huérfano.

**Se renombra** (cosmético, pero es la mitad de la confusión):
- `planos/feyd.js` → `planos/materialize.js`. **Cuidado:** este archivo ya no es el cliente
  de Feyd, es la capa de materialización del flujo nuevo (`preserveLockedRooms`,
  `splitAcceptedFloor`, `materializeUnitInteriors`). Solo salen las dos funciones legacy.
- `feydLayout` / `feydLayoutProfundo` → `layoutDeterminista` / `layoutDeterministaProfundo`.

**No se toca:** `distribucion.js`, `reglas.js`, `validacion.js`, `tipologias.js`,
`geometry.js`, `mobiliario.js`. Son el motor y funcionan.

## 10. Fuera de alcance, anotado

El **lenguaje gráfico FDC** (paleta, jerarquía de línea, hatch, membrete, mobiliario) está
medido del PDF de referencia y prototipado, pero `lamina.js` sigue con el membrete viejo.
Es trabajo independiente de esta cadena y no la bloquea.

## 11. Pruebas

- `plantaTipica` y el chequeo de diversidad de partis: funciones puras, test unitario con
  el validador existente como oráculo.
- **Test de convergencia:** dado un hallazgo `bloqueante` inyectado, la cadena debe
  eliminarlo en ≤ 2 vueltas o detenerse. Se verifica que **no** se emita una tercera vuelta.
- **Test de regresión de hallazgos:** reintroducir un hallazgo ya resuelto debe marcarse sin
  llamar a Tweedledee.
- **Test de subida de nivel:** un sobre imposible (3D en 7.40 × 9.80, dos fachadas) debe
  producir un hallazgo `nivel: "volumen"` y un cambio de reparto, no un reintento de interior.
- Fixture de referencia: lote 20 × 15 medianero, mix 1D/2D/3D.

## 12. Riesgo conocido

Se implementa sobre `main`, con otras cuatro sesiones activas en los mismos archivos
(`EditorPlanos.jsx`, `feyd.js`, `server.js`). Decisión tomada explícitamente. Mitigación:
tocar un archivo por vez, verificar el árbol antes de cada edición y no commitear sin aviso.
