// El registro por donde el ERP le cuenta a Alicia dónde está parada la persona.
// Vive acá y no en HyggeOS.jsx a propósito: ese archivo tiene 16.553 líneas y
// no queremos que esto crezca adentro. Lo único que entra allá son llamadas
// puntuales a useERPContext.
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { buildSnapshot } from "./snapshot.js";

const Ctx = createContext(null);

export function ERPContextProvider({ children }) {
  // Refs y no estado: registrarse o cambiar de módulo NO debe re-renderizar el
  // ERP entero. El snapshot se lee recién cuando se manda un turno.
  const registry = useRef(new Map());   // moduleId → () => descripción
  const activeId = useRef(null);

  const register = useCallback((moduleId, describeFn) => {
    registry.current.set(moduleId, describeFn);
    return () => registry.current.delete(moduleId);
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
    return buildSnapshot(entries, activeId.current);
  }, []);

  return <Ctx.Provider value={{ register, setActive, snapshot }}>{children}</Ctx.Provider>;
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
