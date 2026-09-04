# ALICE

Cockpit ejecutivo + ERP vertical de Hygge Holding · React + Vite + Tailwind.

## Quick start

```bash
npm install
npm run dev
```

Login: `sebastian` / `hygge2026`

## Stack

- Vite 5 + React 18 + Tailwind 3
- lucide-react · recharts · Leaflet (embebido)
- Estado local-first con sincronización a Supabase
- Agentes de arquitectura servidos por `alicia-brain`

## Arquitectura: Cabida → Planos

La planta típica ahora nace en Cabida:

1. En **distribución esquemática**, pulsa **Proponer planta con Tweedledum**.
2. ALICE valida que unidades, core, circulación y vacíos no se superpongan.
3. Tweedledum puede corregir una vez; si no entrega geometría válida, ALICE usa `packFloor` como respaldo determinístico identificado.
4. Pulsa **Aceptar y enviar a Planos**.
5. En Planos, **architecture → Tweedledum** diseña el interior de cada unidad por separado y conserva core, circulación y vacíos.

Endpoints disponibles:

```text
POST /api/architecture/tweedledum/floor-plan
POST /api/architecture/tweedledum/design
POST /api/architecture/tweedledum/revise
POST /api/architecture/tweedledee/critique
POST /api/architecture/review-cycle
```

Los proyectos anteriores sin una propuesta aceptada siguen usando el flujo existente y `packFloor`. Los prompts permanecen versionados en el servidor. Las observaciones RNE o municipales son asesoría salvo que la solicitud incluya evidencia verificada mediante `verifiedEvidence`.

## Estructura

```
src/
├── HyggeOS.jsx         ← app principal (legacy monstruo · se va achicando)
├── App.jsx             ← auth gate
├── main.jsx            ← entrypoint
├── auth/               ← login + session + users
└── modules/            ← features nuevas (timer, recurring, search...)
```

## Para Claude

Si Claude lee este README al arrancar una sesión nueva: **abrí `CLAUDE.md` en la raíz**. Tiene el contexto completo (visión, arquitectura, estado actual, decisiones, backlog).

## Deploy

GitHub repo + Vercel auto-detect (Vite preset). Domain target: `alice.hygge.pe`.

## Versión

v0.1.0 (Junio 2026)
