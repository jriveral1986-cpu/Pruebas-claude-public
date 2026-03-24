/**
 * build.js — Genera pages/normativa.html integrada en el proyecto principal.
 * Usa ../css/main.css, mismo nav, header-bar e informe-header que las demás páginas.
 *
 * Uso:  node scripts/build.js
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const DATA  = join(ROOT, 'data');
const PAGES = join(ROOT, 'pages');

export async function build() {
  const ncgData = JSON.parse(await readFile(join(DATA, 'ncg.json'), 'utf8'));
  const meta    = JSON.parse(await readFile(join(DATA, 'ncg_meta.json'), 'utf8'));

  const fechaCache = meta.last_updated.substring(0, 10);
  const totalNCGs  = ncgData.length;
  const maxNum     = meta.max_num;

  const years       = [...new Set(ncgData.map(r => r.year))].sort((a, b) => b - a);
  const recentYears = years.filter(y => y >= new Date().getFullYear() - 3);
  const oldCutoff   = recentYears[recentYears.length - 1] || 2023;

  const yearBtns = [
    '<button class="ncg-filter active" data-year="all">Todos</button>',
    ...recentYears.map(y => `<button class="ncg-filter" data-year="${y}">${y}</button>`),
    '<button class="ncg-filter" data-year="old">Anteriores</button>',
  ].join('\n        ');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Normativa — Calculadora Previsional Chile</title>
  <link rel="stylesheet" href="../css/main.css">
  <link rel="stylesheet" href="../css/print.css" media="print">
  <style>
    /* ── Tabs ── */
    .ncg-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--color-border); margin-bottom: 24px; }
    .ncg-tab  { background: none; border: none; border-bottom: 3px solid transparent; margin-bottom: -2px;
                padding: 10px 20px; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted);
                cursor: pointer; transition: all .2s; }
    .ncg-tab.active { color: var(--color-primary); border-bottom-color: var(--accent); }
    .ncg-panel { display: none; }
    .ncg-panel.active { display: block; }

    /* ── Toolbar ── */
    .ncg-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
                   justify-content: space-between; margin-bottom: 16px; }
    .ncg-toolbar-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ncg-filter-label { font-size: var(--text-xs); font-weight: 600; letter-spacing: .08em;
                        text-transform: uppercase; color: var(--color-text-muted); }
    .ncg-filter { background: none; border: 1.5px solid var(--color-border); color: var(--color-text-muted);
                  font-size: var(--text-xs); font-weight: 600; padding: 4px 12px; border-radius: 4px;
                  cursor: pointer; transition: all .15s; }
    .ncg-filter:hover, .ncg-filter.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    .ncg-search { border: none; border-bottom: 2px solid var(--color-border); background: transparent;
                  font-size: var(--text-sm); color: var(--color-text); padding: 6px 0; outline: none;
                  transition: border-color .2s; min-width: 220px; }
    .ncg-search::placeholder { color: var(--color-text-muted); }
    .ncg-search:focus { border-color: var(--accent); }

    /* ── Estado ── */
    .ncg-status { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 12px;
                  display: flex; gap: 16px; align-items: center; }
    .dot-ok { display: inline-block; width: 7px; height: 7px; border-radius: 50%;
               background: var(--success); margin-right: 4px; }

    /* ── Tabla NCG ── */
    .ncg-table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 6px; }
    .ncg-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .ncg-table thead { background: var(--color-primary); color: #fff; }
    .ncg-table thead th { padding: 10px 14px; text-align: left; font-weight: 600;
                          font-size: var(--text-xs); letter-spacing: .08em; text-transform: uppercase; }
    .ncg-table tbody tr { border-bottom: 1px solid var(--color-border); transition: background .1s; }
    .ncg-table tbody tr:last-child { border-bottom: none; }
    .ncg-table tbody tr:hover { background: #fff; }
    .ncg-table td { padding: 10px 14px; vertical-align: top; }
    .ncg-num  { font-weight: 700; white-space: nowrap; color: var(--color-primary); }
    .ncg-date { color: var(--color-text-muted); white-space: nowrap; font-size: var(--text-xs); }
    .ncg-mat  { line-height: 1.55; color: var(--color-text); }
    .badge-new { display: inline-block; background: var(--accent); color: #fff; font-size: .6rem;
                 font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
                 padding: 1px 5px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
    .ncg-pdf a { display: inline-flex; align-items: center; gap: 4px; background: var(--color-primary);
                 color: #fff; text-decoration: none; font-size: var(--text-xs); font-weight: 600;
                 letter-spacing: .06em; text-transform: uppercase; padding: 4px 10px; border-radius: 4px;
                 white-space: nowrap; transition: background .15s; }
    .ncg-pdf a:hover { background: var(--accent); }
    .ncg-empty { padding: 40px; text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); }

    /* ── Paginación ── */
    .ncg-pagination { margin-top: 12px; display: flex; gap: 4px; align-items: center;
                      justify-content: flex-end; flex-wrap: wrap; }
    .pg-btn { background: none; border: 1.5px solid var(--color-border); color: var(--color-text-muted);
              font-size: var(--text-xs); padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all .15s; }
    .pg-btn.active, .pg-btn:hover { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    .pg-btn:disabled { opacity: .4; cursor: not-allowed; }
    .pg-info { font-size: var(--text-xs); color: var(--color-text-muted); margin-right: auto; }

    /* ── Leyes grid ── */
    .laws-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .law-card  { background: #fff; border: 1px solid var(--color-border); border-radius: 8px;
                 padding: 20px; display: flex; flex-direction: column; gap: 8px;
                 transition: box-shadow .2s, border-color .2s; position: relative; }
    .law-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); border-color: var(--color-primary-lt); }
    .law-year  { position: absolute; top: 16px; right: 16px; font-size: 1.4rem; font-weight: 900;
                 color: var(--color-border); line-height: 1; }
    .law-tag   { display: inline-flex; align-items: center; gap: 4px; font-size: .68rem; font-weight: 600;
                 letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; width: fit-content; }
    .tag-ley { background: #fdecea; color: #b91c1c; }
    .tag-tec { background: #edfdf5; color: #0d7a4e; }
    .tag-cmp { background: #fdf3e3; color: #b8660a; }
    .law-title { font-size: var(--text-base); font-weight: 700; line-height: 1.3;
                 color: var(--color-primary); padding-right: 36px; }
    .law-code  { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); }
    .law-desc  { font-size: var(--text-sm); line-height: 1.65; color: var(--color-text); flex: 1; }
    .law-footer { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .law-source { font-size: var(--text-xs); color: var(--color-text-muted); }
    .btn-law-web { background: none; border: 1.5px solid var(--color-border); color: var(--color-text-muted);
                   text-decoration: none; font-size: var(--text-xs); font-weight: 600; padding: 5px 12px;
                   border-radius: 4px; transition: all .15s; white-space: nowrap; }
    .btn-law-web:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .btn-law-dl { display: inline-flex; align-items: center; gap: 4px; background: var(--color-primary);
                  color: #fff; text-decoration: none; font-size: var(--text-xs); font-weight: 600;
                  letter-spacing: .06em; text-transform: uppercase; padding: 5px 12px; border-radius: 4px;
                  transition: all .15s; white-space: nowrap; }
    .btn-law-dl:hover { background: var(--accent); }

    /* ── Link SP externo ── */
    .btn-sp { display: inline-flex; align-items: center; gap: 6px; background: var(--color-primary-lt);
              color: #fff; text-decoration: none; font-size: var(--text-xs); font-weight: 600;
              letter-spacing: .06em; text-transform: uppercase; padding: 6px 14px; border-radius: 4px;
              transition: background .2s; }
    .btn-sp:hover { background: var(--color-primary); }

    @media (max-width: 640px) {
      .ncg-toolbar { flex-direction: column; align-items: flex-start; }
      .laws-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <a href="#main-content" class="skip-link">Ir al contenido principal</a>

  <nav class="nav" aria-label="Navegación principal">
    <a href="../index.html" class="nav__logo">Previsión<span>Chile</span></a>
    <a href="../index.html"           class="nav__link">Inicio</a>
    <a href="datos.html"              class="nav__link">Mis Datos</a>
    <a href="proyeccion.html"         class="nav__link">Proyección</a>
    <a href="modalidades.html"        class="nav__link">Modalidades</a>
    <a href="brechas.html"            class="nav__link">Brechas</a>
    <a href="normativa.html"          class="nav__link">Normativa</a>
  </nav>

  <div class="header-bar">
    <button id="btnActualizar" class="btn-actualizar" aria-label="Actualizar indicadores económicos">Actualizar</button>
    <span   id="infoAct"       class="info-act"></span>
  </div>

  <main class="container" id="main-content">

    <!-- ── Informe header ── -->
    <div class="informe-header">
      <div>
        <div class="informe-logo">Previsión<span style="color:var(--accent)">Chile</span></div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:4px;">Normativa Previsional</div>
      </div>
      <table class="informe-datos-cliente">
        <tr><th>Fuente</th><td>spensiones.cl · LeyChile</td></tr>
        <tr><th>Registros</th><td>${totalNCGs} NCGs</td></tr>
        <tr><th>Última NCG</th><td>N°${maxNum}</td></tr>
        <tr><th>Caché</th><td>${fechaCache}</td></tr>
      </table>
      <div class="informe-fecha-eval">
        Datos al:<br><strong>${fechaCache}</strong>
      </div>
    </div>

    <h1 class="page-title">Normativa Previsional</h1>
    <p class="page-subtitle">Normas de Carácter General (NCG), leyes y documentos técnicos del sistema previsional chileno. Fuente: Superintendencia de Pensiones.</p>

    <div class="section">

      <!-- Tabs -->
      <div class="ncg-tabs" role="tablist">
        <button class="ncg-tab active" data-tab="ncg"   role="tab" aria-selected="true">NCG (${totalNCGs})</button>
        <button class="ncg-tab"        data-tab="leyes" role="tab" aria-selected="false">Leyes &amp; Documentos</button>
      </div>

      <!-- Panel NCG -->
      <div class="ncg-panel active" id="panel-ncg" role="tabpanel">

        <div class="ncg-toolbar">
          <div class="ncg-toolbar-left">
            <span class="ncg-filter-label">Año:</span>
            ${yearBtns}
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input class="ncg-search" type="search" id="ncg-search" placeholder="Buscar materia o N°…" aria-label="Buscar NCG">
            <a class="btn-sp" href="https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-5937.html" target="_blank" rel="noopener">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.7 8A5.7 5.7 0 1 1 8 2.3c1.7 0 3.2.7 4.3 1.8L14 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2.5V6h-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Ver en SP
            </a>
          </div>
        </div>

        <div class="ncg-status">
          <span><span class="dot-ok" aria-hidden="true"></span>${totalNCGs} NCGs · caché ${fechaCache}</span>
          <span id="count-msg" aria-live="polite"></span>
        </div>

        <div class="ncg-table-wrap">
          <table class="ncg-table" aria-label="Normas de Carácter General">
            <thead>
              <tr>
                <th style="width:80px">N°</th>
                <th style="width:110px">Fecha</th>
                <th>Materia</th>
                <th style="width:80px">PDF</th>
              </tr>
            </thead>
            <tbody id="ncg-tbody"></tbody>
          </table>
        </div>
        <div class="ncg-pagination" id="ncg-pagination" aria-label="Paginación"></div>
      </div>

      <!-- Panel Leyes -->
      <div class="ncg-panel" id="panel-leyes" role="tabpanel">
        <div class="laws-grid">

          <div class="law-card">
            <div class="law-year" aria-hidden="true">1980</div>
            <span class="law-tag tag-ley">Ley</span>
            <div class="law-title">D.L. 3.500 — Sistema de AFP y Fondos de Pensiones</div>
            <div class="law-code">Decreto Ley N° 3.500 · 1980</div>
            <div class="law-desc">Cuerpo legal fundacional del sistema previsional chileno. Crea las AFP, regula las cotizaciones obligatorias, los multifondos y las prestaciones de vejez, invalidez y sobrevivencia.</div>
            <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-law-web" href="https://www.leychile.cl/Navegar?idNorma=7147" target="_blank" rel="noopener">Ver en línea ↗</a></div>
          </div>

          <div class="law-card">
            <div class="law-year" aria-hidden="true">2008</div>
            <span class="law-tag tag-ley">Ley</span>
            <div class="law-title">Ley 20.255 — Reforma Previsional · Pilar Solidario</div>
            <div class="law-code">Ley N° 20.255 · 2008</div>
            <div class="law-desc">Crea el Pilar Solidario (PBS y APS), el bono por hijo nacido vivo, la pensión para independientes y el SCOMP (sistema de consulta de montos de pensión).</div>
            <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-law-web" href="https://www.leychile.cl/Navegar?idNorma=269892" target="_blank" rel="noopener">Ver en línea ↗</a></div>
          </div>

          <div class="law-card">
            <div class="law-year" aria-hidden="true">2022</div>
            <span class="law-tag tag-ley">Ley</span>
            <div class="law-title">Ley 21.419 — Cotizaciones Trabajadores Independientes</div>
            <div class="law-code">Ley N° 21.419 · 2022</div>
            <div class="law-desc">Moderniza la incorporación previsional de trabajadores con boleta de honorarios. Cotización obligatoria gradual del 17% y ajuste del mecanismo de retención en operación renta.</div>
            <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-law-web" href="https://www.leychile.cl/Navegar?idNorma=1167313" target="_blank" rel="noopener">Ver en línea ↗</a></div>
          </div>

          <div class="law-card">
            <div class="law-year" aria-hidden="true">2025</div>
            <span class="law-tag tag-ley">Ley</span>
            <div class="law-title">Ley 21.735 — Reforma de Pensiones 2025</div>
            <div class="law-code">Ley N° 21.735 · 2025</div>
            <div class="law-desc">Reforma estructural que crea un Seguro Social con cotización solidaria (6% empleador), aumenta la PGU, crea el FAPP y establece un sistema mixto de reparto y capitalización individual.</div>
            <div class="law-footer"><span class="law-source">LeyChile.cl</span><a class="btn-law-web" href="https://www.leychile.cl/Navegar?idNorma=1212067" target="_blank" rel="noopener">Ver en línea ↗</a></div>
          </div>

          <div class="law-card">
            <div class="law-year" aria-hidden="true">2025</div>
            <span class="law-tag tag-tec">Técnico</span>
            <div class="law-title">Nota Técnica — Reforma de Pensiones Ley 21.735</div>
            <div class="law-code">Ministerio de Previsión Social · 2025</div>
            <div class="law-desc">Análisis financiero y actuarial oficial de la Ley 21.735. Incluye proyecciones de beneficios, tasas de reemplazo y análisis del seguro social solidario.</div>
            <div class="law-footer">
              <span class="law-source">previsionsocial.gob.cl</span>
              <a class="btn-law-dl" href="https://previsionsocial.gob.cl/wp-content/uploads/2025/08/Nota-Tecnica-Reforma-de-Pensiones-Ley-N%C2%B021.735.pdf" target="_blank" rel="noopener" download>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>PDF
              </a>
            </div>
          </div>

          <div class="law-card">
            <div class="law-year" aria-hidden="true">SP</div>
            <span class="law-tag tag-cmp">Compendio</span>
            <div class="law-title">Compendio de Normas SP — Presentación Oficial</div>
            <div class="law-code">Superintendencia de Pensiones · NT 432</div>
            <div class="law-desc">Folleto oficial del Compendio de Normas SP. Resume la estructura, libros y finalidad del cuerpo normativo que regula el funcionamiento de las AFP y demás entidades previsionales.</div>
            <div class="law-footer">
              <span class="law-source">spensiones.cl</span>
              <a class="btn-law-dl" href="https://www.spensiones.cl/portal/institucional/594/articles-11315_nt_432_compendiado.pdf" target="_blank" rel="noopener" download>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>PDF
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>

  </main>

  <script type="module">
    import { initBtnActualizar, marcarNavActiva } from '../js/ui.js';
    marcarNavActiva();
    initBtnActualizar();

    const RAW = ${JSON.stringify(ncgData)};
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    const PER_PAGE   = 25;
    const OLD_CUTOFF = ${oldCutoff};

    let allNCGs     = RAW.slice().sort((a, b) => b.num - a.num);
    let filtered    = [...allNCGs];
    let currentPage = 1;
    let activeYear  = 'all';
    let searchTerm  = '';

    function ncgPdfUrl(num) {
      return \`https://www.spensiones.cl/apps/GetFile.php?id=003&namefile=NCG-SP%2FNP\${String(num).padStart(7, '0')}.pdf\`;
    }

    function applyFilters() {
      filtered = allNCGs.filter(n => {
        const ym = activeYear === 'all' ? true
          : activeYear === 'old' ? n.year < OLD_CUTOFF
          : n.year === parseInt(activeYear);
        const sm = !searchTerm || n.mat.toLowerCase().includes(searchTerm) || n.numStr.includes(searchTerm);
        return ym && sm;
      });
      currentPage = 1;
      renderTable();
      renderPagination();
      document.getElementById('count-msg').textContent =
        filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's');
    }

    function renderTable() {
      const tbody  = document.getElementById('ncg-tbody');
      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="ncg-empty">Sin resultados — prueba con otros filtros.</div></td></tr>';
        return;
      }
      const page   = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
      const cutoff = Date.now() - SIXTY_DAYS;
      tbody.innerHTML = page.map(n => {
        const isNew = new Date(n.fecha + 'T00:00:00').getTime() > cutoff;
        let fd = n.fecha;
        try { fd = new Date(n.fecha + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) {}
        const mat = n.mat.length > 200 ? n.mat.substring(0, 197) + '…' : n.mat;
        return \`<tr>
          <td class="ncg-num">\${n.numStr}\${isNew ? '<span class="badge-new">nuevo</span>' : ''}</td>
          <td class="ncg-date">\${fd}</td>
          <td class="ncg-mat">\${mat}</td>
          <td class="ncg-pdf"><a href="\${ncgPdfUrl(n.num)}" target="_blank" rel="noopener" download aria-label="Descargar PDF NCG \${n.numStr}">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>PDF
          </a></td>
        </tr>\`;
      }).join('');
    }

    function renderPagination() {
      const total = Math.ceil(filtered.length / PER_PAGE);
      const pg    = document.getElementById('ncg-pagination');
      if (total <= 1) { pg.innerHTML = ''; return; }
      let h = \`<span class="pg-info">Página \${currentPage} de \${total}</span>\`;
      h += \`<button class="pg-btn" id="pg-prev" \${currentPage === 1 ? 'disabled' : ''}>← Ant.</button>\`;
      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= currentPage - 2 && i <= currentPage + 2))
          h += \`<button class="pg-btn \${i === currentPage ? 'active' : ''}" data-page="\${i}">\${i}</button>\`;
        else if (i === currentPage - 3 || i === currentPage + 3)
          h += \`<span style="color:var(--color-text-muted);padding:0 4px">…</span>\`;
      }
      h += \`<button class="pg-btn" id="pg-next" \${currentPage === total ? 'disabled' : ''}>Sig. →</button>\`;
      pg.innerHTML = h;
      pg.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { currentPage = +b.dataset.page; renderTable(); renderPagination(); }));
      const prev = pg.querySelector('#pg-prev'); if (prev) prev.addEventListener('click', () => { currentPage--; renderTable(); renderPagination(); });
      const next = pg.querySelector('#pg-next'); if (next) next.addEventListener('click', () => { currentPage++; renderTable(); renderPagination(); });
    }

    // Tabs
    document.querySelectorAll('.ncg-tab').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.ncg-tab').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.ncg-panel').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); b.setAttribute('aria-selected', 'true');
      document.getElementById('panel-' + b.dataset.tab).classList.add('active');
    }));

    // Filtros año
    document.querySelectorAll('.ncg-filter').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.ncg-filter').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); activeYear = b.dataset.year; applyFilters();
    }));

    // Búsqueda
    let sd;
    document.getElementById('ncg-search').addEventListener('input', e => {
      clearTimeout(sd); sd = setTimeout(() => { searchTerm = e.target.value.toLowerCase().trim(); applyFilters(); }, 250);
    });

    applyFilters();
  </script>

</body>
</html>`;

  await writeFile(join(PAGES, 'normativa.html'), html, 'utf8');
  const size = (html.length / 1024).toFixed(1);
  console.log(`  [build] ✓ pages/normativa.html generado (${size} KB, ${totalNCGs} NCGs)`);
}

if (process.argv[1].endsWith('build.js')) {
  await build();
}
