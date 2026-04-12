/**
 * test/calculos.test.mjs — Unit tests for js/calculos.js
 * Run: npm test
 *
 * Covers:
 *  - calcularImpuesto
 *  - calcularPensionLiquida
 *  - calcularPGU / calcularPGUInformativa
 *  - calcularBAC
 *  - calcularCEV
 *  - calcularBonificacionHijo
 *  - calcularBrecha
 *  - calcularBeneficioTributarioAPV
 *  - calcularScore
 *  - calcularPensionRP / calcularPensionRV (requiere tablas de mortalidad)
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularImpuesto,
  calcularPensionLiquida,
  calcularPGU, calcularPGUInformativa,
  calcularBAC,
  calcularCEV,
  calcularBonificacionHijo,
  calcularBrecha,
  calcularBeneficioTributarioAPV,
  calcularScore,
  calcularPensionRP,
  calcularPensionRV,
  PGU,
} from '../js/calculos.js';

import { cargarTablas } from '../js/mortalidad.js';

const UF  = 39717;
const UTM = 69889;

// ── Impuesto 2ª categoría ─────────────────────────────────────

describe('calcularImpuesto', () => {
  test('exento bajo tramo 1 ($500.000)', () => {
    assert.equal(calcularImpuesto(500000), 0);
  });

  test('exento en límite ($943.501)', () => {
    assert.equal(calcularImpuesto(943501), 0);
  });

  test('tramo 2 ($1.500.000)', () => {
    const imp = calcularImpuesto(1500000);
    // 1.500.000 × 4% − 37.740 = 22.260
    assert.equal(imp, 22260);
  });

  test('tramo alto ($5.000.000)', () => {
    const imp = calcularImpuesto(5000000);
    // 5.000.000 × 23% − 778.563 = 371.437
    assert.equal(imp, 371437);
  });

  test('siempre >= 0', () => {
    assert.ok(calcularImpuesto(0) >= 0);
    assert.ok(calcularImpuesto(-100) >= 0);
  });
});

// ── Pensión líquida ───────────────────────────────────────────

describe('calcularPensionLiquida', () => {
  test('estructura del resultado', () => {
    const r = calcularPensionLiquida(1000000, 0.0127);
    assert.ok(r.bruta === 1000000);
    assert.ok(r.descComision > 0);
    assert.ok(r.descSalud > 0);
    assert.ok(r.liquida < r.bruta);
    assert.ok(r.totalDescuentos === r.descComision + r.descSalud + r.descImpuesto);
  });

  test('RV sin comisión AFP (comision=0)', () => {
    const r = calcularPensionLiquida(1000000, 0);
    assert.equal(r.descComision, 0);
    assert.ok(r.descSalud > 0);
  });

  test('líquida > 0 para pensión bruta > 0', () => {
    const r = calcularPensionLiquida(500000, 0.0127);
    assert.ok(r.liquida > 0);
  });
});

// ── PGU ──────────────────────────────────────────────────────

describe('calcularPGU', () => {
  test('PGU completa bajo umbral (edad 65)', () => {
    const pgu = calcularPGU(0, 65);
    assert.equal(pgu, PGU.montoBase);
  });

  test('PGU cero bajo 65 años', () => {
    assert.equal(calcularPGU(500000, 60), 0);
  });

  test('PGU cero sobre umbral tope', () => {
    assert.equal(calcularPGU(PGU.umbralTope + 1, 65), 0);
  });

  test('PGU mayor a 82 años', () => {
    const pgu = calcularPGU(0, 82);
    assert.equal(pgu, PGU.montoMax82);
  });

  test('PGU parcial entre umbrales', () => {
    const mitad = Math.round((PGU.umbralCompleto + PGU.umbralTope) / 2);
    const pgu   = calcularPGU(mitad, 65);
    assert.ok(pgu > 0 && pgu < PGU.montoBase);
  });
});

describe('calcularPGUInformativa', () => {
  test('retorna montoBase para pensión 0', () => {
    assert.equal(calcularPGUInformativa(0), PGU.montoBase);
  });

  test('retorna 0 sobre umbral tope', () => {
    assert.equal(calcularPGUInformativa(PGU.umbralTope + 1), 0);
  });
});

// ── BAC ──────────────────────────────────────────────────────

describe('calcularBAC', () => {
  test('inelegible hombre con menos de 240 meses', () => {
    const r = calcularBAC(100, UF, 'M');
    assert.equal(r.elegible, false);
    assert.equal(r.monto, 0);
  });

  test('inelegible mujer con menos de 120 meses', () => {
    const r = calcularBAC(100, UF, 'F');
    assert.equal(r.elegible, false);
  });

  test('elegible hombre 300 meses cotizados', () => {
    const r = calcularBAC(300, UF, 'M');
    assert.equal(r.elegible, true);
    // 300/12 = 25 años × 0.1 = 2.5 UF (tope exacto)
    assert.equal(r.montoUF, 2.5);
    assert.equal(r.monto, Math.round(2.5 * UF));
  });

  test('tope máximo 2.5 UF con más de 300 meses', () => {
    const r = calcularBAC(600, UF, 'M');
    assert.equal(r.montoUF, 2.5);
  });

  test('elegible mujer 120 meses', () => {
    const r = calcularBAC(120, UF, 'F');
    assert.equal(r.elegible, true);
    // 120/12 = 10 años × 0.1 = 1.0 UF
    assert.equal(r.montoUF, 1.0);
  });
});

// ── CEV ──────────────────────────────────────────────────────

describe('calcularCEV', () => {
  test('hombre inelegible siempre', () => {
    const r = calcularCEV('M', 65, 500000, UF);
    assert.equal(r.elegible, false);
    assert.equal(r.monto, 0);
  });

  test('mujer menor de 65 inelegible', () => {
    const r = calcularCEV('F', 60, 500000, UF);
    assert.equal(r.elegible, false);
  });

  test('mujer 65 años elegible con porcentaje 50%', () => {
    const r = calcularCEV('F', 65, 18 * UF, UF);
    assert.equal(r.elegible, true);
    assert.equal(r.porcentaje, 50);
  });

  test('mujer 70 años porcentaje 75%', () => {
    const r = calcularCEV('F', 70, 18 * UF, UF);
    assert.equal(r.porcentaje, 75);
  });

  test('mujer 75 años porcentaje 100%', () => {
    const r = calcularCEV('F', 75, 18 * UF, UF);
    assert.equal(r.porcentaje, 100);
  });

  test('vejez anticipada excluye CEV', () => {
    const r = calcularCEV('F', 65, 500000, UF, true);
    assert.equal(r.elegible, false);
  });
});

// ── Bonificación por hijo ─────────────────────────────────────

describe('calcularBonificacionHijo', () => {
  test('hombre inelegible', () => {
    const r = calcularBonificacionHijo(2, UF, 'M');
    assert.equal(r.elegible, false);
    assert.equal(r.monto, 0);
  });

  test('mujer sin hijos inelegible', () => {
    const r = calcularBonificacionHijo(0, UF, 'F');
    assert.equal(r.elegible, false);
  });

  test('mujer con 2 hijos: 36 UF', () => {
    const r = calcularBonificacionHijo(2, UF, 'F');
    assert.equal(r.elegible, true);
    assert.equal(r.montoUF, 36);
    assert.equal(r.monto, Math.round(36 * UF));
  });
});

// ── Brecha ───────────────────────────────────────────────────

describe('calcularBrecha', () => {
  test('suficiente cuando pensión >= objetivo', () => {
    const r = calcularBrecha(1200000, 1000000);
    assert.equal(r.suficiente, true);
    assert.ok(r.brecha_abs <= 0);
  });

  test('insuficiente cuando pensión < objetivo', () => {
    const r = calcularBrecha(500000, 1000000);
    assert.equal(r.suficiente, false);
    assert.equal(r.brecha_abs, 500000);
    assert.equal(r.brecha_pct, 50);
  });

  test('objetivo 0 no causa división por cero', () => {
    const r = calcularBrecha(500000, 0);
    assert.equal(r.brecha_pct, 0);
  });
});

// ── Beneficio tributario APV ──────────────────────────────────

describe('calcularBeneficioTributarioAPV', () => {
  test('régimen A: 15% del aporte sin superar tope', () => {
    const r = calcularBeneficioTributarioAPV(100000, 'A', 2000000, UTM, UF);
    // tope = 0.5 × UTM = 34.944 | crédito = 100000 × 15% = 15.000
    assert.equal(r.beneficioMensual, 15000);
    assert.equal(r.regimen, 'A');
  });

  test('régimen A tope en 0.5 UTM/mes', () => {
    const aporte = 500000; // 15% = 75.000 > tope 34.944
    const r = calcularBeneficioTributarioAPV(aporte, 'A', 2000000, UTM, UF);
    assert.equal(r.beneficioMensual, Math.round(0.5 * UTM));
  });

  test('régimen B: reduce impuesto al bajar base imponible', () => {
    const renta = 2000000;
    const aporte = 200000;
    const r = calcularBeneficioTributarioAPV(aporte, 'B', renta, UTM, UF);
    assert.ok(r.beneficioMensual >= 0);
    assert.equal(r.regimen, 'B');
    // Beneficio debe ser positivo para renta en tramo afecto
    assert.ok(r.beneficioMensual > 0);
  });

  test('sin aporte retorna 0', () => {
    const r = calcularBeneficioTributarioAPV(0, 'A', 2000000, UTM, UF);
    assert.equal(r.beneficioMensual, 0);
    assert.equal(r.beneficioAnual, 0);
  });
});

// ── Score previsional ─────────────────────────────────────────

describe('calcularScore', () => {
  test('rango [0, 100]', () => {
    const s = calcularScore({ pensionRP: 500000, rentaImponible: 1000000, edad: 55, saldoActual: 20000000 });
    assert.ok(s >= 0 && s <= 100);
  });

  test('score mayor con buena tasa de reemplazo', () => {
    const s1 = calcularScore({ pensionRP: 700000, rentaImponible: 1000000 });
    const s2 = calcularScore({ pensionRP: 200000, rentaImponible: 1000000 });
    assert.ok(s1 > s2);
  });

  test('score mayor con APV mensual activo', () => {
    const base = { pensionRP: 500000, rentaImponible: 1000000 };
    const s1 = calcularScore({ ...base, apvMensual: 100000 });
    const s2 = calcularScore({ ...base, apvMensual: 0 });
    assert.ok(s1 > s2);
  });
});

// ── Pensión RP y RV (requiere tablas de mortalidad) ───────────

describe('calcularPensionRP + calcularPensionRV (integración con tablas)', () => {
  before(async () => {
    await cargarTablas();
  });

  const SALDO   = 50_000_000;
  const FAMILIA = { tienePareja: false, numHijosMenores: 0, numHijosEstudiantes: 0, numHijosInvalidos: 0 };

  test('RP hombre 65 años retorna pensión > 0', () => {
    const r = calcularPensionRP(SALDO, 65, 'M', UF, 0.0127, FAMILIA, 2026);
    assert.ok(r.pension > 0);
    assert.ok(r.pensionTotal > 0);
    assert.ok(r.pensionLiquida > 0);
    assert.ok(r.pensionUF > 0);
  });

  test('RV mujer 65 años retorna pensión > 0', () => {
    const r = calcularPensionRV(SALDO, 65, 'F', UF, FAMILIA, 2026);
    assert.ok(r.pension > 0);
    assert.ok(r.pensionTotal > 0);
  });

  test('mayor saldo → mayor pensión RP', () => {
    const r1 = calcularPensionRP(SALDO,     65, 'M', UF, 0.0127, FAMILIA, 2026);
    const r2 = calcularPensionRP(SALDO * 2, 65, 'M', UF, 0.0127, FAMILIA, 2026);
    assert.ok(r2.pension > r1.pension);
  });

  test('mayor saldo → mayor pensión RV', () => {
    const r1 = calcularPensionRV(SALDO,     65, 'M', UF, FAMILIA, 2026);
    const r2 = calcularPensionRV(SALDO * 2, 65, 'M', UF, FAMILIA, 2026);
    assert.ok(r2.pension > r1.pension);
  });

  test('desglose RP: líquida < bruta', () => {
    const r = calcularPensionRP(SALDO, 65, 'M', UF, 0.0127, FAMILIA, 2026);
    assert.ok(r.pensionLiquida < r.pension);
  });

  test('PGU se suma a 65 años (pensión baja)', () => {
    // Con saldo pequeño la pensión base será baja → PGU completa
    const r = calcularPensionRP(1_000_000, 65, 'M', UF, 0.0127, FAMILIA, 2026);
    assert.ok(r.pgu > 0);
    assert.ok(r.pensionTotal > r.pensionLiquida);
  });

  test('mujer tiene mayor CNU que hombre (mayor longevidad)', () => {
    const rH = calcularPensionRP(SALDO, 65, 'M', UF, 0, FAMILIA, 2026);
    const rF = calcularPensionRP(SALDO, 65, 'F', UF, 0, FAMILIA, 2026);
    // Mayor CNU → menor pensión mensual
    assert.ok(rF.pension < rH.pension);
  });
});
