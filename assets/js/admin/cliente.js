// Página do CLIENTE no painel administrativo.
import { db, q, funcao, registrar, logoComoDataUrl } from '../core/api.js';
import { html, montar, $, fmtData, fmtDataHora, baixar, nomeArquivo } from '../core/dom.js';
import { avisar, avisarErro, confirmar, confirmarDigitando, janela, ocupado, carregando, vazio } from '../core/ui.js';
import { criarOperacional } from './operacional.js';
import { tabelaAuditoria } from './auditoria.js';
import { csv, json } from './exportar.js';
import { PILLARS } from '../import/autodiagnostico-modelo.js';
import { ROTULOS_CAMPOS } from '../import/leitores.js';
import { PERGUNTAS } from '../client/posicionamento-perguntas.js';
import { analisar, textoResposta } from '../reports/posicionamento.js';
import { ir, aoSairDaTela } from '../app.js';

export const ETAPAS = {
  lead: 'Lead', autodiagnostico: 'Autodiagnóstico importado', diagnostico_operacional: 'Diagnóstico em andamento',
  relatorio_emitido: 'Relatório emitido', proposta_emitida: 'Proposta emitida', cliente_ativo: 'Cliente ativo',
  nao_fechou: 'Não fechou', encerrado: 'Encerrado',
};
// Menu lateral do cliente, agrupado pela jornada
const GRUPOS = [
  ['Cadastro', [['visao', 'Visão geral']]],
  ['Diagnóstico', [['autodiagnostico', 'Autodiagnóstico'], ['preparacao', 'Preparação'], ['sessao', 'Diagnóstico operacional'], ['matriz', 'Matriz de encaixe'], ['relatorio', 'Relatório'], ['proposta', 'Proposta']]],
  ['Consultoria', [['plano', 'Plano de ação (PDCA)']]],
  ['Portal do cliente', [['portal', 'Liberações e materiais'], ['posicionamento', 'Posicionamento']]],
  ['Registro', [['historico', 'Histórico']]],
];
const ABAS = GRUPOS.flatMap(([, itens]) => itens);
const OPERACIONAIS = ['preparacao', 'sessao', 'matriz', 'relatorio', 'proposta'];

