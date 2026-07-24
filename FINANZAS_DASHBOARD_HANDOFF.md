# Handoff · Dashboard de Finanzas del ERP (alice.bam.pe)

_Objetivo: que el dashboard de Finanzas lea el Excel y lo muestre con tablas y gráficos ricos._

## Contexto de arquitectura
- **ERP** = `alice.bam.pe`, React+Vite en `files/alice/`. Deploy **Netlify manual**: `npm run build && npx netlify deploy --prod --dir=dist` (NO conectado a git).
- **Backend** = `alicia-brain/` → `aliceai.bam.pe`, Railway (auto-deploy al pushear a `main`).
- El ERP consume del backend: `BACKEND = ALICIA_URL` (aliceai.bam.pe) para `/api/dropbox/*`.

## NUEVA CONVENCIÓN DE FUENTE (requisito de Sebastián — cambiar)
Reemplazar la vieja convención `{raízProyecto}/Fuente Flujo ERP`. Ahora cada proyecto tiene **DOS reportes financieros distintos**, en rutas fijas bajo `/Hygge/Finanzas/{NOMBRE_PROYECTO}/`:
- `/Hygge/Finanzas/{NOMBRE_PROYECTO}/factibilidad`  → reporte de **Factibilidad**
- `/Hygge/Finanzas/{NOMBRE_PROYECTO}/flujo financiero` → reporte de **Flujo Financiero**

Son dos vistas separadas en el dashboard (tab o toggle "Factibilidad" / "Flujo Financiero"), cada una con su tabla + gráficos.

Implementación:
- **Backend** (`alicia-brain/src/server.js`): reemplazar/añadir sobre `/api/dropbox/flujo`. Recibir el nombre del proyecto y el tipo (`factibilidad` | `flujo financiero`), construir `folder = "/Hygge/Finanzas/" + proyecto + "/" + tipo`, listar y devolver el archivo más reciente (ya soporta `.csv/.tsv/.xlsx/.xls/.xlsm` → CSV vía `lib/sheets.js`). Idempotente: crear la carpeta si no existe (igual que hoy).
- **Frontend** (`FinanzasDashboard` en HyggeOS.jsx): selector de proyecto + toggle de tipo de reporte; llamar al backend con `{ proyecto, tipo }`. Definir de dónde salen los nombres de proyecto (listar `/Hygge/Finanzas/` o mantener `FINANZAS_PROYECTOS` con el nombre de carpeta real).
- Confirmar con Sebastián si `factibilidad` / `flujo financiero` son **subcarpetas** (que contienen el archivo) — asumido acá — o nombres de archivo.

## YA HECHO (backend, en `main`, commit d267db2 — deployado, HTTP 200)
Soporte para leer Excel directo desde Dropbox (antes solo CSV/TSV):
- `alicia-brain/src/lib/sheets.js` (nuevo): `isSpreadsheet()` + `spreadsheetBufferToCsv()` (SheetJS). Elige la primera hoja visible; opcional `sheet` por nombre.
- `alicia-brain/src/integrations/dropbox.js`: `getFileBuffer()` en modo API y local (baja binario intacto).
- `alicia-brain/src/server.js`: `/api/dropbox/download` (detecta xlsx, `?sheet=`) y `/api/dropbox/flujo` (acepta `.xlsx/.xls/.xlsm`, `body.sheet`).
- `alicia-brain/package.json` + lock: dep `xlsx@^0.18.5`.

## LO QUE FALTA (frontend ERP — el pedido real)
`files/alice/src/HyggeOS.jsx` → componente **`FinanzasDashboard`** (~línea 4060) y helpers `parseCSV` / `autoWidgets` (~4000-4340).
Hoy el render es mínimo:
- Tarjetas KPI (última fila de cada col numérica).
- UN `AreaChart` "Evolución temporal" solo si hay ≥3 filas.
- Tabla cruda dentro de un `<details>` colapsable.

Mejoras pedidas por Sebastián ("debería mostrar tablas, curvas etc"):
1. **Tabla siempre visible** y formateada (no colapsada), con números alineados y con separadores de miles / moneda (S/ y $).
2. **Formateo de cifras** en KPIs y tabla (hoy muestra el string crudo de la celda).
3. **Más gráficos**: barras para desglose por partida (`Concepto` vs `Monto`), y curva/línea real cuando el labelCol sea temporal (fecha/mes/periodo). Elegir tipo de chart según si `isLabelCol(labelCol)` es temporal (barras si es categórico, área/línea si es temporal).
4. Layout más de "dashboard" (grid de secciones).

## Realidad del dato (importante)
`CLEMENTE_X.xlsx` (Miraflores) es una **factibilidad estática** (hojas `FACTIBILIDAD_CABIDA`, `Precio`), NO serie temporal → no hay curva mensual sin un cronograma de obra/ventas. Para "flujo en el tiempo" hace falta que Sebastián provea el cronograma.

CSVs limpios ya generados en Dropbox `/Hygge/04_FINANZAS/FINANZAS/reportes/`:
- `CLEMENTE_resumen.csv` — ancho, 1 fila → 6 KPIs (Costo Total 8,442,849 · Ingresos 10,686,696 · Utilidad Bruta 2,243,847 · Impuesto 661,935 · Utilidad Neta 1,581,912 · Margen 14.8%).
- `CLEMENTE_desglose.csv` — `Concepto,Monto (USD)`, 18 filas → barras + tabla.

## Gotchas
- Los fetch del ERP a `/api/dropbox/*` pasan por `panelGate` (server.js:76). El token Supabase lo adjunta el interceptor de `files/alice/src/lib/supabase.js`. **401 = sesión vencida**, **503 = Dropbox no configurado en el backend**.
- **Dropbox OAuth** puede estar vencido (pendiente #1 del HANDOFF.md raíz) → reautorizar en `https://aliceai.bam.pe/auth/dropbox`. Sin esto no carga nada aunque el frontend esté perfecto.
- La fuente pasa a la NUEVA convención de arriba: `/Hygge/Finanzas/{PROYECTO}/factibilidad` y `/Hygge/Finanzas/{PROYECTO}/flujo financiero` (dos reportes). Deprecar `Fuente Flujo ERP` y revisar `FINANZAS_PROYECTOS` (hoy dc01/pu01/tg01/l36/general) para que los nombres calcen con las carpetas reales bajo `/Hygge/Finanzas/`.
- El ERP NO está conectado a git → deploy Netlify manual tras los cambios.

## Primer paso sugerido para Code
Refactor de `autoWidgets()` + render de `FinanzasDashboard`: (a) helper de formato numérico/moneda, (b) tabla siempre visible formateada, (c) selector de tipo de gráfico (barras vs línea) según `isLabelCol`. Probar con los dos CSV de arriba. Luego `npm run build` + deploy Netlify.
