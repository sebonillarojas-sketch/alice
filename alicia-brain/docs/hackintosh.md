# La "supercomputadora" de Alicia — Hackintosh DT019

_La máquina local de Alicia (la "supercomputadora" del HANDOFF, pendiente #9). NO es una Mac Studio ni un Mac Pro: es una **hackintosh** armada por [digital.tuning](https://www.instagram.com/digital.tuning) (build DT019), entregada ~15 jul 2026._

## Specs

| Componente | Detalle |
|---|---|
| CPU | Intel Core Ultra 7 270K Plus (Arrow Lake, 20 núcleos) |
| RAM | 64 GB |
| GPU | AMD Radeon RX 6800 16 GB (soporte nativo macOS — por eso AMD y no NVIDIA) |
| Cooling | AIO líquida + case compacto DeepCool, ultra-silencioso, ARGB a control remoto |
| SO | macOS 15.x (Sequoia) vía OpenCore |

## Identidad / acceso

- macOS la identifica como **Mac Pro** (SMBIOS MacPro7,1 del OpenCore) — de ahí el hostname.
- **Tailscale**: `alicias-mac-pro` · IP tailnet `100.106.79.20` · cuenta sebastian@hygge.pe.
- Para specs en vivo: `system_profiler SPHardwareDataType SPDisplaysDataType` (el `sysctl -n machdep.cpu.brand_string` muestra el CPU real, no el spoofeado).

## Qué corre

- **Cheshire** (`scripts/cheshire.js`): smoke tests con Chromium real contra producción, vía launchd cada 30 min, reporta al servidor con `x-agent-key`.
- Futuro (Wonderland IT, `docs/WONDERLAND_IT.md`): agentes con cron propio (Claude Agent SDK), clon nocturno de DB+stack, Bandersnatch/Jabberwocky.
- Futuro (Zoom, `docs/ZOOM_ALICIA_OPCIONES.md` fase 2): bot self-hosted con el Meeting SDK de Zoom (proceso persistente + media pipeline).

## Gotchas hackintosh

- Arrow Lake no tiene soporte oficial de macOS: el CPU va spoofeado por OpenCore. Las **actualizaciones de macOS NO son automáticas** — antes de actualizar, verificar compatibilidad de OpenCore/kexts o se rompe el arranque.
- El iGPU de Arrow Lake no existe para macOS; todo el video sale de la RX 6800. Si la pantalla muere, el equipo probablemente sigue vivo — entrar por Tailscale/SSH antes de asumir cuelgue.
- Para SSH remoto hace falta **Remote Login** activado (Ajustes → General → Compartir). Tailscale SSH como servidor no existe en macOS.