export async function render(el, [id, abaInicial = 'visao']) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { ir('painel'); return; }
  const cliente = await q(db.from('clients').select('*').eq('id', id).maybeSingle());
  if (!cliente) { montar(el, html`<div class="wrap">${vazio('Cliente não encontrado', 'Ele pode ter sido excluído.', html`<a class="btn secondary" href="#/painel">Voltar aos clientes</a>`)}</div>`); return; }
  const [autos, avals, perfis] = await Promise.all([
    q(db.from('self_assessments').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1)),
    q(db.from('assessments').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1)),
    q(db.from('profiles').select('user_id, role, must_change_password').eq('client_id', id).neq('role', 'admin')),
  ]);
  const ctx = { cliente, autodiag: autos[0] || null, aval: avals[0] || null, perfis, logo: await logoComoDataUrl(cliente.logo_path) };
  const op = await criarOperacional({ cliente, autodiag: ctx.autodiag, logo: ctx.logo });
  aoSairDaTela(() => op.salvar.flush());
  registrar('cliente.aberto', { entidade: 'clients', id, cliente: id });

  let aba = ABAS.some(([k]) => k === abaInicial) ? abaInicial : 'visao';
  let limparAba = null;

  montar(el, html`<div class="wrap">
    <div class="page-head"><div><a href="#/painel" class="small">← Clientes</a><h1 id="cli-nome">${cliente.name}</h1>
      <p>${[cliente.segment, cliente.city].filter(Boolean).join(' · ') || 'Segmento e cidade não informados'}</p></div>
      <div class="row"><span id="saveflag" class="saveflag" aria-live="polite"></span>
        <div class="field" style="min-width:230px"><label for="etapa">Etapa</label><select id="etapa">${Object.entries(ETAPAS).map(([k, v]) => html`<option value="${k}" ${cliente.stage === k ? html`selected` : ''}>${v}</option>`)}</select></div></div></div>
    <div class="cli-layout">
      <nav class="cli-menu" aria-label="Etapas do cliente">${GRUPOS.map(([g, itens]) => html`<p class="cli-grupo">${g}</p>
        ${itens.map(([k, t]) => html`<button type="button" data-aba="${k}" aria-current="${k === aba ? 'page' : 'false'}">${t}</button>`)}`)}</nav>
      <div id="painel-aba"></div></div></div>`);

  $('#etapa', el).addEventListener('change', async (e) => {
    try { await q(db.from('clients').update({ stage: e.target.value }).eq('id', id)); cliente.stage = e.target.value; avisar('Etapa atualizada.', 'ok'); }
    catch (err) { avisarErro(err); e.target.value = cliente.stage; }
  });

  async function abrir(nova) {
    if (OPERACIONAIS.includes(aba)) await op.salvar.flush();
    limparAba?.(); limparAba = null;
    aba = nova;
    history.replaceState(null, '', `#/cliente/${id}/${aba}`);
    el.querySelectorAll('[data-aba]').forEach((b) => b.setAttribute('aria-current', b.dataset.aba === aba ? 'page' : 'false'));
    const p = $('#painel-aba', el);
    montar(p, carregando());
    try {
      if (OPERACIONAIS.includes(aba)) limparAba = await op.montarAba(p, aba, $('#saveflag', el));
      else if (aba === 'plano') limparAba = await (await import('./plano.js')).render(p, ctx);
      else if (aba === 'portal') limparAba = await (await import('./portal-cliente.js')).render(p, ctx);
      else limparAba = await ({ visao, autodiagnostico, posicionamento, historico })[aba](p, ctx);
    } catch (e) { avisarErro(e); montar(p, vazio('Não foi possível abrir esta seção', 'Tente novamente.')); }
  }
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { abrir(b.dataset.aba); scrollTo({ top: 0 }); }));
  await abrir(aba);
  return () => { limparAba?.(); };
}

