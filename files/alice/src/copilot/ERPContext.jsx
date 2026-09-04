// El registro por donde el ERP le cuenta a Alicia dónde está parada la persona.
// Vive acá y no en HyggeOS.jsx a propósito: ese archivo tiene 16.553 líneas y
// no queremos que esto crezca adentro. Lo único que entra allá son llamadas
// puntuales a useERPContext.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { buildSnapshot } from "./snapshot.js";

const Ctx = createContext(null);

export function ERPContextProvider({ children }) {
  // Refs y no estado: registrarse o cambiar de módulo NO debe re-renderizar el
  // ERP entero. El snapshot se lee recién cuando se manda un turno.
  const registry = useRef(new Map());   // moduleId → () => descripción
  const activeId = useRef(null);
  // La última descripción de lo que estabas mirando, congelada al desmontar.
  // Existe porque el chat de Alicia ocupa la pantalla entera: es UN space más,
  // no un panel al costado. Para escribirle tenés que salir de Cabida (o de
  // Velocity, Cotización, Obra, Mesa, Growth), y salir = desmontar = el módulo
  // se borra del registro antes de que llegues a teclear. Sin esto el snapshot
  // siempre llega vacío. "En qué estoy trabajando", cuando estás hablando con
  // Alicia, es el módulo del que acabás de salir.
  const ultimoVisto = useRef(null);

  const register = useCallback((moduleId, describeFn) => {
    registry.current.set(moduleId, describeFn);
    return () => {
      // Antes de soltarlo, guardar la foto: es lo único que va a quedar de este
      // módulo cuando la persona ya esté en el chat. Un describe() roto no puede
      // impedir un desmontaje, así que va envuelto.
      try {
        const d = describeFn();
        if (d) ultimoVisto.current = { module: moduleId, ...d };
      } catch (e) {
        console.warn(`[copilot] describe() de "${moduleId}" falló al desmontar:`, e);
      }
      registry.current.delete(moduleId);
      // Si el que se desmonta era el activo, hay que soltarlo: si no, queda
      // apuntando a un módulo que ya no existe y ningún otro lo va a corregir
      // (el efecto de otro módulo no se re-dispara solo porque esto cambió).
      if (activeId.current === moduleId) activeId.current = null;
    };
  }, []);

  const setActive = useCallback((moduleId) => { activeId.current = moduleId; }, []);

  const snapshot = useCallback(() => {
    const entries = [];
    for (const [moduleId, describe] of registry.current) {
      // Un describe() roto no puede tumbar el turno: se saltea ese módulo.
      try {
        const d = describe();
        if (d) entries.push({ module: moduleId, ...d });
      } catch (e) {
        console.warn(`[copilot] describe() de "${moduleId}" falló:`, e);
      }
    }
    // Si el registro no tiene activo —el caso normal al estar en el chat— entra
    // la última foto. Se agrega como una entrada más para no tocar el contrato
    // de buildSnapshot: sigue recibiendo entradas y un moduleId activo.
    let activo = activeId.current;
    if (!entries.some((e) => e.module === activo)
      && ultimoVisto.current && !registry.current.has(ultimoVisto.current.module)) {
      entries.push(ultimoVisto.current);
      activo = ultimoVisto.current.module;
    }
    return buildSnapshot(entries, activo);
  }, []);

  // Memoizado: si no, cada render de ERPContextProvider crea un objeto nuevo y
  // eso re-dispara el efecto de CADA módulo registrado (ctx está en sus deps),
  // aunque register/setActive/snapshot sean estables.
  const value = useMemo(() => ({ register, setActive, snapshot }), [register, setActive, snapshot]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Registra un módulo y lo marca como activo mientras esté montado.
// describeFn se guarda en un ref: cambiarla en cada render no re-registra nada,
// así que el módulo NO necesita envolverla en useCallback.
export function useERPContext(moduleId, describeFn) {
  const ctx = useContext(Ctx);
  const fn = useRef(describeFn);
  fn.current = describeFn;

  useEffect(() => {
    if (!ctx) return;                       // sin provider (tests, storybook) no hace nada
    const unregister = ctx.register(moduleId, () => fn.current());
    ctx.setActive(moduleId);
    return unregister;
  }, [ctx, moduleId]);
}

export function useCopilotSnapshot() {
  const ctx = useContext(Ctx);
  // Sin provider devolvemos un snapshot vacío en vez de romper: así AliciaView
  // sigue andando en cualquier árbol que no lo tenga montado.
  return ctx?.snapshot ?? (() => ({ active: null, others: [], dropped: 0 }));
}
