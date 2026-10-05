// Área do CLIENTE: boas-vindas, diagnóstico de posicionamento (quando liberado),
// salvamento automático, revisão, envio e agradecimento. O cliente não vê o relatório.
import { db, q, funcao } from '../core/api.js';
import { CONFIG } from '../config.js';
import { html, montar, $, $$, fmtData, fmtDataHora, debounce, urlSegura } from '../core/dom.js';
import { avisar, avisarErro, mensagemErro, confirmar, ocupado } from '../core/ui.js';
import { PERGUNTAS, SECOES, SCHEMA_POSICIONAMENTO } from './posicionamento-perguntas.js';
import { progresso, respondida } from '../reports/posicionamento.js';
import { aoSairDaTela } from '../app.js';

const LISTA_SECOES = Object.keys(SECOES);
let limparAtual = null;

function expirado(c) { return !c.is_active || (c.access_expires_at && new Date(c.access_expires_at) <= new Date()); }

// ------------------------------------------------------------------ INÍCIO (painel do cliente)
export async function render(el, _params, sessao) {
  const cliente = await q(db.from('clients').select('*').eq('id', sessao.perfil.client_id).single());
  sessao.cliente = cliente;
  if (expirado(cliente)) return telaEncerrado(el, cliente);
  const [avals, docs, mats] = await Promise.all([
    cliente.positioning_enabled ? q(db.from('assessments').select('status, progress_percent, submitted_at').eq('client_id', cliente.id).order('created_at', { ascending: false }).limit(1)) : [],
    q(db.from('client_documents').select('tipo, titulo, publicado_em').eq('client_id', cliente.id)),
    q(db.from('material_access').select('material_id')),
  ]);
  const lib = cliente.liberacoes || {};
  const aval = avals[0];
  const cartoes = [];
  if (cliente.positioning_enabled) cartoes.push({ rota: '#/posicionamento', rotulo: 'Diagnóstico de posicionamento',
    texto: !aval ? 'Ficha liberada para você preencher.' : aval.status === 'draft' ? `Em preenchimento · ${aval.progress_percent || 0}%` : 'Enviado em ' + fmtData(aval.submitted_at),
    acao: !aval ? 'Começar' : aval.status === 'draft' ? 'Continuar' : 'Ver', destaque: !aval || aval.status === 'draft' });
  if (lib.plano) cartoes.push({ rota: '#/plano/plano', rotulo: 'Plano de ação', texto: 'Acompanhe as entregas, os responsáveis e os prazos do projeto.', acao: 'Abrir' });
  if (lib.dashboard) cartoes.push({ rota: '#/plano/dashboard', rotulo: 'Indicadores do projeto', texto: 'Andamento das ações em gráficos e números.', acao: 'Abrir' });
  for (const d of docs) cartoes.push({ rota: '#/documento/' + d.tipo, rotulo: d.tipo === 'relatorio' ? 'Relatório de diagnóstico' : 'Proposta', texto: d.titulo + ' · publicado em ' + fmtData(d.publicado_em), acao: 'Ler' });
  if (mats.length) cartoes.push({ rota: '#/materiais', rotulo: 'Materiais exclusivos', texto: mats.length + (mats.length === 1 ? ' material disponível' : ' materiais disponíveis') + ' para a sua clínica.', acao: 'Ver materiais' });

  montar(el, html`<div class="wrap stack">
    <section class="hero-client"><span class="eyebrow" style="color:var(--lime)">Portal ELOGA</span>
      <h1>Olá, ${cliente.name}.</h1>
      <p class="serif" style="font-size:var(--t-xl);color:#dfe8ed">Você decide transformar. Nós construímos juntos. Seu resultado é o nosso.</p></section>
    ${cartoes.length ? html`<div class="grid g3">${cartoes.map((k) => html`<a class="card cartao-portal ${k.destaque ? 'destaque' : ''}" href="${k.rota}">
        <h3>${k.rotulo}</h3><p class="small muted">${k.texto}</p><span class="btn sm ${k.destaque ? 'primary' : 'secondary'}">${k.acao}</span></a>`)}</div>`
      : html`<div class="card"><h2>Nenhuma etapa disponível no momento</h2><p class="muted">Quando a ELOGA liberar documentos, o plano de ação ou materiais, eles aparecerão aqui.</p>${contatoHtml()}</div>`}
    <div class="card"><h3>Seu espaço seguro</h3><div class="seguranca" style="margin-top:12px">
      <div><span class="ic" aria-hidden="true">1</span><span><b>Acesso individual</b>Somente a sua clínica vê estas informações.</span></div>
      <div><span class="ic" aria-hidden="true">2</span><span><b>Dados protegidos</b>Conexão criptografada e regras de acesso no servidor.</span></div>
      <div><span class="ic" aria-hidden="true">3</span><span><b>LGPD</b>Sem dados de pacientes. Você pode pedir a exclusão a qualquer momento.</span></div></div></div></div>`);
}