// =================================================================== VISÃO GERAL
async function visao(p, ctx) {
  const c = ctx.cliente;
  const temLogin = ctx.perfis.length > 0;
  const expirado = c.access_expires_at && new Date(c.access_expires_at) <= new Date();
  const a = ctx.aval;
  const situacaoPos = !a ? 'Não iniciado' : a.status === 'draft' ? `Em preenchimento · ${a.progress_percent || 0}%` : 'Enviado em ' + fmtDataHora(a.submitted_at);
  montar(p, html`<div class="grid g2">
    <div class="card span-2"><div class="card-head"><div><h2>Cadastro</h2><p>Dados da clínica e do responsável. Não registre dados de pacientes.</p></div></div>
      <form id="f-cad" class="grid g3" novalidate>
        ${campo('name', 'Nome da clínica *', c.name)}${campo('segment', 'Segmento', c.segment)}${campo('city', 'Cidade / UF', c.city)}
        ${campo('contact_name', 'Responsável (decisor)', c.contact_name)}${campo('contact_email', 'E-mail do responsável', c.contact_email, 'email')}${campo('phone', 'WhatsApp', c.phone, 'tel')}
        <div class="field"><label for="c-profile">Perfil</label><select id="c-profile" name="profile">${[['', '—'], ['terapias', 'Clínica de terapias'], ['estetica', 'Clínica de estética'], ['autonomo', 'Profissional autônomo'], ['outro', 'Outro']].map(([v, t]) => html`<option value="${v}" ${c.profile === v ? html`selected` : ''}>${t}</option>`)}</select></div>
        <div class="field"><label for="c-payer">Pagamento predominante</label><select id="c-payer" name="payer">${[['', '—'], ['particular', 'Particular'], ['convenio', 'Convênio'], ['misto', 'Misto']].map(([v, t]) => html`<option value="${v}" ${c.payer === v ? html`selected` : ''}>${t}</option>`)}</select></div>
        ${campo('origin', 'Origem', c.origin)}
        <div class="field span-2" style="grid-column:1/-1"><label for="c-notes">Observações internas</label><textarea id="c-notes" name="notes" rows="3">${c.notes || ''}</textarea></div>
        <div><button class="btn strong" type="submit">Salvar cadastro</button></div></form></div>

    <div class="card"><div class="card-head"><div><h2>Acesso ao portal</h2><p>Login individual do cliente.</p></div>
      <span class="badge ${!temLogin ? '' : !c.is_active ? 'bad' : expirado ? 'warn' : 'ok'}">${!temLogin ? 'Sem acesso' : !c.is_active ? 'Bloqueado' : expirado ? 'Expirado' : 'Ativo'}</span></div>
      ${temLogin ? html`<dl class="kv"><dt>E-mail de login</dt><dd>${c.access_email || '—'}</dd>
          <dt>Válido até</dt><dd>${c.access_expires_at ? fmtData(c.access_expires_at) : 'Sem prazo'}</dd>
          <dt>Senha</dt><dd>${ctx.perfis.some((x) => x.must_change_password) ? 'Temporária (ainda não trocada)' : 'Definida pelo cliente'}</dd></dl>
        <div class="row" style="margin-top:14px;align-items:flex-end"><div class="field" style="flex:1"><label for="validade">Nova validade</label><input id="validade" type="date" value="${c.access_expires_at ? String(c.access_expires_at).slice(0, 10) : ''}"></div>
          <button class="btn secondary" type="button" data-acao="validade">Salvar validade</button></div>
        <div class="toolbar" style="margin-top:14px">
          <button class="btn secondary" type="button" data-acao="senha">Gerar nova senha</button>
          <button class="btn secondary" type="button" data-acao="email">Alterar e-mail</button>
          <button class="btn ${c.is_active ? 'danger' : 'secondary'}" type="button" data-acao="bloquear">${c.is_active ? 'Bloquear acesso' : 'Desbloquear acesso'}</button></div>`
      : html`<form id="f-acesso" class="stack"><div class="field"><label for="ac-email">E-mail de login</label><input id="ac-email" type="email" value="${c.contact_email || ''}" required></div>
          <div class="field"><label for="ac-dias">Validade do acesso</label><select id="ac-dias"><option value="7">7 dias</option><option value="15" selected>15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option><option value="">Sem prazo</option></select></div>
          <button class="btn strong" type="submit">Criar acesso e gerar senha</button>
          <p class="xs muted" style="margin:0">A senha temporária aparece uma única vez. O cliente troca no primeiro acesso.</p></form>`}</div>

    <div class="card"><div class="card-head"><div><h2>Diagnóstico de posicionamento</h2><p>Liberado individualmente. O cliente não recebe o relatório.</p></div>
      <span class="badge ${c.positioning_enabled ? 'purple' : ''}">${c.positioning_enabled ? 'Liberado' : 'Não liberado'}</span></div>
      <dl class="kv"><dt>Situação</dt><dd>${situacaoPos}</dd>
        ${a?.status === 'submitted' ? html`<dt>E-mail à ELOGA</dt><dd>${a.notify_status === 'enviado' ? html`<span class="badge ok">Enviado</span>` : html`<span class="badge warn">Não confirmado</span> <span class="xs muted">gere o PDF na aba Posicionamento</span>`}</dd>` : ''}</dl>
      ${!temLogin ? html`<p class="small muted" style="margin-top:12px">Crie o acesso ao portal para o cliente conseguir preencher.</p>` : ''}
      <div class="toolbar" style="margin-top:14px">
        <button class="btn ${c.positioning_enabled ? 'secondary' : 'purple'}" type="button" data-acao="posicionamento">${c.positioning_enabled ? 'Retirar liberação' : 'Liberar para o cliente'}</button>
        ${a ? html`<button class="btn secondary" type="button" data-acao="reset">Permitir novo preenchimento</button>` : ''}</div></div>

    <div class="card"><div class="card-head"><div><h2>Logo do cliente</h2><p>Aparece no relatório e na proposta. PNG, JPG ou WebP até 1 MB.</p></div></div>
      ${ctx.logo ? html`<img src="${ctx.logo}" alt="Logo atual" style="max-height:70px;max-width:200px;margin-bottom:12px;border:1px solid var(--line);border-radius:10px;padding:6px">` : html`<p class="small muted">Nenhuma logo cadastrada.</p>`}
      <input type="file" id="logo" accept="image/png,image/jpeg,image/webp" aria-label="Enviar logo"></div>

    <div class="card" style="border-color:#efc9c5"><div class="card-head"><div><h2>Excluir cliente</h2><p>Remove cadastro, login, respostas, diagnósticos, propostas e logo. Não pode ser desfeito. O registro na auditoria é mantido.</p></div></div>
      <button class="btn danger" type="button" data-acao="excluir">Excluir definitivamente</button></div>
  </div>`);

  const ctl = new AbortController(), o = { signal: ctl.signal };
  $('#f-cad', p).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dados = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v).trim() || null]));
    if (!dados.name) return avisar('Informe o nome da clínica.', 'bad');
    if (dados.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.contact_email)) return avisar('E-mail do responsável inválido.', 'bad');
    await ocupado(e.submitter, async () => {
      try { Object.assign(c, await q(db.from('clients').update(dados).eq('id', c.id).select().single())); $('#cli-nome').textContent = c.name; avisar('Cadastro salvo.', 'ok'); }
      catch (err) { avisarErro(err); }
    });
  }, o);

  $('#f-acesso', p)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#ac-email', p).value.trim(), dias = $('#ac-dias', p).value;
    let expira = null;
    if (dias) { const d = new Date(); d.setDate(d.getDate() + +dias); d.setHours(23, 59, 59); expira = d.toISOString(); }
    await ocupado(e.submitter, async () => {
      try {
        const r = await funcao('admin-clientes', { acao: 'criar_acesso', client_id: c.id, email, access_expires_at: expira });
        await mostrarSenha(c, r.email, r.senha_temporaria, expira);
        recarregar(p, ctx);
      } catch (err) { avisarErro(err); }
    });
  }, o);

  $('#logo', p).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return avisar('Use PNG, JPG ou WebP.', 'bad');
    if (f.size > 1048576) return avisar('A logo deve ter até 1 MB.', 'bad');
    try {
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[f.type];
      const caminho = `${c.id}/logo.${ext}`;
      await q(db.storage.from('client-logos').upload(caminho, f, { upsert: true, contentType: f.type }));
      if (c.logo_path && c.logo_path !== caminho) await db.storage.from('client-logos').remove([c.logo_path]);
      await q(db.from('clients').update({ logo_path: caminho }).eq('id', c.id));
      c.logo_path = caminho; ctx.logo = await logoComoDataUrl(caminho);
      avisar('Logo atualizada. Reabra o cliente para vê-la nos documentos.', 'ok'); recarregar(p, ctx);
    } catch (err) { avisarErro(err); }
  }, o);

  p.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    await ocupado(b, async () => { try { await ACOES_VISAO[b.dataset.acao](p, ctx); } catch (err) { avisarErro(err); } });
  }, o);
  return () => ctl.abort();
}

