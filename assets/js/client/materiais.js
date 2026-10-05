// Materiais liberados pela ELOGA. Arquivos com "só visualizar" abrem num leitor sem botão de download.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, urlSegura } from '../core/dom.js';
import { avisarErro, vazio, ocupado } from '../core/ui.js';

export async function render(el) {
  const acessos = await q(db.from('material_access').select('material_id, pode_baixar'));
  const mats = acessos.length ? await q(db.from('materials').select('id, titulo, descricao, tipo, url, storage_path, mime').in('id', acessos.map((a) => a.material_id))) : [];
  const pode = Object.fromEntries(acessos.map((a) => [a.material_id, a.pode_baixar]));
  montar(el, html`<div class="wrap" style="max-width:980px">
    <div class="page-head"><div><a href="#/inicio" class="small">← Início</a><h1>Materiais exclusivos</h1><p>Conteúdos liberados pela ELOGA para a sua clínica.</p></div></div>
    ${mats.length ? html`<div class="grid g2">${mats.map((m) => html`<div class="card"><h3>${m.titulo}</h3>${m.descricao ? html`<p class="small muted">${m.descricao}</p>` : ''}
      <div class="toolbar">${m.tipo === 'link' ? html`<a class="btn secondary" href="${urlSegura(m.url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
        : html`<button class="btn secondary" type="button" data-ver="${m.id}">Visualizar</button>${pode[m.id] ? html`<button class="btn primary" type="button" data-baixar="${m.id}">Baixar</button>` : ''}`}</div></div>`)}</div>`
      : vazio('Nenhum material disponível', 'Quando a ELOGA liberar materiais, eles aparecerão aqui.')}
    <div id="leitor" style="margin-top:20px"></div></div>`);

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = mats.find((x) => x.id === (b.dataset.ver || b.dataset.baixar)); if (!m) return;
    await ocupado(b, async () => {
      try {
        if (b.dataset.baixar) {
          const { data, error } = await db.storage.from('materiais').createSignedUrl(m.storage_path, 60, { download: m.titulo });
          if (error) throw error;
          location.href = data.signedUrl;
          registrar('cliente.material_aberto', { entidade: 'materials', id: m.id, detalhes: { download: true } });
          return;
        }
        const { data: blob, error } = await db.storage.from('materiais').download(m.storage_path);
        if (error) throw error;
        await mostrar($('#leitor', el), m, blob);
        registrar('cliente.material_aberto', { entidade: 'materials', id: m.id });
      } catch (err) { avisarErro(err); }
    });
  });
}

async function mostrar(caixa, m, blob) {
  montar(caixa, html`<div class="card"><div class="row between"><h2 style="margin:0">${m.titulo}</h2><button class="btn sm ghost" type="button" id="fechar-leitor">Fechar</button></div>
    <div id="paginas" class="leitor-paginas" style="margin-top:12px"></div></div>`);
  caixa.querySelector('#fechar-leitor').addEventListener('click', () => montar(caixa, html``));
  const alvo = caixa.querySelector('#paginas');
  alvo.addEventListener('contextmenu', (e) => e.preventDefault());
  if (m.mime !== 'application/pdf') {
    const img = document.createElement('img'); img.alt = m.titulo; img.src = URL.createObjectURL(blob); img.style.maxWidth = '100%';
    alvo.appendChild(img); caixa.scrollIntoView({ behavior: 'smooth' }); return;
  }
  const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('assets/vendor/pdfjs/pdf.worker.min.mjs', location.href).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1.5 });
    const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
    cv.style.cssText = 'width:100%;height:auto;display:block;margin:0 auto 12px;border:1px solid var(--line);border-radius:8px';
    alvo.appendChild(cv);
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  }
  caixa.scrollIntoView({ behavior: 'smooth' });
}
