// files/alice/src/copilot/esperas.js
//
// El mecanismo de espera de ERPContext, extraído a un módulo puro: sin JSX, sin
// React, sin DOM. Existe por erp_navigate: cuando Alicia llama a navigate(),
// React todavía no re-renderizó y el módulo destino no montó. Sin esto, el
// erp_read que viene atrás leería un registro vacío y Alicia diría que Cabida
// no tiene nada.
//
// Por qué separado de ERPContext.jsx: es la única lógica de ese archivo con
// aristas de concurrencia (Promise + Map + Set + setTimeout) y el reviewer de
// la Tarea 6 encontró que ningún test la ejercitaba de verdad — los tests de
// manos.js usan un registro falso cuyo esperarRegistro es una comprobación
// síncrona, no este mecanismo. Puro, se testea sin montar nada.

export function crearEsperas() {
  // moduleId → Set<{ resolve, timer }>. Cada entrada guarda su propio timer
  // para poder cancelarlo si el módulo monta antes de que venza — así no queda
  // un setTimeout colgado hasta 3s en cada navigate exitoso.
  const colas = new Map();

  // Despertar a quien estaba esperando este módulo: se llama desde register().
  function despertar(moduleId) {
    const cola = colas.get(moduleId);
    if (!cola) return;
    colas.delete(moduleId);
    for (const entry of cola) {
      clearTimeout(entry.timer);
      entry.resolve(true);
    }
  }

  // yaEsta: si el llamador ya sabe que el módulo está registrado, resuelve al
  // toque sin tocar la cola ni programar un timer.
  function esperar(moduleId, timeoutMs, yaEsta) {
    if (yaEsta) return Promise.resolve(true);
    return new Promise((resolve) => {
      const entry = { resolve, timer: null };
      const cola = colas.get(moduleId) ?? new Set();
      cola.add(entry);
      colas.set(moduleId, cola);

      entry.timer = setTimeout(() => {
        // Que no monte NO es un error del que haya que recuperarse: puede ser
        // un módulo que no existe, o uno que tarda. Resolvemos en false y que
        // la mano lo cuente como lo que es.
        //
        // `colas.get(moduleId)` puede ya ser OTRA cola (una episodio de espera
        // nuevo para el mismo moduleId, si éste ya se vació y se recreó):
        // borrar por identidad de `entry` evita que este timer viejo le toque
        // un pelo a esa cola nueva.
        const c = colas.get(moduleId);
        if (c?.delete(entry) && c.size === 0) colas.delete(moduleId);
        resolve(false);
      }, timeoutMs);
    });
  }

  return { despertar, esperar };
}
