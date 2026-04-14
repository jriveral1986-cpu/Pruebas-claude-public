/**
 * chat.js — Widget flotante "Previ" (Asesor Previsional IA)
 * Powered by Claude Haiku via Cloudflare Worker proxy.
 *
 * Importa PROXY_URL desde api.js (mismo Worker, distinto endpoint ?action=chat).
 * Incluye panel de Recursos Legales con links directos a PDFs oficiales.
 */

import { PROXY_URL } from './api.js';

const CHAT_URL  = `${PROXY_URL}?action=chat`;
const STORE_KEY = 'pension_chile_v1';

// ── Recursos legales ─────────────────────────────────────────────────────────
const RECURSOS = [
  {
    label: 'DL 3.500 (texto vigente)',
    url:   'https://www.bcn.cl/leychile/navegar?idNorma=6498',
    hint:  'Ley del sistema de AFP — BCN',
  },
  {
    label: 'Ley 21.419 (PGU)',
    url:   'https://www.bcn.cl/leychile/navegar?idNorma=1168237',
    hint:  'Pensión Garantizada Universal — BCN',
  },
  {
    label: 'NCGs Superintendencia',
    url:   'https://www.spensiones.cl/portal/orient/572/w3-propertyvalue-14782.html',
    hint:  'Normas de Carácter General vigentes',
  },
  {
    label: 'Circular 2407 — Tablas RV/RP',
    url:   'https://www.spensiones.cl/portal/institucional/594/articles-15614_recurso_1.pdf',
    hint:  'Tasas técnicas y tablas de mortalidad 2026',
  },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
#previ-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
}
#previ-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(79,70,229,0.4);
  transition: transform 150ms ease-in-out, box-shadow 150ms ease-in-out;
}
#previ-btn:hover  { transform: scale(1.08); box-shadow: 0 6px 20px rgba(79,70,229,0.5); }
#previ-btn:focus-visible { outline: 3px solid #a5b4fc; outline-offset: 3px; }

#previ-panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 370px;
  height: 530px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform-origin: bottom right;
  transition: opacity 200ms ease-in-out, transform 200ms ease-in-out;
}
#previ-panel[hidden] { display: none !important; }
#previ-panel.previ-entering { opacity: 0; transform: scale(0.93) translateY(10px); }
#previ-panel.previ-visible  { opacity: 1; transform: scale(1) translateY(0); }

/* Header */
#previ-header {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
}
#previ-header-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
#previ-avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
#previ-title    { font-weight: 700; font-size: 15px; line-height: 1.2; }
#previ-subtitle { font-size: 11px; opacity: 0.82; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.previ-header-actions { display: flex; gap: 6px; flex-shrink: 0; }
.previ-icon-btn {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.15);
  color: #fff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 150ms;
}
.previ-icon-btn:hover { background: rgba(255,255,255,0.28); }
.previ-icon-btn:focus-visible { outline: 2px solid rgba(255,255,255,0.6); }

