// financiamiento.js — motor de cuotas hipotecarias para la Cotización.
// Las tasas (bank_rates / macro) vienen SIEMPRE del feed real de alicia-brain
// (BCRP + scraper de bancos, ver alicia-brain/src/market.js) — este archivo
// solo hace la aritmética de amortización, cero data propia.

// TEA (tasa efectiva anual, %) → TEM (tasa efectiva mensual, fracción)
export function teaToTem(teaPercent) {
  const tea = teaPercent / 100;
  return Math.pow(1 + tea, 1 / 12) - 1;
}

// Cuota fija · sistema francés de amortización
export function cuotaFrancesa({ montoFinanciar, teaPercent, plazoAnios }) {
  if (!montoFinanciar || !teaPercent || !plazoAnios) return null;
  const i = teaToTem(teaPercent);
  const n = Math.round(plazoAnios * 12);
  if (i <= 0 || n <= 0) return null;
  const factor = Math.pow(1 + i, n);
  const cuota = montoFinanciar * (i * factor) / (factor - 1);
  return {
    cuotaMensual: cuota,
    totalPagado: cuota * n,
    totalIntereses: cuota * n - montoFinanciar,
    n,
    tem: i,
  };
}

// Financiamiento propio (directo con el desarrollador, sin banco): los
// términos son lo que se negocie con el cliente — tasa (a veces 0%), cantidad
// de cuotas y monto son inputs manuales de comercial, no vienen de ningún
// feed. Esta función arma el cronograma cuota por cuota.
export function generarCronogramaPropio({ monto, teaPercent = 0, meses, fechaInicioISO }) {
  if (!monto || !meses || meses <= 0) return [];
  const i = teaPercent > 0 ? teaToTem(teaPercent) : 0;
  const cuota = i > 0
    ? monto * (i * Math.pow(1 + i, meses)) / (Math.pow(1 + i, meses) - 1)
    : monto / meses;
  const start = fechaInicioISO ? new Date(fechaInicioISO) : null;
  let saldo = monto;
  const filas = [];
  for (let n = 1; n <= meses; n++) {
    const interes = saldo * i;
    const amortizacion = cuota - interes;
    saldo = Math.max(0, saldo - amortizacion);
    let fecha = null;
    if (start) { fecha = new Date(start); fecha.setMonth(fecha.getMonth() + n); }
    filas.push({ numero: n, fecha, cuota, interes, amortizacion, saldo });
  }
  return filas;
}

// Ratio de endeudamiento estándar usado por la banca peruana para hipotecarios:
// la cuota no debería superar ~30-35% del ingreso mensual del cliente. Es una
// regla de bolsillo declarada como tal en la UI, no un dato de mercado.
export const RATIO_ENDEUDAMIENTO_DEFAULT = 0.30;

export function capacidadEndeudamiento({ ingresoMensual, cuotaMensual, ratioMax = RATIO_ENDEUDAMIENTO_DEFAULT }) {
  if (!ingresoMensual || !cuotaMensual) return { ratio: null, apta: null };
  const ratio = cuotaMensual / ingresoMensual;
  return { ratio, apta: ratio <= ratioMax };
}

// Compara cuotas entre todos los bancos con tasa real disponible (bank_rates,
// vivo desde alicia-brain). moneda: "PEN" | "USD".
export function calcularCuotasPorBanco({ precioUnidad, inicialMonto, plazoAnios, bankRates, moneda = "PEN", ingresoMensual }) {
  const montoFinanciar = Math.max(0, (precioUnidad || 0) - (inicialMonto || 0));
  const rateField = moneda === "USD" ? "rate_usd" : "rate_pen";
  return (bankRates || [])
    .filter(b => b[rateField] != null)
    .map(b => {
      const calc = cuotaFrancesa({ montoFinanciar, teaPercent: b[rateField], plazoAnios });
      const capacidad = calc ? capacidadEndeudamiento({ ingresoMensual, cuotaMensual: calc.cuotaMensual }) : { ratio: null, apta: null };
      return {
        bank: b.bank,
        tea: b[rateField],
        montoFinanciar,
        ...calc,
        ...capacidad,
      };
    })
    .filter(r => r.cuotaMensual != null)
    .sort((a, b) => a.cuotaMensual - b.cuotaMensual);
}
