// Diagnóstico de POSICIONAMENTO: análise e PDF (relatório + ficha de respostas num único arquivo).
// O cliente NÃO vê este relatório; o PDF vai por e-mail somente para a ELOGA e fica disponível no painel.
import { PERGUNTAS } from '../client/posicionamento-perguntas.js';
import { carregarScript } from '../core/dom.js';

// ------------------------------------------------------------------ respostas
export function textoResposta(q, a) {
  if (a === undefined || a === null || a === '') return 'Não respondido';
  if (q.type === 'score') return a + ' / 4';
  if (q.type === 'text') return String(a).trim() || 'Não respondido';
  if (q.type === 'select') return [a?.selected, a?.other].filter(Boolean).join(' · ') || 'Não respondido';
  if (q.type === 'multi') return [...(a?.selected || []), a?.other].filter(Boolean).join(', ') || 'Não respondido';
  return String(a);
}
export function respondida(q, a) {
  if (q.type === 'text') return String(a || '').trim() !== '';
  if (q.type === 'score') return a !== null && a !== undefined && a !== '';
  if (q.type === 'select') return !!(a?.selected || a?.other);
  if (q.type === 'multi') return !!((a?.selected || []).length || a?.other);
  return false;
}
export const progresso = (answers) => Math.round(PERGUNTAS.filter((q) => respondida(q, answers[q.id])).length / PERGUNTAS.length * 100);

function lista(answers, id) {
  const a = answers[id];
  if (!a) return [];
  if (typeof a === 'object' && !Array.isArray(a)) return [...(a.selected || []), ...(a.other ? [a.other] : [])].filter(Boolean);
  return [String(a)];
}

// ------------------------------------------------------------------ análise
const PILARES = [['Quem você é', 'p1_score'], ['Como você pensa', 'p2_score'], ['O que você resolve', 'p3_score'], ['Como você resolve', 'p4_score'], ['Por que confiar', 'p5_score']];
const REC = {
  'Quem você é': 'Formalizar identidade, valores e personalidade e repeti-los em bastidores, apresentação da equipe e narrativa institucional.',
  'Como você pensa': 'Transformar crenças e critérios técnicos em conteúdos educativos, opiniões técnicas e orientações práticas.',
  'O que você resolve': 'Comunicar menos o nome do serviço e mais a dor, a necessidade, a transformação e a situação em que o paciente percebe valor.',
  'Como você resolve': 'Mostrar método, jornada, diferenciais, critérios e experiência para reduzir a incerteza antes do contato.',
  'Por que confiar': 'Aumentar os sinais de confiança com credenciais, avaliações, protocolos, evidências e provas autorizadas.',
};
function maturidade(n) {
  if (n < 40) return ['Posicionamento indefinido', 'Há lacunas relevantes de clareza e consistência.'];
  if (n < 60) return ['Posicionamento emergente', 'Existem elementos estratégicos, mas ainda pouco traduzidos em comunicação.'];
  if (n < 80) return ['Posicionamento estruturado', 'A base é consistente; o foco deve ser padronizar, provar e repetir.'];
  return ['Posicionamento consolidado', 'Há boa coerência entre identidade, proposta, método, prova e comunicação.'];
}

