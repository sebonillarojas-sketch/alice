# NAS de ALICE · estructura en Dropbox

_Creada 25 jul 2026. La fuente canónica es `/Hygge/09_ALICE/estructura.md` en Dropbox._

El "NAS" del sistema es Dropbox (`/Hygge/`), que ya sigue la convención de carpetas
numeradas por área (00_INBOX … 10_CONTABILIDAD, `_SISTEMA`). Todo lo de ALICE vive
en `09_ALICE/`. Un NAS físico puede espejar `/Hygge` completo vía Cloud Sync.

```
/Hygge/09_ALICE/
├── _cerebro/                    ← AUTO-GENERADO por src/brainsync.js (cron 3:30am, no editar)
│   ├── empresa.md · README.md
│   ├── memoria/<id>_<nombre>.md
│   └── skills/                  ← espejo de la tabla skills (aliceai)
├── skills/                      ← fuente EDITABLE de playbooks
│   ├── alicia/                  ← skills enseñables de Alicia
│   ├── wonderland/              ← skills destiladas por agentes Wonderland
│   └── bam/                     ← skills de los Bammy
├── agentes/                     ← carpeta mental por agente
│   ├── wonderland/{cheshire, mad_hatter, white_rabbit, bandersnatch,
│   │               tea_table, dark_alice, jabberwocky}/
│   ├── bam/{bammy_arquitectura, bammy_marketing, bammy_comercial}/
│   │   (cada agente: aprendizajes.md + outputs/)
│   └── _plantilla/              ← README + aprendizajes.md + skill_plantilla.md
├── chats/                       ← conversaciones que alimentan a Alicia
│   ├── whatsapp/ · panel/ · erp/
├── erp/
│   ├── exports/                 ← CSV de tareas, terrenos, etc.
│   └── reportes/                ← CEO dashboard, cierres, análisis
├── prompts_wonderland/ · analytics/ · wiki/ · docs/   ← preexistentes
└── estructura.md                ← mapa + convenciones (leer primero)
```

## Convenciones
- Minúsculas, sin tildes, `_` por espacios (igual que `brainsync.js` → `slug()`).
- Prefijo `_` = sistema / auto-generado.
- Chats: `YYYY-MM-DD_<persona-o-tema>.md`. Exports: `YYYY-MM-DD_<qué>.csv`.
- `_cerebro/` y `chats/` contienen info sensible de colaboradores → acceso solo admins en Dropbox.

## Flujo de aprendizaje (fase 2 · pendiente de código)
1. Agentes anotan en `agentes/<agente>/aprendizajes.md`.
2. Lo repetible se destila a `skills/<grupo>/<skill>.md`.
3. Alicia importa `chats/` + `skills/` en el cron nocturno (extender `brainsync.js`:
   hoy solo EXPORTA el cerebro; falta el camino de vuelta import → tabla `skills`/`memories`).
4. `_cerebro/` queda como espejo legible de lo incorporado.

## Pendientes de integración
- [ ] brainsync: import de `skills/alicia/` → tabla `skills` (bidireccional).
- [ ] Export automático de chats (wa.js / panel) → `chats/<canal>/`.
- [ ] Bammys y Wonderland: escribir `aprendizajes.md` al cierre de cada corrida.
- [ ] Export semanal de tareas del ERP → `erp/exports/`.
- [ ] Restringir permisos Dropbox de `_cerebro/` y `chats/` a admins.
