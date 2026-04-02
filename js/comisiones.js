/**
 * comisiones.js — AFP commission lookups
 * Loads afp.json once and exposes commission-related helpers.
 */

let _afpData = null;

export async function cargarAFP() {
  if (_afpData) return _afpData;
  const base = location.pathname.includes('/pages/') ? '../' : './';
  const res  = await fetch(`${base}data/afp.json`, { cache: 'no-store' });
  _afpData = await res.json();
  return _afpData;
}

/**
 * Returns the monthly commission rate (%) for a given AFP id.
 * Applied over remuneración/renta imponible (cotizantes activos).
 * @param {string} afpId - normalized AFP id, e.g. 'habitat'
 * @returns {number} monthly commission as percentage (e.g. 1.44)
 */
export function getComision(afpId) {
  if (!_afpData) return 0;
  const afp = _afpData.afps.find(a => a.id === afpId);
  return afp ? afp.comision : 0;
}

/**
 * Returns the commission rate (%) applied to the monthly pension for
 * pensioners under Retiro Programado or Renta Temporal modalities.
 * Source: Circular N°2402, SP Chile, vigente desde 01-oct-2025.
 *
 * Fallback chain (never returns undefined):
 *   1. afp.comisionPensionado if present in afp.json
 *   2. afp.comision (active-worker rate) as conservative proxy
 *   3. 1.25 (market maximum) if AFP not found
 *
 * @param {string} afpId - normalized AFP id, e.g. 'planvital'
 * @returns {number} commission as percentage (e.g. 1.25); 0.00 for PlanVital
 */
export function getComisionPensionado(afpId) {
  if (!_afpData) return 1.25;
  const afp = _afpData.afps.find(a => a.id === afpId);
  if (!afp) return 1.25;
  return afp.comisionPensionado ?? afp.comision;
}

/**
 * Monthly commission deducted from salary for AFP admin fee.
 * Formula: salario * (comisionMensual / 100)
 * The commission rate is already monthly (not annual).
 * @param {number} salario - gross monthly taxable salary (imponible)
 * @param {string} afpId
 * @returns {number} monthly CLP amount
 */
export function calcularDescuentoMensual(salario, afpId) {
  return salario * (getComision(afpId) / 100);
}

/**
 * Monthly SIS (Seguro de Invalidez y Sobrevivencia) amount.
 * Rate is 1.88% paid by employer, vigente desde julio 2025.
 * @param {number} salario
 * @returns {number}
 */
export function calcularSIS(salario) {
  return salario * 0.0188;
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
