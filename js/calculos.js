/**
 * calculos.js — Pure pension calculation functions
 * No side effects. No DOM access. No fetch.
 * All monetary values in CLP.
 */

import { getCRU, esperanzaVida } from './mortalidad.js';

// ============================================================
// CONSTANTES VIGENTES — SP Chile, marzo 2026
// ============================================================

/** Tasa técnica RP: Circular SP N°2407, enero 2026 */
export const TASA_RP = 0.0331 / 12;

/** Tope imponible = 87.8 × UF */
export function calcularTopeImponible(uf) {
  return Math.round(87.8 * uf);
}

/** PGU — Pensión Garantizada Universal (Ley 21.419 + Reforma 21.735, feb 2026) */
export const PGU = {
  montoBase:       231732,   // < 82 años
  montoMax82:      250275,   // ≥ 82 años
  umbralCompleto:  789139,   // pensión base ≤ → PGU completa
  umbralTope:      1252602,  // pensión base ≥ → sin PGU
};

/** UTM marzo 2026 — SII Chile */
export const UTM = 69889;

/** Tabla impuesto 2ª categoría 2026 (SII) — tramos en UTM */
const TRAMOS_IMP = [
  { hasta: 13.5,     tasa: 0,     rebaja: 0       },
  { hasta: 30,       tasa: 0.04,  rebaja: 0        },
  { hasta: 50,       tasa: 0.08,  rebaja: 2772     },
  { hasta: 70,       tasa: 0.135, rebaja: 5126     },
  { hasta: 90,       tasa: 0.23,  rebaja: 11771    },
  { hasta: 120,      tasa: 0.304, rebaja: 18427    },
  { hasta: 150,      tasa: 0.355, rebaja: 24537    },
  { hasta: Infinity, tasa: 0.40,  rebaja: 31287    },
];

// ============================================================
// DESCUENTOS LEGALES
// ============================================================

/**
 * Impuesto mensual 2ª categoría sobre pensión bruta.
 * @param {number} pensionBruta - en pesos
 * @returns {number} impuesto mensual en pesos
 */
export function calcularImpuesto(pensionBruta) {
  const enUTM = pensionBruta / UTM;
  for (const t of TRAMOS_IMP) {
    if (enUTM <= t.hasta) {
      const imp = pensionBruta * t.tasa - (t.rebaja * UTM / 12);
      return Math.max(0, Math.round(imp));
    }
  }
  return 0;
}

/**
 * Pensión líquida después de todos los descuentos legales.
 * @param {number} pensionBruta
 * @param {number} comisionAfp  - tasa decimal (ej: 0.0127). 0 para RV.
 * @returns {{ bruta, descComision, descSalud, descImpuesto, totalDescuentos, liquida, pctDescuento }}
 */
export function calcularPensionLiquida(pensionBruta, comisionAfp = 0) {
  const descComision  = Math.round(pensionBruta * comisionAfp);
  const baseImp       = pensionBruta - descComision;
  const descSalud     = Math.round(baseImp * 0.07);   // 7% salud obligatoria
  const descImpuesto  = calcularImpuesto(baseImp);
  const totalDesc     = descComision + descSalud + descImpuesto;
  const liquida       = pensionBruta - totalDesc;
  return {
    bruta: pensionBruta,
    descComision,
    descSalud,
    descImpuesto,
    totalDescuentos: totalDesc,
    liquida,
    pctDescuento: totalDesc / pensionBruta * 100,
  };
}

/**
 * Pensión Garantizada Universal (PGU) según pensión base.
 * @param {number} pensionBase  - pensión bruta (antes de PGU)
 * @param {number} edad
 * @returns {number} monto PGU mensual
 */
export function calcularPGU(pensionBase, edad = 65) {
  const montoMax = edad >= 82 ? PGU.montoMax82 : PGU.montoBase;
  if (pensionBase <= PGU.umbralCompleto) return montoMax;
  if (pensionBase >= PGU.umbralTope)    return 0;
  const proporcion = (PGU.umbralTope - pensionBase) / (PGU.umbralTope - PGU.umbralCompleto);
  return Math.round(montoMax * proporcion);
}

// ============================================================
// PENSIÓN DE SOBREVIVENCIA — DL 3.500 art. 58
// ============================================================

