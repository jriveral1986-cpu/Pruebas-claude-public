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
 * CRU para Renta Vitalicia desde tablas RV-2020 a tasa de mercado RV.
 * Aplica mejoramiento AAx (mismos factores que B-2020 por NCG N°306) si se provee anioJubilacion.
 *
 * A diferencia de calcularCNUConMejoramiento (RP), aquí no existe una tabla CRU
 * pre-computada oficial para RV, por lo que el CRU se calcula directamente desde qx.
 *
 * @param {string} sexo - 'M' | 'F'
 * @param {number} edad
 * @param {number} tasaMensualRV - tasa mensual mercado RV (ej. TASA_RV = 0.0276/12)
 * @param {number|null} anioJubilacion
 * @returns {number} CRU_RV en meses
 */
export function getCRURentaVitalicia(sexo, edad, tasaMensualRV, anioJubilacion = null) {
  if (!_tablas) return 200;
  const tablaQx  = sexo === 'M' ? _tablas.rv2020_hombre : _tablas.rv2020_mujer;
  const aaxBidim = _tablas.aax
    ? (sexo === 'M' ? _tablas.aax.b2020_hombre : _tablas.aax.b2020_mujer)
    : null;
  if (!tablaQx) return 200;

  const edadBase = Math.floor(edad);
  const tm = _tablas.aax?.anioTabla ?? 2020;

  // Pre-computar factor de mejoramiento por edad (NCG N°306, mismos AAx para RP y RV)
  let factorMejora = null;
  if (aaxBidim && anioJubilacion && anioJubilacion > tm) {
    factorMejora = new Array(111);
    for (let x = edadBase; x <= 110; x++) {
      let f = 1;
      for (let y = tm + 1; y <= anioJubilacion; y++) f *= (1 - getAAxParaAnio(aaxBidim, x, y));
      factorMejora[x] = f;
    }
  }

  let cru = 0, px = 1;
  for (let k = 1; k <= (110 - edadBase) * 12; k++) {
    const x   = Math.min(edadBase + Math.floor((k - 1) / 12), 110);
    const row = tablaQx[x];
    if (!row || row.qx >= 1) break;
    const qx       = factorMejora ? row.qx * (factorMejora[x] ?? 1) : row.qx;
    const qMensual = 1 - Math.pow(1 - qx, 1 / 12);
    px *= (1 - qMensual);
    if (px < 1e-10) break;
    cru += px * Math.pow(1 + tasaMensualRV, -k);
  }
  return cru;
}

/**
 * Extrapolates CRU for ages BELOW the pre-computed table minimum,
 * using the slope of the two youngest entries in the table.
 * For ages within the table range, delegates to getCRU().
 * More accurate than getCRUCalculado() because the raw b2020 tables
 * have qx values inconsistent with the official pre-computed CRU.
 * @param {string} sexo - 'M' | 'F'
 * @param {number} edad
 * @returns {number} CRU in months
 */
export function getCRUExtrapolado(sexo, edad) {
  if (!_tablas || !_tablas.cru) return 300;
  const tabla = sexo === 'M' ? _tablas.cru.hombre : _tablas.cru.mujer;
  const ages = Object.keys(tabla).map(Number).sort((a, b) => a - b);
  if (edad >= ages[0]) return getCRU(sexo, edad);
  // Linear extrapolation using slope from two youngest table entries
  const a1 = ages[0], a2 = ages[1];
  const slopePerYear = (tabla[a2] - tabla[a1]) / (a2 - a1); // negative (CRU decreases with age)
  return tabla[a1] + slopePerYear * (edad - a1); // increases for ages below a1
}

/**
 * Reversionary annuity: PV of $1/month payable to the spouse
 * ONLY AFTER the affiliate dies (not while both are alive).
 *
 * Uses constant force of mortality model calibrated to the pre-computed
 * CRU table (which are computed at 3% annual real rate per tablas.json).
 *
 * @param {number} cruAfiliado - CRU of the affiliate (from getCRU or getCRUExtrapolado)
 * @param {number} cruConyuge  - CRU of the spouse
 * @returns {number} reversionary annuity in months (≥ 0)
 * @deprecated Use getCNUConyuge() for more accurate results matching SCOMP.
 */
