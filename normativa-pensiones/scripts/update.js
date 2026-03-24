/**
 * update.js — Orquestador principal: scrape → diff → build.
 *
 * Flujo:
 *   1. Cargar ncg.json actual → obtener max_num
 *   2. Ejecutar scrape.js → datos frescos de spensiones.cl
 *   3. Comparar: ¿hay NCGs con num > max_num?
 *   4. Si hay nuevas → fusionar, guardar, regenerar HTML
 *   5. Si no hay nuevas → informar sin cambios
 *
 * Uso:  node scripts/update.js
 */

import { readFile, writeFile } from 'fs/promises';
import { createHash }          from 'crypto';
import { dirname, join }       from 'path';
import { fileURLToPath }       from 'url';
import { scrapeNCGs, normalizarFecha } from './scrape.js';
import { build }               from './build.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA  = join(__dir, '..', 'data');

async function main() {
  console.log('\n=== Actualizador Normativa Pensiones ===\n');

  // 1. Cargar datos actuales
  let current;
  try {
    current = JSON.parse(await readFile(join(DATA, 'ncg.json'), 'utf8'));
  } catch {
    console.log('  [update] data/ncg.json no encontrado — partiendo desde cero');
    current = [];
  }
  const currentMaxNum = current.length > 0 ? Math.max(...current.map(r => r.num)) : 0;
  console.log(`  [update] Base actual: ${current.length} NCGs (última: N°${currentMaxNum})`);

  // 2. Scrape
  console.log('  [update] Iniciando extracción desde spensiones.cl...');
  let fresh;
  try {
    fresh = await scrapeNCGs();
  } catch (err) {
    console.error(`\n  [update] ERROR en scrape: ${err.message}`);
    console.error('  Verifica la conectividad y que Playwright esté instalado (npx playwright install chromium)');
    process.exit(1);
  }

  // 3. Normalizar fechas y enriquecer datos
  const freshEnriched = fresh.map(r => ({
    num:    r.num,
    numStr: String(r.num).padStart(4, '0'),
    fecha:  normalizarFecha(r.fecha),
    year:   parseInt(normalizarFecha(r.fecha).split('-')[0] || '2000', 10),
    mat:    r.mat,
  }));

  // 4. Detectar nuevos
  const nuevos = freshEnriched.filter(r => r.num > currentMaxNum);

  if (nuevos.length === 0) {
    console.log(`\n  Sin cambios. Última NCG: N°${currentMaxNum}`);
    return;
  }

  console.log(`\n  [update] ${nuevos.length} NCG(s) nueva(s): [${nuevos.map(r => r.num).join(', ')}]`);

  // 5. Fusionar y ordenar (sin duplicados)
  const existingNums = new Set(current.map(r => r.num));
  const merged = [
    ...current,
    ...freshEnriched.filter(r => !existingNums.has(r.num)),
  ].sort((a, b) => b.num - a.num);

  // 6. Checksum del nuevo dataset
  const checksum = 'sha256:' + createHash('sha256')
    .update(JSON.stringify(merged))
    .digest('hex')
    .substring(0, 16);

  // 7. Guardar ncg.json
  await writeFile(join(DATA, 'ncg.json'), JSON.stringify(merged, null, 2), 'utf8');
  console.log(`  [update] ✓ data/ncg.json actualizado (${merged.length} registros)`);

  // 8. Actualizar metadatos
  const meta = {
    last_updated:    new Date().toISOString(),
    total_records:   merged.length,
    max_num:         merged[0].num,
    source_url:      'https://www.spensiones.cl/apps/normativaSP/getNormativa.php?id=ncgsp',
    new_since_last:  nuevos.map(r => String(r.num)),
    checksum,
  };
  await writeFile(join(DATA, 'ncg_meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('  [update] ✓ data/ncg_meta.json actualizado');

  // 9. Regenerar HTML
  console.log('  [update] Regenerando dist/index.html...');
  await build();

  console.log(`\n  ✅ Listo. dist/index.html actualizado (${merged.length} NCGs, última: N°${merged[0].num})`);
  if (nuevos.length > 0) {
    console.log('\n  Nuevas NCGs agregadas:');
    nuevos.forEach(r => console.log(`    · N°${r.numStr} (${r.fecha}) — ${r.mat.substring(0, 80)}…`));
  }
}

main().catch(err => {
  console.error('\n  ERROR:', err.message);
  process.exit(1);
});
