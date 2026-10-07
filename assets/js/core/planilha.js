// Leitura de planilhas (.xlsx e .csv) no navegador, sem bibliotecas externas.
// O .xlsx é um arquivo ZIP com XML dentro: lemos o índice do ZIP, descompactamos
// só o necessário e extraímos as abas como grades de texto.
// Limites para manter o portal leve: 10 abas, 300 linhas e 30 colunas por aba.

export const LIMITES = { abas: 10, linhas: 300, colunas: 30 };

const decod = new TextDecoder('utf-8');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const xmlTexto = (s) => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));

// ------------------------------------------------------------------ ZIP
async function inflar(bytes) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

async function lerZip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let fim = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('Arquivo .xlsx inválido ou corrompido.');
  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const arquivos = {};
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true);
    const lNome = dv.getUint16(p + 28, true), lExtra = dv.getUint16(p + 30, true), lCom = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = decod.decode(u8.subarray(p + 46, p + 46 + lNome));
    arquivos[nome] = { metodo, tam, local };
    p += 46 + lNome + lExtra + lCom;
  }
  return async (nome) => {
    const a = arquivos[nome]; if (!a) return null;
    const lN = dv.getUint16(a.local + 26, true), lE = dv.getUint16(a.local + 28, true);
    const ini = a.local + 30 + lN + lE, dados = u8.subarray(ini, ini + a.tam);
    const bytes = a.metodo === 0 ? dados : a.metodo === 8 ? await inflar(dados) : null;
    if (!bytes) throw new Error('Formato de compactação não suportado.');
    return decod.decode(bytes);
  };
}

// ------------------------------------------------------------------ XLSX
const colIndice = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

function textosCompartilhados(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => xmlTexto(t[1])).join(''));
}

function numeroLegivel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6).replace('.', ',');
}

function lerAba(xml, compart) {
  const linhas = [];
  for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const iLinha = (+(/\br="(\d+)"/.exec(r[1])?.[1] || linhas.length + 1)) - 1;
    if (iLinha >= LIMITES.linhas) break;
    const linha = [];
    for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], corpo = c[2] || '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const iCol = ref ? colIndice(ref) : linha.length;
      if (iCol >= LIMITES.colunas) continue;
      const tipo = /\bt="(\w+)"/.exec(attrs)?.[1] || 'n';
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
      let texto = '';
      if (tipo === 's') texto = compart[+v] ?? '';
      else if (tipo === 'inlineStr') texto = [...corpo.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => xmlTexto(t[1])).join('');
      else if (tipo === 'b') texto = v === '1' ? 'Sim' : 'Não';
      else if (tipo === 'str' || tipo === 'e') texto = xmlTexto(v || '');
      else texto = v == null ? '' : numeroLegivel(v);
      linha[iCol] = texto.trim();
    }
    linhas[iLinha] = linha;
  }
  return linhas;
}

/** Recorta linhas e colunas vazias no fim e completa as células ausentes com ''. */
export function normalizarGrade(grade) {
  const g = Array.from(grade || [], (l) => Array.from({ length: (l || []).length }, (_, i) => String(l?.[i] ?? '').trim()));
  while (g.length && g.at(-1).every((x) => !x)) g.pop();
  const cols = Math.min(LIMITES.colunas, Math.max(0, ...g.map((l) => { let n = l.length; while (n && !l[n - 1]) n--; return n; })));
  return g.slice(0, LIMITES.linhas).map((l) => Array.from({ length: cols }, (_, i) => l[i] || ''));
}

export async function lerXlsx(buf) {
  const ler = await lerZip(buf);
  const wb = await ler('xl/workbook.xml');
  if (!wb) throw new Error('Não encontrei as abas da planilha. Salve como .xlsx e tente de novo.');
  const rels = (await ler('xl/_rels/workbook.xml.rels')) || '';
  const alvo = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const compart = textosCompartilhados(await ler('xl/sharedStrings.xml'));
  const abas = [];
  for (const s of [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)].slice(0, LIMITES.abas)) {
    const nome = xmlTexto(/\bname="([^"]*)"/.exec(s[1])?.[1] || `Aba ${abas.length + 1}`);
    if (/\bstate="(hidden|veryHidden)"/.test(s[1])) continue;
    const rid = /\br:id="([^"]+)"/.exec(s[1])?.[1];
    let caminho = alvo[rid] || `worksheets/sheet${abas.length + 1}.xml`;
    caminho = caminho.startsWith('/') ? caminho.slice(1) : 'xl/' + caminho.replace(/^\.\//, '');
    const xml = await ler(caminho);
    if (!xml) continue;
    const linhas = normalizarGrade(lerAba(xml, compart));
    if (linhas.length) abas.push({ nome, linhas });
  }
  if (!abas.length) throw new Error('A planilha está vazia.');
  return { versao: 1, abas };
}

// ------------------------------------------------------------------ CSV
export function lerCsv(texto) {
  const t = String(texto).replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/, 1)[0] || '';
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let linha = [], campo = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const g = normalizarGrade(linhas);
  if (!g.length) throw new Error('O arquivo CSV está vazio.');
  return { versao: 1, abas: [{ nome: 'Planilha', linhas: g }] };
}

/** Lê um arquivo escolhido pelo usuário (.xlsx ou .csv) e devolve a estrutura do modelo. */
export async function lerArquivoPlanilha(arquivo) {
  const nome = (arquivo.name || '').toLowerCase();
  if (nome.endsWith('.csv')) return lerCsv(await arquivo.text());
  if (nome.endsWith('.xlsx')) return lerXlsx(await arquivo.arrayBuffer());
  if (nome.endsWith('.xls')) throw new Error('Formato .xls antigo: abra no Excel ou Google Planilhas e salve como .xlsx.');
  throw new Error('Use uma planilha .xlsx ou .csv.');
}

// ------------------------------------------------------------------ modelo × respostas
/**
 * Junta o modelo (células preenchidas são fixas) com as respostas do cliente.
 * A 1ª linha de cada aba é o cabeçalho. Células vazias do modelo são editáveis.
 * Linhas extras (além do modelo) vêm das respostas, se o modelo permitir.
 */
export function mesclarRespostas(estrutura, dados) {
  return (estrutura?.abas || []).map((aba, ia) => {
    const resp = dados?.abas?.[ia]?.linhas || [];
    const cols = Math.max(1, ...aba.linhas.map((l) => l.length));
    const total = Math.max(aba.linhas.length, resp.length);
    const linhas = Array.from({ length: Math.min(total, LIMITES.linhas + 200) }, (_, i) => Array.from({ length: cols }, (_, j) => {
      const fixo = aba.linhas[i]?.[j] || '';
      return { v: fixo || String(resp[i]?.[j] ?? ''), fixo: !!fixo || i === 0, extra: i >= aba.linhas.length };
    }));
    return { nome: aba.nome, cols, linhas };
  });
}

/** Grade só com valores (para Drive, CSV e conferência). */
export const valores = (mescladas) => mescladas.map((a) => ({ nome: a.nome, linhas: a.linhas.map((l) => l.map((c) => c.v)) }));
