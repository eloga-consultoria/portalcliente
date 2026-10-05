// Leitores dos PDFs do autodiagnóstico do site (relatório e ficha).
// Funções puras (sem tela), testadas em tests/leitores.test.js.
//
// Dois caminhos:
//  1) Dados embutidos (PDFs gerados após a correção do formulário): leitura exata.
//  2) Texto obtido por OCR (PDFs antigos, que são imagem): leitura aproximada,
//     sempre seguida da tela de conferência antes de gravar.
import { PILLARS, SCALE, NA, LEVELS, levelOf, pillarById } from './autodiagnostico-modelo.js';

export const MARCA_DADOS = 'ELOGA-DADOS-V1:';

// ---------------------------------------------------------------- utilidades
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9%@./ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function bigramas(s) {
  const t = normalizar(s).replace(/ /g, '');
  const m = new Map();
  for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); m.set(b, (m.get(b) || 0) + 1); }
  return m;
}

/** Similaridade de Dice (0 a 1) — tolerante a pequenos erros de OCR. */
export function similaridade(a, b) {
  const A = bigramas(a), B = bigramas(b);
  let inter = 0, tA = 0, tB = 0;
  for (const v of A.values()) tA += v;
  for (const v of B.values()) tB += v;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) || 0);
  return tA + tB ? (2 * inter) / (tA + tB) : 0;
}

function melhor(alvo, candidatos, chave = (x) => x) {
  let best = null, score = 0;
  for (const c of candidatos) { const s = similaridade(alvo, chave(c)); if (s > score) { score = s; best = c; } }
  return { item: best, score };
}

