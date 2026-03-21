/**
 * comisiones.js — AFP commission lookups
 * Loads afp.json once and exposes commission-related helpers.
 */

let _afpData = null;

export async function cargarAFP() {
  if (_afpData) return _afpData;
  const base = location.pathname.includes('/pages/') ? '../' : './';
  const res  = await fetch(`${base}data/afp.json`);
  _afpData = await res.json();
  return _afpData;
}

/**
 * Returns the annual commission rate (%) for a given AFP id.
 * @param {string} afpId - normalized AFP id, e.g. 'habitat'
 * @returns {number} commission as percentage of taxable salary (e.g. 0.95)
 */
export function getComision(afpId) {
  if (!_afpData) return 0;
  const afp = _afpData.afps.find(a => a.id === afpId);
  return afp ? afp.comision : 0;
}

/**
 * Monthly commission deducted from salary for AFP admin fee.
 * Formula: salario * (comisionAnual / 100) / 12
 * @param {number} salario - gross monthly taxable salary
 * @param {string} afpId
 * @returns {number} monthly CLP amount
 */
export function calcularDescuentoMensual(salario, afpId) {
  return salario * (getComision(afpId) / 100) / 12;
}

/**
 * Monthly SIS (Seguro de Invalidez y Sobrevivencia) amount.
 * Rate is 1.54% paid by employer (shown for transparency).
 * @param {number} salario
 * @returns {number}
 */
export function calcularSIS(salario) {
  return salario * 0.0154;
}

/**
 * Returns list of all AFP objects sorted by commission ascending.
 * @returns {Array<{id, nombre, comision}>}
 */
export function getAfpsPorComision() {
  if (!_afpData) return [];
  return [..._afpData.afps].sort((a, b) => a.comision - b.comision);
}

/**
 * Returns list of all AFP objects.
 */
export function getAfps() {
  return _afpData ? _afpData.afps : [];
}

/**
 * Returns list of fondos.
 */
export function getFondos() {
  return _afpData ? _afpData.fondos : [];
}
