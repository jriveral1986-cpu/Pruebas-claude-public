/**
 * build.js — Genera dist/index.html desde data/ncg.json y data/ncg_meta.json.
 * HTML completamente autocontenido: no requiere servidor, funciona con file://.
 *
 * Uso:  node scripts/build.js
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const DATA   = join(ROOT, 'data');
// Salida en pages/ del proyecto principal (al mismo nivel que datos.html, brechas.html, etc.)
const PAGES  = join(ROOT, '..', 'pages');

export async function build() {
  const ncgData = JSON.parse(await readFile(join(DATA, 'ncg.json'), 'utf8'));
  const meta    = JSON.parse(await readFile(join(DATA, 'ncg_meta.json'), 'utf8'));

  const fechaCache  = meta.last_updated.substring(0, 10);
  const totalNCGs   = ncgData.length;
  const maxNum      = meta.max_num;

  // Años disponibles (para filtros dinámicos)
  const years = [...new Set(ncgData.map(r => r.year))].sort((a, b) => b - a);
  const recentYears = years.filter(y => y >= new Date().getFullYear() - 3);

  const yearBtns = [
    '<button class="filter-btn active" data-year="all">Todos</button>',
    ...recentYears.map(y => `<button class="filter-btn" data-year="${y}">${y}</button>`),
    '<button class="filter-btn" data-year="old">Anteriores</button>',
  ].join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Normativa Previsional Chile</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0f1923; --paper: #f4f0e8; --accent: #c8392b;
    --gold: #b8972a; --muted: #6b6560; --rule: #d4cfc6; --card: #faf8f4; --blue: #1a5fa8;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-weight:300;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='1' cy='1' r='0.4' fill='%23000' opacity='0.04'/%3E%3C/svg%3E");pointer-events:none;z-index:0}

  header{position:relative;padding:3rem 2rem 2rem;max-width:1200px;margin:0 auto;border-bottom:3px double var(--ink)}
  .eyebrow{font-size:.68rem;font-weight:500;letter-spacing:.25em;text-transform:uppercase;color:var(--accent);margin-bottom:.75rem}
  h1{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.5rem);font-weight:900;line-height:1.05}
  h1 em{font-style:italic;color:var(--accent)}
  .sub{margin-top:.8rem;font-size:.88rem;color:var(--muted);max-width:560px;line-height:1.7}
  .meta{margin-top:1.2rem;display:flex;align-items:center;gap:2rem;font-size:.73rem;color:var(--muted);flex-wrap:wrap}

  .tabs{max-width:1200px;margin:1.5rem auto 0;padding:0 2rem;display:flex;gap:0;border-bottom:2px solid var(--rule)}
  .tab-btn{background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;padding:.7rem 1.4rem;font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:500;color:var(--muted);cursor:pointer;transition:all .2s;letter-spacing:.03em}
  .tab-btn.active{color:var(--ink);border-bottom-color:var(--accent)}
  .panel{display:none}.panel.active{display:block}

  .toolbar{max-width:1200px;margin:1.5rem auto 0;padding:0 2rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap;justify-content:space-between}
  .toolbar-left{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap}
  .filter-label{font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
  .filter-btn{background:none;border:1.5px solid var(--rule);color:var(--muted);font-family:'DM Sans',sans-serif;font-size:.75rem;font-weight:500;padding:.3rem .8rem;border-radius:2px;cursor:pointer;transition:all .2s}
  .filter-btn:hover,.filter-btn.active{background:var(--ink);border-color:var(--ink);color:var(--paper)}
  .search-input{border:none;border-bottom:2px solid var(--rule);background:transparent;font-family:'DM Sans',sans-serif;font-size:.88rem;color:var(--ink);padding:.4rem 0;outline:none;transition:border-color .2s;min-width:220px}
  .search-input::placeholder{color:var(--muted)}.search-input:focus{border-color:var(--accent)}

  .btn-refresh{display:inline-flex;align-items:center;gap:.4rem;background:var(--blue);color:white;border:none;font-family:'DM Sans',sans-serif;font-size:.75rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;padding:.45rem 1rem;border-radius:2px;cursor:pointer;transition:all .2s;text-decoration:none}
  .btn-refresh:hover{background:#154d8c}

  .status-bar{max-width:1200px;margin:.8rem auto 0;padding:0 2rem;font-size:.72rem;color:var(--muted);display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}
  .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:.3rem}
  .dot-ok{background:#2ecc71}.dot-warn{background:var(--gold)}

  .ncg-wrap{max-width:1200px;margin:1.2rem auto 0;padding:0 2rem 3rem}
  .table-wrap{overflow-x:auto;border:1.5px solid var(--rule)}
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  thead{background:var(--ink);color:var(--paper)}
  thead th{padding:.75rem 1rem;text-align:left;font-weight:500;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}
  tbody tr{border-bottom:1px solid var(--rule);transition:background .1s}
  tbody tr:hover{background:#fff}
  tbody td{padding:.7rem 1rem;vertical-align:top}
  .td-num{font-family:'Playfair Display',serif;font-weight:700;white-space:nowrap}
  .td-date{color:var(--muted);white-space:nowrap;font-size:.75rem}
  .td-mat{line-height:1.5;color:#3a3530}
  .badge-new{display:inline-block;background:var(--accent);color:white;font-size:.6rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;padding:.1rem .4rem;border-radius:1px;margin-left:.5rem;vertical-align:middle}
  .td-act a{display:inline-flex;align-items:center;gap:.3rem;background:var(--ink);color:white;text-decoration:none;font-size:.68rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;padding:.3rem .65rem;border-radius:1px;white-space:nowrap;transition:background .15s}
  .td-act a:hover{background:var(--accent)}

  .state-msg{padding:3rem;text-align:center;color:var(--muted);font-size:.9rem}
  .state-msg strong{display:block;font-size:1.1rem;margin-bottom:.4rem;color:var(--ink)}

  .pagination{margin-top:1rem;display:flex;gap:.4rem;align-items:center;justify-content:flex-end;flex-wrap:wrap}
  .page-btn{background:none;border:1.5px solid var(--rule);color:var(--muted);font-family:'DM Sans',sans-serif;font-size:.75rem;padding:.3rem .65rem;border-radius:2px;cursor:pointer;transition:all .15s}
  .page-btn.active,.page-btn:hover{background:var(--ink);border-color:var(--ink);color:white}
  .page-btn:disabled{opacity:.4;cursor:not-allowed}
  .page-info{font-size:.72rem;color:var(--muted);margin-right:auto}

  /* LEYES */
  .laws-grid{max-width:1200px;margin:1.5rem auto 0;padding:0 2rem 3rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5px;background:var(--rule);border-bottom:1.5px solid var(--rule)}
  .law-card{background:var(--card);padding:1.5rem;display:flex;flex-direction:column;gap:.6rem;transition:background .15s;position:relative;overflow:hidden;animation:fadeUp .35s ease both}
  .law-card:hover{background:#fff}
  .law-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:transparent;transition:background .2s}
  .law-card:hover::before{background:var(--accent)}
  .law-year{position:absolute;top:1.2rem;right:1.2rem;font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:900;color:var(--rule);line-height:1}
  .law-tag{display:inline-flex;align-items:center;gap:.3rem;font-size:.62rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;padding:.2rem .5rem;border-radius:1px;width:fit-content}
  .tag-ley{background:#fdecea;color:#c8392b}.tag-tec{background:#edfdf5;color:#0d7a4e}.tag-cmp{background:#fdf3e3;color:#b8660a}
  .law-title{font-family:'Playfair Display',serif;font-size:.98rem;font-weight:700;line-height:1.3;padding-right:2.5rem}
  .law-code{font-size:.72rem;font-weight:500;color:var(--muted)}
  .law-desc{font-size:.81rem;line-height:1.65;color:#4a4540;flex:1}
  .law-footer{margin-top:.4rem;display:flex;align-items:center;justify-content:space-between}
  .law-source{font-size:.68rem;color:var(--muted)}
  .btn-dl{display:inline-flex;align-items:center;gap:.4rem;background:var(--ink);color:white;text-decoration:none;font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;padding:.4rem .8rem;border-radius:1px;transition:all .15s;white-space:nowrap}
  .btn-dl:hover{background:var(--accent);transform:translateY(-1px)}
  .btn-web{background:none;border:1.5px solid var(--rule);color:var(--muted);text-decoration:none;font-size:.7rem;font-weight:500;padding:.35rem .75rem;border-radius:1px;transition:all .15s}
  .btn-web:hover{border-color:var(--ink);color:var(--ink)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

  footer{max-width:1200px;margin:0 auto;padding:1.5rem 2rem;border-top:1px solid var(--rule);display:flex;gap:1rem;justify-content:space-between;align-items:center;flex-wrap:wrap}
  .footer-note{font-size:.7rem;color:var(--muted);line-height:1.6;max-width:600px}
  .footer-note a{color:var(--accent)}
  .info-box{max-width:1200px;margin:1rem auto 0;padding:0 2rem}
  .info-box-inner{background:#edf4fd;border:1px solid #c0d8f5;border-radius:2px;padding:.8rem 1rem;font-size:.78rem;color:#1a3f6f;line-height:1.6}
  @media(max-width:640px){header,.tabs,.toolbar,.status-bar,.ncg-wrap,.laws-grid{padding-left:1.2rem;padding-right:1.2rem}.laws-grid{grid-template-columns:1fr}}
</style>
</head>
<body>

<header>
  <p class="eyebrow">📋 Repositorio Previsional · Chile</p>
  <h1>Normativa <em>Pensiones</em></h1>
  <p class="sub">Leyes, reglamentos y normas de carácter general. Las NCGs se cargan desde datos extraídos directamente del sitio oficial de la SP.</p>
  <div class="meta">
    <span>🏛 Fuente: spensiones.cl · LeyChile · Previsión Social</span>
    <span>📅 Caché: ${fechaCache}</span>
    <span id="total-badge">📄 ${totalNCGs} NCGs</span>
  </div>
</header>

<div class="tabs">
  <button class="tab-btn active" data-tab="ncg">📑 NCG (${totalNCGs})</button>
  <button class="tab-btn" data-tab="leyes">⚖ Leyes & Documentos</button>
</div>

<!-- ===== PANEL NCG ===== -->
<div class="panel active" id="panel-ncg">

  <div class="info-box">
    <div class="info-box-inner">
      💡 <strong>Datos en caché al ${fechaCache}.</strong>
      Para ver las NCGs más recientes, usa el botón <strong>"Ver en SP →"</strong> — abre el sitio oficial de la Superintendencia de Pensiones en una nueva pestaña.
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-left">
      <span class="filter-label">Año:</span>
      ${yearBtns}
    </div>
    <div style="display:flex;gap:.8rem;align-items:center">
      <input class="search-input" type="text" id="ncg-search" placeholder="Buscar materia o N°…">
      <a class="btn-refresh" href="https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-5937.html" target="_blank" rel="noopener">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13.7 8A5.7 5.7 0 1 1 8 2.3c1.7 0 3.2.7 4.3 1.8L14 2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2.5V6h-3.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Ver en SP
      </a>
    </div>
  </div>

  <div class="status-bar">
    <span><span class="dot dot-ok"></span> ${totalNCGs} NCGs cargadas · datos del ${fechaCache}</span>
    <span id="count-msg"></span>
  </div>

  <div class="ncg-wrap">
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:80px">N°</th>
          <th style="width:110px">Fecha</th>
          <th>Materia</th>
          <th style="width:100px">PDF</th>
        </tr></thead>
        <tbody id="ncg-tbody"></tbody>
      </table>
    </div>
    <div class="pagination" id="pagination"></div>
  </div>
</div>

<!-- ===== PANEL LEYES ===== -->
<div class="panel" id="panel-leyes">
  <div class="laws-grid">
    <div class="law-card">
      <div class="law-year">1980</div>
      <span class="law-tag tag-ley">⚖ Ley</span>
      <div class="law-title">D.L. 3.500 — Sistema de AFP y Fondos de Pensiones</div>
      <div class="law-code">Decreto Ley N° 3.500 · 1980</div>
      <div class="law-desc">Cuerpo legal fundacional del sistema previsional chileno. Crea las AFP, regula las cotizaciones obligatorias, los multifondos y las prestaciones de vejez, invalidez y sobrevivencia.</div>
      <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-web" href="https://www.leychile.cl/Navegar?idNorma=7147" target="_blank">Ver en línea ↗</a></div>
    </div>
    <div class="law-card">
      <div class="law-year">2008</div>
      <span class="law-tag tag-ley">⚖ Ley</span>
      <div class="law-title">Ley 20.255 — Reforma Previsional · Pilar Solidario</div>
      <div class="law-code">Ley N° 20.255 · 2008</div>
      <div class="law-desc">Crea el Pilar Solidario (PBS y APS), el bono por hijo nacido vivo, la pensión para independientes y el SCOMP (sistema de consulta de montos de pensión).</div>
      <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-web" href="https://www.leychile.cl/Navegar?idNorma=269892" target="_blank">Ver en línea ↗</a></div>
    </div>
    <div class="law-card">
      <div class="law-year">2022</div>
      <span class="law-tag tag-ley">⚖ Ley</span>
      <div class="law-title">Ley 21.419 — Cotizaciones Trabajadores Independientes</div>
      <div class="law-code">Ley N° 21.419 · 2022</div>
      <div class="law-desc">Moderniza la incorporación previsional de trabajadores con boleta de honorarios. Cotización obligatoria gradual del 17% y ajuste del mecanismo de retención en operación renta.</div>
      <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-web" href="https://www.leychile.cl/Navegar?idNorma=1167313" target="_blank">Ver en línea ↗</a></div>
    </div>
    <div class="law-card">
      <div class="law-year">2025</div>
      <span class="law-tag tag-ley">⚖ Ley</span>
      <div class="law-title">Ley 21.735 — Reforma de Pensiones 2025</div>
      <div class="law-code">Ley N° 21.735 · 2025</div>
      <div class="law-desc">Reforma estructural que crea un Seguro Social con cotización solidaria (6% empleador), aumenta la PGU, crea el FAPP y establece un sistema mixto de reparto y capitalización individual.</div>
      <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-web" href="https://www.leychile.cl/Navegar?idNorma=1212067" target="_blank">Ver en línea ↗</a></div>
    </div>
    <div class="law-card">
      <div class="law-year">2025</div>
      <span class="law-tag tag-tec">🔬 Técnico</span>
      <div class="law-title">Nota Técnica — Reforma de Pensiones Ley 21.735</div>
      <div class="law-code">Ministerio de Previsión Social · 2025</div>
      <div class="law-desc">Análisis financiero y actuarial oficial de la Ley 21.735. Incluye proyecciones de beneficios, tasas de reemplazo y análisis del seguro social solidario.</div>
      <div class="law-footer"><span class="law-source">previsionsocial.gob.cl</span>
        <a class="btn-dl" href="https://previsionsocial.gob.cl/wp-content/uploads/2025/08/Nota-Tecnica-Reforma-de-Pensiones-Ley-N%C2%B021.735.pdf" target="_blank" download>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>PDF</a></div>
    </div>
    <div class="law-card">
      <div class="law-year">SP</div>
      <span class="law-tag tag-cmp">📚 Compendio</span>
      <div class="law-title">Compendio de Normas SP — Presentación Oficial</div>
      <div class="law-code">Superintendencia de Pensiones · NT 432</div>
      <div class="law-desc">Folleto oficial del Compendio de Normas SP. Resume la estructura, libros y finalidad del cuerpo normativo que regula el funcionamiento de las AFP y demás entidades previsionales.</div>
      <div class="law-footer"><span class="law-source">spensiones.cl</span>
        <a class="btn-dl" href="https://www.spensiones.cl/portal/institucional/594/articles-11315_nt_432_compendiado.pdf" target="_blank" download>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>PDF</a></div>
    </div>
  </div>
</div>

<footer>
  <p class="footer-note">Datos NCG extraídos de <a href="https://www.spensiones.cl" target="_blank">spensiones.cl</a>. Leyes desde <a href="https://www.leychile.cl" target="_blank">leychile.cl</a>. PDFs descargados directamente desde los servidores de la SP.</p>
  <span style="font-size:.7rem;color:var(--muted)">v4.0 · ${fechaCache} · ${totalNCGs} NCGs (última: N°${maxNum})</span>
</footer>

<script>
const RAW = ${JSON.stringify(ncgData)};
const SIXTY_DAYS = 60*24*60*60*1000;
let allNCGs = RAW.sort((a,b) => b.num - a.num);
let filtered = [...allNCGs];
let currentPage = 1;
const PER_PAGE = 25;
let activeYear = 'all';
let searchTerm = '';

function ncgPdfUrl(num) {
  return \`https://www.spensiones.cl/apps/GetFile.php?id=003&namefile=NCG-SP%2FNP\${String(num).padStart(7,'0')}.pdf\`;
}

function applyFilters() {
  filtered = allNCGs.filter(n => {
    const ym = activeYear==='all' ? true : activeYear==='old' ? n.year<${recentYears[recentYears.length - 1] || 2023} : n.year===parseInt(activeYear);
    const sm = !searchTerm || n.mat.toLowerCase().includes(searchTerm) || n.numStr.includes(searchTerm);
    return ym && sm;
  });
  currentPage = 1;
  renderTable(); renderPagination();
  document.getElementById('count-msg').textContent = filtered.length + ' resultado' + (filtered.length===1?'':'s');
}

function renderTable() {
  const tbody = document.getElementById('ncg-tbody');
  if (!filtered.length) { tbody.innerHTML='<tr><td colspan="4"><div class="state-msg"><strong>Sin resultados</strong>Prueba con otros filtros o términos de búsqueda.</div></td></tr>'; return; }
  const page = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  const cutoff = Date.now()-SIXTY_DAYS;
  tbody.innerHTML = page.map(n => {
    const isNew = new Date(n.fecha+'T00:00:00').getTime() > cutoff;
    let fd = n.fecha;
    try { fd = new Date(n.fecha+'T00:00:00').toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}); } catch(e){}
    const mat = n.mat.length>200 ? n.mat.substring(0,197)+'…' : n.mat;
    return \`<tr>
      <td class="td-num">\${n.numStr}\${isNew?'<span class="badge-new">nuevo</span>':''}</td>
      <td class="td-date">\${fd}</td>
      <td class="td-mat">\${mat}</td>
      <td class="td-act"><a href="\${ncgPdfUrl(n.num)}" target="_blank" rel="noopener" download>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>PDF
      </a></td>
    </tr>\`;
  }).join('');
}

function renderPagination() {
  const total = Math.ceil(filtered.length/PER_PAGE);
  const pg = document.getElementById('pagination');
  if (total<=1) { pg.innerHTML=''; return; }
  let h = \`<span class="page-info">Página \${currentPage} de \${total}</span>\`;
  h += \`<button class="page-btn" id="pg-prev" \${currentPage===1?'disabled':''}>← Ant.</button>\`;
  for (let i=1;i<=total;i++) {
    if (i===1||i===total||(i>=currentPage-2&&i<=currentPage+2)) h+=\`<button class="page-btn \${i===currentPage?'active':''}" data-page="\${i}">\${i}</button>\`;
    else if (i===currentPage-3||i===currentPage+3) h+=\`<span style="color:var(--muted);font-size:.8rem;padding:0 .2rem">…</span>\`;
  }
  h += \`<button class="page-btn" id="pg-next" \${currentPage===total?'disabled':''}>Sig. →</button>\`;
  pg.innerHTML = h;
  pg.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{currentPage=+b.dataset.page;renderTable();renderPagination();}));
  const prev=pg.querySelector('#pg-prev'); if(prev) prev.addEventListener('click',()=>{currentPage--;renderTable();renderPagination();});
  const next=pg.querySelector('#pg-next'); if(next) next.addEventListener('click',()=>{currentPage++;renderTable();renderPagination();});
}

document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); document.getElementById('panel-'+b.dataset.tab).classList.add('active');
}));

document.querySelectorAll('[data-year]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-year]').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); activeYear=b.dataset.year; applyFilters();
}));

let sd;
document.getElementById('ncg-search').addEventListener('input',e=>{
  clearTimeout(sd); sd=setTimeout(()=>{searchTerm=e.target.value.toLowerCase().trim();applyFilters();},250);
});

applyFilters();
</script>
</body>
</html>`;

  await writeFile(join(PAGES, 'normativa.html'), html, 'utf8');
  // También actualizar index.html local como copia de respaldo
  await writeFile(join(ROOT, 'index.html'), html, 'utf8');
  const size = (html.length / 1024).toFixed(1);
  console.log(`  [build] ✓ pages/normativa.html generado (${size} KB, ${totalNCGs} NCGs)`);
}

// Ejecución directa
if (process.argv[1].endsWith('build.js')) {
  await build();
}
