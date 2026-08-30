# ALICE · shell de escritorio

App de Electron que envuelve `alice.bam.pe` y agrega notificaciones nativas de macOS.

## Qué se actualiza solo y qué no

- **El ERP** (todo lo de `files/alice`) se actualiza **solo**, vía Netlify. No hace
  falta publicar una versión de la app por un cambio del ERP.
- **El shell** (esta carpeta) requiere un release firmado. Debería cambiar pocas
  veces al año.

## Publicar una versión

```bash
export APPLE_ID="sebastian@hygge.pe"
export APPLE_APP_SPECIFIC_PASSWORD="..."   # app-specific password de appleid.apple.com
export APPLE_TEAM_ID="..."
export GH_TOKEN="..."                      # token de GitHub con permiso `repo`
npm version patch
npm run release
```

## Instalar por primera vez

Bajar el `.dmg` del último release en GitHub, arrastrar ALICE a Aplicaciones, abrir.
Al primer banner, macOS pide permiso de notificaciones: hay que concederlo.
De ahí en adelante se actualiza sola.

## Reglas del proyecto

- **La web nunca depende de la app.** Toda llamada web→shell va con detección de
  capacidad (`if (window.alice?.notify)`) y funciona igual en navegador.
- **El shell nunca inyecta JavaScript en la página.** Le manda mensajes por IPC y
  la web decide.
- `desktop/` es **CommonJS** a propósito, aunque el resto del repo sea ESM.
