/**
 * calculos.js — Pure pension calculation functions
 * No side effects. No DOM access. No fetch.
 * All monetary values in CLP.
 */

import { getCRU, getCRUExtrapolado, getCRUReversional, calcularCNUConMejoramiento, getCRURentaVitalicia, esperanzaVida } from './mortalidad.js';

// ============================================================
// CONSTANTES VIGENTES — SP Chile, marzo 2026
// ============================================================

/** Tasa técnica RP (TITRP): Circular SP N°2407, enero 2026 — se recalcula trimestralmente */
export const TASA_RP = 0.0331 / 12;

/** Tasa de mercado RV — vejez, promedio feb 2026 (SP Chile, spensiones.cl/apps/tasas/tasasRentasVitalicias.php) */
export const TASA_RV = 0.0276 / 12;

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
  const {
    tienePareja         = false,
    numHijosMenores     = 0,
    numHijosEstudiantes = 0,
    numHijosInvalidos   = 0,
    // backwards compat: si llega numHijos (campo antiguo), lo sumamos a menores
    numHijos            = 0,
  } = familia;

  const totalHijosTemporales = numHijosMenores + numHijosEstudiantes + numHijos;
  const totalHijosComunes    = totalHijosTemporales + numHijosInvalidos;
  const totalBeneficiarios   = (tienePareja ? 1 : 0) + totalHijosComunes;

  if (!pensionRef || totalBeneficiarios === 0) {
    return {
      pensionRef, tienePareja,
      numHijosMenores, numHijosEstudiantes, numHijosInvalidos,
      montoConyuge: 0, montoHijoTemporal: 0, montoHijoInvalido: 0,
      totalSobrevivencia: 0, pctTotal: 0,
      huboProrrataeo: false, factorProrrateo: 1,
      tieneBeneficiarios: false,
      pctConyuge: 0,
    };
  }

  // Cónyuge con hijos comunes → 50%; sin hijos comunes → 60% (DL 3.500 art. 58)
  const pctConyuge = tienePareja
    ? (totalHijosComunes > 0 ? 0.50 : 0.60)
    : 0;

  const pctHijoTemp = 0.15;
  const pctHijoInv  = 0.15; // inválido total; parcial sería 0.11 (no se distingue aquí)

  let pctTotal = pctConyuge
    + totalHijosTemporales * pctHijoTemp
    + numHijosInvalidos    * pctHijoInv;

  // Tope 100%
  let factorProrrateo = 1;
  if (pctTotal > 1.0) {
    factorProrrateo = 1.0 / pctTotal;
    pctTotal = 1.0;
  }

  const montoConyuge       = tienePareja          ? Math.round(pensionRef * pctConyuge    * factorProrrateo) : 0;
  const montoHijoTemporal  = totalHijosTemporales > 0 ? Math.round(pensionRef * pctHijoTemp * factorProrrateo) : 0;
  const montoHijoInvalido  = numHijosInvalidos    > 0 ? Math.round(pensionRef * pctHijoInv  * factorProrrateo) : 0;
  const totalSobrevivencia = Math.round(pensionRef * pctTotal);

  return {
    pensionRef,
    tienePareja,
    numHijosMenores,
    numHijosEstudiantes,
    numHijosInvalidos,
    totalHijosTemporales,
    pctConyuge,
    montoConyuge,
    montoHijoTemporal,
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
  const {
    tienePareja = false,
    numHijosMenores = 0, numHijosEstudiantes = 0,
    numHijosInvalidos = 0, numHijos = 0,
  } = familia;
  const totalHijos = numHijosMenores + numHijosEstudiantes + numHijosInvalidos + numHijos;
  if (numHijosInvalidos > 0) return 'rv';
  if (tienePareja && totalHijos > 0) return 'rv';
  if (!tienePareja && totalHijos === 0) return 'rp';
  if (tienePareja) return 'mixta';
  return 'mixta';
}

// ============================================================
// CNU — CAPITAL NECESARIO UNITARIO (grupo familiar)
// ============================================================

