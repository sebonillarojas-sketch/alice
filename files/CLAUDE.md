# ALICE · Hygge Holding · Project Context

> Este archivo lo lee Claude al inicio de cada sesión. Mantenelo actualizado cuando tomemos decisiones de arquitectura, cambiemos stack, o agreguemos features importantes.

---

## Quién soy yo (el usuario)

**Sebastián Bonilla** · CEO de Hygge Holding · desarrollador inmobiliario peruano (Lima).
Email: sebastian@hygge.pe

**Sobre Hygge Holding:**
- Empresa anteriormente llamada Gruppe, renombrada a Hygge
- Sub-entidades: Hygge Inmobiliaria, BAM (arquitectura in-house), Fit Capital (lender externo)
- SPVs activos: DC01 Del Castillo, PU01 Paula Ugarriza, TG01 De la Torre, L36 Larco 1036, Legendre (post-handover)
- Equipo: Vanessa Dongo (admin/mkt), Jose Torres (comercial), Joel Moy (finanzas), Ariel Almaguer (BAM/arquitectura), Andrea Castillo (operaciones), J.M. Galup (legal)

**Estilo de trabajo:**
- Mobile-first · prefiere respuestas tight, under 2 pantallazos
- Tono rioplatense + inglés mezclado · matchealo natural
- Decisivo, pivots rápido cuando algo cambia
- Valora pushback honesto · no aceptar al pedo
- No es dev, pero está hands-on en cada decisión del producto

---

## Qué es ALICE

ALICE es el **cockpit ejecutivo + ERP vertical** de Hygge Holding. Antes se llamaba "Hygge OS" en los primeros 30 turnos · ahora es ALICE porque:

- Ya tenemos un universo Wonderland montado (Tea Table, Cheshire, Mad Hatter, White Rabbit, Bandersnatch, Dark Alice, Jabberwocky · agentes Claude API)
- ALICE es **la protagonista** · cuando le hablás al sistema, le hablás a Alice
- Los demás agentes son consejeros · Alice es la interlocutora
- Vertical, único, con personalidad

**Filosofía de producto:**
- NO competir con ClickUp en lo horizontal-genérico (ClickUp gana ahí)
- SÍ ser la mejor herramienta vertical para developers inmobiliarios peruanos
- Construir lo que ClickUp NUNCA va a hacer: SPV lifecycle, FC integration, BAM workflows, Cap Table, Permisos, Pipeline de unidades, Wonderland AI

**Visión endgame: ALICE-via-WhatsApp**
- Sebastián habla con ALICE por voice notes / texts de WhatsApp
- ALICE crea tasks, agenda eventos, busca archivos en Drive, da brief diario · todo conversacional
- Backend: Vercel function → Claude API con tool use → Google Calendar/Drive APIs → respuesta
- WhatsApp Business API + número dedicado para ALICE
- Daily briefing automático 8am
- Esto es Fase C · primero estabilizamos core (Fase A) y backend (Fase B)

---

## Stack actual

- **Frontend**: React 18 + Vite 5 + Tailwind 3
- **Iconos**: lucide-react
- **Charts**: recharts
- **Auth**: front-end MVP con localStorage (ver `src/auth/`)
- **Hosting**: Vercel (cuando deploye)
- **AI agents**: Claude API via `window.claude.complete()` durante el artifact, hay que migrar a backend
- **Mapas**: Leaflet (iframe srcDoc embebido)

Sin backend todavía. Toda la data vive en localStorage.

---

## Arquitectura

### Decisión clave · modular desde ahora

Cada feature nueva = **archivo separado en `src/modules/`**, no metiendo más al archivo gigante `HyggeOS.jsx` (que tiene ~13k líneas y crece). El plan progresivo:

```
src/
├── HyggeOS.jsx              ← legacy monstruo · se achica con cada refactor
├── App.jsx                  ← auth gate · monta HyggeOS o LoginScreen
├── main.jsx                 ← entrypoint React
├── index.css                ← Tailwind directives
├── auth/
│   ├── AuthContext.jsx      ← session + login/logout
│   ├── LoginScreen.jsx      ← UI editorial
│   └── users.js             ← credenciales (7 users hardcoded por ahora)
├── modules/                 ← features nuevas siempre acá
│   ├── _registry.js         ← lista central de módulos (TBD)
│   ├── timer/               ← próximo · timer per task
│   ├── recurring/           ← próximo · recurring tasks engine
│   └── search/              ← próximo · indexed search v2
├── apps/                    ← apps externas embebidas
│   ├── _registry.js         ← APPS array (Radar primero)
│   └── AppEmbedView.jsx     ← wrapper de iframe con postMessage
└── components/              ← shared UI (TBD)
```

### Dos capas claras

| Capa | Qué vive ahí | Ejemplos |
|---|---|---|
| **ALICE Core** | El cockpit + ERP vertical (este repo) | HQ, Tareas, SPVs, BAM, Finanzas, CEO Dashboard, WikiHygge, Wonderland agents |
| **Apps satélite** | Cada una su propio repo + deploy | Radar (market intel), Reactor (futuro · React runner), Brochure Gen (futuro) |