/* Recursos panel */
#previ-recursos {
  background: #f8f7ff;
  border-bottom: 1px solid #e0e7ff;
  overflow: hidden;
  max-height: 0;
  transition: max-height 250ms ease-in-out;
}
#previ-recursos.open { max-height: 200px; }
#previ-recursos-inner { padding: 10px 14px 12px; }
#previ-recursos-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6366f1;
  margin-bottom: 8px;
}
.previ-recurso-link {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  text-decoration: none;
  color: #1e293b;
  border-bottom: 1px solid #ede9fe;
  transition: color 150ms;
}
.previ-recurso-link:last-child { border-bottom: none; }
.previ-recurso-link:hover { color: #4f46e5; }
.previ-recurso-name { font-size: 12.5px; font-weight: 600; line-height: 1.3; }
.previ-recurso-hint { font-size: 11px; color: #94a3b8; }
.previ-dl-icon { flex-shrink: 0; margin-top: 2px; color: #7c3aed; }

/* Messages */
#previ-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}
#previ-messages::-webkit-scrollbar { width: 4px; }
#previ-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

.previ-msg { display: flex; gap: 8px; max-width: 92%; }
.previ-msg--bot  { align-self: flex-start; }
.previ-msg--user { align-self: flex-end; flex-direction: row-reverse; }
.previ-bubble {
  padding: 9px 13px;
  border-radius: 14px;
  line-height: 1.55;
  font-size: 13.5px;
}
.previ-msg--bot  .previ-bubble { background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }
.previ-msg--user .previ-bubble { background: linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border-bottom-right-radius: 4px; }

/* Typing */
.previ-typing { display: flex; gap: 4px; padding: 11px 13px; }
.previ-typing span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: previ-bounce 1.2s infinite ease-in-out;
}
.previ-typing span:nth-child(2) { animation-delay: 0.2s; }
.previ-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes previ-bounce {
  0%,80%,100% { transform: translateY(0); }
  40%         { transform: translateY(-6px); }
}

/* Quick suggestions */
#previ-suggestions {
  padding: 0 14px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}
.previ-chip {
  font-size: 11.5px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1.5px solid #e0e7ff;
  background: #f5f3ff;
  color: #4f46e5;
  cursor: pointer;
  transition: background 150ms, border-color 150ms;
  white-space: nowrap;
}
.previ-chip:hover { background: #ede9fe; border-color: #a5b4fc; }

/* Input area */
#previ-input-area {
  padding: 10px 14px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  background: #fff;
}
#previ-input {
  flex: 1;
  border: 1.5px solid #e2e8f0;
  border-radius: 24px;
  padding: 8px 13px;
  font-size: 13.5px;
  outline: none;
  transition: border-color 150ms;
  font-family: inherit;
}
#previ-input:focus   { border-color: #6366f1; }
#previ-input::placeholder { color: #94a3b8; }
#previ-input:disabled { background: #f8fafc; }
#previ-send {
  width: 40px; height: 40px; min-width: 40px;
  border-radius: 50%;
  border: none;
  background: #4f46e5;
  color: #fff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 150ms, transform 150ms;
  flex-shrink: 0;
}
#previ-send:hover    { background: #4338ca; transform: scale(1.05); }
#previ-send:disabled { background: #c7d2fe; cursor: not-allowed; transform: none; }
#previ-send:focus-visible { outline: 3px solid #a5b4fc; }