function campo(nome, rotulo, valor, tipo = 'text') {
  return html`<div class="field"><label for="c-${nome}">${rotulo}</label><input id="c-${nome}" name="${nome}" type="${tipo}" value="${valor || ''}" ${nome === 'name' ? html`required` : ''}></div>`;
}

async function recarregar(p, ctx) {
  ctx.perfis = await q(db.from('profiles').select('user_id, role, must_change_password').eq('client_id', ctx.cliente.id).neq('role', 'admin'));
  Object.assign(ctx.cliente, await q(db.from('clients').select('*').eq('id', ctx.cliente.id).single()));
  const av = await q(db.from('assessments').select('*').eq('client_id', ctx.cliente.id).order('created_at', { ascending: false }).limit(1));
  ctx.aval = av[0] || null;
  p.replaceWith(p.cloneNode(false)); // remove ouvintes antigos
  const novo = document.getElementById('painel-aba');
  await visao(novo, ctx);
}

async function mostrarSenha(c, email, senha, expira) {
  const msg = `Olá! Seu acesso ao Portal ELOGA está pronto.\n\nEndereço: ${location.origin + location.pathname}\nE-mail: ${email}\nSenha temporária: ${senha}\n${expira ? 'Disponível até: ' + fmtData(expira) + '\n' : ''}\nNo primeiro acesso você vai criar uma senha só sua.\n\nHelle Machado · ELOGA`;
  await janela({
    titulo: 'Senha temporária gerada',
    corpo: html`<div class="stack"><p>Envie ao cliente por um canal seguro (WhatsApp ou e-mail). <b>Ela não será exibida novamente.</b></p>
      <div class="secret" aria-label="Senha temporária">${senha}</div>
      <div class="field"><label for="msg-acesso">Mensagem pronta</label><textarea id="msg-acesso" rows="8" readonly>${msg}</textarea></div></div>`,
    acoes: [{ rotulo: 'Copiar mensagem', classe: 'secondary', valor: 'copiar' }, { rotulo: 'Concluído', classe: 'strong', valor: null }],
    validar: async (_el, v) => { if (v === 'copiar') { await navigator.clipboard.writeText(msg).then(() => avisar('Mensagem copiada.', 'ok'), () => avisar('Copie manualmente o texto.', 'bad')); return false; } return true; },
  });
}

