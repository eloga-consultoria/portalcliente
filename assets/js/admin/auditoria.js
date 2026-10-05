// AUDITORIA (somente administração): quem fez o quê, quando e de onde.
// O log é imutável no banco (ninguém altera nem apaga) e guardado por 5 anos.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, fmtDataHora, baixar, debounce } from '../core/dom.js';
import { avisarErro, carregando, vazio, ocupado } from '../core/ui.js';
import { csv } from './exportar.js';

export const ACOES = {
  'clients.criado': 'Cliente cadastrado', 'clients.alterado': 'Cadastro alterado', 'clients.excluido': 'Cadastro apagado',
  'cliente.excluido_definitivo': 'Cliente excluído definitivamente', 'cliente.aberto': 'Cadastro consultado',
  'profiles.criado': 'Login vinculado ao cliente', 'profiles.alterado': 'Perfil de acesso alterado', 'profiles.excluido': 'Login desvinculado',
  'acesso.criado': 'Acesso ao portal criado', 'acesso.senha_redefinida': 'Nova senha gerada', 'acesso.email_alterado': 'E-mail de acesso alterado',
  'acesso.bloqueado': 'Acesso bloqueado', 'acesso.desbloqueado': 'Acesso desbloqueado', 'acesso.negado': 'Acesso negado',
  'sessao.login': 'Entrou no portal', 'sessao.logout': 'Saiu do portal', 'sessao.expirada': 'Sessão encerrada por inatividade', 'sessao.senha_alterada': 'Trocou a própria senha',
  'mfa.ativado': 'Verificação em duas etapas ativada', 'consents.criado': 'Termo LGPD aceito',
  'posicionamento.liberado': 'Posicionamento liberado', 'posicionamento.bloqueado': 'Posicionamento retirado',
  'assessments.criado': 'Posicionamento iniciado pelo cliente', 'assessments.alterado': 'Posicionamento alterado', 'assessments.excluido': 'Respostas do posicionamento apagadas',
  'posicionamento.enviado': 'Posicionamento enviado pelo cliente', 'posicionamento.email_enviado': 'PDF do posicionamento enviado à ELOGA',
  'posicionamento.email_falhou': 'Falha no e-mail do posicionamento', 'posicionamento.pdf_gerado': 'PDF do posicionamento gerado',
  'self_assessments.criado': 'Autodiagnóstico importado', 'self_assessments.alterado': 'Autodiagnóstico alterado', 'self_assessments.excluido': 'Autodiagnóstico removido',
  'operational_diagnoses.criado': 'Diagnóstico operacional iniciado', 'operational_diagnoses.alterado': 'Diagnóstico operacional atualizado',
  'operational_diagnoses.excluido': 'Diagnóstico operacional removido', 'relatorio.pdf_gerado': 'PDF do relatório gerado',
  'proposals.criado': 'Proposta emitida', 'proposals.alterado': 'Situação da proposta alterada', 'proposals.excluido': 'Proposta removida', 'proposta.pdf_gerado': 'PDF da proposta gerado',
  'importacao.concluida': 'Importação de PDF concluída', 'exportacao.planilha': 'Planilha exportada', 'exportacao.json': 'Dados exportados (JSON)',
  'backup.exportado': 'Backup completo exportado', 'auditoria.exportada': 'Auditoria exportada', 'auditoria.expurgo': 'Expurgo automático (5 anos)',
};
const GRUPOS = [
  ['', 'Todas as ações'], ['sessao.', 'Acessos e sessões'], ['acesso.', 'Gestão de acessos'], ['clients.', 'Cadastro de clientes'],
  ['cliente.excluido_definitivo', 'Exclusões definitivas'], ['posicionamento.', 'Posicionamento'], ['self_assessments.', 'Importações'],
  ['operational_diagnoses.', 'Diagnóstico operacional'], ['propos', 'Propostas'], ['relatorio.', 'Relatórios'], ['exportacao.', 'Exportações'], ['backup.', 'Backups'],
];
export const rotuloAcao = (a) => ACOES[a] || a;
const CRITICAS = /excluido|bloqueado|negado|falhou|expurgo|backup|exportacao|exportada/;

