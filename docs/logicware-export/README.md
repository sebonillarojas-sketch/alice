# Export de Logicware — 64 días de leads

Snapshot tomado el **2026-09-17** del dashboard público "ANÁLISIS DE LEADS" de
Metabase que Hygge tenía con Logicware (`metabase.logicwareperu.com`, Metabase
v0.50.26). Hygge **ya no es cliente**: esto se extrajo para no perder el histórico
cuando ese dashboard se apague.

## Qué hay acá

`leads-2026-09-17.json` — las 7 tarjetas con sus filas, tal como las devolvió la API
pública. Los `*.json` sueltos son las respuestas crudas, sin tocar.

## Lo que dice

- **303 leads** en total, del 2025-10-16 al 2026-07-02.
- **Canal de entrada:** WHATSAPP 285 · FACEBOOK 8 · SALA DE VENTA 7 · CORREDOR 3
  → WhatsApp es el **94%** de todo.
- **Estado:** Activo 296 · Cerrado 7.
- **85 leads entraron fuera de horario de oficina** (antes de las 9 o después
  de las 20), 28% del total. 22 de ellos a la
  medianoche.

## Lo que NO hay, y es lo importante

Este dashboard expone **agregados, no los leads**. No hay un solo nombre, teléfono
ni correo: son conteos por canal, por día y por hora. **Los 303 registros siguen
adentro de Logicware** y salen solo por un export desde su aplicación o por un
pedido de portabilidad de datos. Esto no los reemplaza.

Tampoco se tocó nada de Logicware más allá de este dashboard público, cuyo link
estaba en `HyggeOS.jsx` desde antes.