const ACOES_VISAO = {
  async validade(p, ctx) {
    const v = $('#validade', p).value;
    await q(db.from('clients').update({ access_expires_at: v ? new Date(v + 'T23:59:59').toISOString() : null }).eq('id', ctx.cliente.id));
    avisar('Validade atualizada.', 'ok'); await recarregar(p, ctx);
  },
  async senha(p, ctx) {
    if (!(await confirmar('Gerar nova senha?', 'A senha atual do cliente deixa de funcionar imediatamente.', { rotulo: 'Gerar nova senha' }))) return;
    const r = await funcao('admin-clientes', { acao: 'redefinir_senha', client_id: ctx.cliente.id });
    await mostrarSenha(ctx.cliente, r.email || ctx.cliente.access_email, r.senha_temporaria, ctx.cliente.access_expires_at);
    await recarregar(p, ctx);
  },
  async email(p, ctx) {
    let novo = '';
    const ok = await janela({ titulo: 'Alterar e-mail de login', corpo: html`<div class="field"><label for="novo-email">Novo e-mail</label><input id="novo-email" type="email" value="${ctx.cliente.access_email || ''}" autofocus></div>`,
      acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar', classe: 'strong', valor: true }],
      validar: (el) => { novo = el.querySelector('#novo-email').value.trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo) || (avisar('E-mail inválido.', 'bad'), false); } });
    if (!ok) return;
    await funcao('admin-clientes', { acao: 'alterar_email', client_id: ctx.cliente.id, email: novo });
    avisar('E-mail de login alterado.', 'ok'); await recarregar(p, ctx);
  },
  async bloquear(p, ctx) {
    const bloquear = ctx.cliente.is_active;
    if (bloquear && !(await confirmar('Bloquear o acesso?', 'O cliente não conseguirá mais entrar até ser desbloqueado. Os dados são mantidos.', { rotulo: 'Bloquear', perigo: true }))) return;
    await funcao('admin-clientes', { acao: 'bloquear', client_id: ctx.cliente.id, bloqueado: bloquear });
    avisar(bloquear ? 'Acesso bloqueado.' : 'Acesso desbloqueado.', 'ok'); await recarregar(p, ctx);
  },
  async posicionamento(p, ctx) {
    const liberar = !ctx.cliente.positioning_enabled;
    if (!(await confirmar(liberar ? 'Liberar o diagnóstico de posicionamento?' : 'Retirar a liberação?',
      liberar ? 'A ficha aparecerá no painel do cliente no próximo acesso. Confira também a validade do acesso.' : 'O cliente deixa de ver a ficha. Respostas já salvas são mantidas.', { rotulo: liberar ? 'Liberar' : 'Retirar' }))) return;
    await q(db.from('clients').update({ positioning_enabled: liberar, ...(liberar ? { positioning_released_at: new Date().toISOString() } : {}) }).eq('id', ctx.cliente.id));
    avisar(liberar ? 'Posicionamento liberado.' : 'Liberação retirada.', 'ok'); await recarregar(p, ctx);
  },
  async reset(p, ctx) {
    if (!(await confirmar('Permitir novo preenchimento?', 'As respostas atuais do posicionamento serão apagadas. Cadastro, login e senha são mantidos. Baixe o PDF antes, se precisar.', { rotulo: 'Apagar respostas e liberar', perigo: true }))) return;
    await q(db.rpc('admin_reset_assessment', { p_client_id: ctx.cliente.id }));
    avisar('Novo preenchimento liberado.', 'ok'); await recarregar(p, ctx);
  },
  async excluir(_p, ctx) {
    const nome = await confirmarDigitando('Excluir cliente', 'Esta ação remove definitivamente cadastro, login, respostas, diagnósticos, propostas e logo. Não pode ser desfeita.', ctx.cliente.name);
    if (!nome) return;
    const r = await funcao('admin-clientes', { acao: 'excluir', client_id: ctx.cliente.id, confirmacao: nome });
    aoSairDaTela(null);
    avisar(`Cliente excluído (logins: ${r.etapas.logins}; arquivos: ${r.etapas.arquivos}).`, 'ok');
    ir('painel');
  },
};

