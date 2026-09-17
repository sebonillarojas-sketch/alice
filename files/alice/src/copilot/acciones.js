//
// El bus de acciones: lo que cada módulo del ERP deja disponible para que Alicia
// lo ejecute. Sin JSX ni React a propósito, para que `node --test` lo importe
// directo y para que no dependa de dónde esté montado.
//
// El bus NO sabe nada de confirmación. Que una acción se confirme lo decide el
// catálogo del cerebro (client-tools.js) y lo transporta el frame `confirm`.
// Acá llega lo que ya fue confirmado.

export function crearBus() {
  const acciones = new Map();

  function registrar(nombre, fn) {
    acciones.set(nombre, fn);
    return () => {
      // Sólo borrar si sigue siendo LA MISMA función. Cuando un módulo se
      // re-monta, el cleanup del montaje viejo corre DESPUÉS del registro del
      // nuevo: un delete a ciegas dejaría la acción muerta.
      if (acciones.get(nombre) === fn) acciones.delete(nombre);
    };
  }

  async function ejecutar(nombre, args) {
    const fn = acciones.get(nombre);
    if (!fn) {
      const hay = [...acciones.keys()];
      throw new Error(
        `La acción "${nombre}" no está disponible en esta pantalla.` +
        (hay.length ? ` Disponibles: ${hay.join(", ")}.` : " No hay ninguna acción disponible acá.")
      );
    }
    let salida;
    try {
      salida = await fn(args ?? {});
    } catch (e) {
      // El nombre adentro del mensaje: el error termina siendo un tool_result y
      // el modelo tiene que poder decir cuál de las acciones falló.
      throw new Error(`"${nombre}" falló: ${e?.message ?? e}`);
    }
    if (typeof salida === "string") return salida;
    if (salida === undefined || salida === null) return "Hecho.";
    try { return JSON.stringify(salida); }
    catch { return String(salida); }
  }

  const disponibles = () => [...acciones.keys()];

  return { registrar, ejecutar, disponibles };
}
