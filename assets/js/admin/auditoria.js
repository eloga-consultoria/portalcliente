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
  'acesso.bloqueado': 'Acesso bloqueado', 'acesso.periodo_alterado': 'Período de acesso alterado', 'acesso.desbloqueado': 'Acesso desbloqueado', 'acesso.negado': 'Acesso negado',
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
  'backup.exportado': 'Backup completo exportado', 'documento.publicado': 'Documento publicado para o cliente',
  'client_documents.criado': 'Documento publicado', 'client_documents.alterado': 'Publicação alterada', 'client_documents.excluido': 'Documento retirado do portal',
  'plano.criado': 'Plano de ação criado', 'action_plans.criado': 'Plano de ação criado', 'action_plans.excluido': 'Plano de ação removido',
  'materials.criado': 'Material cadastrado', 'materials.excluido': 'Material excluído', 'material_access.criado': 'Material liberado ao cliente',
  'material_access.alterado': 'Permissão de download alterada', 'material_access.excluido': 'Material retirado do cliente', 'material.liberacoes': 'Liberações de material salvas',
  'configuracao.catalogo_salvo': 'Catálogo de programas salvo', 'app_settings.criado': 'Configuração criada', 'app_settings.alterado': 'Configuração alterada',
  'cliente.documento_aberto': 'Cliente abriu documento', 'cliente.material_aberto': 'Cliente abriu material', 'cliente.plano_aberto': 'Cliente abriu o plano de ação', 'cliente.plano_editado': 'Cliente editou o plano de ação', 'cliente.planilha_enviada': 'Planilha enviada ao Drive da ELOGA', 'cliente.planilha_falhou': 'Falha ao enviar planilha ao Drive', 'material_respostas.criado': 'Cliente começou a preencher planilha', 'material_respostas.excluido': 'Respostas de planilha removidas', 'plano.edicao_cliente': 'Edição do plano pelo cliente (liberada/retirada)', 'auditoria.exportada': 'Auditoria exportada', 'auditoria.expurgo': 'Expurgo automático (5 anos)',
};
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
// Acessos da administração exibidos na tela (as demais ações do admin continuam registradas no banco
// por 5 anos e saem na exportação completa feita pelo backup).
const ACESSOS_ADMIN = ['sessao.login', 'sessao.logout', 'sessao.expirada', 'sessao.senha_alterada', 'mfa.ativado', 'acesso.negado'];