// =================================================================== AUTODIAGNÓSTICO
async function autodiagnostico(p, ctx) {
  const a = ctx.autodiag;
  if (!a) { montar(p, html`<div class="card">${vazio('Autodiagnóstico ainda não importado', 'Importe o relatório e a ficha recebidos por e-mail para preencher a preparação da sessão automaticamente.', html`<a class="btn purple" href="#/importar/${ctx.cliente.id}">Importar PDFs</a>`)}</div>`); return; }
  const id = a.identification || {};
  const bloco = (g, titulo) => {
    const ent = Object.entries(id[g] || {}).filter(([, v]) => (Array.isArray(v) ? v.length : String(v ?? '').trim()));
    return ent.length ? html`<div class="card"><h3>${titulo}</h3><dl class="kv">${ent.map(([k, v]) => html`<dt>${ROTULOS_CAMPOS[g + '.' + k] || k}</dt><dd>${Array.isArray(v) ? v.join(', ') : v}</dd>`)}</dl></div>` : '';
  };
  const resp = a.answers || {};
  montar(p, html`<div class="stack">
    <div class="row between"><p class="small muted" style="margin:0">Importado em ${fmtDataHora(a.created_at)} · leitura ${a.source === 'dados_embutidos' ? 'exata (dados do PDF)' : a.source === 'ocr' ? 'por imagem (OCR), conferida' : 'manual'}${a.filled_at ? ' · preenchido em ' + fmtData(String(a.filled_at).slice(0, 10)) : ''}</p>
      <a class="btn sm secondary" href="#/importar/${ctx.cliente.id}">Importar novamente</a></div>
    <div class="grid g4">
      <div class="kpi accent"><div class="k-label">Nota geral</div><div class="k-value">${a.overall ?? '—'}<span class="small">/100</span></div></div>
      <div class="kpi"><div class="k-label">Nível</div><div class="k-value" style="font-size:22px">${a.level || '—'}</div></div>
      <div class="kpi"><div class="k-label">Classe do lead</div><div class="k-value">${a.lead_class || '—'}</div></div>
      <div class="kpi"><div class="k-label">Itens “Não sei”</div><div class="k-value">${(a.unknowns || []).length}</div></div></div>
    <div class="grid g2">
      <div class="card"><h3>Notas por pilar</h3>${(a.pillars || []).map((x) => html`<div style="margin:10px 0"><div class="row between small"><span>${x.name}</span><b>${x.score ?? 'N/A'}</b></div>
        <div class="bar ${x.score == null ? '' : x.score < 40 ? 'red' : x.score < 60 ? 'amber' : 'teal'}"><i style="width:${Math.max(0, Math.min(100, +x.score || 0))}%"></i></div></div>`)}</div>
      <div class="card"><h3>Prioridades</h3>${(a.priorities || []).map((x, i) => html`<div style="margin-bottom:10px"><b>${i + 1}. ${PILLARS.find((pp) => pp.id === x.id)?.name || x.id}</b> <span class="xs muted">${x.nota ?? ''}/100</span>
        ${(x.itens || []).map((it) => html`<p class="small" style="margin:2px 0 0">• Respondeu “${it.rotulo}” para: ${it.t}</p>`)}</div>`)}
        ${(a.unknowns || []).length ? html`<h3 style="margin-top:16px">O que a operação ainda não enxerga</h3><ul class="small">${a.unknowns.map((u) => html`<li><b>${u.pillar}:</b> ${u.t}</li>`)}</ul>` : ''}</div></div>
    <div class="grid g2">${bloco('identificacao', 'Identificação')}${bloco('estrutura', 'Estrutura e operação')}${bloco('dores', 'Prioridades e dores')}${bloco('decisao', 'Momento e decisão')}</div>
    ${Object.keys(resp).length ? html`<div class="card"><h3>Respostas item a item</h3>${PILLARS.map((pl) => {
      const itens = pl.items.filter((it) => resp[it.id]);
      return itens.length ? html`<h4 style="margin:16px 0 6px;color:var(--purple)">${pl.name}</h4><div class="table-wrap"><table class="t"><tbody>${itens.map((it) => html`<tr><td>${it.t}</td><td style="width:34%"><span class="badge ${['0', 'ns'].includes(resp[it.id].v) ? 'bad' : resp[it.id].v === '1' || resp[it.id].v === '2' ? 'warn' : resp[it.id].v === 'na' ? '' : 'ok'}">${resp[it.id].rotulo}</span></td></tr>`)}</tbody></table></div>` : '';
    })}</div>` : html`<div class="notice info">A ficha não foi importada: só há os dados do relatório. Importe a ficha para ver as respostas item a item e o perfil da operação.</div>`}
  </div>`);
}

