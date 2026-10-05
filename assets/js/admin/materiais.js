// MATERIAIS: biblioteca de e-books, roteiros e links liberados por cliente.
// Arquivos ocupam o espaço do Supabase (1 GB no plano gratuito); links não ocupam espaço.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, fmtDataHora, slug, urlSegura } from '../core/dom.js';
import { avisar, avisarErro, confirmar, janela, ocupado, vazio } from '../core/ui.js';

const LIMITE_GRATUITO = 1024 ** 3;
const TIPOS = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const mb = (b) => (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';

export async function render(el) {
  const [materiais, acessos, clientes] = await Promise.all([
    q(db.from('materials').select('*').order('created_at', { ascending: false })),
    q(db.from('material_access').select('material_id, client_id, pode_baixar')),
    q(db.from('clients').select('id, name').order('name')),
  ]);
  const usado = materiais.reduce((s, m) => s + (+m.tamanho || 0), 0);
  const pct = Math.min(100, Math.round(usado / LIMITE_GRATUITO * 100));
  const ctl = new AbortController();

  montar(el, html`<div class="wrap" style="max-width:1080px">
    <div class="page-head"><div><span class="eyebrow">Portal do cliente</span><h1>Materiais</h1>
      <p>E-books, roteiros e ferramentas. Libere cada material por cliente, com ou sem download.</p></div></div>
    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><h2>Adicionar arquivo</h2><form id="f-arq" class="stack" novalidate>
        <div class="field"><label for="a-tit">Título</label><input id="a-tit" maxlength="200" required></div>
        <div class="field"><label for="a-desc">Descrição (opcional)</label><input id="a-desc" maxlength="1000"></div>
        <div class="field"><label for="a-arq">Arquivo (PDF, PNG, JPG ou WebP, até 20 MB)</label><input id="a-arq" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></div>
        <button class="btn strong" type="submit">Enviar arquivo</button></form></div>
      <div class="card"><h2>Adicionar link</h2><form id="f-link" class="stack" novalidate>
        <div class="field"><label for="l-tit">Título</label><input id="l-tit" maxlength="200" required></div>
        <div class="field"><label for="l-desc">Descrição (opcional)</label><input id="l-desc" maxlength="1000"></div>
        <div class="field"><label for="l-url">Endereço (https://...)</label><input id="l-url" type="url" placeholder="https://drive.google.com/..."></div>
        <p class="xs muted" style="margin:0">Para links do Google Drive, confira o compartilhamento no próprio Drive: é ele que controla quem consegue abrir.</p>
        <button class="btn strong" type="submit">Salvar link</button></form></div></div>
    <div class="card" style="margin-bottom:16px"><div class="row between"><b>Espaço usado por materiais</b><span class="small">${mb(usado)} de 1 GB (plano gratuito)</span></div>
      <div class="bar ${pct > 85 ? 'red' : pct > 60 ? 'amber' : 'teal'}" style="margin-top:8px"><i style="width:${Math.max(pct, 1)}%"></i></div>
      <p class="xs muted" style="margin:8px 0 0">O espaço do plano gratuito também inclui as logos dos clientes. Prefira links para vídeos e arquivos grandes.</p></div>
    <div class="card"><h2>Biblioteca</h2>
      ${materiais.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Material</th><th>Tipo</th><th>Clientes</th><th>Incluído em</th><th></th></tr></thead><tbody>
        ${materiais.map((m) => { const n = acessos.filter((a) => a.material_id === m.id).length; return html`<tr>
          <td><b>${m.titulo}</b>${m.descricao ? html`<div class="xs muted">${m.descricao}</div>` : ''}</td>
          <td>${m.tipo === 'link' ? html`<a href="${urlSegura(m.url)}" target="_blank" rel="noopener noreferrer">Link</a>` : html`Arquivo · ${mb(m.tamanho || 0)}`}</td>
          <td>${n ? n + ' cliente(s)' : html`<span class="muted">nenhum</span>`}</td><td class="nowrap">${fmtDataHora(m.created_at)}</td>
          <td class="nowrap"><button class="btn sm secondary" type="button" data-liberar="${m.id}">Liberar para…</button>
            <button class="btn sm danger" type="button" data-excluir="${m.id}">Excluir</button></td></tr>`; })}
      </tbody></table></div>` : vazio('Nenhum material ainda', 'Adicione um arquivo ou um link acima.')}</div></div>`);

  const recarregar = () => { ctl.abort(); render(el); };

  $('#f-arq', el).addEventListener('submit', (e) => { e.preventDefault(); ocupado(e.submitter, async () => {
    try {
      const tit = $('#a-tit', el).value.trim(), f = $('#a-arq', el).files[0];
      if (!tit) return avisar('Informe o título.', 'bad');
      if (!f) return avisar('Escolha o arquivo.', 'bad');
      if (!TIPOS[f.type]) return avisar('Use PDF, PNG, JPG ou WebP.', 'bad');
      if (f.size > 20 * 1048576) return avisar('O arquivo passa de 20 MB. Use um link do Drive.', 'bad');
      if (usado + f.size > LIMITE_GRATUITO * 0.95) return avisar('O espaço gratuito está quase no limite. Use um link do Drive.', 'bad');
      // Lê o arquivo antes de enviar: no celular, arquivos escolhidos direto do Drive/nuvem
      // podem não estar disponíveis e o envio falharia sem explicação.
      let conteudo;
      try { conteudo = new Blob([await f.arrayBuffer()], { type: f.type }); }
      catch { return avisar('Não foi possível ler o arquivo neste aparelho. Baixe-o para a memória do celular (ou use o computador) e tente de novo.', 'bad'); }
      const caminho = `${crypto.randomUUID()}/${slug(tit) || 'material'}.${TIPOS[f.type]}`;
      try {
        await q(db.storage.from('materiais').upload(caminho, conteudo, { contentType: f.type, upsert: false }));
      } catch (err) {
        if (/fetch|network|load failed/i.test(err?.message || '')) return avisar('O envio foi interrompido. Verifique a internet e tente de novo; para arquivos grandes, prefira o computador ou um link do Drive.', 'bad');
        throw err;
      }
      try {
        await q(db.from('materials').insert({ titulo: tit, descricao: $('#a-desc', el).value.trim() || null, tipo: 'arquivo', storage_path: caminho, tamanho: f.size, mime: f.type }));
      } catch (err) { await db.storage.from('materiais').remove([caminho]); throw err; }
      avisar('Arquivo adicionado.', 'ok'); recarregar();
    } catch (err) { avisarErro(err); }
  }); }, { signal: ctl.signal });

  $('#f-link', el).addEventListener('submit', (e) => { e.preventDefault(); ocupado(e.submitter, async () => {
    try {
      const tit = $('#l-tit', el).value.trim(), url = $('#l-url', el).value.trim();
      if (!tit) return avisar('Informe o título.', 'bad');
      if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(url)) return avisar('Use um endereço completo começando com https://', 'bad');
      await q(db.from('materials').insert({ titulo: tit, descricao: $('#l-desc', el).value.trim() || null, tipo: 'link', url }));
      avisar('Link adicionado.', 'ok'); recarregar();
    } catch (err) { avisarErro(err); }
  }); }, { signal: ctl.signal });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = materiais.find((x) => x.id === (b.dataset.liberar || b.dataset.excluir)); if (!m) return;
    if (b.dataset.excluir) {
      if (!(await confirmar('Excluir material?', `“${m.titulo}” deixa de aparecer para todos os clientes.`, { rotulo: 'Excluir', perigo: true }))) return;
      await ocupado(b, async () => {
        try {
          if (m.storage_path) await q(db.storage.from('materiais').remove([m.storage_path]));
          await q(db.from('materials').delete().eq('id', m.id));
          avisar('Material excluído.', 'ok'); recarregar();
        } catch (err) { avisarErro(err); }
      });
    }
    if (b.dataset.liberar) {
      const atuais = Object.fromEntries(acessos.filter((a) => a.material_id === m.id).map((a) => [a.client_id, a]));
      let escolha = null;
      const ok = await janela({ titulo: 'Liberar “' + m.titulo + '”', largo: true,
        corpo: clientes.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Cliente</th><th>Liberado</th>${m.tipo === 'arquivo' ? html`<th>Pode baixar</th>` : ''}</tr></thead><tbody>
          ${clientes.map((c) => html`<tr><td>${c.name}</td><td><input type="checkbox" data-c="${c.id}" ${atuais[c.id] ? html`checked` : ''} aria-label="Liberar para ${c.name}"></td>
            ${m.tipo === 'arquivo' ? html`<td><input type="checkbox" data-d="${c.id}" ${atuais[c.id]?.pode_baixar ? html`checked` : ''} aria-label="Download para ${c.name}"></td>` : ''}</tr>`)}</tbody></table></div>`
          : html`<p class="muted">Nenhum cliente cadastrado.</p>`,
        acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar liberações', classe: 'strong', valor: true }],
        validar: (box) => { escolha = clientes.map((c) => ({ id: c.id, on: box.querySelector(`[data-c="${c.id}"]`).checked, baixar: !!box.querySelector(`[data-d="${c.id}"]`)?.checked })); return true; } });
      if (!ok) return;
      try {
        for (const x of escolha) {
          if (x.on && !atuais[x.id]) await q(db.from('material_access').insert({ material_id: m.id, client_id: x.id, pode_baixar: x.baixar }));
          else if (x.on && atuais[x.id].pode_baixar !== x.baixar) await q(db.from('material_access').update({ pode_baixar: x.baixar }).eq('material_id', m.id).eq('client_id', x.id));
          else if (!x.on && atuais[x.id]) await q(db.from('material_access').delete().eq('material_id', m.id).eq('client_id', x.id));
        }
        registrar('material.liberacoes', { entidade: 'materials', id: m.id, detalhes: { titulo: m.titulo, clientes: escolha.filter((x) => x.on).length } });
        avisar('Liberações salvas.', 'ok'); recarregar();
      } catch (err) { avisarErro(err); }
    }
  }, { signal: ctl.signal });
  return () => ctl.abort();
}