/**
 * Anualidad limitada: valor presente de $1/mes durante n meses a tasa TASA_RP.
 * Usada para calcular el CNU de hijos con derecho temporal.
 */
function calcularAnualidadLimitada(meses) {
  if (TASA_RP === 0 || meses <= 0) return meses;
  return (1 - Math.pow(1 + TASA_RP, -meses)) / TASA_RP;
}

/**
 * CNU total del grupo familiar (afiliado + beneficiarios).
 *
 * La pensión de RP = saldo / CNU_total. A más beneficiarios → CNU mayor → pensión menor.
 *
 * Porcentajes de pensión de sobrevivencia (DL 3.500 art. 58):
 *  - Cónyuge/conviviente sin hijos comunes: 60%
 *  - Cónyuge/conviviente con hijos comunes: 50% (sube a 60% cuando los hijos pierden el derecho)
 *  - Hijo < 18 o estudiante < 24: 15%
 *  - Hijo inválido total (cualquier edad): 15% de por vida
 *
 * @param {number} edad - edad del afiliado
 * @param {string} sexo - 'M' | 'F'
 * @param {object} familia
 * @param {boolean} familia.tienePareja
 * @param {number}  familia.edadConyuge
 * @param {string}  familia.sexoConyuge - 'M' | 'F'
 * @param {number}  familia.numHijosMenores   - hijos < 18 años
 * @param {number}  familia.numHijosEstudiantes - hijos 18–24 estudiantes
 * @param {number}  familia.numHijosInvalidos  - hijos inválidos (de por vida)
 * @param {number}  factorTabla    - 1.0 para RP (B-2020), 1.08 para RV (aproxima RV-2020)
 * @param {number}  [anioJubilacion] - año de jubilación para ajuste AAx (ej. 2026)
 * @returns {{ cnuTotal, cnuAfiliado, cnuConyuge, cnuHijos, factorFamilia, tieneImpacto,
 *             cnuSinMejora, pctAumentoMejora, anioJubilacion }}
 */
