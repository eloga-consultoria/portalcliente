// LIBERAÇÕES E MATERIAIS de um cliente: tudo o que aparece no portal dele passa por aqui.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, fmtDataHora } from '../core/dom.js';
import { avisar, avisarErro, confirmar, ocupado, vazio } from '../core/ui.js';
import { estadoPadrao, mesclar } from './operacional-modelo.js';
import { carregarCatalogo } from './catalogo.js';
import { relatorioHtml, propostaHtml } from '../reports/documentos-operacionais.js';

/** HTML do documento pronto para o cliente: sem campos editáveis e sem scripts. */
export function htmlPublicavel(seguro) {
  return String(seguro).replace(/\scontenteditable="true"/g, '').replace(/\sdata-ed="[^"]*"/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+="[^"]*"/gi, '');
}

export async function render(p, ctx) {
  const c = ctx.cliente;
  const [docs, propostas, diag, materiais, acessos] = await Promise.all([
    q(db.from('client_documents').select('id, tipo, titulo, pode_baixar, publicado_em').eq('client_id', c.id)),
    q(db.from('proposals').select('id, code, issued_at, status, snapshot').eq('client_id', c.id).order('created_at', { ascending: false })),
    q(db.from('operational_diagnoses').select('id, data, report_issued_at').eq('client_id', c.id).order('updated_at', { ascending: false }).limit(1)),
    q(db.from('materials').select('id, titulo, tipo, tamanho').order('created_at', { ascending: false })),
    q(db.from('material_access').select('material_id, pode_baixar, liberado_em').eq('client_id', c.id)),
  ]);
  const doc = (t) => docs.find((d) => d.tipo === t);
  const lib = { ...(c.liberacoes || {}) };
  const acesso = Object.fromEntries(acessos.map((a) => [a.material_id, a]));
  const temLogin = ctx.perfis.length > 0;
  const ctl = new AbortController();

  const linhaDoc = (tipo, nome, extra) => {
    const d = doc(tipo);
    return html`<tr><td><b>${nome}</b><div class="xs muted">${d ? 'Publicado em ' + fmtDataHora(d.publicado_em) + ' · ' + d.titulo : 'Não publicado'}</div>${extra}</td>
      <td>${d ? html`<label class="check"><input type="checkbox" data-baixar="${tipo}" ${d.pode_baixar ? html`checked` : ''}> Pode baixar o PDF</label>` : ''}</td>
      <td class="nowrap"><button class="btn sm purple" type="button" data-publicar="${tipo}">${d ? 'Atualizar publicação' : 'Publicar'}</button>
        ${d ? html`<button class="btn sm danger" type="button" data-retirar="${tipo}">Retirar</button>` : ''}</td></tr>`;
  };

  montar(p, html`<div class="stack">
    ${!temLogin ? html`<div class="notice warn">Este cliente ainda não tem acesso ao portal. Crie o acesso na <a href="#/cliente/${c.id}/visao">Visão geral</a> para que ele veja o que for liberado.</div>` : ''}
    <div class="card"><div class="card-head"><div><h2>O que o cliente vê</h2><p>Nada aparece para o cliente sem a sua liberação. Tudo é somente leitura.</p></div></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Item</th><th>Opções</th><th></th></tr></thead><tbody>
        <tr><td><b>Diagnóstico de posicionamento</b><div class="xs muted">Ficha para o cliente preencher. Ele não vê o relatório.</div></td><td></td>
          <td><label class="check"><input type="checkbox" data-pos ${c.positioning_enabled ? html`checked` : ''}> Liberado</label></td></tr>
        <tr><td><b>Plano de ação (PDCA)</b><div class="xs muted">Demandas, responsáveis, prazos e situação. Sem diagnóstico, SWOT ou relatórios mensais.</div></td><td></td>
          <td><label class="check"><input type="checkbox" data-lib="plano" ${lib.plano ? html`checked` : ''}> Liberado</label></td></tr>
        <tr><td><b>Dashboard do plano</b><div class="xs muted">Indicadores de andamento das ações.</div></td><td></td>
          <td><label class="check"><input type="checkbox" data-lib="dashboard" ${lib.dashboard ? html`checked` : ''}> Liberado</label></td></tr>
        ${linhaDoc('relatorio', 'Relatório de diagnóstico', diag[0] ? '' : html`<div class="xs" style="color:var(--warn)">Ainda não há diagnóstico operacional.</div>`)}
        ${linhaDoc('proposta', 'Proposta', propostas.length ? html`<div class="field" style="margin-top:6px;max-width:320px"><label for="qual-proposta">Versão a publicar</label>
          <select id="qual-proposta">${propostas.map((x) => html`<option value="${x.id}">${x.code} · ${x.status}</option>`)}</select></div>` : html`<div class="xs" style="color:var(--warn)">Emita uma proposta antes de publicar.</div>`)}
      </tbody></table></div>
      <p class="xs muted" style="margin:10px 0 0">A publicação é uma fotografia do documento. Se você alterar o relatório ou emitir nova proposta, clique em “Atualizar publicação”.</p></div>

    <div class="card"><div class="card-head"><div><h2>Materiais liberados</h2><p>Cadastre novos materiais em <a href="#/materiais">Materiais</a>.</p></div></div>
      ${materiais.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Material</th><th>Tipo</th><th>Liberado</th><th>Pode baixar</th></tr></thead><tbody>
        ${materiais.map((m) => html`<tr><td>${m.titulo}</td><td>${m.tipo === 'link' ? 'Link' : 'Arquivo'}</td>
          <td><input type="checkbox" data-mat="${m.id}" aria-label="Liberar ${m.titulo}" ${acesso[m.id] ? html`checked` : ''}></td>
          <td>${m.tipo === 'arquivo' ? html`<input type="checkbox" data-mat-baixar="${m.id}" aria-label="Permitir download de ${m.titulo}" ${acesso[m.id]?.pode_baixar ? html`checked` : ''} ${acesso[m.id] ? '' : html`disabled`}>` : html`<span class="xs muted">—</span>`}</td></tr>`)}
      </tbody></table></div>` : vazio('Nenhum material cadastrado', 'Cadastre e-books, roteiros ou links na tela Materiais.')}</div></div>`);

  const salvarLib = async (k, v) => {
    lib[k] = v;
    await q(db.from('clients').update({ liberacoes: lib }).eq('id', c.id));
    c.liberacoes = { ...lib };
    avisar(v ? 'Liberado para o cliente.' : 'Liberação retirada.', 'ok');
  };

  async function publicar(tipo) {
    await carregarCatalogo();
    let titulo, corpo;
    if (tipo === 'relatorio') {
      if (!diag[0]) throw new Error('Ainda não há diagnóstico operacional para publicar.');
      const state = mesclar(estadoPadrao(), diag[0].data || {});
      corpo = htmlPublicavel(relatorioHtml({ state, cliente: c, autodiag: ctx.autodiag, logo: ctx.logo }));
      titulo = 'Relatório de Diagnóstico Operacional';
    } else {
      const escolhida = propostas.find((x) => x.id === $('#qual-proposta', p)?.value) || propostas[0];
      if (!escolhida) throw new Error('Emita uma proposta antes de publicar.');
      corpo = htmlPublicavel(propostaHtml({ state: mesclar(estadoPadrao(), escolhida.snapshot || {}), cliente: c, logo: ctx.logo, editavel: false }));
      titulo = 'Proposta ' + escolhida.code;
    }
    const atual = doc(tipo);
    await q(db.from('client_documents').upsert({ client_id: c.id, tipo, titulo, html: corpo, pode_baixar: atual?.pode_baixar ?? false, publicado_em: new Date().toISOString() }, { onConflict: 'client_id,tipo' }));
    registrar('documento.publicado', { entidade: 'client_documents', id: tipo, cliente: c.id, detalhes: { titulo } });
    avisar(titulo + ' publicado para o cliente.', 'ok');
  }

  p.addEventListener('change', async (e) => {
    const t = e.target;
    try {
      if (t.matches('[data-pos]')) {
        await q(db.from('clients').update({ positioning_enabled: t.checked, ...(t.checked ? { positioning_released_at: new Date().toISOString() } : {}) }).eq('id', c.id));
        c.positioning_enabled = t.checked; avisar(t.checked ? 'Posicionamento liberado.' : 'Liberação retirada.', 'ok');
      }
      if (t.dataset.lib) await salvarLib(t.dataset.lib, t.checked);
      if (t.dataset.baixar) {
        await q(db.from('client_documents').update({ pode_baixar: t.checked }).eq('client_id', c.id).eq('tipo', t.dataset.baixar));
        avisar(t.checked ? 'O cliente pode baixar o PDF.' : 'Somente visualização.', 'ok');
      }
      if (t.dataset.mat) {
        if (t.checked) await q(db.from('material_access').insert({ material_id: t.dataset.mat, client_id: c.id }));
        else await q(db.from('material_access').delete().eq('material_id', t.dataset.mat).eq('client_id', c.id));
        const b = p.querySelector(`[data-mat-baixar="${t.dataset.mat}"]`);
        if (b) { b.disabled = !t.checked; if (!t.checked) b.checked = false; }
        avisar(t.checked ? 'Material liberado.' : 'Material retirado.', 'ok');
      }
      if (t.dataset.matBaixar) {
        await q(db.from('material_access').update({ pode_baixar: t.checked }).eq('material_id', t.dataset.matBaixar).eq('client_id', c.id));
        avisar(t.checked ? 'Download permitido.' : 'Somente visualização.', 'ok');
      }
    } catch (err) { avisarErro(err); t.checked = !t.checked; }
  }, { signal: ctl.signal });

  p.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    await ocupado(b, async () => {
      try {
        if (b.dataset.publicar) { await publicar(b.dataset.publicar); ctl.abort(); await render(p, ctx); }
        if (b.dataset.retirar) {
          if (!(await confirmar('Retirar do portal do cliente?', 'O documento deixa de aparecer para o cliente. Você pode publicar de novo quando quiser.', { rotulo: 'Retirar', perigo: true }))) return;
          await q(db.from('client_documents').delete().eq('client_id', c.id).eq('tipo', b.dataset.retirar));
          avisar('Documento retirado do portal.', 'ok'); ctl.abort(); await render(p, ctx);
        }
      } catch (err) { avisarErro(err); }
    });
  }, { signal: ctl.signal });
  return () => ctl.abort();
}