export function tabelaAuditoria(linhas, { comCliente = true } = {}) {
  if (!linhas.length) return vazio('Nenhum registro', 'Não há eventos para os filtros escolhidos.');
  return html`<div class="table-wrap"><table class="t"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th>${comCliente ? html`<th>Cliente</th>` : ''}<th>Detalhes</th></tr></thead><tbody>
    ${linhas.map((l) => html`<tr>
      <td class="nowrap">${fmtDataHora(l.at)}</td>
      <td><b>${l.actor_email || 'Sistema'}</b><div class="xs muted">${l.actor_role || ''}${l.ip ? ' · ' + l.ip : ''}</div></td>
      <td><span class="badge ${CRITICAS.test(l.action) ? 'warn' : ''}">${rotuloAcao(l.action)}</span></td>
      ${comCliente ? html`<td>${l.client_name || '—'}</td>` : ''}
      <td>${Object.keys(l.details || {}).length ? html`<details><summary class="linkbtn xs">ver</summary><div class="diff">${JSON.stringify(l.details, null, 2)}</div></details>` : ''}</td></tr>`)}
  </tbody></table></div>`;
}

const POR_PAGINA = 100;

export async function render(el) {
  const ini = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const filtro = { de: ini, ate: new Date().toISOString().slice(0, 10), grupo: '', cliente: '', usuario: '', pagina: 0, aba: 'eventos' };
  const desde30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [total, criticos, exclusoes, exportacoes] = await Promise.all([
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30),
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30).or('action.like.%negado%,action.like.%falhou%,action.like.acesso.bloqueado'),
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30).like('action', '%excluido%'),
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30).or('action.like.exportacao.%,action.like.backup.%,action.eq.auditoria.exportada'),
  ]);
  montar(el, html`<div class="wrap">
    <div class="page-head"><div><span class="eyebrow">Governança</span><h1>Auditoria</h1>
      <p>Registro imutável de acessos e alterações, guardado por 5 anos. Visível somente para a administração.</p></div></div>
    <div class="grid g4" style="margin-bottom:24px">
      <div class="kpi accent"><div class="k-label">Eventos · 30 dias</div><div class="k-value">${total.count ?? '—'}</div></div>
      <div class="kpi"><div class="k-label">Falhas e bloqueios</div><div class="k-value">${criticos.count ?? '—'}</div><div class="k-note">acessos negados, e-mails com falha, bloqueios</div></div>
      <div class="kpi"><div class="k-label">Exclusões</div><div class="k-value">${exclusoes.count ?? '—'}</div></div>
      <div class="kpi"><div class="k-label">Exportações e backups</div><div class="k-value">${exportacoes.count ?? '—'}</div></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-aba="eventos" aria-selected="true">Eventos do portal</button>
      <button class="tab" role="tab" data-aba="auth" aria-selected="false">Logins (Supabase Auth)</button></div>
    <div class="filters" id="filtros">
      <div class="field"><label for="f-de">De</label><input id="f-de" type="date" value="${filtro.de}"></div>
      <div class="field"><label for="f-ate">Até</label><input id="f-ate" type="date" value="${filtro.ate}"></div>
      <div class="field so-eventos"><label for="f-grupo">Tipo de ação</label><select id="f-grupo">${GRUPOS.map(([v, t]) => html`<option value="${v}">${t}</option>`)}</select></div>
      <div class="field so-eventos"><label for="f-cli">Cliente</label><input id="f-cli" type="search" placeholder="Nome da clínica"></div>
      <div class="field"><label for="f-usu">Usuário</label><input id="f-usu" type="search" placeholder="E-mail"></div>
      <div class="field" style="flex:0 0 auto"><button class="btn secondary" type="button" id="exportar">Exportar CSV</button></div>
    </div>
    <div id="lista"></div>
    <div class="row between" style="margin-top:12px" id="paginacao"></div></div>`);

  const lista = $('#lista', el);
  let ultimo = [];
  async function carregar() {
    montar(lista, carregando());
    try {
      if (filtro.aba === 'auth') {
        const linhas = await q(db.rpc('admin_auth_events', { p_since: filtro.de + 'T00:00:00', p_limit: 1000 }));
        const ate = new Date(filtro.ate + 'T23:59:59');
        ultimo = linhas.filter((l) => new Date(l.at) <= ate && (!filtro.usuario || String(l.actor || '').toLowerCase().includes(filtro.usuario.toLowerCase())));
        montar(lista, ultimo.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Quando</th><th>Usuário</th><th>Evento</th><th>IP</th></tr></thead><tbody>
          ${ultimo.map((l) => html`<tr><td class="nowrap">${fmtDataHora(l.at)}</td><td>${l.actor || '—'}</td><td>${traduzAuth(l.action)}</td><td>${l.ip || '—'}</td></tr>`)}</tbody></table></div>`
          : vazio('Nenhum login no período'));
        montar($('#paginacao', el), html``);
        return;
      }
      let cons = db.from('audit_log').select('*').gte('at', filtro.de + 'T00:00:00').lte('at', filtro.ate + 'T23:59:59')
        .order('at', { ascending: false }).range(filtro.pagina * POR_PAGINA, filtro.pagina * POR_PAGINA + POR_PAGINA);
      if (filtro.grupo) cons = filtro.grupo.endsWith('.') || filtro.grupo === 'propos' ? cons.like('action', filtro.grupo + '%') : cons.eq('action', filtro.grupo);
      if (filtro.cliente) cons = cons.ilike('client_name', '%' + filtro.cliente.replace(/[%_]/g, '') + '%');
      if (filtro.usuario) cons = cons.ilike('actor_email', '%' + filtro.usuario.replace(/[%_]/g, '') + '%');
      const linhas = await q(cons);
      const temMais = linhas.length > POR_PAGINA;
      ultimo = linhas.slice(0, POR_PAGINA);
      montar(lista, tabelaAuditoria(ultimo));
      montar($('#paginacao', el), html`<span class="small muted">Página ${filtro.pagina + 1}</span><div class="toolbar">
        <button class="btn sm secondary" type="button" id="ant" ${filtro.pagina === 0 ? html`disabled` : ''}>Anteriores</button>
        <button class="btn sm secondary" type="button" id="prox" ${temMais ? '' : html`disabled`}>Mais antigos</button></div>`);
      $('#ant', el)?.addEventListener('click', () => { filtro.pagina--; carregar(); });
      $('#prox', el)?.addEventListener('click', () => { filtro.pagina++; carregar(); });
    } catch (e) { avisarErro(e); montar(lista, vazio('Não foi possível carregar a auditoria', 'Confirme que as migrations foram aplicadas.')); }
  }
  const recarregar = debounce(() => { filtro.pagina = 0; carregar(); }, 350);
  const ligar = (id, k) => $(id, el).addEventListener('input', (e) => { filtro[k] = e.target.value; recarregar(); });
  ligar('#f-de', 'de'); ligar('#f-ate', 'ate'); ligar('#f-grupo', 'grupo'); ligar('#f-cli', 'cliente'); ligar('#f-usu', 'usuario');
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
    filtro.aba = b.dataset.aba;
    el.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    el.querySelectorAll('.so-eventos').forEach((x) => x.classList.toggle('hidden', filtro.aba === 'auth'));
    carregar();
  }));
  $('#exportar', el).addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    const linhas = filtro.aba === 'auth'
      ? ultimo.map((l) => ({ Quando: fmtDataHora(l.at), Usuario: l.actor, Evento: traduzAuth(l.action), IP: l.ip }))
      : ultimo.map((l) => ({ Quando: fmtDataHora(l.at), Usuario: l.actor_email || 'Sistema', Papel: l.actor_role, Acao: rotuloAcao(l.action), Codigo: l.action,
          Cliente: l.client_name, IP: l.ip, Detalhes: JSON.stringify(l.details) }));
    baixar(csv(linhas), `ELOGA_Auditoria_${filtro.de}_a_${filtro.ate}.csv`);
    await registrar('auditoria.exportada', { detalhes: { de: filtro.de, ate: filtro.ate, registros: linhas.length, aba: filtro.aba } });
  }));
  carregar();
}

function traduzAuth(a) {
  return ({ login: 'Login', logout: 'Logout', token_refreshed: 'Sessão renovada', token_revoked: 'Sessão revogada', user_modified: 'Usuário alterado',
    user_recovery_requested: 'Pedido de recuperação de senha', user_signedup: 'Usuário criado', user_deleted: 'Usuário excluído',
    user_updated_password: 'Senha alterada', mfa_code_login: 'Login com MFA', factor_in_progress: 'MFA em cadastro', verification_attempted: 'Verificação MFA',
    user_invited: 'Convite enviado', user_confirmation_requested: 'Confirmação solicitada' })[a] || a;
}
