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
- Sin backend · localStorage por ahora

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
