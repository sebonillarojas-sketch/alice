# Mica — agente comercial de redes sociales · diseño

_2026-09-15_

## 1. Problema

Hygge vende arquitectura, y las conversaciones de venta empiezan en redes sociales. Hoy
esas conversaciones dependen de que una persona esté mirando el inbox: el que escribe un
domingo a las 22:00 espera hasta el lunes, y el que pregunta por un proyecto a las 11:04
recibe respuesta cuando alguien se desocupa. Jose Torres (`jt`, comercial) es uno solo, y su
propio plan de crecimiento en el brain dice, literal, *"usar más el CRM"* — porque el CRM que
exige tipeo manual después de cada conversación no se llena nunca.

El costo no es perder mensajes. Es perder el momento: la intención de compra de un
departamento dura horas, no días.

## 2. Objetivo

Una agente — **Mica** — que atienda las conversaciones entrantes de redes sociales con la voz
del estudio, entienda a quién tiene enfrente, y le entregue a Jose el lead caliente con todo
lo que él necesita para escribir el primer mensaje sin leer cien líneas de chat.

Mica no cierra ventas. **Abre bien y entrega bien.** Ese es todo su trabajo.

## 3. Alcance

**Entra:** ingesta de Instagram y Messenger, el motor de conversación con su voz, el buyer
persona progresivo, la clasificación de temperatura, el handoff a Jose, el CRM mínimo que
sostiene todo eso, el loop de aprendizaje diario y el seguimiento proactivo.

**No entra:** cotizar. Mica nunca dice un precio ni envía un plano — ver §6. Tampoco entra
agendar: el cierre es el handoff, no la cita. Tampoco el CRM completo (kanban, pipeline,
reportes, comisiones); acá se construye solo lo que el agente necesita para no perder datos.

## 4. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Canal | Meta Business API directo (IG + Messenger) | Hay un experto de Meta trabajando en el permiso; sin intermediario ni costo por mensaje |
| Cerebro | Híbrido: modelo local + Claude | El local hace triage, extracción y plantillas (el 80% del volumen, costo cero); Claude escribe lo que vende |
| Autonomía | Rodaje en copiloto → autónomo con freno | Las correcciones de Jose durante el rodaje son la mejor evidencia que va a tener el loop |
| Datos | Híbrido: conversación en la Mac, CRM en Supabase | El volumen crudo es barato y privado en local; lo que Jose necesita ver vive donde ya mira |
| Cierre | Handoff a Jose, sin agendar | Es lo que dicen las plantillas del dueño del producto, y elimina la única dependencia humana pendiente (el Google de Jose) |

## 5. Arquitectura

El hecho que manda: **la Mac no tiene entrada desde internet** (solo Tailscale, SSH cerrado), y
**el reloj de la bestia tickea cada ~10 minutos** — perfecto para Cheshire y Knave, letal para
una conversación. Nada de lo que sigue tiene sentido sin esas dos restricciones.

```
Instagram / Messenger DM
   └→ POST /webhook/meta              (brain · Railway · público)
        · valida X-Hub-Signature-256
        · normaliza a InboundMessage {channel, thread_id, text, adjuntos}
        · INSERT en social_queue (pending)
        └→ SSE /api/social/stream ────────────→ Mica (la Mac · proceso persistente)
                                                  · modelo local: leer, clasificar, extraer
                                                  · Claude: redactar lo que vende
             ←── POST /api/social/reply ────────┘
        · envía por Meta Send API · marca answered
```

**En el brain** (`alicia-brain/src/social/`):
- `meta-webhook.js` — handshake de verificación y firma `X-Hub-Signature-256`. Un mensaje sin
  firma válida se descarta y se registra; nunca llega a la cola.
- `queue.js` — *claim-on-read* con el mismo patrón de `agent-requests.js`, que ya está probado
  contra doble-claim. **Sin `await` dentro del claim**: `node:sqlite` es síncrono y esa
  atomicidad es lo que evita que dos ticks respondan el mismo mensaje.
- `GET /api/social/stream` y `POST /api/social/reply`, autenticadas con `x-agent-key` — la misma
  llave que ya usan Cheshire y Knave.