const dataBr = /(\d{2})\/(\d{2})\/(\d{4})/;
function dataIso(txt) {
  const m = dataBr.exec(String(txt || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const ROTULOS = [...SCALE, NA].sort((a, b) => b.t.length - a.t.length);
function valorDoRotulo(rotulo) { return [...SCALE, NA].find((x) => normalizar(x.t) === normalizar(rotulo))?.v ?? null; }

function pilarPorNome(nome, minimo = 0.62) {
  const { item, score } = melhor(nome, PILLARS, (p) => p.name);
  return score >= minimo ? item : null;
}

/** Estrutura vazia padronizada do resultado da leitura. */
export function resultadoVazio(tipo, fonte) {
  return {
    tipo, fonte,
    identificacao: {}, estrutura: {}, dores: {}, decisao: {}, classificacao: {},
    gerado: null, nota: null, nivel: null,
    pilares: {},       // { fat: { nota } }
    respostas: {},     // { fat_c1: { v, rotulo, t } }
    prioridades: [],   // [{ id, nota, itens: [{ rotulo, t }] }]
    nao_sei: [],       // [{ pillar, t }]
    avisos: [],
  };
}

// ---------------------------------------------------------- 1) dados embutidos
/** Lê o campo Keywords do PDF. Retorna o objeto de dados ou null. */
export function lerDadosEmbutidos(keywords) {
  const k = String(keywords || '');
  const i = k.indexOf(MARCA_DADOS);
  if (i < 0) return null;
  try {
    const b64 = k.slice(i + MARCA_DADOS.length).trim().split(/\s/)[0];
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const dados = JSON.parse(new TextDecoder().decode(bytes));
    return dados && dados.v === 1 && dados.resultado ? dados : null;
  } catch { return null; }
}

export function deDadosEmbutidos(d) {
  const r = resultadoVazio(d.tipo === 'ficha' ? 'ficha' : 'relatorio', 'dados_embutidos');
  const txt = (v) => (v == null ? '' : String(v)).slice(0, 2000);
  for (const [k, v] of Object.entries(d.identificacao || {})) r.identificacao[k] = txt(v);
  for (const g of ['estrutura', 'dores', 'decisao']) {
    for (const [k, v] of Object.entries(d[g] || {})) r[g][k] = Array.isArray(v) ? v.map(txt) : txt(v);
  }
  if (d.classificacao) {
    r.classificacao = {
      classe: ['A', 'B', 'C'].includes(d.classificacao.classe) ? d.classificacao.classe : null,
      nome: txt(d.classificacao.nome),
      prazo_agendamento: txt(d.classificacao.prazo_agendamento),
    };
  }
  r.gerado = txt(d.gerado) || null;
  const res = d.resultado;
  r.nota = Number.isFinite(+res.nota) ? Math.max(0, Math.min(100, Math.round(+res.nota))) : null;
  r.nivel = txt(res.nivel) || null;
  for (const p of res.pilares || []) {
    if (!pillarById(p.id)) continue;
    r.pilares[p.id] = { nota: p.nota === null || p.nota === undefined ? null : Math.max(0, Math.min(100, Math.round(+p.nota))) };
    for (const a of p.respostas || []) {
      if (a.id) r.respostas[a.id] = { v: txt(a.v), rotulo: txt(a.rotulo), t: txt(a.t) };
    }
  }
  r.prioridades = (res.prioridades || []).filter((id) => pillarById(id)).map((id) => ({
    id, nota: r.pilares[id]?.nota ?? null,
    itens: Object.entries(r.respostas)
      .filter(([k, a]) => k.startsWith(id) && ['0', '1', '2'].includes(a.v))
      .sort((x, y) => +x[1].v - +y[1].v).slice(0, 2).map(([, a]) => ({ rotulo: a.rotulo, t: a.t })),
  }));
  r.nao_sei = (res.nao_sei || []).map((x) => ({ pillar: txt(x.pillar), t: txt(x.t) }));
  return r;
}

// ------------------------------------------------------------- 2) OCR: comum
function linhas(paginas) {
  return paginas.join('\n').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const NOTA_FIM = /(\d{1,3})\s*\/\s*1\s?0\s?0\b/;

// --------------------------------------------------------- 2a) OCR: relatório
export function lerRelatorioOcr(paginas) {
  const r = resultadoVazio('relatorio', 'ocr');
  const L = linhas(paginas);

  // Cabeçalho: "<Nome>" seguido de "<Segmento> · <Cidade> · Gerado em dd/mm/aaaa"
  const iCab = L.findIndex((l) => /gerado em\s*\d{2}\/\d{2}\/\d{4}/i.test(l));
  if (iCab >= 0) {
    const partes = L[iCab].replace(/gerado em.*$/i, '').split(/\s+[·•\-–—]\s+/).map((s) => s.trim()).filter(Boolean);
    r.identificacao.ramo = partes[0] || '';
    r.identificacao.cidade = partes.slice(1).join(' · ');
    r.gerado = dataIso(L[iCab]);
    for (let k = iCab - 1; k >= 0; k--) {
      if (!/eloga|consultoria|estrat[eé]gias|relat[oó]rio|^[\W\d_]+$/i.test(L[k]) && L[k].length >= 2) { r.identificacao.clinica = L[k]; break; }
    }
  } else r.avisos.push('Não encontrei o cabeçalho com nome, segmento e data. Preencha na conferência.');

  const nivel = L.map((l) => /n[ií]vel:\s*(.+)$/i.exec(l)).find(Boolean);
  if (nivel) r.nivel = melhor(nivel[1], LEVELS, (x) => x.name).item?.name ?? null;

  // Notas por pilar: linhas "<Pilar> NN/100" (leitura por pilar e prioridades)
  for (const l of L) {
    const m = /^(?:\d\s+)?(.+?)\s+(\d{1,3})\s*\/\s*1\s?0\s?0\b/.exec(l);
    if (!m) continue;
    const p = pilarPorNome(m[1]);
    if (p && r.pilares[p.id] === undefined && +m[2] <= 100) r.pilares[p.id] = { nota: +m[2] };
  }

  // Suas 3 prioridades
  const iPri = L.findIndex((l) => /suas\s*3\s*prioridades/i.test(l));
  const iNs = L.findIndex((l) => /ainda n[aã]o enxerga/i.test(l));
  if (iPri >= 0) {
    let atual = null, bullet = null;
    for (const l of L.slice(iPri + 1, iNs > iPri ? iNs : undefined)) {
      const cab = /^([123])\s+(.+?)\s+(\d{1,3})\s*\/\s*1\s?0\s?0/.exec(l);
      if (cab) {
        const p = pilarPorNome(cab[2]);
        atual = { id: p?.id ?? null, nota: +cab[3], itens: [] };
        r.prioridades.push(atual); bullet = null; continue;
      }
      const b = /voc[eê] respondeu\s*["“”'‘’]+(.+?)["“”'‘’]+\s*para:?\s*(.*)$/i.exec(l);
      if (b && atual) { bullet = { rotulo: b[1].trim(), t: b[2].trim() }; atual.itens.push(bullet); continue; }
      if (bullet && !/^[*•·\-]/.test(l)) bullet.t = (bullet.t + ' ' + l).trim();
    }
    r.prioridades = r.prioridades.filter((p) => p.id);
  }

  // O que a operação ainda não enxerga ("Não sei")
  if (iNs >= 0) {
    let ult = null;
    for (const l of L.slice(iNs + 1)) {
      if (/agende|helle machado|este relat[oó]rio|fundadora/i.test(l)) break;
      const m = /^[*•·\-]\s*(.+?):\s*(.+)$/.exec(l);
      if (m && pilarPorNome(m[1], 0.55)) { ult = { pillar: pilarPorNome(m[1], 0.55).name, t: m[2].trim() }; r.nao_sei.push(ult); }
      else if (ult && !/voc[eê] marcou|achado importante|faltam dados|decidir com seguran/i.test(l)) ult.t += ' ' + l;
    }
  }

  completarNota(r, L);
  for (const p of PILLARS) if (r.pilares[p.id] === undefined) r.avisos.push(`Nota de “${p.name}” não encontrada. Preencha na conferência.`);
  return r;
}

// ------------------------------------------------------------ 2b) OCR: ficha
const CAMPOS_FICHA = [
  ['identificacao', 'clinica', 'Clínica / empresa / profissional'],
  ['identificacao', 'ramo', 'Ramo de atuação'],
  ['identificacao', 'responsavel', 'Responsável'],
  ['identificacao', 'telefone', 'Telefone / WhatsApp'],
  ['identificacao', 'email', 'E-mail'],
  ['identificacao', 'cidade', 'Cidade / Estado'],
  ['identificacao', 'como_conheceu', 'Como conheceu a ELOGA'],
  ['estrutura', 'estrutura', 'Estrutura atual'],
  ['estrutura', 'unidades', 'Unidades'],
  ['estrutura', 'profissionais', 'Profissionais de atendimento'],
  ['estrutura', 'gestao', 'Colaboradores na gestão'],
  ['estrutura', 'especialidades', 'Especialidades'],
  ['estrutura', 'publico', 'Público predominante'],
  ['estrutura', 'volume', 'Atendimentos por mês'],
  ['estrutura', 'pagamento', 'Modelos de pagamento'],
  ['estrutura', 'faturamento', 'Faturamento mensal'],
  ['estrutura', 'quem_agenda', 'Quem faz o agendamento'],
  ['estrutura', 'sistema_agenda', 'Sistema de agendamento'],
  ['estrutura', 'sistema_crm', 'Sistema de CRM'],
  ['dores', 'preocupacoes', 'Preocupações'],
  ['dores', 'tempo', 'Tempo do problema'],
  ['dores', 'impacto', 'Impacto percebido'],
  ['dores', 'contexto', 'Contexto'],
  ['decisao', 'momento', 'Momento'],
  ['decisao', 'decisor', 'Quem decide'],
  ['decisao', 'investimento', 'Investimento em 3 meses'],
];
export const ROTULOS_CAMPOS = Object.fromEntries(CAMPOS_FICHA.map(([g, k, r]) => [`${g}.${k}`, r]));

function campoNoInicio(linha) {
  const palavras = linha.split(' ');
  let best = null;
  for (const c of CAMPOS_FICHA) {
    const n = c[2].split(' ').length;
    const prefixo = palavras.slice(0, n).join(' ');
    const s = similaridade(prefixo, c[2]);
    if (s >= 0.8 && (!best || s > best.s || (s === best.s && n > best.n))) best = { c, s, n };
  }
  return best ? { campo: best.c, resto: palavras.slice(best.n).join(' ').trim() } : null;
}

const SECAO = /^[|\]\[!I]?\s*(\d{1,2})\s*[.,]\s*(.+)$/;

export function lerFichaOcr(paginas) {
  const r = resultadoVazio('ficha', 'ocr');
  const L = linhas(paginas);
  const tudo = L.join(' ');

  const cls = /classe\s+([ABC])\b\s*\(([^)]+)\)/i.exec(tudo);
  if (cls) r.classificacao = { classe: cls[1].toUpperCase(), nome: cls[2].trim() };
  const prazo = /prazo para agendar:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(tudo);
  if (prazo) r.classificacao.prazo_agendamento = dataIso(prazo[1]);
  const ng = /nota geral:?\s*(\d{1,3})\s*\/\s*100\s*\(([^)]+)\)/i.exec(tudo);
  if (ng) { r.nota = +ng[1]; r.nivel = melhor(ng[2], LEVELS, (x) => x.name).item?.name ?? null; }
  const reg = L.findIndex((l) => /respostas registradas em/i.test(l));
  if (reg >= 0) {
    r.gerado = dataIso(L[reg]);
    if (reg > 0 && !/eloga|ficha preenchida|consultoria/i.test(L[reg - 1])) r.identificacao.clinica = L[reg - 1];
  }

  let secao = null, pilar = null, ultimoCampo = null, itens = [], itemAtual = null;
  const fecharPilar = () => { if (pilar) atribuirItens(r, pilar, itens); itens = []; itemAtual = null; };

  for (const l of L) {
    if (/documento de uso interno|gerado automaticamente/i.test(l)) break;
    const s = SECAO.exec(l);
    if (s && +s[1] >= 1 && +s[1] <= 10 && !/registradas/i.test(l)) {
      const nomeSec = s[2].replace(/\s*[+·•\-–—]\s*(\d{1,3}\s*\/\s*100|n[aã]o se aplica).*$/i, '').trim();
      const p = +s[1] >= 5 ? pilarPorNome(nomeSec, 0.55) : null;
      if (+s[1] >= 5 && p) {
        fecharPilar();
        pilar = p; secao = 'pilar';
        const nota = NOTA_FIM.exec(s[2]);
        r.pilares[p.id] = { nota: /n[aã]o se aplica/i.test(s[2]) ? null : nota ? +nota[1] : undefined };
        continue;
      }
      if (+s[1] <= 4) { secao = 'cadastro'; ultimoCampo = null; continue; }
    }
    if (secao === 'cadastro') {
      const c = campoNoInicio(l);
      if (c) {
        const [g, k] = c.campo;
        r[g][k] = c.resto === 'Não informado' ? '' : c.resto;
        ultimoCampo = c.campo;
      } else if (ultimoCampo) {
        const [g, k] = ultimoCampo;
        r[g][k] = (r[g][k] + ' ' + l).trim();
      }
    } else if (secao === 'pilar') {
      const sem = l.replace(/^[—–\-\s]+/, '');
      const rot = ROTULOS.find((x) => normalizar(sem).endsWith(normalizar(x.t)));
      if (rot) {
        const nRot = normalizar(rot.t).split(' ').length;
        const prefixo = sem.split(' ').slice(0, Math.max(0, sem.split(' ').length - nRot)).join(' ').replace(/[\s—–\-]+$/, '');
        itemAtual = { texto: prefixo, rotulo: rot.t };
        itens.push(itemAtual);
      } else if (itemAtual) {
        itemAtual.texto = (itemAtual.texto + ' ' + l).trim();
      }
    }
  }
  fecharPilar();

  // Listas (vírgulas) viram arrays, como no formato embutido
  for (const k of ['especialidades', 'pagamento']) if (r.estrutura[k]) r.estrutura[k] = r.estrutura[k].split(/\s*,\s*/).filter(Boolean);
  if (r.dores.preocupacoes) r.dores.preocupacoes = r.dores.preocupacoes.split(/\s*,\s*/).filter(Boolean);
  if (r.identificacao.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.identificacao.email)) {
    r.avisos.push(`E-mail lido como “${r.identificacao.email}”. Confira, pois o OCR costuma errar o símbolo @.`);
  }

  // Prioridades e "Não sei" derivados das respostas (mesma regra do site)
  derivarPrioridadesENaoSei(r);
  completarNota(r, L);
  return r;
}

/** Associa as linhas lidas aos itens conhecidos do pilar (tolerante a erros e quebras de linha). */
function atribuirItens(r, pilar, itens) {
  const livres = [...pilar.items];
  for (const it of itens) {
    const { item, score } = melhor(it.texto, livres, (x) => x.t);
    if (item && score >= 0.55) {
      r.respostas[item.id] = { v: valorDoRotulo(it.rotulo), rotulo: it.rotulo, t: item.t };
      livres.splice(livres.indexOf(item), 1);
    } else {
      r.avisos.push(`Item não reconhecido em “${pilar.name}”: “${it.texto.slice(0, 80)}”. Confira na tela de conferência.`);
    }
  }
  // Confere a nota do pilar recalculada a partir das respostas
  const resp = Object.entries(r.respostas).filter(([k]) => pilar.items.some((x) => x.id === k)).map(([, a]) => a.v);
  const validos = resp.filter((v) => v !== 'na');
  if (validos.length && r.pilares[pilar.id]?.nota != null) {
    const calc = Math.round(validos.reduce((s, v) => s + (v === 'ns' ? 0 : +v), 0) / (4 * validos.length) * 100);
    if (calc !== r.pilares[pilar.id].nota) {
      r.avisos.push(`“${pilar.name}”: a nota impressa (${r.pilares[pilar.id].nota}) difere da calculada pelas respostas lidas (${calc}). Confira os itens.`);
    }
  }
}

function derivarPrioridadesENaoSei(r) {
  const comNota = PILLARS.filter((p) => r.pilares[p.id]?.nota != null);
  r.prioridades = comNota.slice().sort((a, b) => r.pilares[a.id].nota - r.pilares[b.id].nota).slice(0, 3).map((p) => ({
    id: p.id, nota: r.pilares[p.id].nota,
    itens: p.items.map((it) => r.respostas[it.id]).filter((a) => a && ['0', '1', '2'].includes(a.v))
      .sort((a, b) => +a.v - +b.v).slice(0, 2).map((a) => ({ rotulo: a.rotulo, t: a.t })),
  }));
  r.nao_sei = PILLARS.flatMap((p) => p.items.filter((it) => r.respostas[it.id]?.v === 'ns').map((it) => ({ pillar: p.name, t: it.t })));
}

/** Nota geral = média das notas dos pilares (regra do site). Nível pela faixa. */
function completarNota(r) {
  const notas = PILLARS.map((p) => r.pilares[p.id]?.nota).filter((n) => Number.isFinite(n));
  if (notas.length) {
    const media = Math.round(notas.reduce((a, b) => a + b, 0) / notas.length);
    if (r.nota == null) r.nota = media;
    else if (Math.abs(r.nota - media) > 1) r.avisos.push(`A nota geral lida (${r.nota}) difere da média dos pilares (${media}). Confira.`);
  }
  if (r.nota != null && !r.nivel) r.nivel = LEVELS[levelOf(r.nota)].name;
}

// --------------------------------------------------------- 3) junção e checagens
/** Junta relatório + ficha. A ficha (mais completa) prevalece; o relatório completa lacunas. */
export function combinar(resultados) {
  const ficha = resultados.find((x) => x.tipo === 'ficha');
  const rel = resultados.find((x) => x.tipo === 'relatorio');
  const base = structuredClone(ficha || rel || resultadoVazio('relatorio', 'manual'));
  const outro = ficha && rel ? rel : null;
  base.fontes = resultados.map((x) => ({ tipo: x.tipo, fonte: x.fonte }));
  base.fonte = resultados.every((x) => x.fonte === 'dados_embutidos') ? 'dados_embutidos' : resultados.length ? 'ocr' : 'manual';
  base.avisos = resultados.flatMap((x) => x.avisos.map((a) => `${x.tipo === 'ficha' ? 'Ficha' : 'Relatório'}: ${a}`));
  if (outro) {
    for (const k of ['clinica', 'ramo', 'cidade']) if (!base.identificacao[k] && outro.identificacao[k]) base.identificacao[k] = outro.identificacao[k];
    base.gerado ||= outro.gerado;
    base.nivel ||= outro.nivel;
    if (base.nota == null) base.nota = outro.nota;
    for (const p of PILLARS) {
      const a = base.pilares[p.id]?.nota, b = outro.pilares[p.id]?.nota;
      if (a == null && b != null) base.pilares[p.id] = { nota: b };
      else if (a != null && b != null && a !== b) base.avisos.push(`“${p.name}”: ficha indica ${a} e relatório indica ${b}. Confira.`);
    }
    if (!base.prioridades.length) base.prioridades = outro.prioridades;
    if (!base.nao_sei.length) base.nao_sei = outro.nao_sei;
    const nomeA = normalizar(ficha.identificacao.clinica), nomeB = normalizar(rel.identificacao.clinica);
    if (nomeA && nomeB && similaridade(nomeA, nomeB) < 0.7) {
      base.avisos.unshift(`Atenção: os arquivos parecem ser de clínicas diferentes (“${ficha.identificacao.clinica}” × “${rel.identificacao.clinica}”).`);
    }
  }
  return base;
}

/** Identifica o tipo do PDF pelo texto lido. */
export function tipoPeloTexto(texto) {
  const t = normalizar(texto);
  if (/ficha preenchida|respostas registradas em|uso interno/.test(t)) return 'ficha';
  if (/relatorio de autodiagnostico|notas por pilar|suas 3 prioridades|leitura por pilar/.test(t)) return 'relatorio';
  return null;
}
