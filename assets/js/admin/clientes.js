// Painel administrativo: indicadores, alertas e lista de clientes.
import { db, q } from '../core/api.js';
import { CONFIG } from '../config.js';
import { html, montar, $, fmtData, debounce, slug } from '../core/dom.js';
import { avisar, avisarErro, janela, vazio } from '../core/ui.js';
import { ETAPAS } from './cliente.js';
import { ir } from '../app.js';

const ORDEM = ['lead', 'autodiagnostico', 'diagnostico_operacional', 'relatorio_emitido', 'proposta_emitida', 'cliente_ativo'];

export async function render(el) {
  const [clientes, avals, autos, propostas, perfis, backups] = await Promise.all([
    q(db.from('clients').select('id, name, segment, city, stage, is_active, access_expires_at, access_email, positioning_enabled, updated_at, created_at').order('updated_at', { ascending: false })),
    q(db.from('assessments').select('client_id, status, progress_percent, notify_status, submitted_at, created_at').order('created_at', { ascending: false })),
    q(db.from('self_assessments').select('client_id, overall, level, lead_class, created_at').order('created_at', { ascending: false })),
    q(db.from('proposals').select('client_id, status, code, issued_at')),
    q(db.from('profiles').select('client_id').neq('role', 'admin')),
    q(db.from('audit_log').select('at').eq('action', 'backup.exportado').order('at', { ascending: false }).limit(1)),
  ]);
  const ultimo = (lista, id) => lista.find((x) => x.client_id === id);
  const comLogin = new Set(perfis.map((x) => x.client_id));
  const agora = new Date(), em7 = new Date(Date.now() + 7 * 86400000);
  const linhas = clientes.map((c) => ({ c, aval: ultimo(avals, c.id), auto: ultimo(autos, c.id), props: propostas.filter((p) => p.client_id === c.id), login: comLogin.has(c.id) }));

  const expirando = linhas.filter(({ c, login }) => login && c.is_active && c.access_expires_at && new Date(c.access_expires_at) > agora && new Date(c.access_expires_at) <= em7);
  const falhaEmail = linhas.filter(({ aval }) => aval?.status === 'submitted' && aval.notify_status !== 'enviado');
  const diasBackup = backups[0] ? Math.floor((agora - new Date(backups[0].at)) / 86400000) : null;
  const propAbertas = propostas.filter((p) => ['emitida', 'enviada'].includes(p.status)).length;
  const aceitas = propostas.filter((p) => p.status === 'aceita').length;
  const decididas = propostas.filter((p) => ['aceita', 'recusada'].includes(p.status)).length;

  montar(el, html`<div class="wrap">
    <div class="page-head"><div><span class="eyebrow">Painel administrativo</span><h1>Clientes</h1><p>Do autodiagnóstico importado à proposta aceita.</p></div>
      <div class="toolbar"><a class="btn purple" href="#/importar">Importar autodiagnóstico</a><button class="btn primary" type="button" id="novo">Novo cliente</button></div></div>

    ${diasBackup === null || diasBackup > CONFIG.lembreteBackupDias ? html`<div class="notice warn" style="margin-bottom:16px">
      ${diasBackup === null ? 'Nenhum backup exportado pelo portal ainda.' : `Último backup há ${diasBackup} dias.`} <a href="#/backup">Gerar backup agora</a>.</div>` : ''}
    ${falhaEmail.length ? html`<div class="notice bad" style="margin-bottom:16px"><b>Posicionamento sem e-mail confirmado:</b> ${falhaEmail.map(({ c }, i) => html`${i ? ', ' : ''}<a href="#/cliente/${c.id}/posicionamento">${c.name}</a>`)}. Baixe o PDF pelo painel.</div>` : ''}
    ${expirando.length ? html`<div class="notice info" style="margin-bottom:16px"><b>Acessos que expiram em 7 dias:</b> ${expirando.map(({ c }, i) => html`${i ? ', ' : ''}<a href="#/cliente/${c.id}">${c.name}</a> (${fmtData(c.access_expires_at)})`)}.</div>` : ''}

    <div class="grid g4" style="margin-bottom:24px">
      <div class="kpi accent"><div class="k-label">Clientes</div><div class="k-value">${clientes.length}</div><div class="k-note" style="color:#a9bcc6">${linhas.filter((l) => l.auto).length} com autodiagnóstico importado</div></div>
      <div class="kpi"><div class="k-label">Diagnósticos em andamento</div><div class="k-value">${clientes.filter((c) => ['autodiagnostico', 'diagnostico_operacional'].includes(c.stage)).length}</div><div class="k-note">aguardando sessão ou relatório</div></div>
      <div class="kpi"><div class="k-label">Propostas em aberto</div><div class="k-value">${propAbertas}</div><div class="k-note">${decididas ? `conversão ${Math.round(aceitas / decididas * 100)}% (${aceitas} de ${decididas})` : 'sem propostas decididas'}</div></div>
      <div class="kpi"><div class="k-label">Posicionamento</div><div class="k-value">${avals.filter((a) => a.status === 'submitted').length}</div><div class="k-note">enviados · ${clientes.filter((c) => c.positioning_enabled).length} liberados</div></div>
    </div>

    <div class="filters">
      <div class="field"><label for="busca">Buscar</label><input id="busca" type="search" placeholder="Nome, cidade ou segmento"></div>
      <div class="field"><label for="f-etapa">Etapa</label><select id="f-etapa"><option value="">Todas</option>${Object.entries(ETAPAS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
      <div class="field"><label for="f-acesso">Acesso ao portal</label><select id="f-acesso"><option value="">Todos</option><option value="ativo">Ativo</option><option value="expirado">Expirado</option><option value="bloqueado">Bloqueado</option><option value="sem">Sem acesso</option></select></div>
    </div>
    <div id="tabela"></div></div>`);

  function situacaoAcesso({ c, login }) {
    if (!login) return ['sem', 'Sem acesso', ''];
    if (!c.is_active) return ['bloqueado', 'Bloqueado', 'bad'];
    if (c.access_expires_at && new Date(c.access_expires_at) <= agora) return ['expirado', 'Expirado', 'warn'];
    return ['ativo', c.access_expires_at ? 'Até ' + fmtData(c.access_expires_at) : 'Ativo', 'ok'];
  }
  function pipeline(stage) {
    const i = ORDEM.indexOf(stage);
    if (i < 0) return html`<span class="badge ${stage === 'nao_fechou' ? 'bad' : ''}">${ETAPAS[stage] || stage}</span>`;
    return html`<div class="pipeline" aria-label="${ETAPAS[stage]}">${['Auto', 'Sessão', 'Relatório', 'Proposta', 'Ativo'].map((t, k) => html`<span class="${k + 1 < i ? 'done' : k + 1 === i ? 'on' : ''}">${t}</span>`)}</div>`;
  }

  const desenhar = () => {
    const termo = $('#busca', el).value.trim().toLowerCase(), etapa = $('#f-etapa', el).value, acesso = $('#f-acesso', el).value;
    const filtradas = linhas.filter((l) => (!termo || [l.c.name, l.c.city, l.c.segment].join(' ').toLowerCase().includes(termo))
      && (!etapa || l.c.stage === etapa) && (!acesso || situacaoAcesso(l)[0] === acesso));
    montar($('#tabela', el), filtradas.length ? html`<div class="table-wrap"><table class="t"><thead><tr>
        <th>Cliente</th><th>Etapa</th><th>Autodiagnóstico</th><th>Acesso</th><th>Posicionamento</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>
      ${filtradas.map((l) => { const ac = situacaoAcesso(l); return html`<tr>
        <td class="client-cell"><b><a href="#/cliente/${l.c.id}">${l.c.name}</a></b><span class="xs muted">${[l.c.segment, l.c.city].filter(Boolean).join(' · ')}</span></td>
        <td>${pipeline(l.c.stage)}</td>
        <td>${l.auto ? html`<b>${l.auto.overall ?? '—'}</b><span class="xs muted">/100 · ${l.auto.level || ''}${l.auto.lead_class ? ' · classe ' + l.auto.lead_class : ''}</span>` : html`<span class="xs muted">—</span>`}</td>
        <td><span class="badge ${ac[2]}">${ac[1]}</span></td>
        <td>${!l.c.positioning_enabled && !l.aval ? html`<span class="xs muted">Não liberado</span>`
          : !l.aval ? html`<span class="badge purple">Liberado</span>`
          : l.aval.status === 'draft' ? html`<span class="badge warn">${l.aval.progress_percent || 0}%</span>`
          : html`<span class="badge ok">Enviado</span>`}</td>
        <td><a class="btn sm secondary" href="#/cliente/${l.c.id}">Abrir</a></td></tr>`; })}
      </tbody></table></div>` : vazio(linhas.length ? 'Nenhum cliente com esses filtros' : 'Nenhum cliente ainda', linhas.length ? '' : 'Importe um autodiagnóstico ou cadastre um cliente.'));
  };
  const redesenhar = debounce(desenhar, 200);
  ['#busca', '#f-etapa', '#f-acesso'].forEach((s) => $(s, el).addEventListener('input', redesenhar));
  $('#novo', el).addEventListener('click', novoCliente);
  desenhar();
}

