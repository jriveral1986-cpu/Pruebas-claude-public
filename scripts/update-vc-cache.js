#!/usr/bin/env node
/**
 * update-vc-cache.js
 * Fetches valor cuota for all funds (A-E) from SP Chile's public HTML page
 * and writes the result to data/vc_cache.json.
 *
 * Run:  node scripts/update-vc-cache.js
 * Used: GitHub Action (.github/workflows/update-vc-cache.yml) on daily cron
 *
 * SP Chile endpoint (HTML — el CSV requiere sesión):
 *   https://www.spensiones.cl/apps/valoresCuotaFondo/vcfAFP.php?tf=A
 * Tabla 3 contiene: AFP | Valor Cuota | Valor Patrimonio  (última fila = más reciente)
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT    = join(__dirname, '..', 'data', 'vc_cache.json');
const FONDOS    = ['A', 'B', 'C', 'D', 'E'];
const SP_URL    = (fondo) =>
  `https://www.spensiones.cl/apps/valoresCuotaFondo/vcfAFP.php?tf=${fondo}`;

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':          'text/html,*/*',
  'Accept-Language': 'es-CL,es;q=0.9',
  'Referer':         'https://www.spensiones.cl/',
};

async function fetchFondo(fondo) {
  const res = await fetch(SP_URL(fondo), {
    headers: HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} para fondo ${fondo}`);
  // SP Chile returns ISO-8859-1; fetch decodes as UTF-8 by default — fix manually
  const buf  = await res.arrayBuffer();
  return new TextDecoder('iso-8859-1').decode(buf);
}

/**
 * Parses the SP Chile HTML for a given fund.
 * Returns { afpKey: { valor, fecha }, ... }
 *
 * The page has 3 tables:
 *   [0] header nav
 *   [1] date ranges (confirmed / available)
 *   [2] data table: AFP | Valor Cuota | Valor Patrimonio
 * The date is in the <th colspan="3"> of table[2].
 * Values use Chilean format: "58.860,35" → 58860.35
 */
function parseHtml(html) {
  // Extract all <table> blocks
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  if (tables.length < 3) throw new Error(`Solo ${tables.length} tablas encontradas (esperadas 3)`);

  const dataTable = tables[2];

  // Extract date from <th colspan="3">25-Marzo-2026...</th> (confirmed or provisional)
  const dateMatch = dataTable.match(/<th[^>]*colspan[^>]*>\s*<center>\s*([\d]+-[A-Za-zé]+-\d{4})/i);
  const fecha = dateMatch
    ? parseFechaChilena(dateMatch[1].trim())
    : new Date().toISOString().slice(0, 10);

  // Extract AFP rows: <td class="alignLeft">NAME</td><td align="right">VALUE</td>
  const rowRegex = /<td[^>]*alignLeft[^>]*>([^<]+)<\/td>\s*<td[^>]*align="right">([^<&]+)/gi;
  const result   = {};

  for (const match of dataTable.matchAll(rowRegex)) {
    const nombre = match[1].trim();
    const raw    = match[2].trim().replace(/\./g, '').replace(',', '.');
    const valor  = parseFloat(raw);
    if (!nombre || isNaN(valor) || valor <= 0) continue;

    const afpKey = nombre.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    result[afpKey] = { valor, fecha };
  }

  if (Object.keys(result).length === 0) throw new Error('No se encontraron filas de AFP');
  return result;
}

/** Converts "25-Marzo-2026" or "25-MAR-2026" to "2026-03-25" */
function parseFechaChilena(str) {
  const MESES = {
    ene: '01', jan: '01', feb: '02', mar: '03', abr: '04', apr: '04',
    may: '05', jun: '06', jul: '07', ago: '08', aug: '08', sep: '09',
    oct: '10', nov: '11', dic: '12', dec: '12',
  };
  const m = str.match(/(\d{1,2})[- ]([A-Za-zé]+)[- ](\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const dia = m[1].padStart(2, '0');
  const mes = MESES[m[2].toLowerCase().slice(0, 3)] ?? '01';
  return `${m[3]}-${mes}-${dia}`;
}

async function main() {
  const cache  = {
    _fecha:  new Date().toISOString().slice(0, 10),
    _fuente: 'SP Chile — fetch automático',
  };
  let errors = 0;

  for (const fondo of FONDOS) {
    try {
      process.stdout.write(`Fondo ${fondo}... `);
      const html  = await fetchFondo(fondo);
      cache[fondo] = parseHtml(html);
      const afps  = Object.keys(cache[fondo]);
      const fecha = cache[fondo][afps[0]]?.fecha ?? '?';
      console.log(`OK (${afps.length} AFPs, fecha: ${fecha})`);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      errors++;
    }
  }

  if (errors === FONDOS.length) {
    console.error('\nTodos los fondos fallaron. No se actualiza el cache.');
    process.exit(1);
  }

  writeFileSync(OUTPUT, JSON.stringify(cache, null, 2));
  console.log(`\nCache actualizado → ${OUTPUT}`);

  if (errors > 0) {
    console.warn(`Advertencia: ${errors} fondo(s) no se pudieron actualizar.`);
    process.exit(1);
  }
}

main();
