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

---

## Addendum 2 · Intento de migración a Cloud API (27-31 jul 2026)

Se intentó completar la Opción B (Cloud API). **El lado técnico quedó
terminado; el bloqueo es administrativo del lado de Meta.**

### Lo que quedó FUNCIONANDO y verificado

| Item | Estado |
|---|---|
| `GET /webhook` verificado por Meta | ✅ log `✅ WhatsApp webhook verificado` (27 jul 10:43) |
| Callback URL | `https://alice-production-462e.up.railway.app/webhook` |
| `WA_VERIFY_TOKEN` | `alicia-hygge-2026` (Meta y Railway coinciden) |
| `WA_WEB_ENABLED=0` | ✅ log `📵 WA Web desactivado` — Baileys ya no arranca |
| `ALLOWED_USER_PHONES` | ✅ correcto, con código de país (`+51951869600,...`) |
| Fix anti-crash (PR #24) | ✅ mergeado a `main` |

`PROBLEMA 3` (DNS) quedó resuelto de facto: se usa el dominio
`alice-production-462e.up.railway.app`, que sí responde. `aliceai.bam.pe`
también responde 200 (incluido al crawler de Meta).

### El bloqueo: cuentas de Meta deshabilitadas

Los logs HTTP muestran **cero `POST /webhook`** — Meta nunca entregó un
solo mensaje. La cadena de errores, en orden de descubrimiento:

1. `(#200) API access blocked` — al llamar `subscribed_apps`
2. `(#133010) Account not registered` — al enviar mensaje
3. `Register endpoint is not available for SMB businesses` — al llamar
   `/register`. El WABA se había creado vía la **app WhatsApp Business**
   (tipo SMB), que Meta no deja usar con Cloud API.
4. Modal `Account Restricted` al intentar agregar cualquier número.

**Causa raíz:** los WhatsApp Business Accounts están deshabilitados
porque **el negocio que los contiene está deshabilitado**:

> *"This account has been disabled because the website listed in its
> Business Manager profile couldn't be found."* — 1 jul 2026, Permanent

WABAs afectados (portfolio Hygge `1334104998015596`):
- `1766820844489531` — Test WhatsApp Business Account · Disabled
- `1534675774316619` — Hygge · Disabled

Crear un portfolio nuevo **no** funciona: `Bam Studio` fue restringido el
31 jul 2026 (mismo día en que se creó) y queda *prohibited from claiming
apps*. Meta vincula los portfolios por admin/dominio y lo lee como evasión.

### Argumento para la apelación

El motivo citado **ya no aplica**: `https://hygge.pe/` está online y
responde `HTTP/2 200` al propio user-agent de Meta:

```bash
curl -sI -A "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" https://hygge.pe/
```

Además, en los logs HTTP de Railway se ve a `facebookexternalhit/1.1`
entrando a `aliceai.bam.pe` con 200. Y el portfolio Hygge figura como
**Business verification: Verified** (Hygge Larco 1036 SAC, RUC 20612454613).

Vía más efectiva: **chat en vivo** de Business Support Home, no el
formulario.

### ⚠️ Gotcha de código: Cloud API bloquea el fallback a Twilio

`alicia-brain/src/wa.js:19` — si `WA_PHONE_NUMBER_ID` **y**
`WA_ACCESS_TOKEN` están seteados, el envío toma el camino Cloud API y
**lanza excepción** si falla (línea 28). Nunca cae a Twilio.

→ **Para usar Twilio hay que BORRAR ambas variables de Railway**, no
alcanza con configurar Twilio.

El camino Twilio está completo en el código: endpoint `/webhook/twilio`
(`server.js:893`) con paridad de texto, audio y archivos.
Webhook a configurar en Twilio:
`https://alice-production-462e.up.railway.app/webhook/twilio` (POST).

### Datos de referencia

- App ID: `2229024171220311`
- Business portfolio Hygge: `1334104998015596`
- Número nuevo disponible para Alicia: `+51 924 140 141` (sin WhatsApp previo)
- Número anterior: `+51 919 108 689` (quedó liberado al borrarse su WABA)
- Los tokens de *API Setup* son **temporales** y expiran a hora fija
  (no a las 24h corridas). Para producción hace falta token de
  **System User** con expiración `Never` y el WABA asignado como asset.

### Próximos pasos

1. **Apelar** las restricciones de Hygge y Bam Studio (chat en vivo).
2. Mientras tanto, **Twilio Sandbox** para desbloquear al equipo
   (recordar borrar `WA_PHONE_NUMBER_ID` y `WA_ACCESS_TOKEN`).
3. Al levantarse la restricción: crear WABA nativo de Cloud API (no SMB),
   agregar `+51 924 140 141`, `/register` con PIN, token de System User,
   y setear `WA_PHONE_NUMBER_ID` + `WA_ACCESS_TOKEN`. El webhook y el
   verify token **no cambian**.
4. Alternativa a explorar: BSP tipo **360dialog**, que en algunos casos
   da de alta el número bajo el WABA del proveedor (podría esquivar la
   restricción). No verificado.
