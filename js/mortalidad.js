/**
 * mortalidad.js — Mortality table utilities
 * Loads tablas.json once and exposes survival probability helpers.
 * Tables used:
 *   rv2020_hombre / rv2020_mujer → Renta Vitalicia
 *   b2020_hombre  / b2020_mujer  → Retiro Programado
 */

let _tablas = null;

export async function cargarTablas() {
  if (_tablas) return _tablas;
  const base = location.pathname.includes('/pages/') ? '../' : './';
  const res  = await fetch(`${base}data/tablas.json`);
  _tablas = await res.json();
  return _tablas;
}

/**
 * Probability of surviving t more years from exact age x.
 * tPx = ∏(i=0..t-1) (1 - q[x+i])
 * @param {string} nombreTabla - e.g. 'b2020_hombre'
 * @param {number} x - current exact age
 * @param {number} t - years ahead
 * @returns {number} survival probability [0,1]
 */
export function tPx(nombreTabla, x, t) {
  if (!_tablas) return 0;
  const tabla = _tablas[nombreTabla];
  if (!tabla) return 0;
  let prob = 1;
  for (let i = 0; i < t; i++) {
    const edad = Math.min(x + i, 110);
    const row  = tabla[edad];
    if (!row) break;
    prob *= (1 - row.qx);
    if (prob < 1e-10) break;
  }
  return prob;
}

/**
 * Curtate life expectancy from edadActual using a named table.
 * e_x = Σ(t=1..omega) tPx(x, t)
 * @returns {number} expected additional years of life
 */
export function esperanzaVida(nombreTabla, edadActual) {
  if (!_tablas) return 0;
  let ex = 0;
  for (let t = 1; t <= 110 - edadActual; t++) {
    ex += tPx(nombreTabla, edadActual, t);
  }
  return ex;
}

/**
 * Computes CRU directly from B-2020 mortality tables for any age.
 * Used for beneficiaries outside the pre-computed CRU range (children, young spouses).
 * @param {string} sexo - 'M' | 'F'
 * @param {number} edad
 * @param {number} tasaMensual - monthly technical rate (e.g. 0.0331/12)
 * @returns {number} CRU in months
 */
export function getCRUCalculado(sexo, edad, tasaMensual) {
  if (!_tablas) return 300;
  const tabla = sexo === 'M' ? _tablas.b2020_hombre : _tablas.b2020_mujer;
  let cru = 0;
  let px  = 1;
  const edadBase = Math.floor(edad);
  const maxMeses = (110 - edadBase) * 12;
  for (let k = 1; k <= maxMeses; k++) {
    const edadAnual = Math.min(edadBase + Math.floor((k - 1) / 12), 110);
    const row = tabla[edadAnual];
    if (!row || row.qx >= 1) break;
    const qMensual = 1 - Math.pow(1 - row.qx, 1 / 12);
    px *= (1 - qMensual);
    if (px < 1e-10) break;
    cru += px * Math.pow(1 + tasaMensual, -k);
  }
  return cru;
}

/**
 * Capital Requerido Unitario for a given sex and age.
 * Pre-computed in tablas.json for ages 50-75.
 * Interpolates linearly for intermediate ages.
 * @param {string} sexo - 'M' (male) | 'F' (female)
 * @param {number} edad
 * @returns {number} CRU in months
 */
export function getCRU(sexo, edad) {
  if (!_tablas || !_tablas.cru) return 180; // fallback
  const tabla = sexo === 'M' ? _tablas.cru.hombre : _tablas.cru.mujer;
  const edadStr = String(Math.round(edad));
  if (tabla[edadStr] !== undefined) return tabla[edadStr];

  // Linear interpolation between nearest available ages
  const ages = Object.keys(tabla).map(Number).sort((a, b) => a - b);
  const lower = ages.filter(a => a <= edad).pop();
  const upper = ages.filter(a => a >  edad)[0];
  if (lower === undefined) return tabla[ages[0]];
  if (upper === undefined) return tabla[ages[ages.length - 1]];
  const t = (edad - lower) / (upper - lower);
  return tabla[lower] + t * (tabla[upper] - tabla[lower]);
}