**En la Mac** (`alicia-brain/scripts/mica.js`): proceso **persistente** con
`com.hygge.mica.plist` y `KeepAlive`. Deliberadamente **fuera de `schedule.js`** — el reloj de
10 minutos no sirve para conversar. El `git pull` del runner lo sigue actualizando; el proceso
se reinicia solo al detectar código nuevo. **Prerequisito: hoy no hay ningún modelo local
instalado en esa máquina** (`ollama` no existe en el sistema). Instalarlo y elegir modelo es
el primer paso del paso 1 del §14, no un detalle de configuración.

**El fallback, que es lo que hace verdad el "siempre responder":** si un mensaje lleva **60
segundos** en `pending`, el brain lo contesta él mismo con Claude en modo degradado — tono
conservador, sin memoria local, nunca promete nada — y lo marca `degraded`. Cada respuesta
degradada entra al reporte diario de Jose: si la Mac se cayó un martes, se sabe el martes y no
el viernes.

### Rodaje en copiloto

Las primeras 2-3 semanas Mica **no manda sola**. Cada respuesta que redacta entra a
`social_queue` con estado `draft` y llega a Jose por WhatsApp con dos opciones: aprobar tal
cual, o responder con su propia versión. Lo que Jose escribe distinto es lo que se guarda como
corrección —  el par (borrador, versión de Jose) es exactamente lo que `lesson-capture.js`
convierte en lección (§10).

El rodaje **no termina por calendario sino por evidencia**: cuando la tasa de aprobación sin
edición supera el 80% sobre al menos 50 borradores, Mica pasa a responder sola y el freno queda
en lo que dice §12 — todo lo que sea precio, plano, tema legal o reclamo sigue parando en Jose.
Durante el rodaje, el fallback degradado de arriba queda **apagado**: si Jose no contesta, el
prospecto espera. Nadie que no haya sido revisado habla con un cliente en esta etapa.

## 6. La voz

Hygge es un estudio que vende arquitectura, no una inmobiliaria que coloca metros cuadrados.
La voz es **arquitecto soft**: no tan técnica, no tan comercial, cool, con tecnicismo simple.
Se codifica en `alicia-brain/skills/conversacion-comercial-hygge/` con el patrón de skills que
el repo ya usa (`skills/arquitecto-residencial-lima/`), no como prompt suelto.

`voz.md` arranca con las cuatro preguntas que son el ADN del repertorio, textuales del dueño
del producto:

> — ¿Qué te gusta más, una sala amplia o más espacio en las habitaciones?
> — ¿Qué fue lo que más te llamó la atención de nuestro proyecto?
> — ¿Tienes pensado algún metraje en específico?
> — Tenemos tipologías como townhouses, flats o dúplex.

`voss.md` guarda lo que sirve de Chris Voss —etiquetado, preguntas calibradas, auditoría de
acusación antes de un pedido incómodo— **sin el costado de negociación dura**, que en esta voz
suena a otra empresa. `objeciones-lima.md` cubre cuota inicial, crédito hipotecario,
MiVivienda/Bono del Buen Pagador, plazo de entrega, estacionamiento.

**El mirroring copia la forma, nunca el contenido emocional.** Mica adapta registro (tú/usted),
largo de mensaje, uso de emoji, jerga y ritmo. No adapta el estado de ánimo: si el prospecto
está molesto, Mica no se pone molesta.

### La regla que ordena todo el sistema

> **Mica nunca envía planos ni dice un precio. Que se los pidan *es* la señal de handoff.**

Esto no es una limitación: es la simplificación central del diseño. Mica conoce tipologías,
metrajes y rangos para **calificar y hablar con propiedad**, no para cotizar. Como los precios
no son suyos, no puede alucinarlos. El error del que una inmobiliaria no se recupera queda
estructuralmente fuera de su alcance.

## 7. El handoff

Es el momento más importante de toda la conversación, así que **no se improvisa**. Es una
máquina de slots, con el proyecto como única variable:

