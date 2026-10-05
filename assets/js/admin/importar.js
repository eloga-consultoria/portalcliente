// IMPORTAÇÃO do autodiagnóstico do site (relatório e/ou ficha em PDF).
// Tudo acontece NO NAVEGADOR: o PDF não é enviado a servidor algum. Só os dados
// conferidos são gravados (e a impressão digital SHA-256 de cada arquivo).
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, $$, carregarScript, slug } from '../core/dom.js';
import { avisar, avisarErro, ocupado, mensagemErro } from '../core/ui.js';
import { PILLARS, SCALE, NA, LEVELS, levelOf } from '../import/autodiagnostico-modelo.js';
import { lerDadosEmbutidos, deDadosEmbutidos, lerRelatorioOcr, lerFichaOcr, combinar, tipoPeloTexto, similaridade, ROTULOS_CAMPOS } from '../import/leitores.js';
import { ir } from '../app.js';

const MAX_BYTES = 15 * 1024 * 1024;
const abs = (p) => new URL(p, location.href).href;

// ------------------------------------------------------------------ leitura do PDF
let pdfjs = null;
async function carregarPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = abs('assets/vendor/pdfjs/pdf.worker.min.mjs');
  }
  return pdfjs;
}

let ocrWorker = null;
async function ocr() {
  if (!ocrWorker) {
    await carregarScript('assets/vendor/tesseract/tesseract.min.js');
    ocrWorker = await window.Tesseract.createWorker('por', 1, {
      workerPath: abs('assets/vendor/tesseract/worker.min.js'),
      corePath: abs('assets/vendor/tesseract/'),
      langPath: abs('assets/vendor/tesseract/lang'),
      workerBlobURL: false, gzip: true,
    });
  }
  return ocrWorker;
}

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Texto de PDFs que tenham camada de texto (agrupa itens por linha). */
async function textoDaPagina(pagina) {
  const tc = await pagina.getTextContent();
  const linhas = [];
  for (const it of tc.items) {
    if (!it.str?.trim()) continue;
    const y = Math.round(it.transform[5]);
    let l = linhas.find((x) => Math.abs(x.y - y) <= 2);
    if (!l) { l = { y, partes: [] }; linhas.push(l); }
    l.partes.push({ x: it.transform[4], s: it.str });
  }
  return linhas.sort((a, b) => b.y - a.y).map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ')).join('\n');
}

async function lerArquivo(arquivo, progresso) {
  if (arquivo.size > MAX_BYTES) throw new Error(`“${arquivo.name}” tem mais de 15 MB. Confira se é o PDF certo.`);
  const buf = await arquivo.arrayBuffer();
  const cab = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
  if (cab !== '%PDF-') throw new Error(`“${arquivo.name}” não é um PDF válido.`);
  const hash = await sha256(buf);
  const lib = await carregarPdfJs();
  let doc;
  try { doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise; }
  catch (e) {
    if (e?.name === 'PasswordException') throw new Error(`“${arquivo.name}” está protegido por senha. Gere o PDF novamente sem senha.`);
    throw new Error(`“${arquivo.name}” está corrompido ou incompleto. Baixe o anexo do e-mail de novo.`);
  }
  if (doc.numPages > 10) throw new Error(`“${arquivo.name}” tem ${doc.numPages} páginas: não parece ser o relatório nem a ficha do autodiagnóstico.`);

  // 1) Dados embutidos (PDFs gerados após a correção do formulário): leitura exata
  progresso('Procurando dados embutidos...', 5);
  const meta = await doc.getMetadata().catch(() => ({}));
  const dados = lerDadosEmbutidos(meta?.info?.Keywords);
  if (dados) { progresso('Dados lidos com exatidão.', 100); return { r: deDadosEmbutidos(dados), hash, nome: arquivo.name }; }

  // 2) Camada de texto, se existir
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) paginas.push(await textoDaPagina(await doc.getPage(i)));
  let texto = paginas.join('\n');

  // 3) OCR das páginas (PDF em imagem)
  if (texto.replace(/\s/g, '').length < 200) {
    const w = await ocr();
    paginas.length = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      progresso(`Lendo a página ${i} de ${doc.numPages} (reconhecimento de texto)...`, 10 + Math.round((i - 1) / doc.numPages * 85));
      const pagina = await doc.getPage(i);
      const vp = pagina.getViewport({ scale: 2.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
      await pagina.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport: vp }).promise;
      const { data } = await w.recognize(canvas);
      paginas.push(data.text);
      canvas.width = canvas.height = 0;
    }
    texto = paginas.join('\n');
    if (texto.replace(/\s/g, '').length < 100) throw new Error(`Não consegui ler o texto de “${arquivo.name}”. Se for uma foto ou digitalização de baixa qualidade, use o PDF original do e-mail.`);
  }
  const tipo = tipoPeloTexto(texto);
  if (!tipo) throw new Error(`“${arquivo.name}” não parece ser o relatório nem a ficha do autodiagnóstico ELOGA.`);
  progresso('Leitura concluída. Confira os dados.', 100);
  return { r: tipo === 'ficha' ? lerFichaOcr(paginas) : lerRelatorioOcr(paginas), hash, nome: arquivo.name };
}