/* Error */
.previ-error { padding: 8px 13px; background: #fef2f2; color: #b91c1c; border-radius: 8px; font-size: 12.5px; }

/* Responsive */
@media (max-width: 420px) {
  #previ-widget { bottom: 16px; right: 16px; }
  #previ-panel  { width: calc(100vw - 32px); height: 72vh; }
}
@media (prefers-reduced-motion: reduce) {
  #previ-btn, #previ-panel, .previ-typing span, #previ-recursos {
    animation: none !important; transition: none !important;
  }
}
`;

// ── State ─────────────────────────────────────────────────────────────────────
let history    = [];  // { role: 'user'|'assistant', content: string }[]
let isOpen     = false;
let sending    = false;
let recursosOpen = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
  catch { return {}; }
}

function buildContext() {
  const d = readStore();
  return {
    afp:             d.afp,
    fondo:           d.fondo,
    edad:            d.edad,
    sexo:            d.sexo,
    saldoTotal:      d.saldoTotal,
    edadJubilacion:  d.edadJubilacion,
    saldoAPV:        d.saldoAPV   || 0,
    saldoDC:         d.saldoDC    || 0,
    rentaImponible:  d.rentaImponible  || 0,
    pensionObjetivo: d.pensionObjetivo || 0,
  };
}

/** Minimal markdown → HTML (no external deps). */
function md(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:underline;">$1</a>')
    .replace(/\n/g, '<br>');
}

// ── DOM references (set after build) ─────────────────────────────────────────
let messagesDiv, inputEl, sendBtn, suggestionsDiv, recursosDiv;

// ── Build widget ──────────────────────────────────────────────────────────────
function buildWidget() {
  if (document.getElementById('previ-widget')) return; // already mounted

  // Inject CSS
  const style = document.createElement('style');
  style.id = 'previ-chat-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  const widget = document.createElement('div');
  widget.id = 'previ-widget';

  // ── Toggle button ──
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'previ-btn';
  toggleBtn.setAttribute('aria-label', 'Abrir asesor previsional IA Previ');
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', 'previ-panel');
  toggleBtn.innerHTML = chatIconSVG();
  toggleBtn.addEventListener('click', toggleWidget);

  // ── Panel ──
  const panel = document.createElement('div');
  panel.id = 'previ-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat con Previ — Asesor Previsional IA');
  panel.setAttribute('aria-modal', 'true');
  panel.hidden = true;

  // Header
  const header = document.createElement('div');
  header.id = 'previ-header';
  header.innerHTML = `
    <div id="previ-header-info">
      <div id="previ-avatar" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div>
        <div id="previ-title">Previ</div>
        <div id="previ-subtitle">Asesor Previsional · Claude Haiku</div>
      </div>
    </div>
    <div class="previ-header-actions">
      <button class="previ-icon-btn" id="previ-recursos-btn" aria-label="Ver recursos legales" title="Leyes y normativa">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </button>
      <button class="previ-icon-btn" id="previ-close" aria-label="Cerrar chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
  header.querySelector('#previ-close').addEventListener('click', toggleWidget);
  header.querySelector('#previ-recursos-btn').addEventListener('click', toggleRecursos);

  // Recursos panel
  recursosDiv = document.createElement('div');
  recursosDiv.id = 'previ-recursos';
  const recursosInner = document.createElement('div');
  recursosInner.id = 'previ-recursos-inner';
  recursosInner.innerHTML = `<div id="previ-recursos-title">Documentos oficiales</div>` +
    RECURSOS.map(r => `
      <a class="previ-recurso-link" href="${r.url}" target="_blank" rel="noopener noreferrer">
        <svg class="previ-dl-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <div>
          <div class="previ-recurso-name">${r.label}</div>
          <div class="previ-recurso-hint">${r.hint}</div>
        </div>
      </a>
    `).join('');
  recursosDiv.appendChild(recursosInner);

  // Messages area
  messagesDiv = document.createElement('div');
  messagesDiv.id = 'previ-messages';
  messagesDiv.setAttribute('role', 'log');
  messagesDiv.setAttribute('aria-live', 'polite');
  messagesDiv.setAttribute('aria-label', 'Conversación con Previ');

  // Welcome message
  addBotMessage(
    'Hola! Soy **Previ**, tu asesor previsional IA. Puedo responder tus dudas sobre AFP, pensiones, APV, PGU y el sistema chileno (DL 3.500).\n\nTambién puedes descargar las leyes y normativa usando el botón de documentos en la parte superior.',
    false
  );

  // Quick suggestions
  suggestionsDiv = document.createElement('div');
  suggestionsDiv.id = 'previ-suggestions';
  const chips = [
    '¿Qué es la PGU?',
    'Diferencia RP vs RV',
    '¿Cómo funciona el APV?',
    '¿Qué es el ELD?',
  ];
  chips.forEach(text => {
    const chip = document.createElement('button');
    chip.className = 'previ-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      suggestionsDiv.style.display = 'none';
      inputEl.value = text;
      sendMessage();
    });
    suggestionsDiv.appendChild(chip);
  });

  // Input area
  const inputArea = document.createElement('div');
  inputArea.id = 'previ-input-area';
  inputEl = document.createElement('input');
  inputEl.id = 'previ-input';
  inputEl.type = 'text';
  inputEl.placeholder = 'Escribe tu pregunta…';
  inputEl.setAttribute('aria-label', 'Mensaje para Previ');
  inputEl.maxLength = 500;
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  sendBtn = document.createElement('button');
  sendBtn.id = 'previ-send';
  sendBtn.setAttribute('aria-label', 'Enviar mensaje');
  sendBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  sendBtn.addEventListener('click', sendMessage);

  inputArea.append(inputEl, sendBtn);
  panel.append(header, recursosDiv, messagesDiv, suggestionsDiv, inputArea);
  widget.append(toggleBtn, panel);
  document.body.appendChild(widget);
}

