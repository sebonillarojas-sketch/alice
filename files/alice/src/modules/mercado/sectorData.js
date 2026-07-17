// datos de sector por distrito + competidores relevados — fuente única para
// TerrenoOpportunidad (Growth · análisis) y las láminas de mercado de la Mesa de Trabajo.
// Relevamiento manual jul-2026 (Nexo + páginas de developers).

export const DISTRICTS_DATA = {
  "Miraflores":  { base: 3.5, priceRange: [3200, 6500], trend: "estable",   trendScore: 1.05, nse: "A",    desc: "NSE A. Demanda sostenida, premium consolidado.",          lat: -12.1191, lng: -77.0289, oferta: 18, demanda: 82, stock: 340, m2Prom: 95 },
  "San Isidro":  { base: 2.8, priceRange: [3800, 7200], trend: "estable",   trendScore: 1.00, nse: "A+",   desc: "NSE A+. Small & luxury. Absorción lenta, precio alto.",    lat: -12.0934, lng: -77.0368, oferta: 12, demanda: 68, stock: 180, m2Prom: 78 },
  "Barranco":    { base: 2.5, priceRange: [2800, 5000], trend: "trending",  trendScore: 1.28, nse: "A/B+", desc: "NSE A/B+. Storytelling = driver clave.",                   lat: -12.1476, lng: -77.0217, oferta: 9,  demanda: 91, stock: 210, m2Prom: 88 },
  "La Molina":   { base: 4.8, priceRange: [2200, 4800], trend: "estable",   trendScore: 1.00, nse: "B+/A", desc: "NSE B+/A. Buyer familiar.",                                lat: -12.0851, lng: -76.9422, oferta: 22, demanda: 74, stock: 520, m2Prom: 120 },
  "Surco":       { base: 6.2, priceRange: [1800, 3800], trend: "estable",   trendScore: 0.98, nse: "B/B+", desc: "NSE B/B+. Masivo con bolsones premium.",                   lat: -12.1374, lng: -76.9967, oferta: 35, demanda: 78, stock: 890, m2Prom: 105 },
  "Jesús María": { base: 7.5, priceRange: [1600, 2800], trend: "trending",  trendScore: 1.22, nse: "B/B+", desc: "NSE B/B+. Alta velocidad, precio accesible.",              lat: -12.0806, lng: -77.0472, oferta: 28, demanda: 88, stock: 670, m2Prom: 70 },
  "Magdalena":   { base: 5.5, priceRange: [1700, 3000], trend: "trending",  trendScore: 1.18, nse: "B+",   desc: "NSE B+. Zona en consolidación.",                           lat: -12.0924, lng: -77.0684, oferta: 14, demanda: 85, stock: 310, m2Prom: 75 },
  "San Borja":   { base: 4.2, priceRange: [2200, 4200], trend: "estable",   trendScore: 1.00, nse: "A/B+", desc: "NSE A/B+. Familiar.",                                      lat: -12.1006, lng: -76.9985, oferta: 20, demanda: 72, stock: 430, m2Prom: 100 },
  "Pueblo Libre":{ base: 5.8, priceRange: [1500, 2600], trend: "emergente", trendScore: 0.88, nse: "B",    desc: "NSE B. Emergente.",                                        lat: -12.0743, lng: -77.0618, oferta: 16, demanda: 79, stock: 380, m2Prom: 68 },
  "San Miguel":  { base: 6.8, priceRange: [1400, 2500], trend: "emergente", trendScore: 0.90, nse: "B",    desc: "NSE B. Volumen es el negocio.",                            lat: -12.0780, lng: -77.0900, oferta: 31, demanda: 76, stock: 720, m2Prom: 65 },
  "Lince":       { base: 8.2, priceRange: [1300, 2200], trend: "emergente", trendScore: 0.85, nse: "B/C+", desc: "NSE B/C+. Riesgo sobre-oferta.",                           lat: -12.0820, lng: -77.0368, oferta: 24, demanda: 62, stock: 540, m2Prom: 58 },
  "Chorrillos":  { base: 5.2, priceRange: [1500, 2800], trend: "emergente", trendScore: 0.82, nse: "B",    desc: "NSE B. Playa como diferenciador.",                         lat: -12.1727, lng: -77.0175, oferta: 19, demanda: 71, stock: 410, m2Prom: 72 },
};