```
Apertura:    Con gusto · Claro · Claro que sí · Por supuesto
Conector:    Te conecto con José · Te paso con José · Te contacto con José
Rol:         está a cargo de {PROYECTO} · lleva {PROYECTO}
             (+ "y trabaja de cerca con el equipo de arquitectura")
Qué ofrece:  los planos y toda la información · planos, precios y disponibilidad
             · el detalle de cada unidad · toda la información que necesites
Cierre:      en breve se pone en contacto contigo · te escribe en un momento
             · se comunica contigo enseguida
```

Sin repetir combinación con el mismo prospecto. Lo arma el **modelo local**: cero tokens de
Claude, y cero riesgo de que el modelo se ponga creativo justo donde no debe.

**Cuando se dispara, pasan cuatro cosas:**

1. Mica responde con la plantilla armada.
2. Jose recibe un WhatsApp por Twilio — el canal que ya funciona y en el que ya vive — con el
   resumen corto y el link a la ficha.
3. **El dossier**: nombre y contacto, proyecto, tipología y metraje de interés, plazo, **qué le
   llamó la atención en sus propias palabras**, qué evitar, y el hilo completo a un click. Con
   **citas literales, nunca paráfrasis**: Jose tiene que saber cómo habla esa persona antes de
   escribirle.
4. El lead pasa a etapa `handoff` con dueño `jt`.

**Después del handoff Mica no desaparece ni pisa a Jose.** Si el prospecto escribe de nuevo,
responde lo que no invade —nunca precios, nunca planos—, mantiene el hilo tibio y le avisa a
Jose. Un lead caliente que escribe y no recibe nada es peor que no haberlo capturado.

## 8. Temperatura y buyer persona

El buyer persona se llena mensaje a mensaje: motivación, composición del hogar, metraje
buscado, tipología, prioridad (sala amplia vs. habitaciones), plazo. **Cada campo guarda la
frase textual que lo sustenta.** Sin evidencia no hay dato — y es lo que hace que el dossier
sea creíble para Jose en vez de un resumen que hay que verificar.

En paralelo, un **perfil de forma**: registro, largo de mensaje, emojis, jerga, texto vs. audio,
horario. Ese es el que alimenta el mirroring.

**La temperatura es auditable, no intuición:**

```
hot  = intención declarada
     ∧ interés compatible con alguna tipología real del catálogo
     ∧ plazo ≤ 6 meses
     ∧ dato de contacto entregado
```

El pedido de planos o precios es señal directa de `hot`. Solo `hot` dispara el handoff, y cada
cambio de temperatura guarda la frase exacta que lo causó.

## 9. Datos

**Supabase** — lo que Jose ve y lo que queda respaldado:

| Tabla | Qué guarda |
|---|---|
| `crm_leads` | canal, id externo, nombre, correo, proyecto, temperatura, etapa, dueño, fuente (campaña o post), primer y último contacto |
| `crm_buyer_persona` | los campos del §8, **cada uno con su cita textual** |
| `crm_eventos` | línea de tiempo auditable: mensajes, cambios de temperatura, handoff, seguimientos |
| `crm_proyectos` / `crm_tipologias` | el catálogo: OLVR-01, San Antonio 01, … con tipologías, metrajes, rangos y `brochure_url` |

**SQLite en la Mac** (`mica.db`): la conversación cruda completa y el estado de trabajo. Volumen
alto, valor privado, costo cero, y no viaja.

Los brochures viven en Supabase Storage con espejo local en la Mac, para que el modelo local
pueda leerlos y citarlos sin salir a la red. Cada brochure enviado queda registrado: es señal
de interés y alimenta la temperatura.

**La vista de Jose**: módulo nuevo `files/alice/src/modules/crm/` dentro del space `comercial`
que el ERP ya tiene. Bandeja de leads por temperatura y ficha con dossier + hilo. Lo mínimo que
hace que un CRM se use es que Jose abra el link del WhatsApp y entienda todo en diez segundos.

## 10. Aprendizaje

El loop no se inventa: se enchufa al que ya existe. `lessons.js` tiene el gate (evidencia ≥3,
riesgo L0–L3, nada se auto-aplica salvo L0) y `reflection.js` ya hace que un agente mire su
actividad y proponga a lo sumo una lección. Se agrega el job `mica-reflexion` al reloj de la
bestia, 1×día.