export function analisar(cliente, avaliacao) {
  const ans = avaliacao.responses?.answers || {};
  const arr = PILARES.map(([nome, id]) => ({ nome, valor: ans[id] === null || ans[id] === undefined || ans[id] === '' ? 0 : Number(ans[id]) * 25 }));
  const geral = Math.round(arr.reduce((s, x) => s + x.valor, 0) / arr.length);
  const ordenado = [...arr].sort((a, b) => a.valor - b.valor);
  const servico = textoResposta(PERGUNTAS.find((q) => q.id === 'p3_service'), ans.p3_service);
  const metodo = textoResposta(PERGUNTAS.find((q) => q.id === 'p4_method'), ans.p4_method);
  const necessidades = lista(ans, 'p3_needs'), resultados = lista(ans, 'p3_results');
  const objetivos = lista(ans, 'social_goal').join(' ').toLowerCase();
  const mix = { conexao: 15, educacao: 20, demanda: 25, metodo: 20, prova: 20 };
  if (objetivos.includes('autoridade')) { mix.educacao += 5; mix.prova += 5; mix.demanda -= 5; mix.conexao -= 5; }
  if (objetivos.includes('agendamento') || objetivos.includes('paciente')) { mix.demanda += 5; mix.metodo += 5; mix.educacao -= 5; mix.conexao -= 5; }
  const sv = servico === 'Não respondido' ? null : servico;
  return {
    arr, geral, nivel: maturidade(geral), prioridade: ordenado.slice(0, 2), fortes: ordenado.slice(-2).reverse(),
    declaracao: `A ${cliente.name} deve se posicionar como uma referência em ${sv || 'sua área de atuação'}, para pessoas que buscam ${necessidades.slice(0, 3).join(', ') || 'o cuidado que a clínica oferece'}, entregando ${resultados.slice(0, 3).join(', ') || 'o resultado desejado'} por meio de ${metodo === 'Não respondido' ? 'uma jornada individualizada e estruturada' : metodo}.`,
    objetivos: lista(ans, 'social_goal'), tom: lista(ans, 'p2_tone'), formatos: lista(ans, 'social_formats'),
    servico: sv || 'Não informado', necessidades, mix, rec: REC,
    plano: [
      ['Semana 1', 'Conexão', 'Reels', 'Por que a clínica existe e qual experiência quer entregar.', 'Conheça nossa forma de cuidar'],
      ['Semana 1', 'Demanda', 'Carrossel', `Sinais de que ${necessidades[0] || 'essa necessidade'} merece atenção.`, 'Salve e compartilhe'],
      ['Semana 1', 'Educação', 'Stories', 'Uma crença técnica da clínica explicada de forma simples.', 'Responda à enquete'],
      ['Semana 2', 'Método', 'Reels', `Como funciona ${sv || 'nosso atendimento'} na prática.`, 'Fale com a equipe'],
      ['Semana 2', 'Prova', 'Carrossel', 'O que sustenta nossa abordagem: equipe, método e evidências.', 'Conheça nossa equipe'],
      ['Semana 2', 'Demanda', 'Reels', 'A dúvida mais comum antes de iniciar.', 'Envie sua dúvida'],
      ['Semana 3', 'Conexão', 'Stories', 'Bastidores que demonstram os valores da marca.', 'Acompanhe nossa rotina'],
      ['Semana 3', 'Educação', 'Carrossel', 'O que o paciente precisa saber antes de decidir.', 'Salve para consultar'],
      ['Semana 3', 'Método', 'Carrossel', 'Nossa jornada de atendimento em etapas.', 'Conheça o processo'],
      ['Semana 4', 'Prova', 'Reels', 'Prova social ou avaliação autorizada, com contexto.', 'Veja mais avaliações'],
      ['Semana 4', 'Demanda', 'Carrossel', `Quando ${sv ? 'esse serviço' : 'o serviço'} faz sentido e quando avaliar outras opções.`, 'Agende uma avaliação'],
      ['Semana 4', 'Método', 'Reels', 'O diferencial que mais muda a experiência do paciente.', 'Converse com a equipe'],
    ],
  };
}

// ------------------------------------------------------------------ PDF
/** Helvetica do jsPDF só tem o conjunto Windows-1252: troca o que não existe nele. */
const CP1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export function textoPdf(s) {
  return String(s ?? '').replace(/→/g, '->').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[✓✔]/g, 'v')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️‍]/gu, '')
    .split('').filter((c) => c.charCodeAt(0) < 256 || CP1252.has(c)).join('');
}

async function carregarImagem(src) {
  const r = await fetch(src); const b = await r.blob();
  return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.readAsDataURL(b); });
}

export async function carregarJsPdf() {
  await carregarScript('assets/vendor/jspdf/jspdf.umd.min.js');
  await carregarScript('assets/vendor/jspdf/jspdf.plugin.autotable.min.js');
  return window.jspdf.jsPDF;
}