// ------------------------------------------------------------------ POSICIONAMENTO
export async function renderPosicionamento(el, _params, sessao) {
  const cliente = await q(db.from('clients').select('*').eq('id', sessao.perfil.client_id).single());
  if (expirado(cliente)) return telaEncerrado(el, cliente);
  if (!cliente.positioning_enabled) return telaSemAtividade(el, cliente);
  const lista = await q(db.from('assessments').select('*').eq('client_id', cliente.id).order('created_at', { ascending: false }).limit(1));
  const aval = lista[0] || null;
  if (aval && aval.status !== 'draft') return telaObrigado(el, cliente, aval);
  telaBoasVindas(el, cliente, aval);
  return () => { limparAtual?.(); limparAtual = null; };
}

// ------------------------------------------------------------------ estados simples
function contatoHtml() {
  return html`<div class="row" style="justify-content:center;margin-top:16px">
    <a class="btn secondary" href="${urlSegura('mailto:' + CONFIG.contato.email)}">${CONFIG.contato.email}</a>
    <a class="btn secondary" href="${urlSegura(CONFIG.contato.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div>`;
}
function telaEncerrado(el, c) {
  montar(el, html`<div class="wrap"><div class="card thanks">
    <div class="ok-ic" style="background:var(--line-2)" aria-hidden="true">⏸</div>
    <h1>Acesso encerrado</h1>
    <p>${!c.is_active ? 'O acesso da ' + c.name + ' está pausado no momento.' : 'O prazo de preenchimento terminou em ' + fmtData(c.access_expires_at) + '.'}</p>
    <p>Para reativar, fale com a ELOGA. Suas respostas salvas continuam guardadas com segurança.</p>${contatoHtml()}</div></div>`);
}
function telaSemAtividade(el, c) {
  montar(el, html`<div class="wrap stack">
    <section class="hero-client"><span class="eyebrow" style="color:var(--lime)">Portal ELOGA</span>
      <h1>Olá, ${c.name}.</h1>
      <p>Este é o seu espaço exclusivo com a ELOGA. Quando houver uma etapa para você preencher, ela aparecerá aqui e avisaremos você.</p></section>
    <div class="card"><h2>Nenhuma etapa pendente</h2><p class="muted">No momento não há formulários liberados para a sua clínica. Em caso de dúvida, fale com a ELOGA.</p>${contatoHtml()}</div></div>`);
}
function telaObrigado(el, c, aval) {
  montar(el, html`<div class="wrap"><div class="card thanks">
    <div class="ok-ic" aria-hidden="true">✓</div>
    <h1>Obrigada pelo preenchimento!</h1>
    <p>A ficha de posicionamento da <b>${c.name}</b> foi enviada à ELOGA em ${fmtDataHora(aval.submitted_at || aval.updated_at)}.</p>
    <p>Agradecemos o tempo dedicado e a qualidade das informações. A ELOGA fará a análise estratégica e dará continuidade com você.</p>
    <p class="small subtle">O formulário foi encerrado e não pode mais ser alterado.</p>${contatoHtml()}</div></div>`);
}

function diasRestantes(iso) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000));
}

function telaBoasVindas(el, c, aval) {
  const dias = diasRestantes(c.access_expires_at);
  const pct = aval?.progress_percent || 0;
  montar(el, html`<div class="wrap stack">
    <section class="hero-client">
      <span class="eyebrow" style="color:var(--lime)">Diagnóstico de posicionamento</span>
      <h1>${aval ? 'Bem-vinda de volta' : 'Olá'}, ${c.name}.</h1>
      <p>Esta ficha ajuda a ELOGA a entender como a clínica é percebida e como ela quer ser percebida. São ${PERGUNTAS.length} perguntas em ${LISTA_SECOES.length} etapas, com orientações e exemplos em cada uma.</p>
      <div class="facts">
        <div><b>15 a 25 min</b>tempo estimado</div>
        <div><b>${aval ? pct + '%' : 'Salvamento automático'}</b>${aval ? 'já preenchido' : 'você pode parar e voltar depois'}</div>
        ${c.access_expires_at ? html`<div><b>${fmtData(c.access_expires_at)}</b>disponível até${dias !== null ? html` · ${dias === 0 ? 'último dia' : dias + (dias === 1 ? ' dia' : ' dias')}` : ''}</div>` : ''}
      </div>
      <div style="margin-top:24px;position:relative;z-index:1"><button class="btn primary lg" type="button" id="comecar">${aval ? 'Continuar de onde parei' : 'Começar'}</button></div>
    </section>
    <a href="#/inicio" class="small">← Voltar ao início</a></div>`);
  $('#comecar', el).addEventListener('click', () => { limparAtual = questionario(el, c, aval); }, { once: true });
}

