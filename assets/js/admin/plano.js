// PLANO DE AÇÃO (Painel Mestre PDCA) do cliente, no painel administrativo.
// O painel original roda num quadro isolado (sandbox, origem opaca): não tem acesso à
// sessão do portal nem à internet. Os dados entram e saem só por mensagens validadas.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, debounce } from '../core/dom.js';
import { avisarErro } from '../core/ui.js';

/** Projeção que o cliente pode ver: só o plano PDCA e o necessário ao dashboard. */
export function projecaoCliente(dbPainel) {
  const out = { clients: {}, current: dbPainel?.current };
  for (const [id, c] of Object.entries(dbPainel?.clients || {})) {
    const pilares = {};
    for (const [k, p] of Object.entries(c.pilares || {})) pilares[k] = { ...p, nota: null, obs: '', criterios: (p.criterios || []).map(() => null), status: 'Não avaliado' };
    out.clients[id] = {
      nome: c.nome, logo: c.logo, periodoInicio: c.periodoInicio, periodoFim: c.periodoFim,
      plano: c.plano || [], planoVersao: c.planoVersao, pilaresPlano: c.pilaresPlano || [], dismissed: c.dismissed,
      pilares, swot: { forcas: [], fraquezas: [], oportunidades: [], ameacas: [] }, relatorios: {}, relCfg: c.relCfg,
    };
  }
  return out;
}

/** Monta o painel num iframe isolado. modo: 'admin' | 'cliente' (+ 'so=plano|dashboard'). */
export function montarPainel(caixa, { dados, modo = 'admin', so = '', ir = '', aoSalvar }) {
  const iframe = document.createElement('iframe');
  iframe.title = 'Plano de ação ELOGA';
  iframe.className = 'painel-frame';
  iframe.setAttribute('sandbox', modo === 'admin'
    ? 'allow-scripts allow-modals allow-downloads allow-popups allow-top-navigation-to-custom-protocols'
    : 'allow-scripts');
  iframe.src = 'assets/painel/painel-mestre.html' + (modo === 'cliente' ? '#cliente' + (so ? '&so=' + so : '') + (ir ? '&ir=' + ir : '') : '');
  const ouvir = (e) => {
    if (e.source !== iframe.contentWindow || !e.data || e.data.ponte !== 'eloga') return;
    if (e.data.tipo === 'pronto') iframe.contentWindow.postMessage({ ponte: 'eloga', tipo: 'dados', db: dados }, '*');
    if (e.data.tipo === 'salvar' && modo === 'admin' && e.data.db && typeof e.data.db === 'object') aoSalvar?.(e.data.db);
    if (e.data.tipo === 'altura' && Number.isFinite(e.data.h)) iframe.style.height = Math.max(640, Math.min(e.data.h + 20, 20000)) + 'px';
  };
  addEventListener('message', ouvir);
  caixa.replaceChildren(iframe);
  return () => removeEventListener('message', ouvir);
}

export async function render(p, ctx) {
  const c = ctx.cliente;
  const linha = await q(db.from('action_plans').select('data, updated_at').eq('client_id', c.id).maybeSingle());
  const semente = { clients: { [c.id]: { nome: c.name, cidade: c.city || '', logo: ctx.logo || '' } }, current: c.id };
  const lib = c.liberacoes || {};
  montar(p, html`<div class="stack">
    <div class="row between"><div><h2 class="serif" style="font-size:var(--t-2xl);margin:0">Plano de ação (PDCA)</h2>
      <p class="small muted" style="margin:4px 0 0">Salva automaticamente. O cliente vê ${lib.plano || lib.dashboard ? html`<b>${[lib.plano && 'o plano de ação', lib.dashboard && 'o dashboard'].filter(Boolean).join(' e ')}</b>, sem poder editar` : html`<b>nada</b> por enquanto`} · <a href="#/cliente/${c.id}/portal">ajustar liberações</a></p></div>
      <span id="flag-plano" class="saveflag" aria-live="polite">${linha ? 'Tudo salvo' : 'Novo plano'}</span></div>
    <div id="caixa-painel"></div></div>`);
  const flag = (t, k = '') => { const f = $('#flag-plano', p); if (f) { f.textContent = t; f.className = 'saveflag ' + k; } };
  let primeiro = !linha;
  const gravar = debounce(async (dbPainel) => {
    if (!dbPainel?.clients || !Object.keys(dbPainel.clients).length) return;
    flag('Salvando...');
    try {
      await q(db.from('action_plans').upsert({ client_id: c.id, data: dbPainel }));
      await q(db.from('action_plan_views').upsert({ client_id: c.id, dados: projecaoCliente(dbPainel) }));
      if (primeiro) { primeiro = false; registrar('plano.criado', { entidade: 'action_plans', id: c.id, cliente: c.id }); }
      flag('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 'ok');
    } catch (e) { flag('Não salvo', 'bad'); avisarErro(e); }
  }, 900);
  const desligar = montarPainel($('#caixa-painel', p), { dados: linha?.data?.clients ? linha.data : semente, modo: 'admin', aoSalvar: gravar });
  return () => { gravar.flush(); desligar(); };
}
