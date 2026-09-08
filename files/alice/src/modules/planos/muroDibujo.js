// Helpers puros de dibujo para los muros y vanos derivados (§9 de
// docs/superpowers/specs/2026-09-07-muros-vanos-design.md).
//
// Separados de EditorPlanos.jsx a propósito: son la parte de la Tarea 3 que se puede
// probar sin levantar React (jerarquía de línea, elección de símbolo, convención de
// ángulo). EditorPlanos.jsx es el único consumidor real — ver
// test/editor-muros-dibujo.test.mjs, que verifica que el lienzo de producción
// efectivamente los usa.
//
// Módulo puro: sin React, sin estado, sin I/O.
import { resolverVano } from "./vanos.js";

// §9 "jerarquía de línea": los muros perimetrales/estructurales se dibujan gruesos, los
// tabiques delgados. La lista sale del pliego, no se reinventa acá.
const CLASES_GRUESAS = new Set(["medianera", "fachada", "fachada_patio", "entre_unidades", "nucleo"]);
export const esMuroGrueso = (clase) => CLASES_GRUESAS.has(clase);

// El tabique es una FRACCIÓN del muro portante configurado en el editor (el campo
// "muro" de la toolbar), no un valor fijo aparte: si el usuario cambia ese espesor
// base, la jerarquía visual se mantiene proporcional en vez de desalinearse.
export const TABIQUE_FACTOR = 0.6;
export function grosorDeMuro(clase, muroBase) {
  return esMuroGrueso(clase) ? muroBase : muroBase * TABIQUE_FACTOR;
}

// §9.3: "sin_muro" son dos tramos del mismo pasillo — no hay pared ahí, dibujarla
// cruzaría el corredor. El resto de las clases (incluida "interior_ciego", que es un
// hallazgo de clasificación, no una clase sin muro) sí se dibuja.
export const muroEsVisible = (muro) => muro?.clase !== "sin_muro";

// Qué símbolo YA EXISTENTE en simbolos.jsx corresponde a un vano derivado. El catálogo
// solo decide qué DIBUJO usar (puerta/ventana/vano genérico) — el ancho real dibujado es
// siempre vano.ancho, nunca el del catálogo, para no desalinear el símbolo del vano que
// construirVanos ya resolvió.
export function refDeVano(vano) {
  if (vano?.tipo === "ventana") return vano.ancho >= 1.5 ? "ventana-180" : "ventana-120";
  if (vano?.tipo === "puerta") return vano.ancho >= 0.85 ? "puerta-90" : "puerta-80";
  return "vano-100";
}

// Resuelve un vano derivado a lo que <Simbolo> necesita para dibujarlo: posición en
// coordenadas del MUNDO (el caller la pasa por toScreen), ángulo y espesor. Delega la
// posición en resolverVano — la ÚNICA función que puede calcularla — así que esto nunca
// puede desalinear un vano de su muro.
//
// Convención de ángulo (verificada contra EditorPlanos.jsx, no asumida): `toScreen` ahí
// es `(p) => ({ x: p.x*scale+tx, y: p.y*scale+ty })` — NO invierte el eje Y, el mundo y
// la pantalla comparten signo. <Simbolo> aplica `rotate(t.rot)` directamente en ese
// mismo espacio de pantalla. Como resolverVano devuelve `angulo = atan2(dy,dx)` en el
// mismo sistema (mundo, sin invertir), el ángulo se pasa TAL CUAL como `rot`, sin
// invertir el signo. Si `toScreen` alguna vez invierte Y, este comentario (y el test de
// convención) son la primera señal de que hay que invertir `rot` también.
export function simboloDeVano(vano, muro, muroBase) {
  const g = resolverVano(vano, muro);
  if (!g) return null;
  return {
    ref: refDeVano(vano),
    w: vano.ancho,
    d: Math.max(grosorDeMuro(muro.clase, muroBase), 0.05),
    rot: g.angulo,
    centro: g.centro,
  };
}
