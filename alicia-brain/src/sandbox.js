// Guard global del clon nocturno: con SANDBOX=1, toda salida externa se no-opea
// (además del env pelado). Cinturón + tiradores contra tocar prod. Ver spec.
export function isSandbox() { return process.env.SANDBOX === "1"; }
