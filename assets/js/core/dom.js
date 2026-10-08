// Montagem de HTML segura: todo valor interpolado é escapado automaticamente.
// Use html`...${valor}...` — nunca concatene dado de usuário em innerHTML.
export class Seguro {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"'`]/g, (c) => MAPA[c]);

function render(v) {
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Seguro(out);
}
/** Apenas para conteúdo FIXO do próprio código (ícones SVG). Nunca para dado de usuário. */
export const confiavel = (s) => new Seguro(String(s));
export function montar(el, conteudo) { el.innerHTML = render(conteudo); return el; }

/** Só permite links http(s), mailto e tel. */
export function urlSegura(u) {
  try {
    const url = new URL(String(u), location.href);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : '#';
  } catch { return '#'; }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegação de eventos: <button data-act="salvar" data-id="..."> → acoes.salvar(el, evento) */
export function delegar(root, tipo, acoes) {
  const h = (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = acoes[el.dataset.act];
    if (fn) { if (tipo === 'click' || tipo === 'submit') e.preventDefault(); fn(el, e); }
  };
  root.addEventListener(tipo, h);
  return () => root.removeEventListener(tipo, h);
}

export const fmtData = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '—');
export const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const hojeIso = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
/** Adia a execução; flush() executa já a chamada pendente (com os últimos argumentos), se houver. */
export function debounce(fn, ms) {
  let t = null, ultimos = [];
  const f = (...a) => { ultimos = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...ultimos); }, ms); };
  f.flush = () => { if (t === null) return fn.length ? undefined : fn(); clearTimeout(t); t = null; return fn(...ultimos); };
  f.cancel = () => { clearTimeout(t); t = null; };
  return f;
}
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const nomeArquivo = (s) => String(s || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

export function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/** Carrega script clássico sob demanda (bibliotecas pesadas só quando necessárias). */
const carregados = new Map();
export function carregarScript(src) {
  if (!carregados.has(src)) {
    carregados.set(src, new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => { carregados.delete(src); falha(new Error('Não foi possível carregar um componente do portal. Verifique a conexão e tente novamente.')); };
      document.head.appendChild(s);
    }));
  }
  return carregados.get(src);
}

/** Imprime (ou salva em PDF pelo navegador) somente o documento informado. */
export function imprimirDocumento(docEl, nomeArquivo) {
  let area = document.getElementById('impressao');
  if (!area) { area = document.createElement('div'); area.id = 'impressao'; document.body.appendChild(area); }
  // Tabela de impressão: o <thead> (logo ELOGA + título) se repete no topo de cada página.
  const titulo1 = [...(docEl.querySelector('.cover h1')?.childNodes || [])].map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const rodape = [...(docEl.querySelector('.foot')?.children || [])].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('  ·  ');
  const tab = document.createElement('table'); tab.className = 'impr-tab';
  const cab = document.createElement('div'); cab.className = 'impr-cab';
  const logo = document.createElement('img'); logo.src = 'assets/img/eloga-marca-escura.png'; logo.alt = 'ELOGA';
  const info = document.createElement('span'); info.textContent = ['Consultoria & Estratégias em Saúde', titulo1].filter(Boolean).join(' · ');
  cab.append(logo, info);
  const linha = (tag, filho) => { const sec = document.createElement(tag), tr = document.createElement('tr'), td = document.createElement('td'); td.append(filho); tr.append(td); sec.append(tr); return sec; };
  tab.append(linha('thead', cab), linha('tbody', docEl.cloneNode(true)));
  // Rodapé de cada página (texto do documento + número da página), na margem da folha
  const estilo = document.createElement('style');
  const css = (t) => '"' + t.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  if (rodape) estilo.textContent = `@media print{@page{@bottom-left{content:${css(rodape)}}}}`;
  area.replaceChildren(estilo, tab);
  area.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
  area.querySelectorAll('.fora, .sel-item, .no-print').forEach((x) => x.remove());
  const titulo = document.title;
  document.title = nomeArquivo; // vira o nome sugerido do PDF
  document.body.classList.add('imprimindo');
  const fim = () => { document.body.classList.remove('imprimindo'); document.title = titulo; area.replaceChildren(); removeEventListener('afterprint', fim); };
  addEventListener('afterprint', fim);
  // espera a logo carregar antes de abrir a impressão
  const pronto = logo.complete ? Promise.resolve() : new Promise((ok) => { logo.onload = logo.onerror = ok; setTimeout(ok, 1500); });
  pronto.then(() => setTimeout(() => window.print(), 50));
}