// ------------------------------------------------------------------ tela
export async function render(el, [clienteId]) {
  const clientes = await q(db.from('clients').select('id, name, segment, city, stage, contact_name, contact_email, phone').order('name'));
  montar(el, html`<div class="wrap" style="max-width:980px">
    <div class="page-head"><div><span class="eyebrow">Autodiagnóstico do site</span><h1>Importar PDFs</h1>
      <p>Arraste o <b>relatório</b> e a <b>ficha preenchida</b> recebidos por e-mail. A leitura acontece no seu computador; o arquivo não é enviado a nenhum servidor.</p></div></div>
    <label class="dropzone" id="zona" tabindex="0">
      <input type="file" id="arquivos" accept="application/pdf,.pdf" multiple class="sr-only">
      <h3>Solte os PDFs aqui</h3><p class="muted">ou clique para escolher · até 2 arquivos · máximo 15 MB cada</p>
      <span class="btn secondary" aria-hidden="true">Escolher arquivos</span></label>
    <div id="progresso" class="progress-list" style="margin-top:16px"></div>
    <div id="conferencia" style="margin-top:24px"></div></div>`);

  const zona = $('#zona', el), input = $('#arquivos', el);
  const ctl = new AbortController(), o = { signal: ctl.signal };
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('over'); }, o);
  zona.addEventListener('dragleave', () => zona.classList.remove('over'), o);
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('over'); processar([...e.dataTransfer.files]); }, o);
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } }, o);
  input.addEventListener('change', () => { processar([...input.files]); input.value = ''; }, o);

  async function processar(arquivos) {
    const pdfs = arquivos.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!pdfs.length) return avisar('Selecione arquivos PDF.', 'bad');
    if (pdfs.length > 2) return avisar('Envie no máximo 2 arquivos: o relatório e a ficha.', 'bad');
    const prog = $('#progresso', el);
    montar($('#conferencia', el), html``);
    montar(prog, html`${pdfs.map((f, i) => html`<div class="card tight"><div class="row between small"><b>${f.name}</b><span id="st-${i}" class="muted">Na fila</span></div>
      <div class="bar" style="margin-top:8px"><i id="pb-${i}" style="width:0%"></i></div></div>`)}`);
    const lidos = [];
    for (let i = 0; i < pdfs.length; i++) {
      const st = $('#st-' + i, el), pb = $('#pb-' + i, el);
      try {
        const res = await lerArquivo(pdfs[i], (t, pct) => { st.textContent = t; pb.style.width = pct + '%'; });
        lidos.push(res);
        st.innerHTML = ''; st.append(document.createTextNode((res.r.tipo === 'ficha' ? 'Ficha' : 'Relatório') + ' · ' + (res.r.fonte === 'dados_embutidos' ? 'leitura exata' : 'leitura por imagem: confira')));
        st.className = res.r.fonte === 'dados_embutidos' ? 'badge ok' : 'badge warn';
      } catch (e) { st.textContent = mensagemErro(e); st.className = 'small'; st.style.color = 'var(--bad)'; pb.parentElement.classList.add('red'); }
    }
    if (!lidos.length) return;
    if (lidos.length === 2 && lidos[0].r.tipo === lidos[1].r.tipo) avisar('Os dois arquivos são do mesmo tipo. Use um relatório e uma ficha.', 'bad');
    conferencia(combinar(lidos.map((x) => x.r)), lidos);
  }

  function conferencia(r, lidos) {
    const ident = r.identificacao;
    let sugestao = clienteId || '';
    if (!sugestao && ident.clinica) {
      let melhor = 0;
      for (const c of clientes) { const s = similaridade(c.name, ident.clinica); if (s > melhor && s >= 0.75) { melhor = s; sugestao = c.id; } }
    }
    const temRespostas = Object.keys(r.respostas).length > 0;
    // Faturamento tem versão "convênios" ou "particular"; itens "solo" não aparecem para quem atende sozinho
    const variante = ['conv', 'part'].find((v) => PILLARS[0].items.some((it) => it.v === v && r.respostas[it.id])) || null;
    const suspeito = (cond) => (cond ? 'suspeito' : '');
    const opcoesResp = [...SCALE, NA];
    const grupoCampos = (g) => Object.entries(ROTULOS_CAMPOS).filter(([k]) => k.startsWith(g + '.')).map(([k, rot]) => {
      const chave = k.split('.')[1]; const v = r[g]?.[chave];
      return html`<div class="field"><label>${rot}</label><input type="text" data-campo="${k}" value="${Array.isArray(v) ? v.join(', ') : v ?? ''}"></div>`;
    });

    montar($('#conferencia', el), html`<form id="f-conf" class="stack" novalidate>
      <div class="card"><div class="card-head"><div><h2>Conferência</h2><p>Confira e corrija antes de gravar. Campos em amarelo merecem atenção.</p></div>
        <span class="badge ${r.fonte === 'dados_embutidos' ? 'ok' : 'warn'}">${r.fonte === 'dados_embutidos' ? 'Leitura exata' : 'Leitura por imagem (OCR)'}</span></div>
        ${r.avisos.length ? html`<div class="notice warn"><b>Pontos para conferir:</b><ul>${r.avisos.map((a) => html`<li>${a}</li>`)}</ul></div>` : html`<div class="notice">Nenhuma inconsistência encontrada.</div>`}
        <h3 style="margin-top:20px">Vincular a</h3>
        <div class="field"><label for="destino">Cliente</label><select id="destino"><option value="">+ Criar novo cliente com estes dados</option>
          ${clientes.map((c) => html`<option value="${c.id}" ${c.id === sugestao ? html`selected` : ''}>${c.name}${c.city ? ' · ' + c.city : ''}</option>`)}</select>
          <span class="hint">${sugestao ? 'Cliente sugerido pela semelhança do nome. Confira.' : 'Nenhum cliente com nome parecido: será criado um novo.'}</span></div></div>

      <div class="card"><h3>Resultado</h3><div class="grid g4">
        <div class="field"><label for="c-nota">Nota geral</label><input id="c-nota" type="number" min="0" max="100" value="${r.nota ?? ''}" class="${suspeito(r.nota == null)}"></div>
        <div class="field"><label for="c-nivel">Nível</label><select id="c-nivel">${LEVELS.map((l) => html`<option ${r.nivel === l.name ? html`selected` : ''}>${l.name}</option>`)}</select></div>
        <div class="field"><label for="c-classe">Classe do lead</label><select id="c-classe"><option value="">—</option>${['A', 'B', 'C'].map((c) => html`<option ${r.classificacao?.classe === c ? html`selected` : ''}>${c}</option>`)}</select></div>
        <div class="field"><label for="c-data">Preenchido em</label><input id="c-data" type="date" value="${r.gerado ? String(r.gerado).slice(0, 10) : ''}"></div></div>
        <h3 style="margin-top:16px">Notas por pilar</h3><div class="grid g3">${PILLARS.map((p) => html`<div class="field"><label for="pil-${p.id}">${p.name}</label>
          <input id="pil-${p.id}" type="number" min="0" max="100" data-pilar="${p.id}" value="${r.pilares[p.id]?.nota ?? ''}" placeholder="N/A" class="${suspeito(r.pilares[p.id] === undefined || r.avisos.some((a) => a.includes(p.name)))}"></div>`)}</div></div>

      <div class="card"><h3>Identificação</h3><div class="grid g3">${grupoCampos('identificacao')}</div></div>
      ${r.tipo === 'ficha' || Object.keys(r.estrutura).length ? html`
        <div class="card"><h3>Estrutura e operação</h3><div class="grid g3">${grupoCampos('estrutura')}</div></div>
        <div class="card"><h3>Prioridades, dores e decisão</h3><div class="grid g3">${grupoCampos('dores')}${grupoCampos('decisao')}</div></div>` : ''}

      ${temRespostas ? html`<div class="card"><h3>Respostas item a item</h3><p class="small muted">Itens não reconhecidos aparecem em amarelo.</p>
        ${PILLARS.map((p) => html`<h4 style="margin:14px 0 6px;color:var(--purple)">${p.name}</h4><div class="table-wrap"><table class="t"><tbody>
          ${p.items.filter((it) => r.respostas[it.id] || (!it.solo && (!it.v || !variante || it.v === variante))).map((it) => html`<tr><td>${it.t}</td><td style="width:38%">
            <select data-resp="${it.id}" aria-label="${it.t}" class="${suspeito(!r.respostas[it.id])}"><option value="">— sem resposta —</option>
            ${opcoesResp.map((x) => html`<option value="${x.v}" ${r.respostas[it.id]?.v === x.v ? html`selected` : ''}>${x.t}</option>`)}</select></td></tr>`)}</tbody></table></div>`)}</div>`
        : html`<div class="notice info">Somente o relatório foi importado. Para trazer as respostas item a item e o perfil da operação, importe também a ficha.</div>`}

      <div class="row between"><button class="btn ghost" type="button" id="cancelar">Cancelar</button>
        <button class="btn primary lg" type="submit">Confirmar e gravar</button></div></form>`);

    $('#cancelar', el).addEventListener('click', () => { montar($('#conferencia', el), html``); montar($('#progresso', el), html``); });
    $('#f-conf', el).addEventListener('submit', (e) => { e.preventDefault(); ocupado(e.submitter, () => gravar(r, lidos)); });
  }

  async function gravar(r, lidos) {
    try {
      const f = $('#f-conf', el);
      const val = (s) => $(s, f).value.trim();
      const campos = {};
      $$('[data-campo]', f).forEach((i) => { const [g, k] = i.dataset.campo.split('.'); (campos[g] ||= {})[k] = i.value.trim(); });
      for (const k of ['especialidades', 'pagamento']) if (campos.estrutura?.[k]) campos.estrutura[k] = campos.estrutura[k].split(/\s*,\s*/).filter(Boolean);
      if (campos.dores?.preocupacoes) campos.dores.preocupacoes = campos.dores.preocupacoes.split(/\s*,\s*/).filter(Boolean);

      const pilares = PILLARS.map((p) => {
        const v = $('#pil-' + p.id, f).value; const n = v === '' ? null : Math.max(0, Math.min(100, Math.round(+v)));
        return { id: p.id, name: p.name, score: n, level: n == null ? null : LEVELS[levelOf(n)].name };
      });
      const respostas = {};
      $$('[data-resp]', f).forEach((s) => {
        if (!s.value) return;
        const item = PILLARS.flatMap((p) => p.items).find((it) => it.id === s.dataset.resp);
        respostas[s.dataset.resp] = { v: s.value, rotulo: [...SCALE, NA].find((x) => x.v === s.value).t, t: item.t };
      });
      const comNota = pilares.filter((p) => p.score != null).sort((a, b) => a.score - b.score).slice(0, 3);
      const temResp = Object.keys(respostas).length > 0;
      const prioridades = comNota.map((p) => ({
        id: p.id, nota: p.score,
        itens: temResp
          ? PILLARS.find((x) => x.id === p.id).items.map((it) => respostas[it.id]).filter((a) => a && ['0', '1', '2'].includes(a.v)).sort((a, b) => +a.v - +b.v).slice(0, 2).map((a) => ({ rotulo: a.rotulo, t: a.t }))
          : (r.prioridades.find((x) => x.id === p.id)?.itens || []),
      }));
      const naoSei = temResp ? PILLARS.flatMap((p) => p.items.filter((it) => respostas[it.id]?.v === 'ns').map((it) => ({ pillar: p.name, t: it.t }))) : r.nao_sei;
      const nota = val('#c-nota') === '' ? null : Math.max(0, Math.min(100, Math.round(+val('#c-nota'))));
      const id = campos.identificacao || {};
      if (!id.clinica && !$('#destino', f).value) throw new Error('Informe o nome da clínica.');
      if (id.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id.email)) throw new Error('Corrija o e-mail do responsável (o OCR costuma trocar o @).');

      // Cliente: vincula ou cria; só preenche campos vazios de um cliente existente
      let clienteIdFinal = $('#destino', f).value;
      if (!clienteIdFinal) {
        const novo = await q(db.from('clients').insert({
          name: id.clinica, slug: slug(id.clinica) + '-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4),
          segment: id.ramo || null, city: id.cidade || null, contact_name: id.responsavel || null, contact_email: id.email || null,
          phone: id.telefone || null, origin: 'Site · autodiagnóstico' + (id.como_conheceu ? ' (' + id.como_conheceu + ')' : ''),
          is_active: true, stage: 'autodiagnostico', positioning_enabled: false,
        }).select('id').single());
        clienteIdFinal = novo.id;
      } else {
        const atual = clientes.find((c) => c.id === clienteIdFinal);
        const completar = {};
        if (!atual.segment && id.ramo) completar.segment = id.ramo;
        if (!atual.city && id.cidade) completar.city = id.cidade;
        if (!atual.contact_name && id.responsavel) completar.contact_name = id.responsavel;
        if (!atual.contact_email && id.email) completar.contact_email = id.email;
        if (!atual.phone && id.telefone) completar.phone = id.telefone;
        if (['lead', null, undefined].includes(atual.stage)) completar.stage = 'autodiagnostico';
        if (Object.keys(completar).length) await q(db.from('clients').update(completar).eq('id', clienteIdFinal));
      }

      await q(db.from('self_assessments').insert({
        client_id: clienteIdFinal, source: r.fonte === 'dados_embutidos' ? 'dados_embutidos' : 'ocr',
        filled_at: val('#c-data') ? val('#c-data') + 'T12:00:00Z' : null,
        overall: nota, level: $('#c-nivel', f).value || null, lead_class: $('#c-classe', f).value || null,
        pillars: pilares, priorities: prioridades, unknowns: naoSei, answers: respostas,
        identification: { identificacao: id, estrutura: campos.estrutura || {}, dores: campos.dores || {}, decisao: campos.decisao || {},
          classificacao: { ...r.classificacao, classe: $('#c-classe', f).value || null } },
        file_hashes: lidos.map((x) => ({ nome: x.nome, tipo: x.r.tipo, leitura: x.r.fonte, sha256: x.hash })),
      }));
      await registrar('importacao.concluida', { entidade: 'self_assessments', cliente: clienteIdFinal, detalhes: { arquivos: lidos.map((x) => x.nome), leitura: r.fonte } });
      avisar('Autodiagnóstico importado.', 'ok');
      ir('cliente', clienteIdFinal, 'autodiagnostico');
    } catch (e) { avisarErro(e); }
  }

  return () => ctl.abort();
}