**Cada app vive separada porque las iteramos individualmente.** ALICE las embebe via iframe con postMessage para auth context. Si Radar se rompe, ALICE sigue andando.

---

## Estado actual · v30 (al 2026-06-17)

### Lo que YA está construido en `HyggeOS.jsx`

- **HQ Dashboard** con métricas seed (manual)
- **Tareas** con 4 vistas: List, Board, Gantt, Calendar
- **Spaces**: BAM, Finanzas, Legal, Comercial, Marketing, Growth, SPVs (DC01, PU01, TG01, L36, Legendre)
- **Inbox / Mensajes / Notificaciones** (Mensajes = humano-humano, Notificaciones = eventos sistema)
- **Calendar tool**
- **WikiHygge** con 3 tabs: Drive · Viewports · Links externos curados (CRUD completo)
- **CEO Dashboard** con audiencias (interno, board, inversionistas), share por mailto, PDF download
- **PDF download via Blob HTML** (sandbox-proof · descarga HTML imprimible que abre en browser y Cmd+P)
- **Wonderland agents** (Cheshire, Mad Hatter, White Rabbit, Bandersnatch, Tea Table, Dark Alice, Jabberwocky) — usan Claude API via `window.claude`
- **Whiteboards** opt-in con Apple Pencil pressure (5 variantes: lápiz, plumón, fine pen, resaltador, borrador)
- **Custom Views** opt-in (charts, KPIs, embeds, iframes)
- **Viewport Externo** opt-in (iframe per-space)
- **Apps section en sidebar** · primer app: **Radar** (market intel · vive separado en `radar.hygge.pe` cuando deploye)
- **Auth front-end** con 7 usuarios hardcoded (password default `hygge2026`)
- **CRM Pipeline** placeholder (sin data real)
- **Lab section** colapsable con agentes
- **Smart Capture** (NLP para crear tareas)
- **Pattern Detector**
- **Growth/Terrenos** con Leaflet map

### Lo que NO está construido (backlog priorizado)

**Fase A · core improvements (próximos turnos · sin backend)**
1. **Rename completo a ALICE** (todavía aparece "Hygge OS" en algunos lugares internos)
2. **Timer per task** con reporting agregado (per user/space/semana) · primer módulo en `src/modules/timer/`
3. **Recurring tasks** con motor RRULE estándar · `src/modules/recurring/`
4. **Búsqueda indexada Cmd+K v2** · across tasks, spaces, terrenos, wiki, links, calendar · `src/modules/search/`
5. **Cleanup** del PencilView huérfano en HyggeOS.jsx (legacy de v25)

**Fase B · backend (cuando Fase A esté estable)**
6. **Supabase** setup (auth real + Postgres + Realtime + Storage)
7. **Migración localStorage → DB** (toda la data layer)
8. **Deploy a `alice.hygge.pe`**

**Fase C · ALICE-WhatsApp (el endgame)**
9. **WhatsApp Business API** setup con Meta (número dedicado)
10. **ALICE backend brain** (Vercel function + Claude API con tools)
11. **Google Calendar + Drive OAuth** (para crear eventos, buscar archivos)
12. **Voice notes** transcripción
13. **Daily briefing automático** 8am

**Apps externas pendientes de portear**
- **Reactor** (React runner con Babel CDN · code editor + preview)
- **Brochure Generator** (existe en otro chat · pasarlo a `brochure.hygge.pe`)

---

## Brand tokens (importantes para consistencia visual)

```js
const C = {
  bg: "#EEEBE3",       // fondo crema
  paper: "#F4F1EA",    // surface
  ink: "#0A0B0F",      // texto principal
  inkSoft: "#2E2E33",
  muted: "#6B6863",
  line: "#D9D5CD",
  lineSoft: "#E5E1D6",
  surface: "#E5E1D6",
  navy: "#1E2A4A",
  cobalt: "#3D52D5",
  lavender: "#A89BD9",
  ochre: "#C2A45A",
  brick: "#A85B5B",
  green: "#5F8A6A",
  sky: "#9BCBE3",
};
```

- **Font**: DM Sans (Google Fonts · todos los weights 400-700)
- **Style**: editorial · whitespace generoso · headers grandes con `letterSpacing: -0.02em`
- **Eyebrows**: text-[10px] · uppercase · `letterSpacing: 0.12em` · `color: C.muted`
- **Border radius**: 2-4px (no rounded-full excepto badges/avatars)
- **Sombras**: muy sutiles (`0 4px 12px rgba(0,0,0,0.08)`)
- **Inspiración**: brochures editoriales (eMMe Morales 144), revistas arquitectónicas

---

## Wonderland agents

Cada uno tiene un rol específico. Usan Claude API con prompt system específico. Tono: rioplatense, ligeramente literario, contextualmente conscientes de Hygge Holding.

