// Hook que sincroniza el estado de tareas del cockpit con el ERP en background.
// Estrategia: localStorage sigue siendo la fuente de verdad del cockpit,
// el ERP recibe una copia de cada cambio (fire-and-forget).
// Cuando el cockpit carga, intenta hidratar desde el ERP si está disponible.

import { useEffect, useRef, useCallback } from "react";
import { erpTasks, erpEvents, erpHealth, erpTaskToCockpit } from "./erp.js";

export function useERPSync({ tasks, setTasks, currentUser, loaded }) {
  const erpAvailable = useRef(false);
  const synced = useRef(false);
  const taskERPIds = useRef(new Map()); // cockpitId → erpId

  // ── 1. Verificar disponibilidad del ERP al montar ──────────────────────
  useEffect(() => {
    erpHealth().then(h => {
      erpAvailable.current = !!h?.ok;
      if (h?.ok) console.log("🟢 ERP conectado · sincronización activa");
    });
  }, []);

  // ── 2. Hidratación inicial: cargar tareas del ERP ─────────────────────
  // Solo corre una vez, después de que el cockpit cargó su estado local.
  useEffect(() => {
    if (!loaded || synced.current || !erpAvailable.current) return;
    synced.current = true;

    erpTasks.list().then(erpList => {
      if (!erpList?.length) return;

      const cockpitTasks = erpList.map(erpTaskToCockpit);

      setTasks(prev => {
        // Merge: las tareas del ERP que no existen localmente se agregan.
        // Las tareas locales que ya existen en el ERP se actualizan con datos del ERP.
        const erpIds = new Set(erpList.map(t => t.id));
        const localWithoutERP = prev.filter(t => !t._erpId && !erpIds.has(t.id));
        return [...cockpitTasks, ...localWithoutERP];
      });

      // Mapear IDs
      erpList.forEach(t => taskERPIds.current.set(t.id, t.id));
      console.log(`📥 ${erpList.length} tareas cargadas desde el ERP`);
    }).catch(() => {});
  }, [loaded, setTasks]);

  // ── 3. Push de nueva tarea al ERP ────────────────────────────────────
  const pushNewTask = useCallback(async (task) => {
    if (!erpAvailable.current || task._fromERP) return;
    try {
      const created = await erpTasks.create(task, currentUser?.id);
      taskERPIds.current.set(task.id, created.id);
      // Actualizar el _erpId en el state local
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, _erpId: created.id, _fromERP: true } : t
      ));
      console.log(`✅ Tarea #${created.id} creada en ERP: "${task.title}"`);
    } catch (e) {
      console.warn("ERP create_task failed:", e.message);
    }
  }, [currentUser, setTasks]);

  // ── 4. Push de actualización de tarea al ERP ─────────────────────────
  const pushTaskUpdate = useCallback(async (cockpitId, fields) => {
    if (!erpAvailable.current) return;
    const erpId = taskERPIds.current.get(cockpitId);
    if (!erpId) return;
    try {
      await erpTasks.update(erpId, fields, currentUser?.id);
    } catch (e) {
      console.warn("ERP update_task failed:", e.message);
    }
  }, [currentUser]);

  // ── 5. Push de nuevo evento al ERP ───────────────────────────────────
  const pushNewEvent = useCallback(async (event) => {
    if (!erpAvailable.current) return;
    try {
      const created = await erpEvents.create(event, currentUser?.id);
      console.log(`✅ Evento #${created.id} creado en ERP: "${event.title}"`);
    } catch (e) {
      console.warn("ERP create_event failed:", e.message);
    }
  }, [currentUser]);

  return { pushNewTask, pushTaskUpdate, pushNewEvent, erpAvailable };
}
