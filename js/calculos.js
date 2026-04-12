/**
 * calculos.js — Pure pension calculation functions
 * No side effects. No DOM access. No fetch.
 * All monetary values in CLP.
 */

import { getCRU, getCRUExtrapolado, getCRURentaVitalicia, getCNUConyuge, calcularCNUConMejoramiento, calcularCRU_RP, esperanzaVida } from './mortalidad.js';

// ============================================================
// CONSTANTES VIGENTES — SP Chile, marzo 2026
// ============================================================

/** Tasa técnica RP (TITRP): Circular SP N°2407, enero 2026 — se recalcula trimestralmente */
export const TASA_RP = 0.0331 / 12;

/** Tasa de mercado RV — vejez, promedio feb 2026 (SP Chile, spensiones.cl/apps/tasas/tasasRentasVitalicias.php) */
export const TASA_RV = 0.0276 / 12;

/** Tope imponible mensual 2026 = 90,0 × UF (SP Chile, vigente feb-2026) */
export function calcularTopeImponible(uf) {
  return Math.round(90.0 * uf);
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

/**
 * Tabla impuesto 2ª categoría — marzo 2026 (SII Chile).
 * Tramos en CLP, rebaja en CLP. Fórmula: max(0, renta × factor − rebaja).
 * UTM marzo 2026: $69.889. Fuente: tabla mensual SII vigente mar-2026.
 */
const TRAMOS_IMP = [
  { hasta: 943501,   tasa: 0,     rebaja: 0        },
  { hasta: 2096670,  tasa: 0.04,  rebaja: 37740    },
  { hasta: 3494450,  tasa: 0.08,  rebaja: 121607   },
  { hasta: 4892230,  tasa: 0.135, rebaja: 313802   },
  { hasta: 6290010,  tasa: 0.23,  rebaja: 778563   },
  { hasta: 8386680,  tasa: 0.304, rebaja: 1244024  },
  { hasta: 21665590, tasa: 0.35,  rebaja: 1629811  },
  { hasta: Infinity, tasa: 0.40,  rebaja: 2713091  },
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
  for (const t of TRAMOS_IMP) {
    if (pensionBruta <= t.hasta) {
      return Math.max(0, Math.round(pensionBruta * t.tasa - t.rebaja));
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
 * Pensión Garantizada Universal (PGU) según pensión base y edad.
 * Requisito legal: edad >= 65 (Ley 21.419). Personas que jubilan antes de los 65
 * (ej. mujeres a los 60) no reciben PGU hasta cumplir esa edad.
 * @param {number} pensionBase  - pensión líquida (antes de PGU)
 * @param {number} edad
 * @returns {number} monto PGU mensual (0 si edad < 65)
 */
export function calcularPGU(pensionBase, edad = 65) {
  if (edad < 65) return 0;   // PGU requiere mínimo 65 años — Ley 21.419
  const montoMax = edad >= 82 ? PGU.montoMax82 : PGU.montoBase;
  if (pensionBase <= PGU.umbralCompleto) return montoMax;
  if (pensionBase >= PGU.umbralTope)    return 0;
  const proporcion = (PGU.umbralTope - pensionBase) / (PGU.umbralTope - PGU.umbralCompleto);
  return Math.round(montoMax * proporcion);
}

/**
 * PGU informativa — monto que recibirá cuando cumpla 65 años, independiente de la edad actual.
 * Útil para mostrar en proyecciones de personas que jubilan antes de los 65.
 * @param {number} pensionBase
 * @returns {number} monto PGU a los 65 años
 */
export function calcularPGUInformativa(pensionBase) {
  return calcularPGU(pensionBase, 65);
}

// ============================================================
// BAC — BENEFICIO POR AÑOS COTIZADOS (Ley 21.735, Título XIX)
// ============================================================

/**
 * Beneficio por Años Cotizados (BAC) — Seguro Social Previsional.
 * Tipo: Heurística — simplificación stock 2026, rotulada como estimación.
 * Fórmula: BAC = (mesesCotizados / 12) × 0,1 UF, tope 2,5 UF/mes.
 *
 * Reglas normativas: requisito mínimo mujeres 120 meses, hombres 240 meses (año 2026).
 * Fuente: Compendio SP — Libro III, Título XIX, Letra B.
 *
 * @param {number} mesesCotizados - meses efectivamente cotizados
 * @param {number} uf             - valor UF vigente
 * @param {string} sexo           - 'M' | 'F'
 * @returns {{ monto, montoUF, anosCotizados, elegible, razonNoElegible }}
 */
export function calcularBAC(mesesCotizados, uf, sexo = 'M') {
  const minMeses = sexo === 'F' ? 120 : 240;
  if (!mesesCotizados || mesesCotizados < minMeses) {
    return {
      monto: 0, montoUF: 0, anosCotizados: (mesesCotizados || 0) / 12,
      elegible: false,
      razonNoElegible: `Requiere mínimo ${minMeses} meses cotizados (${sexo === 'F' ? '10' : '20'} años)`,
    };
  }
  const anosCotizados = mesesCotizados / 12;
  const montoUF = Math.min(anosCotizados * 0.1, 2.5);
  return { monto: Math.round(montoUF * uf), montoUF, anosCotizados, elegible: true, razonNoElegible: null };
}

// ============================================================
// CEV — COMPENSACIÓN POR DIFERENCIAS DE EXPECTATIVA DE VIDA (Ley 21.735, Título XIX)
// ============================================================

/**
 * Compensación por Diferencias de Expectativa de Vida (CEV) — Seguro Social Previsional.
 * Solo aplica a mujeres ≥ 65 años (stock simplificado 2026).
 * Tipo: Heurística — porcentajes por tramo de edad simplificados, rotulada como estimación.
 *
 * Fórmula: CEV = PAFE × porcentaje_según_edad
 * - PAFE = pensión autofinanciada (aprox. con pensión RP/RV del motor), máximo 18 UF
 * - Porcentaje: 65–69 → 50%; 70–74 → 75%; ≥75 → 100%
 * - Monto mínimo: 0,25 UF
 * - Mujeres con vejez anticipada (art. 68 DL 3.500) no tienen derecho a CEV.
 *
 * Fuente: Compendio SP — Libro III, Título XIX, Letra C.
 *
 * @param {string} sexo          - 'M' | 'F'
 * @param {number} edad          - edad al momento de pensionarse
 * @param {number} pafeClp       - pensión autofinanciada en CLP (RP o RV bruta)
 * @param {number} uf            - valor UF vigente
 * @param {boolean} esAnticipada - true si es vejez anticipada (excluye CEV)
 * @returns {{ monto, montoUF, porcentaje, elegible, razonNoElegible }}
 */
export function calcularCEV(sexo, edad, pafeClp, uf, esAnticipada = false) {
  if (sexo !== 'F') {
    return { monto: 0, montoUF: 0, porcentaje: 0, elegible: false, razonNoElegible: 'Solo aplica a mujeres' };
  }
  if (edad < 65) {
    return { monto: 0, montoUF: 0, porcentaje: 0, elegible: false, razonNoElegible: 'Requiere edad ≥ 65 años' };
  }
  if (esAnticipada) {
    return { monto: 0, montoUF: 0, porcentaje: 0, elegible: false, razonNoElegible: 'Vejez anticipada excluye CEV (art. 68 DL 3.500)' };
  }
  const pafeUF = uf > 0 ? Math.min(pafeClp / uf, 18) : 0;
  const pct    = edad >= 75 ? 1.0 : edad >= 70 ? 0.75 : 0.5;
  const montoUF = Math.max(pafeUF * pct, 0.25);
  return { monto: Math.round(montoUF * uf), montoUF, porcentaje: pct * 100, elegible: true, razonNoElegible: null };
}

// ============================================================
// BONIFICACIÓN POR HIJO NACIDO VIVO (Ley 20.255 art. 74-75)
// ============================================================

/**
 * Bonificación por hijo nacido vivo — Ley N° 20.255 art. 74-75 (vigente desde julio 2009).
 * Tipo: Normativa — monto fijo por ley (18 UF × hijo nacido vivo).
 * Ingresa al saldo de capitalización individual al momento de pensionarse.
 * Solo aplica a mujeres afiliadas al sistema AFP (D.L. N° 3.500).
 *
 * Fuente: Ley N° 20.255 art. 74-75; SP Chile.
 *
 * @param {number} numHijosNacidosVivos - número de hijos nacidos vivos
 * @param {number} uf                  - valor UF vigente
 * @param {string} sexo                - 'M' | 'F'
 * @returns {{ monto, montoUF, numHijos, elegible, razonNoElegible }}
 */
export function calcularBonificacionHijo(numHijosNacidosVivos, uf, sexo = 'F') {
  if (sexo !== 'F') {
    return { monto: 0, montoUF: 0, numHijos: 0, elegible: false, razonNoElegible: 'Solo aplica a mujeres (Ley 20.255)' };
  }
  const n = Math.max(0, Math.round(numHijosNacidosVivos || 0));
  if (n === 0) {
    return { monto: 0, montoUF: 0, numHijos: 0, elegible: false, razonNoElegible: 'Sin hijos registrados' };
  }
  const montoUF = n * 18;
  return { monto: Math.round(montoUF * uf), montoUF, numHijos: n, elegible: true, razonNoElegible: null };
}

// ============================================================
// APV — BENEFICIO TRIBUTARIO (Art. 42 bis LIR — Ley N° 19.768)
// ============================================================

/**
 * Calcula el beneficio tributario mensual del APV según régimen elegido.
 *
 * Régimen A (crédito directo):
 *   - Crédito del 15% sobre el monto aportado, con tope de 6 UTM/año (0,5 UTM/mes).
 *   - El crédito se descuenta del impuesto a pagar (o se devuelve si es superior).
 *   Fórmula: min(aporte × 15%, 0.5 × UTM/mes)
 *
 * Régimen B (deducción de base imponible):
 *   - El aporte APV se resta de la renta imponible antes de calcular el impuesto.
 *   - Beneficio = impuesto(renta) − impuesto(renta − aporte)
 *   - Tope anual: 600 UF (50 UF/mes).
 *
 * Fuente: Art. 42 bis LIR; SII Chile; Compendio SP Libro I Título I.
 *
 * @param {number} aporteMensual   - aporte APV mensual en CLP
 * @param {string} regimen         - 'A' | 'B'
 * @param {number} rentaImponible  - renta imponible mensual en CLP
 * @param {number} utm             - valor UTM vigente en CLP
 * @param {number} uf              - valor UF vigente en CLP
 * @returns {{ beneficioMensual, beneficioAnual, regimen, descripcion }}
 */
export function calcularBeneficioTributarioAPV(aporteMensual, regimen, rentaImponible, utm, uf) {
  const aporte = Math.max(0, aporteMensual || 0);
  const renta  = Math.max(0, rentaImponible || 0);
  if (aporte === 0) return { beneficioMensual: 0, beneficioAnual: 0, regimen, descripcion: 'Sin aporte APV' };

  if (regimen === 'A') {
    const tope        = 0.5 * utm;                          // 6 UTM/año → 0,5 UTM/mes
    const credito     = Math.min(aporte * 0.15, tope);
    const beneficioMensual = Math.round(credito);
    return {
      beneficioMensual,
      beneficioAnual:  beneficioMensual * 12,
      regimen:         'A',
      descripcion:     `Crédito 15% sobre aporte (tope 0,5 UTM/mes = ${Math.round(tope).toLocaleString('es-CL')})`,
    };
  }

  if (regimen === 'B') {
    const topeUFMes   = 50 * uf;                            // 600 UF/año → 50 UF/mes
    const aporteEfec  = Math.min(aporte, topeUFMes);
    const impSinAPV   = calcularImpuesto(renta);
    const impConAPV   = calcularImpuesto(Math.max(0, renta - aporteEfec));
    const beneficioMensual = Math.max(0, Math.round(impSinAPV - impConAPV));
    return {
      beneficioMensual,
      beneficioAnual:  beneficioMensual * 12,
      regimen:         'B',
      descripcion:     `Deducción base imponible (tope 50 UF/mes = ${Math.round(topeUFMes).toLocaleString('es-CL')})`,
    };
  }

  return { beneficioMensual: 0, beneficioAnual: 0, regimen, descripcion: 'Régimen no reconocido' };
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

  // CRU según sexo: hombre aplica AAx (NCG N°306), mujer usa tabla oficial directa.
  // Ver calcularCRU_RP en mortalidad.js para el fundamento técnico.
  const cnuSinMejora = getCRU(sexo, edad);
  const cnuBase      = calcularCRU_RP(sexo, edad, TASA_RP, anioJubilacion);
  const pctAumentoMejora = cnuSinMejora > 0 ? ((cnuBase - cnuSinMejora) / cnuSinMejora) * 100 : 0;

  // factorTabla: 1.0 = B-2020 (RP), 1.08 = aproximación RV-2020 (RV)
  const cnuAfiliado = cnuBase * factorTabla;

  const totalHijosComunes = numHijosMenores + numHijosEstudiantes + numHijosInvalidos;
  const pctConyuge = tienePareja ? (totalHijosComunes > 0 ? 0.50 : 0.60) : 0;

  // CNU cónyuge/conviviente — renta reversional (cónyuge cobra SOLO tras fallecimiento afiliado)
  // getCNUConyuge calcula numéricamente la anualidad reversional desde tablas B-2020/RV-2020
  // al 3% (consistente con la tabla CRU pre-computada), logrando ~0.6% de error vs SCOMP.
  let cnuConyuge = 0;
  if (tienePareja) {
    const reversional = getCNUConyuge(sexo, edad, sexoConyuge, edadConyuge);
    cnuConyuge = pctConyuge * reversional * factorTabla;
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
    usaAAx: sexo === 'M' && !!anioJubilacion,
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
    const cruBase = getCRU(sexo, edad);
    cnu = calcularCRU_RP(sexo, edad, TASA_RP, anioJubilacion);
    cnuDetalle = {
      cnuTotal: cnu, cnuAfiliado: cnu, cnuConyuge: 0, cnuHijos: 0,
      factorFamilia: 1, tieneImpacto: false,
      cnuSinMejora: cruBase,
      pctAumentoMejora: cruBase > 0 ? ((cnu - cruBase) / cruBase) * 100 : 0,
      anioJubilacion,
      usaAAx: sexo === 'M' && !!anioJubilacion,
    };
  }

  const tasaMens  = TASA_RP;
  // Bug fix: esperanzaVida necesita nombre de tabla, no null
  const tablaRP   = sexo === 'M' ? 'b2020_hombre' : 'b2020_mujer';
  const mesesEspe = Math.max(12, (esperanzaVida(tablaRP, edad) - edad) * 12);
  // Redondear a 2 decimales UF (igual que SCOMP) antes de convertir a CLP
  const _pensionExacta = cnu > 0
    ? saldo / cnu
    : (tasaMens > 0 ? saldo * tasaMens / (1 - Math.pow(1 + tasaMens, -mesesEspe)) : 0);
  const pension = uf > 0 ? Math.round((_pensionExacta / uf) * 100) / 100 * uf : _pensionExacta;

  // Pensión sin familia (solo CRU del afiliado) para mostrar el impacto
  const cruSoloBase = getCRU(sexo, edad);
  const cruSolo = calcularCRU_RP(sexo, edad, TASA_RP, anioJubilacion);
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
  // CRU_RV desde tablas RV-2020 a tasa mercado 2.76% (sin AAx — TITRP ya incorpora longevidad)
  const cruRVSinMejora = getCRURentaVitalicia(sexo, edad, TASA_RV);
  const cruRVConMejora = cruRVSinMejora;

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

  // Redondear a 2 decimales UF (igual que SCOMP)
  const _pensionRVExacta = cnu > 0 ? saldo / cnu : 0;
  const pension = uf > 0 ? Math.round((_pensionRVExacta / uf) * 100) / 100 * uf : _pensionRVExacta;

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

// ============================================================
// PROCESADORES POR TIPO DE JUBILACIÓN
// ============================================================

/**
 * Vejez normal (Art. 3 DL 3.500).
 * Edad legal: 65 hombres / 60 mujeres.
 */
export function procesarVejezNormal({ saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion }) {
  const edadLegal = sexo === 'F' ? 60 : 65;
  const acceso = {
    cumple:     edad >= edadLegal,
    edadAcceso: edadLegal,
    edadActual: edad,
    faltan:     Math.max(0, edadLegal - edad),
  };
  return {
    acceso,
    rp: calcularPensionRP(saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion),
    rv: calcularPensionRV(saldo, edad, sexo, uf, familia, anioJubilacion),
  };
}

/**
 * Pensión anticipada (Art. 68 DL 3.500).
 * Requiere: RP bruta ≥ 12 UF Y ≥ 70% del promedio de renta imponible del decenio.
 */
export function procesarAnticipada({ saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion, rentaPromedioDecenio, rentaImponible }) {
  const rp    = calcularPensionRP(saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion);
  const rv    = calcularPensionRV(saldo, edad, sexo, uf, familia, anioJubilacion);
  const pension = rp.pension;
  const pensUF  = uf > 0 ? pension / uf : 0;
  const renta   = rentaPromedioDecenio || rentaImponible || 0;
  const req12uf = pensUF >= 12;
  const req70   = renta > 0 ? pension >= renta * 0.70 : null;
  return {
    acceso: {
      cumple:      req12uf && req70 !== false,
      rpBruta:     pension,
      pensUF,
      umbral12UF:  12 * uf,
      umbral70pct: renta > 0 ? Math.round(renta * 0.70) : null,
      req12uf,
      req70,
      renta,
    },
    rp,
    rv,
  };
}

/**
 * Trabajo pesado (Ley 19.404).
 * Rebaja la edad de acceso según tipo de puesto y meses cotizados en trabajo calificado.
 */
export function procesarTrabajoPesado({ saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion, tipoTrabajoPesado, mesesTrabajoPesado }) {
  const tipoTP    = parseInt(tipoTrabajoPesado) || 2;
  const mesesTP   = mesesTrabajoPesado || 0;
  const factor    = tipoTP === 1 ? 0.4 : 0.2;
  const maxRebaja = tipoTP === 1 ? 10  : 5;
  const edadMin   = tipoTP === 1 ? 55  : 60;
  const edadLegal = sexo === 'F' ? 60  : 65;
  const rebaja    = Math.min((mesesTP / 12) * factor, maxRebaja);
  const edadAcceso = Math.max(edadMin, Math.round(edadLegal - rebaja));
  return {
    acceso: {
      cumple:      edad >= edadAcceso,
      edadAcceso,
      edadActual:  edad,
      faltan:      Math.max(0, edadAcceso - edad),
      tipoTP,
      rebaja:      Math.round(rebaja * 10) / 10,
      factor,
      maxRebaja,
      edadLegal,
    },
    rp: calcularPensionRP(saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion),
    rv: calcularPensionRV(saldo, edad, sexo, uf, familia, anioJubilacion),
  };
}

/**
 * Invalidez del afiliado (Art. 54 DL 3.500).
 *
 * Total (pérdida ≥ 2/3):  pensión = saldo / CRU
 * Parcial (≥ 50% < 2/3):  pensión = 0,50 × (saldo / CRU)
 *
 * SIS (Seguro de Invalidez y Sobrevivencia, tasa 1,54% empleador):
 *   complementa hasta 70% de la renta promedio del decenio,
 *   con tope en 70% × 90,0 UF (tope imponible 2026).
 *
 * NOTA: el cálculo saldo/CRU es una estimación simplificada del motor.
 * Normativamente la pensión de invalidez se basa en ingreso base y SIS (Art. 54 DL 3.500).
 */
export function procesarInvalidez({ saldo, edad, sexo, uf, comisionDec, anioJubilacion, tipoInvalidez, rentaPromedioInvalidez }) {
  const tipo      = tipoInvalidez || 'total';
  const cruBase   = calcularCRU_RP(sexo, edad, TASA_RP, anioJubilacion);
  const brutaBase = cruBase > 0 ? saldo / cruBase : 0;
  const pensionBruta = tipo === 'parcial' ? brutaBase * 0.5 : brutaBase;

  const rentaRef     = rentaPromedioInvalidez || 0;
  const topeImponible = calcularTopeImponible(uf);
  const limSIS       = rentaRef > 0 ? Math.min(rentaRef * 0.70, 0.70 * topeImponible) : 0;
  const complementoSIS = rentaRef > 0 ? Math.max(0, Math.round(limSIS - pensionBruta)) : 0;

  const desglose    = calcularPensionLiquida(pensionBruta, comisionDec);
  return {
    tipo,
    pensionBruta:    Math.round(pensionBruta),
    pensionNeta:     desglose.liquida,
    complementoSIS,
    pensionTotal:    desglose.liquida + complementoSIS,
    cruBase,
    desglose,
    rentaRef,
    limSIS:          Math.round(limSIS),
  };
}

/**
 * Dispatcher: selecciona el procesador según `d.tipoJubilacion`.
 * Retorna `{ acceso, rp, rv }` para tipos de vejez, o `{ invalidez }` para invalidez.
 * @param {object} d            — datos del store
 * @param {number} uf
 * @param {number} comisionDec
 * @param {object} familia
 */
export function procesarPension(d, uf, comisionDec, familia) {
  const tipo       = d.tipoJubilacion || 'vejez_normal';
  const anioActual = new Date().getFullYear();
  const edadJub    = d.edadJubilacion || d.edad;
  const anioJub    = anioActual + Math.max(0, Math.round(edadJub - d.edad));
  const bonoHijo      = d.sexo === 'F' ? calcularBonificacionHijo(d.numHijosNacidosVivos, d.uf || 0, 'F').monto : 0;
  const saldoEfectivo = d.saldoTotal + (d.saldoAPV || 0) + (d.bonoReconocimiento || 0) + bonoHijo;

  const base = { saldo: saldoEfectivo, edad: d.edad, sexo: d.sexo, uf, comisionDec, familia, anioJubilacion: anioJub };

  switch (tipo) {
    case 'vejez_normal':
      return procesarVejezNormal(base);
    case 'anticipada':
      return procesarAnticipada({ ...base, rentaPromedioDecenio: d.rentaPromedioDecenio || 0, rentaImponible: d.rentaImponible || 0 });
    case 'trabajo_pesado':
      return procesarTrabajoPesado({ ...base, tipoTrabajoPesado: d.tipoTrabajoPesado || 2, mesesTrabajoPesado: d.mesesTrabajoPesado || 0 });
    case 'invalidez':
      return procesarInvalidez({ ...base, tipoInvalidez: d.tipoInvalidez || 'total', rentaPromedioInvalidez: d.rentaPromedioInvalidez || 0 });
    default:
      return procesarVejezNormal(base);
  }
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
