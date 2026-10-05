// Plano de ação e indicadores (Painel Mestre PDCA) em modo somente leitura para o cliente.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $ } from '../core/dom.js';
import { vazio } from '../core/ui.js';
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
  montar(el, html`<div class="wrap"><div class="page-head"><div><a href="#/inicio" class="small">← Início</a>
    <h1>${so === 'dashboard' ? 'Indicadores do projeto' : 'Plano de ação'}</h1><p>Somente leitura · atualizado pela ELOGA</p></div></div><div id="caixa-painel"></div></div>`);
  registrar('cliente.plano_aberto', { entidade: 'action_plan_views', id: so });
  return montarPainel($('#caixa-painel', el), { dados: linha.dados, modo: 'cliente', so: restricao, ir: so });
}