// ------------------------------------------------------------------ questionário
function questionario(el, cliente, avalInicial) {
  let aval = avalInicial;
  const estado = {
    answers: structuredClone(avalInicial?.responses?.answers || {}),
    additional: avalInicial?.responses?.additional || '',
  };
  let etapa = 0, sujo = false, salvando = false, falhou = false;
  const ctl = new AbortController();
  const opt = { signal: ctl.signal };

  // Retoma na primeira etapa com pendência
  const primeiraPendente = LISTA_SECOES.findIndex((s) => PERGUNTAS.filter((x) => x.section === s).some((x) => !respondida(x, estado.answers[x.id])));
  if (avalInicial && primeiraPendente > 0) etapa = primeiraPendente;

  const flag = (texto, tipo = '') => { const f = $('#saveflag', el); if (f) { f.textContent = texto; f.className = 'saveflag ' + tipo; } };

  async function gravar() {
    if (!sujo || salvando) return;
    salvando = true; sujo = false; falhou = false; flag('Salvando...');
    const dados = {
      progress_percent: progresso(estado.answers),
      responses: { answers: estado.answers, additional: estado.additional, schema_version: SCHEMA_POSICIONAMENTO },
      schema_version: SCHEMA_POSICIONAMENTO,
    };
    try {
      aval = aval
        ? await q(db.from('assessments').update(dados).eq('id', aval.id).select().single())
        : await q(db.from('assessments').insert({ ...dados, client_id: cliente.id, status: 'draft' }).select().single());
      flag('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 'ok');
    } catch (e) {
      sujo = true; falhou = true;
      const m = mensagemErro(e);
      flag('Não salvo: ' + m, 'bad');
      if (/prazo|liberado|enviado/i.test(m)) { avisar(m, 'bad'); setTimeout(() => location.reload(), 2500); }
      else setTimeout(() => salvar(), 10000);
    } finally { salvando = false; if (sujo && !falhou) salvar(); }
  }
  const salvar = debounce(gravar, 1200);
  const aoMudar = () => { sujo = true; flag('Alterações não salvas...'); salvar(); atualizarProgresso(); };
  const sairDaPagina = (e) => { if (sujo || salvando) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', sairDaPagina);
  aoSairDaTela(async () => { await salvar.flush(); removeEventListener('beforeunload', sairDaPagina); });

  function atualizarProgresso() {
    const p = progresso(estado.answers);
    const b = $('#prog-bar', el); if (b) b.style.width = p + '%';
    const t = $('#prog-txt', el); if (t) t.textContent = p + '% preenchido';
    $$('.stepper button', el).forEach((btn, i) => {
      if (i >= LISTA_SECOES.length) return;
      const ok = PERGUNTAS.filter((x) => x.section === LISTA_SECOES[i]).every((x) => respondida(x, estado.answers[x.id]));
      btn.classList.toggle('done', ok);
    });
  }

  function campo(qq) {
    const a = estado.answers[qq.id];
    const id = 'q_' + qq.id;
    if (qq.type === 'text') return html`<textarea id="${id}" data-q="${qq.id}" data-k="text" aria-labelledby="${id}_t" placeholder="Escreva de forma objetiva">${a || ''}</textarea>`;
    if (qq.type === 'score') return html`<div class="scale" role="radiogroup" aria-labelledby="${id}_t">${[0, 1, 2, 3, 4].map((v) => html`
        <label class="chip"><input type="radio" name="${id}" value="${v}" data-q="${qq.id}" data-k="score" ${a === v ? html`checked` : ''}>${v}</label>`)}</div>
        <p class="xs subtle" style="margin:6px 0 0">0 inexistente · 1 inicial · 2 parcial · 3 estruturado · 4 consolidado</p>`;
    if (qq.type === 'select') return html`<select id="${id}" data-q="${qq.id}" data-k="select" aria-labelledby="${id}_t"><option value="">Selecione...</option>
        ${qq.options.map((o) => html`<option ${a?.selected === o ? html`selected` : ''}>${o}</option>`)}</select>
        <input class="other" type="text" data-q="${qq.id}" data-k="other" value="${a?.other || ''}" placeholder="Outra opção (opcional)" aria-label="Outra opção">`;
    return html`<div class="chips" role="group" aria-labelledby="${id}_t">${qq.options.map((o) => html`
        <label class="chip"><input type="checkbox" value="${o}" data-q="${qq.id}" data-k="multi" ${(a?.selected || []).includes(o) ? html`checked` : ''}>${o}</label>`)}</div>
        <input class="other" type="text" data-q="${qq.id}" data-k="other" value="${a?.other || ''}" placeholder="Outras opções (opcional)" aria-label="Outras opções">`;
  }

  function desenhar() {
    const revisao = etapa === LISTA_SECOES.length;
    const sec = LISTA_SECOES[etapa];
    montar(el, html`<div class="wrap" style="max-width:920px">
      <div class="page-head"><div><span class="eyebrow">Diagnóstico de posicionamento</span><h1>${revisao ? 'Revisão e envio' : sec.replace(/^\d+\.\s*/, '')}</h1>
        <p>${revisao ? 'Confira as pendências antes de enviar.' : SECOES[sec]}</p></div>
        <div style="min-width:220px"><div class="row between xs"><span id="prog-txt"></span><span id="saveflag" class="saveflag" aria-live="polite"></span></div>
        <div class="bar" style="margin-top:6px"><i id="prog-bar"></i></div></div></div>
      <nav class="stepper" aria-label="Etapas">${LISTA_SECOES.map((s, i) => html`
        <button type="button" data-ir="${i}" ${i === etapa ? html`aria-current="step"` : ''}><span>Etapa ${i + 1}</span><b>${s.replace(/^\d+\.\s*/, '')}</b></button>`)}
        <button type="button" data-ir="${LISTA_SECOES.length}" ${revisao ? html`aria-current="step"` : ''}><span>Final</span><b>Revisão e envio</b></button></nav>
      <div class="card">${revisao ? corpoRevisao() : PERGUNTAS.filter((x) => x.section === sec).map((qq) => html`
        <div class="q" id="bloco_${qq.id}"><div class="q-top"><div><div class="q-theme">${qq.theme}</div><div class="q-title" id="q_${qq.id}_t">${qq.q}</div></div>
          <button type="button" class="btn sm secondary" data-guia="${qq.id}">Ver orientação e exemplos</button></div>${campo(qq)}</div>`)}</div>
      <div class="row between" style="margin-top:16px">
        <button type="button" class="btn secondary" id="voltar" ${etapa === 0 ? html`disabled` : ''}>Voltar</button>
        ${revisao ? html`<button type="button" class="btn primary lg" id="enviar">Enviar à ELOGA</button>`
                  : html`<button type="button" class="btn strong" id="avancar">${etapa === LISTA_SECOES.length - 1 ? 'Ir para a revisão' : 'Próxima etapa'}</button>`}
      </div></div>`);
    atualizarProgresso();
    if (!sujo && aval) flag('Tudo salvo', 'ok');
  }

  function corpoRevisao() {
    const pend = PERGUNTAS.filter((x) => !respondida(x, estado.answers[x.id]));
    return html`
      ${pend.length ? html`<div class="notice warn"><b>${pend.length} pergunta(s) sem resposta.</b> Você pode enviar assim mesmo, mas respostas completas geram um diagnóstico mais preciso.
        <ul>${pend.map((x) => html`<li><button type="button" class="linkbtn" data-ir="${LISTA_SECOES.indexOf(x.section)}">${x.section.replace(/^\d+\.\s*/, '')}: ${x.q}</button></li>`)}</ul></div>`
        : html`<div class="notice">Todas as perguntas foram respondidas.</div>`}
      <div class="field" style="margin-top:16px"><label for="adicional">Informações adicionais (opcional)</label>
        <textarea id="adicional" data-k="additional">${estado.additional}</textarea></div>
      <div class="notice info" style="margin-top:16px">Ao enviar, o formulário é <b>encerrado</b> e não poderá mais ser alterado. A ELOGA recebe as respostas para a análise.</div>`;
  }

  function lerCampo(t) {
    const id = t.dataset.q, k = t.dataset.k;
    if (k === 'additional') { estado.additional = t.value; return; }
    const atual = estado.answers[id];
    if (k === 'text') estado.answers[id] = t.value;
    if (k === 'score') estado.answers[id] = Number(t.value);
    if (k === 'select') estado.answers[id] = { selected: t.value, other: atual?.other || '' };
    if (k === 'multi') estado.answers[id] = { selected: $$(`[data-q="${id}"][data-k="multi"]:checked`, el).map((x) => x.value), other: atual?.other || '' };
    if (k === 'other') estado.answers[id] = { ...(atual && typeof atual === 'object' ? atual : { selected: PERGUNTAS.find((x) => x.id === id).type === 'multi' ? [] : '' }), other: t.value.trim() ? t.value : '' };
  }

  el.addEventListener('input', (e) => { if (e.target.dataset.k) { lerCampo(e.target); aoMudar(); } }, opt);
  el.addEventListener('change', (e) => { if (e.target.dataset.k) { lerCampo(e.target); aoMudar(); } }, opt);
  el.addEventListener('click', async (e) => {
    const ir = e.target.closest('[data-ir]');
    if (ir) { etapa = +ir.dataset.ir; desenhar(); scrollTo({ top: 0 }); salvar.flush(); return; }
    const g = e.target.closest('[data-guia]');
    if (g) return abrirGuia(PERGUNTAS.find((x) => x.id === g.dataset.guia), g);
    if (e.target.closest('#voltar')) { etapa = Math.max(0, etapa - 1); desenhar(); scrollTo({ top: 0 }); salvar.flush(); return; }
    if (e.target.closest('#avancar')) { etapa += 1; desenhar(); scrollTo({ top: 0 }); salvar.flush(); return; }
    const env = e.target.closest('#enviar');
    if (env) await enviar(env);
  }, opt);

  async function enviar(botao) {
    const ok = await confirmar('Enviar à ELOGA?', 'Depois do envio o formulário é encerrado e não poderá mais ser alterado.', { rotulo: 'Enviar agora' });
    if (!ok) return;
    await ocupado(botao, async () => {
      try {
        sujo = true; await salvar.flush();
        if (sujo) throw new Error('Não foi possível salvar as últimas respostas. Verifique a conexão e tente de novo.');
        aval = await q(db.from('assessments').update({ status: 'submitted' }).eq('id', aval.id).select().single());
        removeEventListener('beforeunload', sairDaPagina);
        aoSairDaTela(null);
        ctl.abort();
        telaObrigado(el, cliente, aval);
        enviarPdfParaEloga(cliente, aval); // em segundo plano; a ELOGA acompanha o status no painel
      } catch (e) { avisarErro(e); }
    });
  }

  desenhar();
  return () => { salvar.cancel(); ctl.abort(); removeEventListener('beforeunload', sairDaPagina); };
}

async function enviarPdfParaEloga(cliente, aval) {
  try {
    const { gerarPdfPosicionamento, blobParaBase64 } = await import('../reports/posicionamento.js');
    const blob = await gerarPdfPosicionamento(cliente, aval);
    await funcao('enviar-posicionamento', { pdf_base64: await blobParaBase64(blob) });
  } catch (e) {
    // O cliente não precisa agir: o painel da ELOGA mostra “e-mail não confirmado” e permite gerar o PDF.
    console.warn('Envio do PDF à ELOGA não confirmado:', e);
  }
}

// ------------------------------------------------------------------ guia lateral
function abrirGuia(qq, origem) {
  const back = document.createElement('div'); back.className = 'drawer-back';
  const d = document.createElement('aside'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'guia-t');
  montar(d, html`<div class="drawer-head"><div><span class="eyebrow" style="color:var(--lime)">${qq.section} · ${qq.theme}</span><h2 id="guia-t">Orientação de preenchimento</h2></div>
      <button class="xbtn" type="button" aria-label="Fechar">×</button></div>
    <div class="drawer-body"><p><b>${qq.q}</b></p>
      <div class="guide-box"><h3>Como responder</h3><p style="margin:0">${qq.help}</p></div>
      <div class="guide-box lime"><h3>Exemplo · clínica de estética</h3><p style="margin:0">${qq.aesthetic}</p></div>
      <div class="guide-box gray"><h3>Exemplo · clínica de terapias</h3><p style="margin:0">${qq.therapy}</p></div>
      <p class="xs subtle">Use os exemplos apenas como referência. A resposta deve refletir a realidade da sua clínica.</p></div>`);
  const fechar = () => { back.remove(); d.remove(); document.removeEventListener('keydown', esc); origem?.focus(); };
  const esc = (e) => { if (e.key === 'Escape') fechar(); };
  back.onclick = fechar; d.querySelector('.xbtn').onclick = fechar;
  document.addEventListener('keydown', esc);
  document.body.append(back, d);
  d.querySelector('.xbtn').focus();
}