/** Gera o PDF (Blob). logoCliente = data URL opcional. */
export async function gerarPdfPosicionamento(cliente, avaliacao, logoCliente = '') {
  const jsPDF = await carregarJsPdf();
  const papel = await carregarImagem('assets/img/papel-timbrado.png');
  const A = analisar(cliente, avaliacao);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: textoPdf('Diagnóstico de Posicionamento - ' + cliente.name), author: 'ELOGA', creator: 'Portal ELOGA' });
  const cor = (hex) => { const n = parseInt(hex.slice(1), 16); doc.setTextColor((n >> 16) & 255, (n >> 8) & 255, n & 255); };
  const T = (t, x, y, o) => doc.text(textoPdf(t), x, y, o);
  const linhasDe = (t, w) => doc.splitTextToSize(textoPdf(t), w);

  const pagina = (titulo, nova = true) => {
    if (nova) doc.addPage();
    doc.addImage(papel, 'PNG', 0, 0, 210, 297, 'papel', 'FAST');
    doc.setDrawColor(207, 244, 21); doc.setLineWidth(0.4); doc.line(18, 39, 192, 39);
    cor('#041c2a'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); T(titulo, 192, 35, { align: 'right' });
    if (logoCliente) { try { doc.addImage(logoCliente, 150, 42, 42, 16, undefined, 'FAST'); } catch { /* formato não suportado */ } }
    return 64;
  };
  const secao = (titulo, y) => {
    if (y > 245) y = pagina('RELATÓRIO DE POSICIONAMENTO');
    cor('#5713ee'); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); T(titulo, 18, y);
    doc.setDrawColor(207, 244, 21); doc.setLineWidth(0.6); doc.line(18, y + 2, 192, y + 2);
    return y + 9;
  };
  const paragrafo = (t, y, { tam = 9.5, estilo = 'normal', c = '#263941', larg = 174, x = 18 } = {}) => {
    doc.setFont('helvetica', estilo); doc.setFontSize(tam); cor(c);
    const ls = linhasDe(t, larg), h = tam * 0.42 + 1.6;
    if (y + ls.length * h > 262) { y = pagina('RELATÓRIO DE POSICIONAMENTO'); }
    doc.text(ls, x, y); return y + ls.length * h + 2;
  };
  const barras = (itens, x, y, w) => itens.forEach((it, i) => {
    const yy = y + i * 11;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor('#33464e'); T(it.nome, x, yy);
    doc.setFillColor(232, 236, 234); doc.roundedRect(x, yy + 2, w, 3, 1.5, 1.5, 'F');
    doc.setFillColor(87, 19, 238); if (it.valor > 0) doc.roundedRect(x, yy + 2, Math.max(3, w * it.valor / 100), 3, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); T(it.valor + '%', x + w + 3, yy + 4.6);
  });

  // Página 1 — capa e leitura
  let y = pagina('RELATÓRIO DE POSICIONAMENTO', false);
  cor('#041c2a'); doc.setFont('helvetica', 'bold'); doc.setFontSize(21); T('Diagnóstico de Posicionamento', 18, y); y += 9;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); cor('#3f5159');
  T('Cliente: ' + (cliente.name || '-'), 18, y); y += 5;
  T('Segmento: ' + (cliente.segment || '-') + '   ·   Cidade: ' + (cliente.city || '-'), 18, y); y += 5;
  T('Enviado em: ' + (avaliacao.submitted_at ? new Date(avaliacao.submitted_at).toLocaleString('pt-BR') : '-'), 18, y); y += 9;
  doc.setFillColor(247, 248, 248); doc.roundedRect(18, y, 174, 28, 3, 3, 'F');
  cor('#5713ee'); doc.setFont('helvetica', 'bold'); doc.setFontSize(26); T(String(A.geral), 32, y + 18, { align: 'center' });
  cor('#041c2a'); doc.setFontSize(11); T(A.nivel[0], 50, y + 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); cor('#53636b'); doc.text(linhasDe(A.nivel[1], 136), 50, y + 16);
  y += 36;
  y = secao('Posicionamento recomendado', y); y = paragrafo(A.declaracao, y, { tam: 10 });
  y = secao('Leitura executiva', y + 2);
  y = paragrafo(`Prioridade imediata: ${A.prioridade[0]?.nome || '-'}. Pilares mais estruturados: ${A.fortes.map((x) => x.nome).join(' e ')}.`, y);
  y = secao('Resultado dos 5 pilares', y + 2); barras(A.arr, 20, y + 2, 130); y += 60;

  // Página 2 — recomendações e redes sociais
  y = pagina('RECOMENDAÇÕES E ESTRATÉGIA');
  y = secao('Recomendações por pilar', y);
  for (const it of A.arr) {
    const ls = linhasDe(A.rec[it.nome], 164), h = 8 + ls.length * 3.6;
    if (y + h > 262) y = pagina('RECOMENDAÇÕES E ESTRATÉGIA');
    doc.setFillColor(249, 247, 255); doc.roundedRect(18, y - 3, 174, h, 2, 2, 'F');
    cor('#041c2a'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); T(`${it.nome} · ${it.valor}%`, 22, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor('#46575e'); doc.text(ls, 22, y + 7);
    y += h + 3;
  }
  y = secao('Estratégia para redes sociais', y + 2);
  y = paragrafo('Objetivos: ' + (A.objetivos.join(', ') || 'Não informado'), y);
  y = paragrafo('Tom de voz: ' + (A.tom.join(', ') || 'Não informado'), y);
  y = paragrafo('Formatos sustentáveis: ' + (A.formatos.join(', ') || 'Não informado'), y);
  y = paragrafo('Serviço prioritário: ' + A.servico, y);
  y = paragrafo(`Distribuição editorial: Conexão ${A.mix.conexao}% · Educação ${A.mix.educacao}% · O que resolve ${A.mix.demanda}% · Método ${A.mix.metodo}% · Prova ${A.mix.prova}%.`, y);
  y = secao('Próximos passos', y + 2);
  ['Validar a declaração de posicionamento.', 'Padronizar bio, destaques, apresentação e scripts.', 'Produzir o primeiro ciclo de conteúdo.', 'Organizar o banco de provas e autoridade.', 'Medir conversas, agendamentos, salvamentos e conversão por origem.']
    .forEach((t, i) => { y = paragrafo(`${i + 1}. ${t}`, y, { tam: 9 }); });

  // Página 3 — plano de 30 dias
  pagina('PLANO DE CONTEÚDO · 30 DIAS');
  cor('#5713ee'); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); T('Plano de conteúdo - 30 dias', 18, 64);
  window.autoTable(doc, {
    startY: 70, head: [['Período', 'Pilar', 'Formato', 'Pauta', 'CTA']], body: A.plano.map((r) => r.map(textoPdf)),
    margin: { left: 18, right: 18, top: 64, bottom: 35 },
    styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 2.4, textColor: [38, 57, 65], lineColor: [225, 230, 228], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [4, 28, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 249] },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 22 }, 2: { cellWidth: 22 }, 3: { cellWidth: 78 }, 4: { cellWidth: 32 } },
  });

  // Ficha de respostas
  y = pagina('FICHA DE RESPOSTAS');
  cor('#041c2a'); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); T('Ficha de respostas', 18, y); y += 8;
  const ans = avaliacao.responses?.answers || {};
  let sec = '';
  for (const q of PERGUNTAS) {
    if (q.section !== sec) { y = secao(q.section, y + 3); sec = q.section; }
    const ql = linhasDe(q.q, 174), vl = linhasDe(textoResposta(q, ans[q.id]), 174);
    const need = (ql.length + vl.length) * 4 + 7;
    if (y + need > 262) y = pagina('FICHA DE RESPOSTAS');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); cor('#596a72'); doc.text(ql, 18, y); y += ql.length * 4 + 1;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); cor('#1f323a'); doc.text(vl, 18, y); y += vl.length * 4 + 4;
    doc.setDrawColor(231, 235, 233); doc.setLineWidth(0.2); doc.line(18, y - 2, 192, y - 2);
  }
  if (avaliacao.responses?.additional) { y = secao('Observações adicionais', y + 2); y = paragrafo(avaliacao.responses.additional, y); }

  // Rodapé com paginação
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); cor('#6b7a80');
    T(`ELOGA · Consultoria & Estratégias em Saúde · Documento confidencial · ${i}/${n}`, 105, 290, { align: 'center' });
  }
  return doc.output('blob');
}

export function blobParaBase64(blob) {
  return new Promise((ok, falha) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1] || '');
    fr.onerror = () => falha(new Error('Falha ao preparar o PDF.'));
    fr.readAsDataURL(blob);
  });
}