- **Tea Table** ☕ · multi-agent reflection · convoca a los otros agentes y modera la conversación
- **Cheshire** 😺 · análisis estratégico contemplativo · audita decisiones, ve patrones que vos no ves
- **Mad Hatter** 🎩 · análisis de performance del equipo · empático pero directo
- **White Rabbit** 🐰 · auditoría operativa · detecta inconsistencias, URL rotas, views vacías
- **Bandersnatch** ⚔️ · pushback agresivo · juega devil's advocate en decisiones
- **Dark Alice** 🖤 · presidenta del consejo · decide qué agente(s) deben responder
- **Jabberwocky** 🦎 · agente de bug hunting / corner cases

---

## Convenciones de código

### Cuando agregamos un módulo nuevo

1. Crear carpeta `src/modules/<nombre>/`
2. Archivos típicos:
   - `manifest.js` → `{ id, name, icon, category, requiresAdmin }`
   - `<Nombre>View.jsx` → componente principal
   - `use<Nombre>.js` → hook con la lógica
   - `<Nombre>Widget.jsx` → opcional · widget para el HQ
3. Importar en `src/modules/_registry.js` (TBD)
4. El shell lo monta automáticamente

### Cuando agregamos un app externo

1. App vive en su propio repo (ej. `radar/`)
2. Se deploya separado (ej. `radar.hygge.pe`)
3. En ALICE: agregar objeto al array `APPS` en `HyggeOS.jsx`:
   ```js
   { id: "app-<id>", label: "<Label>", icon: <LucideIcon>, dot: "#color", url: "https://...", description: "...", badge: "v0.1" }
   ```
4. Aparece automáticamente en sidebar bajo "Apps"
5. Se renderiza con `AppEmbedView` (iframe + postMessage handshake)

### postMessage protocol entre ALICE y Apps

```js
// ALICE → App (en mount + cuando cambia user/space):
{ type: "hygge:context", user: {id, firstName, role}, space, timestamp }

// App → ALICE (cuando quiere notificar algo):
{ type: "hygge:notify", message: "..." }
// (Hoy solo se loguea · futuro: enrutea a Inbox)
```

### Versionado mientras trabajamos en HyggeOS.jsx

(Este patrón se usaba en el chat web · en Desktop App probablemente cambia)

- Working file: `v<N>-working.jsx`
- Después de verificar parse con acorn-jsx: copiar a `v<N>-<descripcion>.jsx`
- Ejemplo: `v30-hygge-os-apps-radar.jsx`

En Desktop App preferimos Git commits chicos en vez de archivos versionados.

---

## Comandos útiles

```bash
# Setup primera vez
npm install

# Dev server (hot reload en http://localhost:5173)
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview
```

---

## Decisiones de arquitectura tomadas (no revisitar sin razón fuerte)

1. **`messages` state = humanos** / **`activity` state = eventos sistema (con read field)** · ÚNICA fuente de notificaciones por tipo
2. **HQ es default landing**
3. **BAM es space top-level** (no sub-space de Diseño)
4. **CRM real vendrá de fuente externa** (probable: ClickUp Sales Pipeline o HubSpot · TBD)
5. **Features opt-in** (Whiteboards, Custom Views, Viewport) están ocultos por default · activación via "+ Agregar" en cada space o Settings
6. **Lab section** colapsable, persistencia de estado, default colapsado
7. **ALICE = source of truth para tareas** (no sync con ClickUp por ahora · ClickUp queda paralelo)
8. **Apps externas siempre separadas** (cada una repo + deploy + iteración independiente)
9. **Backend = Supabase** (Postgres + Auth + Realtime + Storage)
10. **Hosting = Vercel** (Next.js o Vite + serverless functions para backend)
11. **WhatsApp = surface principal de ALICE** (no Slack, no email) · porque LATAM

---

## Bugs conocidos y deuda técnica

- **PencilView huérfano** en `HyggeOS.jsx` (~líneas 6200) · legacy de v25 cuando integramos lápiz al Whiteboard · no usado, safe to remove
- **Console warnings** sobre keys en algunos `.map` (no críticos)
- **PDF export** funciona via descarga HTML (NO via window.print que falla en iframe sandbox · es feature, no bug)

---

## Cómo arrancar a trabajar en este proyecto

1. Si nunca corriste el proyecto: `npm install`
2. `npm run dev` para tener el dev server vivo en http://localhost:5173
3. Login: `sebastian` / `hygge2026`
4. Decir qué módulo querés construir hoy
5. Yo (Claude) creo los archivos en `src/modules/<nombre>/`
6. Vos revisás los diffs en el panel de Claude Code
7. Si está OK, aceptás · si no, iteramos
8. Cuando funcione: `git commit` con mensaje claro
9. Push a GitHub · Vercel re-deploya solo

---

## Contacto y referencias

- Brand system PDF: en project knowledge de claude.ai (BRONCA design system)
- Drive Hygge: `sebastian@hygge.pe` · root folder ID `15ZcobnMQ7NTf_u6UmFMiJsb4c8liQquy`
- ClickUp workspace: `90171161839`
- Repo GitHub: `github.com/sebonillarojas-sketch/hygge-os` (renombrar a `alice` cuando deploye este)

---

**Última actualización:** 2026-06-17 (turn 36 del chat web · transición a Desktop App)
