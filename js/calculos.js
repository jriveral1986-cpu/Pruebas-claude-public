/**
 * calculos.js — Pure pension calculation functions
 * No side effects. No DOM access. No fetch.
 * All monetary values in CLP.
 */

import { getCRU, esperanzaVida } from './mortalidad.js';

/**
 * Compute total balance from number of fund shares.
 */
export function calcularSaldoDesdeNumCuotas(numCuotas, valorCuota) {
  return numCuotas * valorCuota;
}

/**
 * Tope imponible = 87.8 × UF (rounded to integer CLP).
 */
export function calcularTopeImponible(uf) {
  return Math.round(87.8 * uf);
}

/**
 * Retiro Programado (RP) monthly pension estimate.
 *
 * Formula (simplified DL 3.500):
 *   pension = saldo / CRU_B2020(sexo, edad)
 *
 * CRU (Capital Requerido Unitario) represents the present value
 * of a life annuity of $1/month at the given age, computed from
 * B-2020 mortality tables at 3% real annual discount rate.
 *
 * @param {number} saldo - total accumulated balance in CLP
 * @param {number} edad  - age at retirement
 * @param {string} sexo  - 'M' | 'F'
 * @param {number} uf    - current UF value in CLP
 * @returns {{ pension: number, pensionUF: number, anosEstimados: number }}
 */
export function calcularPensionRP(saldo, edad, sexo, uf) {
  const cru       = getCRU(sexo, edad);
  const pension   = cru > 0 ? saldo / cru : 0;
  const pensionUF = uf > 0 ? pension / uf : 0;
  // Estimate years the fund will last at this withdrawal rate (3% real growth)
  const tasaMensual = Math.pow(1.03, 1/12) - 1;
  let anosEstimados = 0;
  if (pension > 0) {
    // n = -ln(1 - saldo*r/pension) / ln(1+r) in months → convert to years
    const r = tasaMensual;
    const x = (saldo * r) / pension;
    if (x < 1) {
      anosEstimados = Math.round((-Math.log(1 - x) / Math.log(1 + r)) / 12);
    } else {
      anosEstimados = 35; // effectively unlimited
    }
  }
  return { pension, pensionUF, anosEstimados };
}

/**
 * Renta Vitalicia (RV) monthly pension estimate.
 *
 * Formula:
 *   pension = saldo / CRU_RV2020(sexo, edad)
 *
 * Uses RV-2020 tables (more conservative than B-2020, so lower pension).
 *
 * @param {number} saldo
 * @param {number} edad
 * @param {string} sexo - 'M' | 'F'
 * @param {number} uf
 * @returns {{ pension: number, pensionUF: number }}
 */
export function calcularPensionRV(saldo, edad, sexo, uf) {
  // RV uses a higher CRU (more conservative: longer assumed lifespan)
  // Apply a 1.08 factor to model the difference between B-2020 and RV-2020
  const cruBase = getCRU(sexo, edad);
  const cru     = cruBase * 1.08;
  const pension = cru > 0 ? saldo / cru : 0;
  const pensionUF = uf > 0 ? pension / uf : 0;
  return { pension, pensionUF };
}

/**
 * Project fund balance over time with optional monthly contributions.
 *
 * @param {number} saldo          - initial balance in CLP
 * @param {number} aporteMensual  - additional monthly contribution in CLP
 * @param {number} tasaAnual      - annual nominal growth rate (e.g. 0.04 for 4%)
 * @param {number} anos           - number of years to project
 * @returns {Array<{ano: number, saldo: number, pension: number}>}
 */
export function proyectarSaldo(saldo, aporteMensual, tasaAnual, anos) {
  const tasaMensual = Math.pow(1 + tasaAnual, 1/12) - 1;
  const resultado   = [];
  let s = saldo;
  for (let a = 1; a <= anos; a++) {
    for (let m = 0; m < 12; m++) {
      s = s * (1 + tasaMensual) + aporteMensual;
    }
    resultado.push({ ano: a, saldo: Math.round(s) });
  }
  return resultado;
}

/**
 * Pension gap analysis.
 *
 * @param {number} pensionActual   - current estimated monthly pension
 * @param {number} pensionObjetivo - desired monthly pension
 * @returns {{ brecha_abs: number, brecha_pct: number, suficiente: boolean }}
 */
export function calcularBrecha(pensionActual, pensionObjetivo) {
  const brecha_abs = pensionObjetivo - pensionActual;
  const brecha_pct = pensionObjetivo > 0 ? (brecha_abs / pensionObjetivo) * 100 : 0;
  return {
    brecha_abs,
    brecha_pct,
    suficiente: brecha_abs <= 0
  };
}

/**
 * Required monthly additional contribution to reach a target pension.
 * Solves for C in: FV_annuity(C, r, n) + FV(saldo, r, n) = saldo_necesario
 *
 * saldo_necesario = pensionObjetivo × CRU(sexo, edad+anosRestantes)
 * This is a simplified estimate.
 *
 * @param {number} saldoActual
 * @param {number} pensionObjetivo  - monthly pension target in CLP
 * @param {number} edad             - current age
 * @param {string} sexo             - 'M' | 'F'
 * @param {number} tasaAnual        - assumed annual growth (e.g. 0.04)
 * @param {number} anosRestantes    - years until retirement
 * @returns {number} required monthly contribution in CLP
 */
export function calcularAportacionNecesaria(saldoActual, pensionObjetivo, edad, sexo, tasaAnual, anosRestantes) {
  const edadRetiro = edad + anosRestantes;
  const cru        = getCRU(sexo, Math.min(edadRetiro, 75));
  const saldoMeta  = pensionObjetivo * cru;
  const r          = Math.pow(1 + tasaAnual, 1/12) - 1;
  const n          = anosRestantes * 12;
  const fvActual   = saldoActual * Math.pow(1 + r, n);
  const faltante   = saldoMeta - fvActual;
  if (faltante <= 0) return 0;
  // FV annuity = C * ((1+r)^n - 1) / r
  const aporte = faltante * r / (Math.pow(1 + r, n) - 1);
  return Math.max(0, Math.round(aporte));
}