export function calcularCNUFamiliar(edad, sexo, familia, factorTabla = 1.0, anioJubilacion = null) {
  const {
    tienePareja         = false,
    edadConyuge         = 40,
    sexoConyuge         = 'F',
    numHijosMenores     = 0,
    numHijosEstudiantes = 0,
    numHijosInvalidos   = 0,
  } = familia || {};

  // CNU sin mejoramiento (tabla 2020 pre-computada)
  const cnuSinMejora = getCRU(sexo, edad);

  // CNU con mejoramiento si se provee año de jubilación
  const cnuBase = anioJubilacion
    ? calcularCNUConMejoramiento(sexo, edad, TASA_RP, anioJubilacion)
    : cnuSinMejora;

  const pctAumentoMejora = cnuSinMejora > 0
    ? ((cnuBase - cnuSinMejora) / cnuSinMejora) * 100
    : 0;

  // factorTabla: 1.0 = B-2020 (RP), 1.08 = aproximación RV-2020 (RV)
  const cnuAfiliado = cnuBase * factorTabla;

  const totalHijosComunes = numHijosMenores + numHijosEstudiantes + numHijosInvalidos;
  const pctConyuge = tienePareja ? (totalHijosComunes > 0 ? 0.50 : 0.60) : 0;

  // CNU cónyuge/conviviente — renta reversional (cónyuge cobra SOLO tras fallecimiento afiliado)
  // getCRUReversional usa modelo de fuerza constante calibrado con la tabla CRU pre-calculada.
  // Evita la sobreestimación del CNU que produce la fórmula aditiva (pct × CRU_cónyuge completo).
  let cnuConyuge = 0;
  if (tienePareja) {
    const cruConyuge   = getCRUExtrapolado(sexoConyuge, edadConyuge);  // extrapola para edades jóvenes
    const cruReversional = getCRUReversional(getCRU(sexo, edad), cruConyuge);
    cnuConyuge = pctConyuge * cruReversional * factorTabla;
  }

  // CNU hijos: anualidades limitadas (promedio restante) — también con factorTabla
  const cruMenor      = numHijosMenores     > 0 ? calcularAnualidadLimitada(9  * 12) * factorTabla : 0;
  const cruEstudiante = numHijosEstudiantes > 0 ? calcularAnualidadLimitada(3  * 12) * factorTabla : 0;
  const cruInvalido   = numHijosInvalidos   > 0 ? getCRUExtrapolado('F', 25) * factorTabla : 0;

  const cnuHijos =
    numHijosMenores     * 0.15 * cruMenor      +
    numHijosEstudiantes * 0.15 * cruEstudiante +
    numHijosInvalidos   * 0.15 * cruInvalido;

  const cnuTotal       = cnuAfiliado + cnuConyuge + cnuHijos;
  const tieneImpacto   = cnuTotal > cnuAfiliado;
  const factorFamilia  = cnuAfiliado > 0 ? cnuTotal / cnuAfiliado : 1;

  return {
    cnuTotal, cnuAfiliado, cnuConyuge, cnuHijos, factorFamilia, tieneImpacto,
    cnuSinMejora: cnuSinMejora * factorTabla,
    pctAumentoMejora,
    anioJubilacion,
  };
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
 * @param {object|null} familia         - grupo familiar para cálculo de CNU (opcional)
 * @param {number|null} anioJubilacion  - año de jubilación para ajuste AAx (opcional)
 * @returns {{ pension, pensionUF, pensionLiquida, desglose, pgu, pensionTotal, anosEstimados,
 *             pensionSinFamilia, impactoFamilia, cnuDetalle }}
 */
export function calcularPensionRP(saldo, edad, sexo, uf, comisionAfpDecimal = 0, familia = null, anioJubilacion = null) {
  // CNU total (afiliado solo o con grupo familiar)
  let cnuDetalle = null;
  let cnu;
  if (familia && (familia.tienePareja || familia.numHijosMenores > 0 ||
      familia.numHijosEstudiantes > 0 || familia.numHijosInvalidos > 0)) {
    cnuDetalle = calcularCNUFamiliar(edad, sexo, familia, 1.0, anioJubilacion);
    cnu = cnuDetalle.cnuTotal;
  } else {
    const cnuSinMejora = getCRU(sexo, edad);
    cnu = anioJubilacion
      ? calcularCNUConMejoramiento(sexo, edad, TASA_RP, anioJubilacion)
      : cnuSinMejora;
    cnuDetalle = {
      cnuTotal: cnu, cnuAfiliado: cnu, cnuConyuge: 0, cnuHijos: 0,
      factorFamilia: 1, tieneImpacto: false,
      cnuSinMejora, pctAumentoMejora: cnuSinMejora > 0 ? ((cnu - cnuSinMejora) / cnuSinMejora) * 100 : 0,
      anioJubilacion,
    };
  }

  const tasaMens  = TASA_RP;
  // Bug fix: esperanzaVida necesita nombre de tabla, no null
  const tablaRP   = sexo === 'M' ? 'b2020_hombre' : 'b2020_mujer';
  const mesesEspe = Math.max(12, (esperanzaVida(tablaRP, edad) - edad) * 12);
  const pension   = cnu > 0
    ? saldo / cnu
    : (tasaMens > 0 ? saldo * tasaMens / (1 - Math.pow(1 + tasaMens, -mesesEspe)) : 0);

  // Pensión sin familia (solo CRU del afiliado) para mostrar el impacto
  const cruSolo = getCRU(sexo, edad);
  const pensionSinFamilia = cruSolo > 0 ? saldo / cruSolo : pension;
  const impactoFamilia = pensionSinFamilia - pension; // cuánto menos recibe por tener familia

  const pensionUF = uf > 0 ? pension / uf : 0;

  // Descuentos legales
  const desglose = calcularPensionLiquida(pension, comisionAfpDecimal);
  const pgu      = calcularPGU(desglose.liquida, edad);
  const pensionTotal = desglose.liquida + pgu;

  // Años estimados del fondo
  // Bug fix 1: usar tasa compuesta consistente (no mezclar con TASA_RP simple)
  // Bug fix 2: usar pensionSinFamilia para calcular duración — el fondo dura igual
  //            independiente del CNU familiar; lo que cambia es cuánto recibe c/u.
  const r = Math.pow(1 + TASA_RP * 12, 1/12) - 1; // tasa mensual compuesta equivalente
  let anosEstimados = 0;
  if (pensionSinFamilia > 0) {
    const x = (saldo * r) / pensionSinFamilia;
    if (x < 1) {
      anosEstimados = Math.round((-Math.log(1 - x) / Math.log(1 + r)) / 12);
    } else {
      anosEstimados = 35;
    }
  }

  return {
    pension, pensionUF, pensionLiquida: desglose.liquida, desglose, pgu, pensionTotal,
    anosEstimados, pensionSinFamilia, impactoFamilia, cnuDetalle,
  };
}

// ============================================================
// PENSIÓN RV (Renta Vitalicia)
// ============================================================

/**
 * Renta Vitalicia — sin comisión AFP, RV usa tablas más longevas (factor 1.08×).
 * Con familia, la aseguradora también calcula reserva técnica para cónyuge e hijos.
 * @param {number} saldo
 * @param {number} edad
 * @param {string} sexo
 * @param {number} uf
 * @param {object|null} familia         - grupo familiar (opcional)
 * @param {number|null} anioJubilacion  - año de jubilación para ajuste AAx (opcional)
 * @returns {{ pension, pensionUF, pensionLiquida, desglose, pgu, pensionTotal,
 *             pensionSinFamilia, impactoFamilia, cnuDetalle }}
 */
export function calcularPensionRV(saldo, edad, sexo, uf, familia = null, anioJubilacion = null) {
  // CRU_RV desde tablas RV-2020 + AAx a tasa mercado 2.76% (SP Chile, feb 2026)
  const cruRVSinMejora = getCRURentaVitalicia(sexo, edad, TASA_RV);
  const cruRVConMejora = anioJubilacion
    ? getCRURentaVitalicia(sexo, edad, TASA_RV, anioJubilacion)
    : cruRVSinMejora;

  // Factor relativo RV/RP para escalar CRU de beneficiarios en calcularCNUFamiliar
  const cruRPBase     = getCRU(sexo, edad);
  const factorTablaRV = cruRPBase > 0 ? cruRVConMejora / cruRPBase : 1.08;

  let cnuDetalle = null;
  let cnu;
  if (familia && (familia.tienePareja || familia.numHijosMenores > 0 ||
      familia.numHijosEstudiantes > 0 || familia.numHijosInvalidos > 0)) {
    cnuDetalle = calcularCNUFamiliar(edad, sexo, familia, factorTablaRV, anioJubilacion);
    cnu = cnuDetalle.cnuTotal;
  } else {
    cnu = cruRVConMejora;
    cnuDetalle = {
      cnuTotal: cnu, cnuAfiliado: cnu, cnuConyuge: 0, cnuHijos: 0,
      factorFamilia: 1, tieneImpacto: false,
      cnuSinMejora: cruRVSinMejora,
      pctAumentoMejora: cruRVSinMejora > 0 ? ((cruRVConMejora - cruRVSinMejora) / cruRVSinMejora) * 100 : 0,
      anioJubilacion,
    };
  }

  const pension = cnu > 0 ? saldo / cnu : 0;

  // Pensión sin familia para comparación
  const pensionSinFamilia = cruRVSinMejora > 0
    ? saldo / cruRVSinMejora
    : pension;
  const impactoFamilia = pensionSinFamilia - pension;

  const pensionUF = uf > 0 ? pension / uf : 0;

  // RV: sin comisión AFP
  const desglose = calcularPensionLiquida(pension, 0);
  const pgu      = calcularPGU(desglose.liquida, edad);
  const pensionTotal = desglose.liquida + pgu;

  return {
    pension, pensionUF, pensionLiquida: desglose.liquida, desglose, pgu, pensionTotal,
    pensionSinFamilia, impactoFamilia, cnuDetalle,
  };
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
