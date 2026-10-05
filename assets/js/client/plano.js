// Plano de ação e indicadores (Painel Mestre PDCA) para o cliente.
// Somente leitura, exceto quando a ELOGA libera a edição das ações: aí só a lista de ações
// é enviada, pela função cliente_salvar_plano, que valida tudo no servidor.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, debounce } from '../core/dom.js';
import { vazio, mensagemErro } from '../core/ui.js';
import { montarPainel } from '../admin/plano.js';

export async function render(el, [aba = 'plano'], sessao) {
  const lib = sessao.cliente?.liberacoes || {};
  const so = aba === 'dashboard' ? 'dashboard' : 'plano';
  const liberado = lib[so];
  const linha = liberado ? await q(db.from('action_plan_views').select('dados, updated_at').maybeSingle()) : null;
  if (!liberado || !Object.keys(linha?.dados?.clients || {}).length) {
    montar(el, html`<div class="wrap">${vazio('Ainda não disponível', 'A ELOGA vai liberar o acompanhamento assim que o plano estiver pronto.', html`<a class="btn secondary" href="#/inicio">Voltar ao início</a>`)}</div>`);
    return;
  }
  // Se os dois estiverem liberados, o cliente navega entre plano e dashboard; senão, só o liberado.
  const restricao = lib.plano && lib.dashboard ? '' : so;
  const editar = !!(lib.plano && lib.plano_editar);
  montar(el, html`<div class="wrap"><div class="page-head"><div><a href="#/inicio" class="small">← Início</a>
    <h1>${so === 'dashboard' ? 'Indicadores do projeto' : 'Plano de ação'}</h1>
    <p>${editar ? 'Você pode atualizar as ações: responsáveis, prazos, status, progresso e evidências. As alterações são salvas automaticamente.' : 'Somente leitura · atualizado pela ELOGA'}</p></div>
    ${editar ? html`<span id="flag-plano" class="saveflag" aria-live="polite">Tudo salvo</span>` : ''}</div><div id="caixa-painel"></div></div>`);
  registrar('cliente.plano_aberto', { entidade: 'action_plan_views', id: so });
  const flag = (t, k = '') => { const f = $('#flag-plano', el); if (f) { f.textContent = t; f.className = 'saveflag ' + k; } };
  const chave = sessao.perfil.client_id;
  const gravar = debounce(async (dbPainel) => {
    const c = dbPainel?.clients?.[chave] || Object.values(dbPainel?.clients || {})[0];
    if (!c || !Array.isArray(c.plano)) return;
    flag('Salvando...');
    try {
      await q(db.rpc('cliente_salvar_plano', { p_plano: c.plano }));
      flag('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 'ok');
    } catch (e) { flag('Não salvo: ' + mensagemErro(e), 'bad'); }
  }, 1500);
  const desligar = montarPainel($('#caixa-painel', el), { dados: linha.dados, modo: 'cliente', so: restricao, ir: so, editar, aoSalvar: editar ? gravar : undefined });
  return () => { if (editar) gravar.flush(); desligar(); };
}
