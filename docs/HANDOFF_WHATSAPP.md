# Handoff · Alicia no responde por WhatsApp
Diagnóstico: 24 jul 2026

## Resumen
Alicia RECIBE y PROCESA mensajes de WhatsApp, pero NO PUEDE ENVIAR
la respuesta. Baileys tiene desincronización de llaves criptográficas,
y además hay un crash sin capturar que tumba el proceso entero.

## Infraestructura
Repo: sebonillarojas-sketch/alice (branch main)

Railway proyecto `keen-miracle`: aa1dec6f-fda3-499c-aa29-537738310843
- env production: af7ed17a-a128-4497-855c-d5b31f2aebba
- servicio `alice`: 0dac2c52-e5ee-46d9-89dc-01c8fcc590cc
  - rootDirectory: /alicia-brain  ← ESTE corre el webhook
  - dominio: alice-production-462e.up.railway.app (puerto 8080)
  - volumen en /data (SQLite: /data/alicia.db)
- servicio `zonal-perfection`: 994bc969-94c0-4e06-b776-d9aac02ae7ff
  - rootDirectory: erp-backend

OJO: el proyecto `intuitive-love` (ec4053f6-36b0-4ecc-b9b6-52b657da0127)
tiene OTRO servicio también llamado `alice` que apunta a /erp-backend.
No es el del webhook.

## PROBLEMA 1 · Baileys recibe pero no envía (BLOQUEANTE)

Síntoma — cada mensaje entrante da inmediatamente:
```
18:50:03  📱 WA Web [sb] Hola Alicia
18:50:03  received error in ack
```
...y no se envía respuesta.

El cerebro SÍ funciona (evidencia):
```
18:24:43  📱 WA Web [sb] Hola
18:24:43  received error in ack
18:24:43  🎭 [sb] persona actualizada
18:27:34  🧠 [sb] 3 memorias guardadas
```
processAliciaMessage() corre, Claude responde, memoria se guarda.
Falla SOLO el envío.

Errores relacionados: `failed to decrypt message`, `stream errored out`,
`sesión cerrada desde el teléfono`, desconexiones 408 / 515 / 428.

Diagnóstico: desincronización del estado criptográfico de la sesión
Baileys (llaves Signal persistidas), NO del vínculo con el teléfono.

YA SE INTENTÓ Y NO FUNCIONÓ:
1. POST /api/waweb/restart → reconecta, mismo error
2. Cerrar sesión desde el teléfono + rescanear QR desde cero
   → NO lo arregló (sesión quedó como 51919108689:14)
La hipótesis "vinculado sucio por migrar a WhatsApp Business app"
quedó DESCARTADA.

Próximo paso (Opción A): borrar el estado de credenciales de Baileys
del volumen /data (no solo re-escanear) y vincular desde cero.
Ubicar dónde alicia-brain persiste las creds (probablemente un dir
tipo auth_info / baileys_auth en /data) y limpiarlo completo.
Advertencia: no garantiza estabilidad futura.

## PROBLEMA 2 · Crash sin capturar tumba todo el proceso

A las 18:48:55 Node murió entero y Railway reinició:

```
Error: Connection Closed
    at sendRawMessage (baileys/lib/Socket/socket.js:56:19)
    at sendNode (baileys/lib/Socket/socket.js:75:16)
    at query (baileys/lib/Socket/socket.js:138:79)
    at assertSessions (baileys/lib/Socket/messages-send.js:176:34)
    at async relayMessage (baileys/.../messages-send.js:288:9)
    at async sendPeerDataOperationMessage (...:211:23)
    at async sendRetryRequest (baileys/.../messages-recv.js:100:27)
  isBoom: true, statusCode: 428 ('Precondition Required')
```

FIX necesario igual, independiente del resto: try/catch en el path de
envío/retry de Baileys + handlers de unhandledRejection y
uncaughtException. Una sesión de WhatsApp caída NUNCA debería tumbar
el backend entero (se cae también el ERP, los agentes Wonderland,
el panel).

## PROBLEMA 3 · DNS de aliceai.bam.pe roto

- En Meta la Callback URL es https://aliceai.bam.pe/webhook y Meta
  muestra "Conectado".
- PERO en los logs HTTP de Railway NO hay ni un request a /webhook.
  Rango amplio, con filtro. Cero.
- Causa: Railway → servicio alice → Settings → Networking →
  Custom Domains: `aliceai.bam.pe` figura con ERROR / pendiente de DNS.
- DNS en registrador externo (confirmar cuál).

Fix inmediato (atajo): cambiar la Callback URL en Meta al dominio que
sí funciona:
  https://alice-production-462e.up.railway.app/webhook
Después arreglar el CNAME con calma.

## PROBLEMA 4 · Faltan variables para Cloud API

El webhook del Cloud API YA ESTÁ IMPLEMENTADO en
alicia-brain/src/server.js:
- GET /webhook — valida hub.mode === "subscribe" y
  hub.verify_token === process.env.WA_VERIFY_TOKEN, devuelve hub.challenge