function chatIconSVG() {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
}
function closeIconSVG() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

// ── Toggle open/close ─────────────────────────────────────────────────────────
function toggleWidget() {
  isOpen = !isOpen;
  const panel     = document.getElementById('previ-panel');
  const toggleBtn = document.getElementById('previ-btn');

  if (isOpen) {
    panel.hidden = false;
    panel.classList.add('previ-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.classList.remove('previ-entering');
      panel.classList.add('previ-visible');
    }));
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.innerHTML = closeIconSVG();
    setTimeout(() => inputEl?.focus(), 260);
  } else {
    panel.classList.remove('previ-visible');
    panel.classList.add('previ-entering');
    setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove('previ-entering');
    }, 210);
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.innerHTML = chatIconSVG();
  }
}

function toggleRecursos() {
  recursosOpen = !recursosOpen;
  recursosDiv.classList.toggle('open', recursosOpen);
  document.getElementById('previ-recursos-btn')
    .setAttribute('aria-expanded', String(recursosOpen));
}

// ── Message rendering ─────────────────────────────────────────────────────────
function addBotMessage(text, pushHistory = true) {
  if (pushHistory) history.push({ role: 'assistant', content: text });
  const wrap   = document.createElement('div');
  wrap.className = 'previ-msg previ-msg--bot';
  const bubble = document.createElement('div');
  bubble.className = 'previ-bubble';
  bubble.innerHTML = md(text);
  wrap.appendChild(bubble);
  messagesDiv.appendChild(wrap);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return wrap;
}

function addUserMessage(text) {
  history.push({ role: 'user', content: text });
  const wrap   = document.createElement('div');
  wrap.className = 'previ-msg previ-msg--user';
  const bubble = document.createElement('div');
  bubble.className = 'previ-bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messagesDiv.appendChild(wrap);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addTypingIndicator() {
  const wrap   = document.createElement('div');
  wrap.className = 'previ-msg previ-msg--bot';
  const bubble = document.createElement('div');
  bubble.className = 'previ-bubble previ-typing';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  wrap.appendChild(bubble);
  messagesDiv.appendChild(wrap);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return wrap;
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  if (sending) return;
  const text = inputEl.value.trim();
  if (!text) return;

  // Hide quick chips after first message
  if (suggestionsDiv) suggestionsDiv.style.display = 'none';

  inputEl.value = '';
  addUserMessage(text);

  sending = true;
  sendBtn.disabled = true;
  inputEl.disabled = true;

  const typingEl = addTypingIndicator();

  try {
    const context = buildContext();
    // Cap history at 10 messages to keep tokens reasonable
    const recentMessages = history.slice(-10);

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: recentMessages, context }),
      signal: AbortSignal.timeout(30000),
    });

    typingEl.remove();

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `Error HTTP ${resp.status}` }));
      const msg = (err.error || '').includes('no configurado')
        ? 'El chat IA no está habilitado en esta instalación.\n\nPara activarlo, configura `ANTHROPIC_API_KEY` como secret del Cloudflare Worker y redespliega con `wrangler deploy`.'
        : `No pude conectarme con el servidor. Intenta de nuevo.\n_(${err.error ?? resp.status})_`;
      addBotMessage(msg);
    } else {
      const data = await resp.json();
      addBotMessage(data.respuesta || 'Sin respuesta del servidor.');
    }
  } catch (err) {
    typingEl.remove();
    const msg = err.name === 'TimeoutError'
      ? 'La consulta tardó demasiado. Por favor intenta de nuevo.'
      : err.name === 'TypeError'
        ? 'No se pudo conectar. Verifica tu conexión o la configuración del Worker.'
        : 'Ocurrió un error inesperado. Intenta de nuevo.';
    addBotMessage(msg);
  } finally {
    sending = false;
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

// ── Auto-init ─────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildWidget);
} else {
  buildWidget();
}