export function getCRUReversional(cruAfiliado, cruConyuge) {
  const delta = Math.log(1.03) / 12;
  const muX = Math.max(0, 1 / cruAfiliado - delta);
  const muY = Math.max(0, 1 / cruConyuge - delta);
  const aJoint = 1 / (muX + muY + delta);
  return Math.max(0, cruConyuge - aJoint);
}

/**
 * Numerical reversionary annuity ä_{y|x}: PV of $1/month paid to the spouse
 * ONLY after the affiliate has died.
 *
 * Methodology (matching SP Chile SCOMP within ~0.6%):
 *   1. Affiliate survival: B-2020 table
 *   2. Cónyuge survival:   RV-2020 table (more conservative, as used in official CRU publications)
 *   3. Discount rate:      3% annual (consistent with pre-computed CRU table in tablas.json)
 *
 * Formula:
 *   ä_xy   = Σ v^k × k_p_x × k_p_y        (joint life annuity)
 *   ä_y|x  = ä_y_rv − ä_xy                 (reversionary = spouse survives AND affiliate dead)
 *
 * @param {string} sexoAf  - affiliate sex ('M'|'F')
 * @param {number} edadAf  - affiliate age (integer)
 * @param {string} sexoCon - cónyuge sex ('M'|'F')
 * @param {number} edadCon - cónyuge age (integer)
 * @returns {number} reversionary annuity in months (≥ 0)
 */
export function getCNUConyuge(sexoAf, edadAf, sexoCon, edadCon) {
  if (!_tablas) return 0;
  const TASA = 0.03 / 12; // consistent with pre-computed CRU table

  const tablaAf  = sexoAf  === 'M' ? _tablas.b2020_hombre : _tablas.b2020_mujer;
  const tablaCon = sexoCon === 'F' ? _tablas.rv2020_mujer  : _tablas.rv2020_hombre;

  const edafBase = Math.floor(edadAf);
  const edConBase = Math.floor(edadCon);
  const edadMax   = Math.max(edafBase, edConBase);

  // Joint life annuity ä_xy
  let joint = 0, pxAf = 1, pxCon = 1;
  for (let k = 1; k <= (110 - edadMax) * 12; k++) {
    const xAf  = Math.min(edafBase  + Math.floor((k - 1) / 12), 110);
    const xCon = Math.min(edConBase + Math.floor((k - 1) / 12), 110);
    const rowAf  = tablaAf[xAf];
    const rowCon = tablaCon[xCon];
    if (!rowAf || !rowCon || rowAf.qx >= 1 || rowCon.qx >= 1) break;
    pxAf  *= Math.pow(1 - rowAf.qx,  1 / 12);  // monthly survival = (1-q)^(1/12)
    pxCon *= Math.pow(1 - rowCon.qx, 1 / 12);
    if (pxAf < 1e-10 || pxCon < 1e-10) break;
    joint += pxAf * pxCon * Math.pow(1 + TASA, -k);
  }

  // Individual CRU of cónyuge (from RV2020 at 3%)
  let cruCon = 0, pxC = 1;
  for (let k = 1; k <= (110 - edConBase) * 12; k++) {
    const xCon = Math.min(edConBase + Math.floor((k - 1) / 12), 110);
    const rowCon = tablaCon[xCon];
    if (!rowCon || rowCon.qx >= 1) break;
    pxC *= Math.pow(1 - rowCon.qx, 1 / 12);
    if (pxC < 1e-10) break;
    cruCon += pxC * Math.pow(1 + TASA, -k);
  }

  return Math.max(0, cruCon - joint);
}

/**
 * Obtiene el factor AAx para una edad y año específicos desde la tabla bidimensional.
 * Para años > anioMax (2036) usa el valor de 2036 (constante por NCG N°306).
 * @param {object} aaxBidim - { "2021": { "0": 0.xxx, ... }, "2022": {...}, ... }
 * @param {number} edad
 * @param {number} anio
 * @returns {number} factor AAx
 */
function getAAxParaAnio(aaxBidim, edad, anio) {
  const anioMax = 2036;
  const anioKey = String(Math.min(anio, anioMax));
  const tabla   = aaxBidim[anioKey];
  if (!tabla) return 0;
  const edadFloor = Math.floor(Math.min(edad, 110));
  // Interpolación lineal entre edades enteras
  const v0 = tabla[String(edadFloor)]     ?? 0;
  const v1 = tabla[String(edadFloor + 1)] ?? v0;
  const frac = edad - edadFloor;
  return v0 + frac * (v1 - v0);
}