Lo que hace distinto a este loop es **contra qué mide**: no contra la opinión del modelo sobre
si le fue bien, sino contra señales duras — ¿contestaron?, ¿cuántos turnos duró?, ¿llegó al
pedido de planos?, ¿Jose lo convirtió en cita? Eso convierte "creo que esta pregunta funciona"
en evidencia.

Las lecciones se clasifican por lo que tocan:
- **Voz → L2.** Cambian lo que lee un cliente: pasan por Sebastián o Jose antes de aplicarse.
- **Operación → L0/L1.** Cuándo reintentar, qué brochure mandar: se aplican solas con evidencia.

Durante el rodaje en copiloto, **cada corrección de Jose a un borrador es la evidencia de mejor
calidad disponible** — y `lesson-capture.js` ya está escrito para capturar exactamente eso.

## 11. Seguimiento

Reglas, no insistencia. Cadencia **+1, +3, +7, +21 días y stop**: máximo cuatro toques sin
respuesta. **Cada toque tiene que aportar algo** —una tipología que encaja con lo que dijo, un
avance de obra, una pregunta abierta— nunca un "¿hola, sigues ahí?". Nada antes de las 9 ni
después de las 21, hora de Lima. Un "no me interesa", o el silencio tras el cuarto toque, cierra
el lead y no se reabre salvo que la persona escriba. Después del handoff, el seguimiento es de
Jose; Mica solo mantiene el hilo tibio.

## 12. Guardarraíles

Sobre `src/hard-rules.js`, que ya existe. Mica **nunca**:

- envía planos ni dice un precio (§6);
- inventa fecha de entrega o condiciones de financiamiento;
- promete descuentos;
- usa urgencia falsa ("últimas unidades") salvo que el catálogo lo diga y sea verdad;
- pide DNI ni ingresos exactos (rangos sí);
- **dice ser humana.** Si le preguntan, responde la verdad. Es decisión de diseño: mentir eso es
  el único error del que una inmobiliaria no se recupera.

## 13. Pruebas

La suite del brain está en 121/121 y no se rompe.

**Sin modelo** (lógica pura, `node --test`): el extractor del buyer persona; el clasificador de
temperatura contra una tabla de frases reales; la máquina de slots —que no repita combinación y
que el proyecto sea el correcto—; la cadencia de seguimiento con relojes falsos; el gate de
lecciones; el claim de la cola bajo dos consumidores.

**Con modelo**: un set de conversaciones de regresión de voz que se corre **antes** de aplicar
cualquier cambio de tono, para ver qué se rompió.

Regla: nada que toque a un prospecto se suelta sin test.

## 14. Orden de construcción

1. **Space "Mica" en Comercial** — el motor de conversación con su voz, y la pantalla para
   hablarle desde `alice.bam.pe`. Sin Instagram, sin seguimiento, sin handoff real. Primero que
   hable bien. **Esta es la rebanada que se construye ahora.**
2. **CRM mínimo** — `crm_leads`, `crm_buyer_persona`, `crm_eventos`, el catálogo, y la ficha.
3. **Handoff real a Jose** — plantillas, dossier, WhatsApp por Twilio.
4. **Ingesta de Meta** — webhook, cola, SSE, el proceso persistente en la Mac y el fallback.
   Depende del permiso de Meta, que es trámite externo.
5. **Loop y seguimiento** — `mica-reflexion` y la cadencia.

## 15. Riesgos

- **La Mac es un punto único de falla.** Mitigado por el fallback degradado del §5, y la
  respuesta degradada es visible en el reporte diario — no falla en silencio.
- **El permiso de Meta puede demorar o no salir.** Por eso el orden del §14 lo pone cuarto: los
  tres primeros pasos entregan valor sin él.
- **El modelo local puede no dar la talla en español peruano.** Por eso sólo hace triage,
  extracción y plantillas; lo que se lee como voz del estudio lo escribe Claude.
- **El checkout `~/Desktop/ALICE` es compartido** con otras sesiones, y un push a `main` publica
  brain y ERP a la vez. Todo el trabajo va en rama propia, con merge recién cuando esté probado.
