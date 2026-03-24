/**
 * scrape.js — Extrae NCGs desde spensiones.cl usando Playwright (headless Chromium).
 * Retorna array de { num, fecha, mat } sin persistir nada a disco.
 *
 * Uso directo:   node scripts/scrape.js
 * Uso como módulo:  const { scrapeNCGs } = await import('./scripts/scrape.js')
 */

import { chromium } from 'playwright';

const SOURCE_URL = 'https://www.spensiones.cl/apps/normativaSP/getNormativa.php?id=ncgsp';
const MAX_RETRIES = 3;
const TIMEOUT_MS  = 30_000;

/**
 * Extrae todos los registros NCG desde la tabla DataTables de spensiones.cl.
 * @returns {Promise<Array<{num:number, fecha:string, mat:string}>>}
 */
export async function scrapeNCGs() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  [scrape] Intento ${attempt}/${MAX_RETRIES} → ${SOURCE_URL}`);
      await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT_MS });

      // Esperar que DataTables cargue la tabla #documento1
      await page.waitForSelector('#documento1 tbody tr', { timeout: TIMEOUT_MS });

      // Extraer datos desde DataTables settings via jQuery
      const data = await page.evaluate(() => {
        const settings = jQuery.fn.dataTable.settings;
        const found = settings.find(s => s.nTable?.id === 'documento1');
        if (!found) throw new Error('DataTable #documento1 no encontrada');

        return found.aoData.map(r => {
          const cells = r.nTr?.querySelectorAll('td');
          if (!cells || cells.length < 3) return null;
          const num = parseInt(cells[0].textContent.trim(), 10);
          if (isNaN(num)) return null;
          const fechaRaw = cells[1].textContent.trim(); // puede venir como DD-MM-YYYY o YYYY-MM-DD
          return { num, fecha: fechaRaw, mat: cells[2].textContent.trim() };
        }).filter(Boolean).sort((a, b) => b.num - a.num);
      });

      await browser.close();
      console.log(`  [scrape] ✓ ${data.length} NCGs extraídas`);
      return data;
    } catch (err) {
      lastError = err;
      console.warn(`  [scrape] ✗ Intento ${attempt} falló: ${err.message}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000));
    }
  }

  await browser.close();
  throw new Error(`scrapeNCGs falló después de ${MAX_RETRIES} intentos: ${lastError?.message}`);
}

/**
 * Normaliza fecha a ISO 8601 (YYYY-MM-DD).
 * Acepta DD-MM-YYYY, D-M-YYYY, YYYY-MM-DD.
 */
export function normalizarFecha(raw) {
  if (!raw) return '';
  const parts = raw.split(/[-/]/);
  if (parts.length !== 3) return raw;
  // Si el primer segmento tiene 4 dígitos → ya es YYYY-MM-DD
  if (parts[0].length === 4) return raw;
  // Asumir DD-MM-YYYY
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Ejecución directa
if (process.argv[1].endsWith('scrape.js')) {
  const data = await scrapeNCGs();
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
  console.log(`... ${data.length} registros totales`);
}
