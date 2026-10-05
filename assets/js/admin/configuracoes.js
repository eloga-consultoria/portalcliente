// PROGRAMAS E PREÇOS: catálogo usado na proposta, editável pela administração e salvo no banco.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, $$ } from '../core/dom.js';
import { avisar, avisarErro, confirmar, ocupado } from '../core/ui.js';
import { CATALOG, CATALOGO_PADRAO, FRONT_KEYS, FORMATOS_BASE, COBRANCA_FORMATO, aplicarCatalogo } from './operacional-modelo.js';
import { carregarCatalogo } from './catalogo.js';

const linhas = (a) => (a || []).join('\n');
const deLinhas = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

export async function render(el) {
  await carregarCatalogo(true);
  let cat = JSON.parse(JSON.stringify(CATALOG));
  const ctl = new AbortController();

  const desenhar = () => montar(el, html`<div class="wrap" style="max-width:1080px">
    <div class="page-head"><div><span class="eyebrow">Configurações</span><h1>Programas e preços</h1>
      <p>O que você salvar aqui passa a valer nas próximas propostas. Propostas já emitidas não mudam.</p></div>
      <div class="toolbar"><button class="btn ghost" type="button" data-acao="padrao">Restaurar padrão</button><button class="btn primary" type="button" data-acao="salvar">Salvar catálogo</button></div></div>

    <div class="card" style="margin-bottom:16px"><div class="card-head"><div><h2>Programas</h2><p>Formatos oferecidos na proposta.</p></div>
      <button class="btn sm purple" type="button" data-acao="novo">+ Novo programa</button></div>
      <div class="stack">${Object.entries(cat.formats).map(([k, f]) => html`<div class="opt-editor" data-formato="${k}">
        <div class="row between"><h4 style="margin:0">${f.name || 'Novo programa'}</h4>
          ${FORMATOS_BASE.includes(k) ? html`<span class="badge">usado na recomendação automática</span>` : html`<button class="btn sm danger" type="button" data-remover="${k}">Remover</button>`}</div>
        <div class="grid g4" style="margin-top:10px">
          <div class="field span-2"><label>Nome</label><input data-f="name" value="${f.name}"></div>
          <div class="field"><label>Cobrança</label><select data-f="cobranca">${Object.entries(COBRANCA_FORMATO).map(([v, t]) => html`<option value="${v}" ${f.cobranca === v ? html`selected` : ''}>${t}</option>`)}</select></div>
          <div class="field"><label>Valor (R$)</label><input type="number" min="0" data-f="price" value="${f.price ?? ''}" placeholder="${f.cobranca === 'soma_frentes' ? 'definido por frente' : ''}" ${f.cobranca === 'soma_frentes' ? html`disabled` : ''}></div>
          <div class="field span-2"><label>Descrição curta</label><input data-f="desc" value="${f.desc}"></div>
          <div class="field span-2"><label>Observação no preço (opcional)</label><input data-f="nota" value="${f.nota || ''}" placeholder="ex.: abatido do programa se contratado em até 30 dias"></div>
          <div class="field" style="grid-column:1/-1"><label>O que inclui (um item por linha)</label><textarea rows="4" data-f="items">${linhas(f.items)}</textarea></div>
        </div></div>`)}</div></div>

    <div class="card" style="margin-bottom:16px"><div class="card-head"><div><h2>Frentes de atuação</h2><p>Escopo, entregas, indicadores e mensalidade de referência de cada frente.</p></div></div>
      <div class="stack">${FRONT_KEYS.map((k) => { const fr = cat.fronts[k]; return html`<details class="opt-editor" data-frente="${k}"><summary style="cursor:pointer"><b>${fr.name}</b> <span class="xs muted">· mensal R$ ${Number(fr.monthly || 0).toLocaleString('pt-BR')}</span></summary>
        <div class="grid g3" style="margin-top:10px">
          <div class="field"><label>Nome</label><input data-f="name" value="${fr.name}"></div>
          <div class="field"><label>Mensalidade de referência (R$)</label><input type="number" min="0" data-f="monthly" value="${fr.monthly}"></div>
          <div class="field"><label>Observação do preço</label><input data-f="monthlyNote" value="${fr.monthlyNote || ''}"></div>
          <div class="field" style="grid-column:1/-1"><label>Pré-requisito de dados</label><input data-f="prereq" value="${fr.prereq || ''}"></div>
          <div class="field"><label>O que será trabalhado</label><textarea rows="6" data-f="modules">${linhas(fr.modules)}</textarea></div>
          <div class="field"><label>O que a clínica recebe</label><textarea rows="6" data-f="deliverables">${linhas(fr.deliverables)}</textarea></div>
          <div class="field"><label>Indicadores</label><textarea rows="6" data-f="kpis">${linhas(fr.kpis)}</textarea></div>
        </div></details>`; })}</div></div>

    <div class="grid g2">
      <div class="card"><h2>Implantação de sistema</h2><div class="stack" data-sistema>
        <div class="field"><label>Nome</label><input data-f="name" value="${cat.system.name}"></div>
        <div class="field"><label>Valor (R$)</label><input type="number" min="0" data-f="price" value="${cat.system.price}"></div>
        <div class="field"><label>O que inclui (um por linha)</label><textarea rows="5" data-f="items">${linhas(cat.system.items)}</textarea></div>
        <div class="field"><label>Fora do escopo (um por linha)</label><textarea rows="3" data-f="outside">${linhas(cat.system.outside)}</textarea></div></div></div>
      <div class="card"><h2>Regras gerais</h2><div class="field"><label for="min-meses">Duração mínima dos programas mensais (meses)</label>
        <input id="min-meses" type="number" min="1" value="${cat.minMonths}"></div></div></div></div>`);

  function ler() {
    const novo = JSON.parse(JSON.stringify(cat));
    $$('[data-formato]', el).forEach((box) => {
      const f = novo.formats[box.dataset.formato];
      $$('[data-f]', box).forEach((i) => {
        const k = i.dataset.f;
        f[k] = k === 'items' ? deLinhas(i.value) : k === 'price' ? (i.value === '' ? null : +i.value) : i.value.trim();
      });
      f.unit = { unico: 'único', por_frente: 'por frente', mensal: 'mensal', soma_frentes: 'mensal' }[f.cobranca];
    });
    $$('[data-frente]', el).forEach((box) => {
      const fr = novo.fronts[box.dataset.frente];
      $$('[data-f]', box).forEach((i) => { const k = i.dataset.f; fr[k] = ['modules', 'deliverables', 'kpis'].includes(k) ? deLinhas(i.value) : k === 'monthly' ? +i.value || 0 : i.value.trim(); });
    });
    $$('[data-sistema] [data-f]', el).forEach((i) => { const k = i.dataset.f; novo.system[k] = ['items', 'outside'].includes(k) ? deLinhas(i.value) : k === 'price' ? +i.value || 0 : i.value.trim(); });
    novo.minMonths = Math.max(1, +$('#min-meses', el).value || 3);
    return novo;
  }

  el.addEventListener('change', (e) => { if (e.target.dataset.f === 'cobranca') { cat = ler(); desenhar(); } }, { signal: ctl.signal });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.remover) {
      if (!(await confirmar('Remover programa?', 'Ele deixa de aparecer nas novas propostas.', { rotulo: 'Remover', perigo: true }))) return;
      cat = ler(); delete cat.formats[b.dataset.remover]; desenhar(); return;
    }
    if (b.dataset.acao === 'novo') { cat = ler(); cat.formats['p_' + Date.now().toString(36)] = { name: 'Novo programa', cobranca: 'unico', unit: 'único', price: 0, desc: '', items: [] }; desenhar(); return; }
    if (b.dataset.acao === 'padrao') {
      if (!(await confirmar('Restaurar o catálogo padrão?', 'Os valores voltam aos do modelo original. Só é gravado ao clicar em “Salvar catálogo”.', { rotulo: 'Restaurar' }))) return;
      cat = JSON.parse(JSON.stringify(CATALOGO_PADRAO)); desenhar(); return;
    }
    if (b.dataset.acao === 'salvar') await ocupado(b, async () => {
      try {
        const novo = ler();
        if (Object.values(novo.formats).some((f) => !f.name)) return avisar('Todo programa precisa de nome.', 'bad');
        await q(db.from('app_settings').upsert({ key: 'catalogo', value: novo }));
        aplicarCatalogo(novo); cat = novo;
        registrar('configuracao.catalogo_salvo', { detalhes: { programas: Object.keys(novo.formats).length } });
        avisar('Catálogo salvo. As próximas propostas usarão estes valores.', 'ok');
      } catch (err) { avisarErro(err); }
    });
  }, { signal: ctl.signal });
  desenhar();
  return () => ctl.abort();
}