export async function render(el) {
  const hojeIso = new Date().toISOString().slice(0, 10);
  const filtro = { de: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), ate: hojeIso, cliente: '', email: '', pagina: 0, aba: 'clientes' };
  const desde30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [clientes, acoesCli, acessosAdm, negados] = await Promise.all([
    q(db.from('clients').select('id, name, access_email').order('name')),
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30).eq('actor_role', 'client'),
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30).eq('actor_role', 'admin').in('action', ACESSOS_ADMIN),
    db.from('audit_log').select('id', { count: 'exact', head: true }).gte('at', desde30).or('action.eq.acesso.negado,action.like.%falhou%'),
  ]);
  const emails = [...new Set(clientes.map((c) => (c.access_email || '').toLowerCase()).filter(Boolean))].sort();

  montar(el, html`<div class="wrap">
    <div class="page-head"><div><span class="eyebrow">Governança</span><h1>Auditoria</h1>
      <p>Ações dos clientes no portal e acessos da administração. O registro completo é imutável e fica guardado por 5 anos.</p></div></div>
    <div class="grid g3" style="margin-bottom:24px">
      <div class="kpi accent"><div class="k-label">Ações de clientes · 30 dias</div><div class="k-value">${acoesCli.count ?? '—'}</div></div>
      <div class="kpi"><div class="k-label">Acessos da administração · 30 dias</div><div class="k-value">${acessosAdm.count ?? '—'}</div><div class="k-note">entradas, saídas e verificação em 2 etapas</div></div>
      <div class="kpi"><div class="k-label">Falhas e acessos negados · 30 dias</div><div class="k-value">${negados.count ?? '—'}</div></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-aba="clientes" aria-selected="true">Ações dos clientes</button>
      <button class="tab" role="tab" data-aba="admin" aria-selected="false">Acessos da administração</button></div>
    <div class="filters" id="filtros">
      <div class="field"><label for="f-de">De</label><input id="f-de" type="date" value="${filtro.de}"></div>
      <div class="field"><label for="f-ate">Até</label><input id="f-ate" type="date" value="${filtro.ate}"></div>
      <div class="field so-clientes"><label for="f-cli">Cliente</label><select id="f-cli"><option value="">Todos os clientes</option>${clientes.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></div>
      <div class="field so-clientes"><label for="f-email">E-mail</label><select id="f-email"><option value="">Todos os e-mails</option>${emails.map((m) => html`<option value="${m}">${m}</option>`)}</select></div>
      <div class="field" style="flex:0 0 auto"><button class="btn secondary" type="button" id="exportar">Exportar CSV</button></div>
    </div>
    <div id="lista"></div>
    <div class="row between" style="margin-top:12px" id="paginacao"></div></div>`);

  const lista = $('#lista', el);
  let ultimo = [];
  async function carregar() {
    montar(lista, carregando());
    try {
      let cons = db.from('audit_log').select('*').gte('at', filtro.de + 'T00:00:00').lte('at', filtro.ate + 'T23:59:59')
        .order('at', { ascending: false }).range(filtro.pagina * POR_PAGINA, filtro.pagina * POR_PAGINA + POR_PAGINA);
      if (filtro.aba === 'admin') cons = cons.eq('actor_role', 'admin').in('action', ACESSOS_ADMIN);
      else {
        cons = cons.eq('actor_role', 'client');
        if (filtro.cliente) cons = cons.eq('client_id', filtro.cliente);
        if (filtro.email) cons = cons.ilike('actor_email', filtro.email.replace(/[%_]/g, ''));
      }
      const linhas = await q(cons);
      const temMais = linhas.length > POR_PAGINA;
      ultimo = linhas.slice(0, POR_PAGINA);
      montar(lista, tabelaAuditoria(ultimo, { comCliente: filtro.aba === 'clientes' }));
      montar($('#paginacao', el), html`<span class="small muted">Página ${filtro.pagina + 1}</span><div class="toolbar">
        <button class="btn sm secondary" type="button" id="ant" ${filtro.pagina === 0 ? html`disabled` : ''}>Anteriores</button>
        <button class="btn sm secondary" type="button" id="prox" ${temMais ? '' : html`disabled`}>Mais antigos</button></div>`);
      $('#ant', el)?.addEventListener('click', () => { filtro.pagina--; carregar(); });
      $('#prox', el)?.addEventListener('click', () => { filtro.pagina++; carregar(); });
    } catch (e) { avisarErro(e); montar(lista, vazio('Não foi possível carregar a auditoria', 'Tente novamente em instantes.')); }
  }
  const recarregar = debounce(() => { filtro.pagina = 0; carregar(); }, 350);
  const ligar = (id, k) => $(id, el).addEventListener(id.startsWith('#f-d') || id === '#f-ate' ? 'input' : 'change', (e) => { filtro[k] = e.target.value; recarregar(); });
  ligar('#f-de', 'de'); ligar('#f-ate', 'ate'); ligar('#f-cli', 'cliente'); ligar('#f-email', 'email');
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
    filtro.aba = b.dataset.aba; filtro.pagina = 0;
    el.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    el.querySelectorAll('.so-clientes').forEach((x) => x.classList.toggle('hidden', filtro.aba !== 'clientes'));
    carregar();
  }));
  $('#exportar', el).addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    const linhas = ultimo.map((l) => ({ Quando: fmtDataHora(l.at), Usuario: l.actor_email || 'Sistema', Papel: l.actor_role, Acao: rotuloAcao(l.action), Codigo: l.action,
      Cliente: l.client_name, IP: l.ip, Detalhes: JSON.stringify(l.details) }));
    baixar(csv(linhas), `ELOGA_Auditoria_${filtro.aba === 'admin' ? 'acessos_admin' : 'clientes'}_${filtro.de}_a_${filtro.ate}.csv`);
    await registrar('auditoria.exportada', { detalhes: { de: filtro.de, ate: filtro.ate, registros: linhas.length, aba: filtro.aba } });
  }));
  carregar();
}