/**
 * Calcula la pensión de sobrevivencia que generaría el afiliado al fallecer.
 *
 * Beneficiarios y porcentajes (DL 3.500 art. 58):
 *  - Cónyuge / conviviente civil: 60% de la pensión de referencia
 *  - Cada hijo < 18 años (o < 24 si estudia): 15%
 *  - Cada hijo con invalidez permanente (sin límite edad): 15% de por vida
 *  - Tope: 100% de la pensión de referencia. Si se supera → prorrateo.
 *
 * @param {number} pensionRef   - pensión de referencia (RP o RV bruta)
 * @param {{ tienePareja: boolean, numHijos: number, numHijosInvalidos: number }} familia
 * @returns {object} detalle de la pensión de sobrevivencia
 */
export function calcularPensionSobrevivencia(pensionRef, familia) {
  const { tienePareja = false, numHijos = 0, numHijosInvalidos = 0 } = familia;

  const PCT_CONYUGE = 0.60;
  const PCT_HIJO    = 0.15;

  const totalBeneficiarios = (tienePareja ? 1 : 0) + numHijos + numHijosInvalidos;

  if (!pensionRef || totalBeneficiarios === 0) {
    return {
      pensionRef, tienePareja, numHijos, numHijosInvalidos,
      montoConyuge: 0, montoHijo: 0, montoHijoInvalido: 0,
      totalSobrevivencia: 0, pctTotal: 0,
      huboProrrataeo: false, factorProrrateo: 1,
      tieneBeneficiarios: false,
    };
  }

  const pctConyuge = tienePareja ? PCT_CONYUGE : 0;
  let pctTotal = pctConyuge + (numHijos + numHijosInvalidos) * PCT_HIJO;

  // Tope 100%
  let factorProrrateo = 1;
  if (pctTotal > 1.0) {
    factorProrrateo = 1.0 / pctTotal;
    pctTotal = 1.0;
  }

  const montoConyuge      = tienePareja ? Math.round(pensionRef * PCT_CONYUGE * factorProrrateo) : 0;
  const montoHijo         = numHijos > 0 ? Math.round(pensionRef * PCT_HIJO * factorProrrateo) : 0;
  const montoHijoInvalido = numHijosInvalidos > 0 ? Math.round(pensionRef * PCT_HIJO * factorProrrateo) : 0;
  const totalSobrevivencia = Math.round(pensionRef * pctTotal);

  return {
    pensionRef,
    tienePareja,
    numHijos,
    numHijosInvalidos,
    montoConyuge,
    montoHijo,
    montoHijoInvalido,
    totalSobrevivencia,
    pctTotal: pctTotal * 100,
    huboProrrataeo: factorProrrateo < 1,
    factorProrrateo,
    tieneBeneficiarios: true,
  };
}

/**
 * Recomienda modalidad según situación familiar (DL 3.500).
 * @returns {'rv'|'rp'|'mixta'} recomendación
 */
export function recomendarModalidadFamiliar(familia) {
  const { tienePareja, numHijos, numHijosInvalidos } = familia;
  if (numHijosInvalidos > 0) return 'rv';
  if (tienePareja && numHijos > 0) return 'rv';
  if (!tienePareja && numHijos === 0 && numHijosInvalidos === 0) return 'rp';
  if (tienePareja) return 'mixta';
  return 'mixta';
}

// ============================================================
// CÁLCULO SALDO
// ============================================================

export function calcularSaldoDesdeNumCuotas(numCuotas, valorCuota) {
  return numCuotas * valorCuota;
}

// ============================================================
// PENSIÓN RP (Retiro Programado)
// ============================================================

/**
 * Retiro Programado — tasa técnica 3,31% (Circular SP N°2407, ene 2026).
 * @param {number} saldo
 * @param {number} edad
 * @param {string} sexo  'M' | 'F'
 * @param {number} uf
 * @param {number} comisionAfpDecimal - tasa comisión AFP en decimal (ej 0.0127)
 * @returns {{ pension, pensionUF, pensionLiquida, desglose, pgu, pensionTotal, anosEstimados }}
 */