export async function novoCliente(dados = {}) {
  let criado = null;
  await janela({
    titulo: 'Novo cliente',
    corpo: html`<form id="f-novo" class="grid g2" novalidate>
      <div class="field span-2"><label for="n-nome">Nome da clínica *</label><input id="n-nome" value="${dados.name || ''}" required autofocus></div>
      <div class="field"><label for="n-seg">Segmento</label><input id="n-seg" value="${dados.segment || ''}"></div>
      <div class="field"><label for="n-cid">Cidade / UF</label><input id="n-cid" value="${dados.city || ''}"></div>
      <div class="field"><label for="n-resp">Responsável</label><input id="n-resp" value="${dados.contact_name || ''}"></div>
      <div class="field"><label for="n-email">E-mail do responsável</label><input id="n-email" type="email" value="${dados.contact_email || ''}"></div>
      <div class="field"><label for="n-tel">WhatsApp</label><input id="n-tel" type="tel" value="${dados.phone || ''}"></div>
      <div class="field"><label for="n-orig">Origem</label><input id="n-orig" value="${dados.origin || 'Indicação'}"></div></form>
      <p class="xs muted" style="margin-top:12px">O acesso ao portal é opcional e pode ser criado depois, na página do cliente.</p>`,
    acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Cadastrar', classe: 'strong', valor: true }],
    validar: async (box) => {
      const v = (id) => box.querySelector(id).value.trim() || null;
      const nome = v('#n-nome');
      if (!nome) { avisar('Informe o nome da clínica.', 'bad'); return false; }
      const email = v('#n-email');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { avisar('E-mail inválido.', 'bad'); return false; }
      try {
        criado = await q(db.from('clients').insert({
          name: nome, slug: slug(nome) + '-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4),
          segment: v('#n-seg'), city: v('#n-cid'), contact_name: v('#n-resp'), contact_email: email, phone: v('#n-tel'),
          origin: v('#n-orig'), is_active: true, stage: 'lead', positioning_enabled: false,
        }).select().single());
        return true;
      } catch (e) { avisarErro(e); return false; }
    },
  });
  if (criado) { avisar('Cliente cadastrado.', 'ok'); ir('cliente', criado.id); }
  return criado;
}