export const COMPETITORS_DB = {
  "Miraflores":  [
    { name: "The 21st",          dev: "Menorca",        priceM2: 6200, units: 32, absorption: 2.1, status: "En venta",    link: "https://menorca.pe" },
    { name: "Miraflores 380",    dev: "Paz Centenario", priceM2: 5800, units: 45, absorption: 2.8, status: "En venta",    link: "" },
    { name: "Parque Reducto",    dev: "Armas Doomo",    priceM2: 5200, units: 28, absorption: 2.4, status: "Pre-venta",   link: "" },
    { name: "Vivo Miraflores",   dev: "Besco",          priceM2: 4200, units: 78, absorption: 4.2, status: "En venta",    link: "https://besco.com.pe" },
    { name: "Residencial Larco", dev: "JLL Lima",       priceM2: 4800, units: 60, absorption: 3.5, status: "Entrega",     link: "" },
  ],
  "Barranco":    [
    { name: "Espacio Barranco",  dev: "JLL Lima",       priceM2: 4200, units: 38, absorption: 2.8, status: "En venta",    link: "" },
    { name: "Park Barranco",     dev: "Altas Cumbres",  priceM2: 3800, units: 52, absorption: 3.1, status: "En venta",    link: "" },
    { name: "Vista Barranco",    dev: "Paz Centenario", priceM2: 4800, units: 24, absorption: 1.9, status: "Pre-venta",   link: "" },
    { name: "The Bloom",         dev: "Menorca",        priceM2: 5200, units: 18, absorption: 1.5, status: "Lanzamiento", link: "https://menorca.pe" },
    { name: "Colonia 550",       dev: "Besco",          priceM2: 3500, units: 65, absorption: 3.8, status: "Entrega",     link: "" },
  ],
  "San Isidro":  [
    { name: "Torre Camino Real", dev: "Grupo T&C",      priceM2: 7200, units: 18, absorption: 1.4, status: "En venta",    link: "" },
    { name: "1 Augusto Tamayo",  dev: "Marcan",         priceM2: 6800, units: 24, absorption: 1.8, status: "En venta",    link: "" },
    { name: "Petit",             dev: "Menorca",        priceM2: 5400, units: 35, absorption: 2.6, status: "Pre-venta",   link: "https://menorca.pe" },
    { name: "Santander",         dev: "Besco",          priceM2: 4800, units: 42, absorption: 2.2, status: "En venta",    link: "" },
  ],
  "Jesús María": [
    { name: "Residencial JM",    dev: "Altas Cumbres",  priceM2: 2600, units: 88, absorption: 7.2, status: "En venta",    link: "" },
    { name: "Parque Aurelio",    dev: "Besco",          priceM2: 2400, units: 102, absorption: 8.1, status: "En venta",   link: "" },
    { name: "La Cuadra",         dev: "Paz Centenario", priceM2: 2800, units: 65, absorption: 6.0, status: "Pre-venta",   link: "" },
    { name: "Urbano JM",         dev: "Grupo T&C",      priceM2: 2200, units: 120, absorption: 9.0, status: "En venta",   link: "" },
  ],
  "Surco":       [
    { name: "Viva Surco",        dev: "Besco",          priceM2: 3200, units: 95, absorption: 6.8, status: "En venta",    link: "" },
    { name: "Park 8",            dev: "Paz Centenario", priceM2: 3800, units: 48, absorption: 5.2, status: "En venta",    link: "" },
    { name: "Residencial 40",    dev: "Altas Cumbres",  priceM2: 2800, units: 130, absorption: 7.5, status: "En venta",   link: "" },
    { name: "Nuevo Surco",       dev: "JLL Lima",       priceM2: 2600, units: 160, absorption: 8.0, status: "Entrega",    link: "" },
  ],
  "La Molina":   [
    { name: "Parque La Molina",  dev: "Grupo T&C",      priceM2: 4500, units: 55, absorption: 4.2, status: "En venta",    link: "" },
    { name: "Natura",            dev: "Paz Centenario", priceM2: 3800, units: 72, absorption: 5.0, status: "En venta",    link: "" },
    { name: "Las Praderas",      dev: "Altas Cumbres",  priceM2: 3200, units: 90, absorption: 5.8, status: "En venta",    link: "" },
  ],
  "Magdalena":   [
    { name: "Magdalena Park",    dev: "Besco",          priceM2: 2900, units: 70, absorption: 5.2, status: "En venta",    link: "" },
    { name: "Av. Del Ejército",  dev: "Altas Cumbres",  priceM2: 2600, units: 88, absorption: 5.8, status: "Pre-venta",   link: "" },
    { name: "Costa Azul",        dev: "JLL Lima",       priceM2: 3200, units: 45, absorption: 4.5, status: "En venta",    link: "" },
  ],
  "San Borja":   [
    { name: "Parque Borja",      dev: "Menorca",        priceM2: 4000, units: 48, absorption: 3.8, status: "En venta",    link: "" },
    { name: "Residencial SB",    dev: "Besco",          priceM2: 3500, units: 65, absorption: 4.5, status: "En venta",    link: "" },
    { name: "Torres Centenario", dev: "Paz Centenario", priceM2: 3200, units: 80, absorption: 4.2, status: "Pre-venta",   link: "" },
  ],
  "Pueblo Libre":[ { name: "Viva Libre",      dev: "Besco",          priceM2: 2400, units: 75, absorption: 5.5, status: "En venta", link: "" }, { name: "Parque Grau",   dev: "Altas Cumbres",  priceM2: 2200, units: 95, absorption: 6.2, status: "En venta", link: "" } ],
  "San Miguel":  [ { name: "Nuevo Miguel",    dev: "JLL Lima",       priceM2: 2300, units: 110, absorption: 7.0, status: "En venta", link: "" }, { name: "Playa Park",    dev: "Besco",          priceM2: 2600, units: 80, absorption: 5.8, status: "En venta", link: "" } ],
  "Lince":       [ { name: "Lince Center",    dev: "Grupo T&C",      priceM2: 2000, units: 120, absorption: 8.0, status: "En venta", link: "" }, { name: "Residencial L", dev: "Altas Cumbres",  priceM2: 1800, units: 150, absorption: 9.2, status: "En venta", link: "" } ],
  "Chorrillos":  [ { name: "Costa Sur",       dev: "Besco",          priceM2: 2500, units: 90, absorption: 5.0, status: "En venta", link: "" }, { name: "Playa Costa",   dev: "Paz Centenario", priceM2: 2800, units: 65, absorption: 4.5, status: "Pre-venta", link: "" } ],
};

export const TREND_LABEL = { trending: "En alza", estable: "Estable", emergente: "Emergente" };
