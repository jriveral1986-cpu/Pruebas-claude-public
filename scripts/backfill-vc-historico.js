#!/usr/bin/env node
/**
 * backfill-vc-historico.js
 * Descarga los últimos N días de valor cuota desde SP Chile
 * y genera data/vc_historico.json.
 *
 * Uso:
 *   node scripts/backfill-vc-historico.js          # últimos 90 días (3 meses)
 *   node scripts/backfill-vc-historico.js 180       # últimos 180 días
 *
 * Navegación: SP Chile acepta POST con btn='<<' + {aaaa,mm,dd} del día D
 * para retornar el día anterior hábil a D.
 * Estrategia: arrancamos desde hoy y navegamos hacia atrás.
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const OUTPUT     = join(__dirname, '..', 'data', 'vc_historico.json');
const FONDOS     = ['A', 'B', 'C', 'D', 'E'];
const DIAS_ATRAS = parseInt(process.argv[2] ?? '90', 10);
const DELAY_MS   = 400; // pausa entre requests para no saturar SP Chile

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':          'text/html,*/*',
  'Accept-Language': 'es-CL,es;q=0.9',
  'Referer':         'https://www.spensiones.cl/apps/valoresCuotaFondo/vcfAFP.php',
  'Content-Type':    'application/x-www-form-urlencoded',
};

const SP_BASE = 'https://www.spensiones.cl/apps/valoresCuotaFondo/vcfAFP.php';

// ─── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Converts "25-Marzo-2026" → "2026-03-25" */
function parseFechaChilena(str) {
  const MESES = {
    ene:'01',jan:'01',feb:'02',mar:'03',abr:'04',apr:'04',
    may:'05',jun:'06',jul:'07',ago:'08',aug:'08',sep:'09',
    oct:'10',nov:'11',dic:'12',dec:'12',
  };
  const m = str.match(/(\d{1,2})[- ]([A-Za-zé]+)[- ](\d{4})/);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase().slice(0, 3)];
  if (!mes) return null;
  return `${m[3]}-${mes}-${m[1].padStart(2, '0')}`;
}

/** Parses AFP data rows from the data table (table[2]) */
function parseDataTable(tableHtml) {
  const rowRegex = /<td[^>]*alignLeft[^>]*>([^<]+)<\/td>\s*<td[^>]*align="right">([^<&]+)/gi;
  const data = {};
  for (const match of tableHtml.matchAll(rowRegex)) {
    const nombre = match[1].trim();
    const raw    = match[2].trim().replace(/\./g, '').replace(',', '.');
    const valor  = parseFloat(raw);
    if (!nombre || isNaN(valor) || valor <= 0) continue;
    const key = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    data[key] = valor;
  }
  return data;
}

/** Extracts the date string from the data table header.
 *  Handles two formats:
 *  - Provisional: "25-Marzo-2026\n<br>Valores Provisorios…"
 *  - Confirmed:   "28-Febrero-2026\n\t   </center>"
 */
function parseFechaFromTable(tableHtml) {
  // Match date followed by either <br> or </center> (with optional whitespace)
  const m = tableHtml.match(/<th[^>]*colspan[^>]*>\s*<center>\s*([\d]+-[A-Za-zé]+-\d{4})/i);
  return m ? parseFechaChilena(m[1].trim()) : null;
}

function extractTables(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
}

// ─── SP Chile fetcher ─────────────────────────────────────────────────────────

/**
 * Fetches one page. If currentDate is null → GET (latest).
 * If currentDate is provided → POST btn='<<' to get the PREVIOUS business day.
 * Returns { fecha, data } where fecha='YYYY-MM-DD', data={afpKey: valor}
 */
async function fetchPage(fondo, currentDate) {
  const url  = `${SP_BASE}?tf=${fondo}`;
  let res;

  if (!currentDate) {
    // First call: GET the latest page
    res = await fetch(url, { headers: { ...HEADERS, 'Content-Type': undefined }, signal: AbortSignal.timeout(15_000) });
  } else {
    // Navigate back: POST btn='<<' with the current date to get the previous day
    const [yyyy, mm, dd] = currentDate.split('-');
    const body = new URLSearchParams({ btn: '<<', aaaa: yyyy, mm, dd });
    res = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf  = await res.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buf);
  const tables = extractTables(html);
  if (tables.length < 3) throw new Error('Menos de 3 tablas en la respuesta');

  const fecha = parseFechaFromTable(tables[2]);
  const data  = parseDataTable(tables[2]);
  if (!fecha) throw new Error('No se pudo parsear la fecha');
  if (Object.keys(data).length === 0) throw new Error('Sin datos de AFP');

  return { fecha, data };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function fetchFondoHistorico(fondo, diasAtras) {
  const result = {};
  let currentDate = null;  // null = fetch latest first
  let prev = null;

  process.stdout.write(`  Fondo ${fondo}: `);

  for (let step = 0; step <= diasAtras; step++) {
    try {
      const { fecha, data } = await fetchPage(fondo, currentDate);

      // Detect infinite loop (same date twice = reached the limit of available data)
      if (fecha === prev) {
        process.stdout.write(' [fin datos]');
        break;
      }

      result[fecha] = data;
      process.stdout.write('.');
      prev        = fecha;
      currentDate = fecha;  // next POST will go back one from here

      await sleep(DELAY_MS);
    } catch (err) {
      process.stdout.write(`[ERR: ${err.message}]`);
      break;
    }
  }

  console.log(` ${Object.keys(result).length} días`);
  return result;
}

async function main() {
  console.log(`Descargando histórico de ${DIAS_ATRAS} días para fondos A-E…\n`);

  // Load existing file to merge (avoid re-downloading what we already have)
  let historico = {};
  if (existsSync(OUTPUT)) {
    try {
      historico = JSON.parse(readFileSync(OUTPUT, 'utf8'));
      console.log(`Cache existente cargado (${Object.keys(historico).filter(k => !k.startsWith('_')).length} fondos)\n`);
    } catch { /* ignorar */ }
  }

  for (const fondo of FONDOS) {
    const nuevo = await fetchFondoHistorico(fondo, DIAS_ATRAS);
    // Merge: new data takes precedence
    historico[fondo] = { ...(historico[fondo] ?? {}), ...nuevo };
  }

  historico._generado = new Date().toISOString().slice(0, 10);
  historico._fuente   = 'SP Chile — scraping automático';

  writeFileSync(OUTPUT, JSON.stringify(historico, null, 2));

  const totalFechas = Object.values(historico)
    .filter(v => typeof v === 'object' && !Array.isArray(v))
    .reduce((max, obj) => Math.max(max, Object.keys(obj).length), 0);

  console.log(`\nListo → ${OUTPUT}`);
  console.log(`Fondos: ${FONDOS.length} | Fechas máx por fondo: ~${totalFechas}`);
}

main().catch(e => { console.error(e); process.exit(1); });