// =================================================================== POSICIONAMENTO
async function posicionamento(p, ctx) {
  const a = ctx.aval, c = ctx.cliente;
  if (!a) { montar(p, html`<div class="card">${vazio('Sem preenchimento', c.positioning_enabled ? 'O cliente ainda não começou a ficha.' : 'Libere o diagnóstico de posicionamento na Visão geral.')}</div>`); return; }
  const A = analisar(c, a), ans = a.responses?.answers || {};
  montar(p, html`<div class="stack">
    <div class="card"><div class="card-head"><div><h2>Diagnóstico de posicionamento</h2>
      <p>${a.status === 'submitted' ? 'Enviado em ' + fmtDataHora(a.submitted_at) : 'Em preenchimento · ' + (a.progress_percent || 0) + '% (prévia parcial)'}</p></div>
      <div class="toolbar"><button class="btn purple" type="button" data-acao="pdf">Baixar PDF (relatório + respostas)</button>
        <button class="btn secondary" type="button" data-acao="csv">Planilha (CSV)</button><button class="btn secondary" type="button" data-acao="json">JSON</button></div></div>
      ${a.status === 'submitted' && a.notify_status !== 'enviado' ? html`<div class="notice warn">O envio automático do PDF por e-mail não foi confirmado. Baixe o PDF por aqui.</div>` : ''}
      <div class="grid g3" style="margin-top:12px">
        <div class="kpi accent"><div class="k-label">Nota geral</div><div class="k-value">${A.geral}</div></div>
        <div class="kpi"><div class="k-label">Maturidade</div><div class="k-value" style="font-size:20px">${A.nivel[0]}</div></div>
        <div class="kpi"><div class="k-label">Prioridade</div><div class="k-value" style="font-size:20px">${A.prioridade[0]?.nome || '—'}</div></div></div>
      <p style="margin-top:16px"><b>Posicionamento recomendado:</b> ${A.declaracao}</p>
      ${A.arr.map((x) => html`<div style="margin:8px 0"><div class="row between small"><span>${x.nome}</span><b>${x.valor}%</b></div><div class="bar"><i style="width:${x.valor}%"></i></div></div>`)}</div>
    <div class="card"><h3>Respostas</h3>${PERGUNTAS.map((qq) => html`<div style="padding:10px 0;border-bottom:1px solid var(--line-2)"><div class="xs muted">${qq.section} · ${qq.theme}</div><div class="small"><b>${qq.q}</b></div><div style="white-space:pre-wrap">${textoResposta(qq, ans[qq.id])}</div></div>`)}
      ${a.responses?.additional ? html`<p style="margin-top:12px"><b>Observações adicionais:</b> ${a.responses.additional}</p>` : ''}</div></div>`);
  const ctl = new AbortController();
  p.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    await ocupado(b, async () => {
      try {
        if (b.dataset.acao === 'pdf') {
          const { gerarPdfPosicionamento } = await import('../reports/posicionamento.js');
          baixar(await gerarPdfPosicionamento(c, a, ctx.logo), 'ELOGA_Posicionamento_' + nomeArquivo(c.name) + '.pdf');
          registrar('posicionamento.pdf_gerado', { entidade: 'assessments', id: a.id, cliente: c.id });
        }
        if (b.dataset.acao === 'csv') {
          baixar(csv(PERGUNTAS.map((qq) => ({ Etapa: qq.section, Tema: qq.theme, Pergunta: qq.q, Resposta: textoResposta(qq, ans[qq.id]) }))), 'ELOGA_Posicionamento_' + nomeArquivo(c.name) + '.csv');
          registrar('exportacao.planilha', { entidade: 'assessments', id: a.id, cliente: c.id });
        }
        if (b.dataset.acao === 'json') {
          baixar(json({ cliente: { nome: c.name, segmento: c.segment, cidade: c.city }, diagnostico: { status: a.status, enviado_em: a.submitted_at, respostas: a.responses } }), 'ELOGA_Posicionamento_' + nomeArquivo(c.name) + '.json');
          registrar('exportacao.json', { entidade: 'assessments', id: a.id, cliente: c.id });
        }
      } catch (err) { avisarErro(err); }
    });
  }, { signal: ctl.signal });
  return () => ctl.abort();
}

// =================================================================== HISTÓRICO
async function historico(p, ctx) {
  const linhas = await q(db.from('audit_log').select('*').eq('client_id', ctx.cliente.id).order('at', { ascending: false }).limit(300));
  montar(p, html`<div class="stack"><p class="small muted">Últimos 300 eventos deste cliente. Para filtros e exportação, use a tela Auditoria.</p>${tabelaAuditoria(linhas, { comCliente: false })}</div>`);
}

