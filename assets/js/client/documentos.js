// Documento publicado pela ELOGA (relatório ou proposta), somente leitura.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, confiavel, imprimirDocumento, nomeArquivo, fmtData } from '../core/dom.js';
import { vazio } from '../core/ui.js';

export async function render(el, [tipo], sessao) {
  if (!['relatorio', 'proposta'].includes(tipo)) { location.hash = '#/inicio'; return; }
  const d = await q(db.from('client_documents').select('titulo, html, pode_baixar, publicado_em').eq('tipo', tipo).maybeSingle());
  if (!d) { montar(el, html`<div class="wrap">${vazio('Documento indisponível', 'Ele ainda não foi liberado ou foi retirado pela ELOGA.', html`<a class="btn secondary" href="#/inicio">Voltar ao início</a>`)}</div>`); return; }
  // HTML gerado pelo próprio portal; scripts e atributos de evento são removidos por precaução
  const seguro = String(d.html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '');
  document.body.classList.toggle('sem-impressao', !d.pode_baixar);
  montar(el, html`<div class="wrap" style="max-width:920px">
    <div class="page-head"><div><a href="#/inicio" class="small">← Início</a><h1>${d.titulo}</h1><p>Publicado em ${fmtData(d.publicado_em)}</p></div>
      ${d.pode_baixar ? html`<button class="btn primary" type="button" id="baixar">Baixar PDF</button>` : ''}</div>
    <div class="doc" id="doc-cliente">${confiavel(seguro)}</div></div>`);
  $('#baixar', el)?.addEventListener('click', () => imprimirDocumento($('#doc-cliente', el), 'ELOGA_' + nomeArquivo(d.titulo) + '_' + nomeArquivo(sessao.cliente?.name)));
  registrar('cliente.documento_aberto', { entidade: 'client_documents', id: tipo });
  return () => document.body.classList.remove('sem-impressao');
}