/**
 * Calcula el promedio aritmético de los factores AAx para una edad en un rango de años.
 * Útil para mostrar al usuario el "AAx efectivo" del período.
 * @param {string} sexo - 'M' | 'F'
 * @param {number} edad
 * @param {number} anioDesde - primer año del período (exclusivo, ej. 2020)
 * @param {number} anioHasta - último año del período (inclusivo, ej. 2026)
 * @returns {number} promedio de AAx para el período
 */
export function getAAxPromedio(sexo, edad, anioDesde, anioHasta) {
  if (!_tablas?.aax) return 0;
  const aaxBidim = sexo === 'M' ? _tablas.aax.b2020_hombre : _tablas.aax.b2020_mujer;
  if (!aaxBidim) return 0;
  let suma = 0, count = 0;
  for (let y = anioDesde + 1; y <= anioHasta; y++) {
    suma += getAAxParaAnio(aaxBidim, edad, y);
    count++;
  }
  return count > 0 ? suma / count : 0;
}

/**
 * CNU con mejoramiento según NCG N°306 (SP Chile, feb-2023).
 *
 * Metodología:
 *   1. Aplica q'_x = q_x,2020 × Π_{y=tm+1}^{anioJub}(1 − AA_{x,y})  (NCG N°306)
 *   2. Calcula la anualidad desde qx base y desde qx mejorados
 *   3. Aplica el factor relativo (mejorado/base) al CRU pre-computado oficial
 *
 * Por qué el factor relativo y no la anualidad directa:
 *   Los qx brutos calculados con aproximación mensual difieren del CRU oficial
 *   pre-computado (SP Chile usa UDD + edades exactas). El factor relativo preserva
 *   el CRU oficial como base y le aplica solo el efecto proporcional del mejoramiento.
 *
 * Para años > 2036: factor AA constante en valor 2036 (por NCG N°306).
 *
 * @param {string} sexo - 'M' | 'F'
 * @param {number} edad - edad al momento de jubilación
 * @param {number} tasaMensual - tasa técnica mensual (ej. TASA_RP = 0.0331/12)
 * @param {number} anioJubilacion - año en que jubila el afiliado (ej. 2026)
 * @returns {number} CRU en meses ajustado por mejoramiento NCG N°306
 */
export function calcularCNUConMejoramiento(sexo, edad, tasaMensual, anioJubilacion) {
  const cruBase = getCRU(sexo, edad);   // CRU oficial pre-computado 2020
  if (!_tablas?.aax || !anioJubilacion) return cruBase;

  const tm = _tablas.aax.anioTabla ?? 2020;
  if (anioJubilacion <= tm) return cruBase;

  const tablaQx  = sexo === 'M' ? _tablas.b2020_hombre : _tablas.b2020_mujer;
  const aaxBidim = sexo === 'M' ? _tablas.aax.b2020_hombre : _tablas.aax.b2020_mujer;
  if (!tablaQx || !aaxBidim) return cruBase;

  const edadBase = Math.floor(edad);

  // Pre-computar Π_{y=tm+1}^{anioJub}(1 − AA_{x,y}) para cada edad
  const factorMejora = new Array(111);
  for (let x = edadBase; x <= 110; x++) {
    let f = 1;
    for (let y = tm + 1; y <= anioJubilacion; y++) {
      f *= (1 - getAAxParaAnio(aaxBidim, x, y));
    }
    factorMejora[x] = f;
  }

  // Calcula anualidad usando qx con o sin mejoramiento
  function anualidad(conMejora) {
    let sum = 0, px = 1;
    for (let k = 1; k <= (110 - edadBase) * 12; k++) {
      const x   = Math.min(edadBase + Math.floor((k - 1) / 12), 110);
      const row = tablaQx[x];
      if (!row || row.qx >= 1) break;
      const qx       = conMejora ? row.qx * (factorMejora[x] ?? 1) : row.qx;
      const qMensual = 1 - Math.pow(1 - qx, 1 / 12);
      px *= (1 - qMensual);
      if (px < 1e-10) break;
      sum += px * Math.pow(1 + tasaMensual, -k);
    }
    return sum;
  }

  const cruQxBase   = anualidad(false);
  const cruQxMejora = anualidad(true);

  if (cruQxBase <= 0) return cruBase;

  // Factor relativo: aplica la mejora proporcional sobre el CRU oficial pre-computado
  return cruBase * (cruQxMejora / cruQxBase);
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