export function calcularPensionRP(saldo, edad, sexo, uf, comisionAfpDecimal = 0) {
  const cru       = getCRU(sexo, edad);
  const tasaMens  = TASA_RP;
  // Formula anualidad: saldo × r / (1 - (1+r)^-n)  con n = meses de expectativa
  const mesesEspe = Math.max(12, (esperanzaVida(null, edad) - edad) * 12);
  const pension   = cru > 0
    ? saldo / cru
    : (tasaMens > 0 ? saldo * tasaMens / (1 - Math.pow(1 + tasaMens, -mesesEspe)) : 0);

  const pensionUF = uf > 0 ? pension / uf : 0;

  // Descuentos legales
  const desglose = calcularPensionLiquida(pension, comisionAfpDecimal);
  const pgu      = calcularPGU(desglose.liquida, edad);
  const pensionTotal = desglose.liquida + pgu;

  // Años estimados del fondo
  const r = Math.pow(1.0331, 1/12) - 1;
  let anosEstimados = 0;
  if (pension > 0) {
    const x = (saldo * r) / pension;
    if (x < 1) {
      anosEstimados = Math.round((-Math.log(1 - x) / Math.log(1 + r)) / 12);
    } else {
      anosEstimados = 35;
    }
  }

  return { pension, pensionUF, pensionLiquida: desglose.liquida, desglose, pgu, pensionTotal, anosEstimados };
}

// ============================================================
// PENSIÓN RV (Renta Vitalicia)
// ============================================================

/**
 * Renta Vitalicia — sin comisión AFP, RV usa tablas más longevas (factor 1.08×).
 * @param {number} saldo
 * @param {number} edad
 * @param {string} sexo
 * @param {number} uf
 * @returns {{ pension, pensionUF, pensionLiquida, desglose, pgu, pensionTotal }}
 */
export function calcularPensionRV(saldo, edad, sexo, uf) {
  const cruBase = getCRU(sexo, edad);
  const cru     = cruBase * 1.08;
  const pension = cru > 0 ? saldo / cru : 0;
  const pensionUF = uf > 0 ? pension / uf : 0;

  // RV: sin comisión AFP
  const desglose = calcularPensionLiquida(pension, 0);
  const pgu      = calcularPGU(desglose.liquida, edad);
  const pensionTotal = desglose.liquida + pgu;

  return { pension, pensionUF, pensionLiquida: desglose.liquida, desglose, pgu, pensionTotal };
}

// ============================================================
// PROYECCIÓN DE SALDO
// ============================================================

/**
 * Proyecta saldo con aportes mensuales opcionales.
 * @param {number} saldo
 * @param {number} aporteMensual
 * @param {number} tasaAnual
 * @param {number} anos
 * @returns {Array<{ano, saldo}>}
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

// ============================================================
// ANÁLISIS DE BRECHA
// ============================================================

export function calcularBrecha(pensionActual, pensionObjetivo) {
  const brecha_abs = pensionObjetivo - pensionActual;
  const brecha_pct = pensionObjetivo > 0 ? (brecha_abs / pensionObjetivo) * 100 : 0;
  return { brecha_abs, brecha_pct, suficiente: brecha_abs <= 0 };
}

/**
 * Aporte mensual necesario para cerrar brecha.
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
  const aporte = faltante * r / (Math.pow(1 + r, n) - 1);
  return Math.max(0, Math.round(aporte));
}

// ============================================================
// SCORE PREVISIONAL (0–100)
// ============================================================

/**
 * Puntaje previsional basado en múltiples factores.
 * @param {{ pensionRP, rentaImponible, apvMensual, saldoAPV, lagunas, edad, saldoActual }} datos
 */
export function calcularScore({ pensionRP, rentaImponible, apvMensual = 0, saldoAPV = 0, lagunas = 0, edad = 40, saldoActual = 0 }) {
  let score = 0;
  const renta = rentaImponible || 800000;

  // Tasa de reemplazo (40 pts)
  const tr = pensionRP / renta * 100;
  score += Math.min(40, (tr / 70) * 40);

  // APV (20 pts)
  if (apvMensual > 0) score += 20;
  else if (saldoAPV > 0) score += 10;

  // Sin lagunas (20 pts)
  score += (1 - Math.min(1, lagunas)) * 20;

  // Saldo relativo a la edad (20 pts)
  const saldoIdeal = renta * 12 * Math.max(1, edad - 22) * 0.5;
  score += Math.min(20, (saldoActual / Math.max(1, saldoIdeal)) * 20);

  return Math.round(Math.min(100, score));
}