- POST /webhook — responde 200 inmediato; soporta text, audio
  (transcribe con Groq Whisper), document e image (sube a Dropbox);
  filtra por ALLOWED_USER_PHONES; llama a processAliciaMessage()
- Envío vía https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages
  con Bearer ${WA_ACCESS_TOKEN}

Ya seteadas en Railway: WA_VERIFY_TOKEN, ALLOWED_USER_PHONES,
PHONE_sb/jm/jt/jmg/vd/aa/ac, ANTHROPIC_API_KEY, GROQ_API_KEY,
OPENAI_API_KEY, PANEL_PASSWORD, BODY_KEY, AGENTS_API_KEY, ERP_URL,
ERP_API_KEY, DB_MODE, SQLITE_PATH, DROPBOX_APP_KEY, DROPBOX_APP_SECRET,
GOOGLE_CLIENT_ID/SECRET, ZOOM_*, TWILIO_*, ELEVENLABS_*, TTS_PROVIDER,
TAVILY_API_KEY, SCRAPINGBEE_API_KEY

FALTAN:
- WA_PHONE_NUMBER_ID  ❌
- WA_ACCESS_TOKEN     ❌

Notas:
- WA_PREFER_CLOUD y WA_WEB_ENABLED NO existen en el código. Para apagar
  Baileys o priorizar Cloud API hay que IMPLEMENTAR esos flags, no solo
  setear la variable.
  ⚠️ CORRECCIÓN (ver Addendum): esta nota es incorrecta — ambos flags
  SÍ existen en el código actual de main.
- Al arranque el log dice "Dropbox: ⏳ pendiente" — revisar si falta el
  refresh token.

## Estado en Meta (lado usuario)
- Número +51 919 108 689, ya migrado de WhatsApp normal → app
  WhatsApp Business en el teléfono.
- NO se creó la app en Meta for Developers todavía. El usuario no logra
  loguearse: llega el código 2FA, lo ingresa y da error (Safari iPhone).
- Por eso faltan las 2 variables.
- IMPORTANTE: la app WhatsApp Business del teléfono y el Cloud API son
  mutuamente excluyentes en el mismo número. Registrar el número en
  Cloud API desconecta la app del teléfono (y mata Baileys).

## Decisión pendiente
A) Arreglar Baileys: borrar creds del volumen, re-vincular, blindar el
   crash. Rápido, sin trámites, frágil a futuro.
B) Migrar a Cloud API: estable, sin QR ni teléfono. Requiere crear app
   en Meta (desde COMPUTADORA — el 2FA falla en Safari mobile),
   registrar/migrar el número, token permanente vía System User, y
   setear las 2 variables.

En ambos casos, PROBLEMA 2 (crash) y PROBLEMA 3 (DNS) hay que
arreglarlos igual.

## Contexto extra resuelto en esta sesión
Dropbox /Hygge: las 101 carpetas y 9 archivos de sistema ya estaban
creados en la cuenta correcta (sebastian@hygge.pe). Se ELIMINÓ
/Hygge/02_PROYECTOS/LEGENDRE por ser duplicado de PU01_paula_ugarriza.
El system prompt de Alicia ya lo contempla: "PU01 también se conoce
como Legendre — es EL MISMO proyecto".
Pendiente: revisar referencias a LEGENDRE en _SISTEMA/ontology.yaml,
03_BAM/proyectos_hygge y 07_MARKETING/brochures.

---

## Addendum · Verificación contra el código (24 jul 2026, Claude Code)

Al copiar este handoff al repo se contrastó contra el código real de
`main` y hay tres correcciones/avances:

1. **`WA_PREFER_CLOUD` y `WA_WEB_ENABLED` SÍ existen** (la nota del
   Problema 4 estaba desactualizada):
   - `alicia-brain/src/wa.js:10` — con `WA_PREFER_CLOUD=1`, el envío
     saltea WA Web y va directo a Cloud API → Twilio.
   - `alicia-brain/src/waweb.js:13` — con `WA_WEB_ENABLED=0`, Baileys
     no arranca. No hace falta implementar nada: basta setear las
     variables en Railway y redeployar.

2. **Ubicación de las creds de Baileys (para la Opción A):** el auth
   dir es `wa-web-auth/` junto al SQLite — con `SQLITE_PATH=/data/alicia.db`
   queda en **`/data/wa-web-auth`** (`alicia-brain/src/waweb.js:14-16`).
   Eso es lo que hay que borrar completo antes de re-vincular.

3. **Problema 2 (crash) — FIX aplicado en este branch:** el stack del
   crash nace en `sendRetryRequest` *adentro* de la librería Baileys
   (retry automático tras `failed to decrypt`), no en código nuestro,
   así que ningún try/catch propio en el path de envío lo alcanza.
   La cobertura correcta son handlers globales de proceso
   (`unhandledRejection` + `uncaughtException`), agregados al tope de
   `alicia-brain/src/server.js`. Además se blindó el handler async de
   `connection.update` en `waweb.js`, que corría sin try/catch.
