// Testes dos leitores de PDF do autodiagnóstico.  Rodar: npm test
// Fixtures com dados FICTÍCIOS (Clínica Teste D'Ávila), gerados pelo formulário real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as L from '../assets/js/import/leitores.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const NOTAS = { fat: 45, fin: 38, com: 30, age: 38, exp: 25, reg: 35 };

test('dados embutidos (ficha) são lidos com exatidão', () => {
  const r = L.deDadosEmbutidos(L.lerDadosEmbutidos(fx('keywords_ficha_ficticia.txt')));
  assert.equal(r.fonte, 'dados_embutidos');
  assert.equal(r.tipo, 'ficha');
  assert.equal(r.identificacao.clinica, "Clínica Teste D'Ávila");
  assert.equal(r.identificacao.email, 'teste@example.com');
  assert.equal(r.nota, 35);
  assert.equal(r.classificacao.classe, 'B');
  for (const [k, v] of Object.entries(NOTAS)) assert.equal(r.pilares[k].nota, v, k);
  assert.equal(Object.keys(r.respostas).length, 26);
  assert.deepEqual(r.prioridades.map((p) => p.id), ['exp', 'com', 'reg']);
});

test('relatório embutido não traz classificação interna do lead', () => {
  const d = L.lerDadosEmbutidos(fx('keywords_relatorio_ficticio.txt'));
  assert.equal(d.tipo, 'relatorio');
  assert.equal(d.classificacao, undefined);
  assert.equal(d.identificacao.email, undefined);
});

test('keywords inválidas não quebram a leitura', () => {
  assert.equal(L.lerDadosEmbutidos(''), null);
  assert.equal(L.lerDadosEmbutidos('ELOGA-DADOS-V1:@@@'), null);
  assert.equal(L.lerDadosEmbutidos('ELOGA-DADOS-V1:' + Buffer.from('{"v":2}').toString('base64')), null);
});

test('OCR do relatório: cabeçalho, notas, prioridades', () => {
  const r = L.lerRelatorioOcr(JSON.parse(fx('ocr_relatorio_ficticio.json')));
  assert.equal(r.identificacao.clinica, "Clínica Teste D'Ávila");
  assert.equal(r.gerado, '2026-10-05');
  assert.equal(r.nota, 35);
  assert.equal(r.nivel, 'Inicial');
  for (const [k, v] of Object.entries(NOTAS)) assert.equal(r.pilares[k].nota, v, k);
  assert.deepEqual(r.prioridades.map((p) => p.id), ['exp', 'com', 'reg']);
  assert.equal(r.prioridades[0].itens.length, 2);
});

test('OCR da ficha: respostas item a item idênticas aos dados embutidos', () => {
  const ocr = L.lerFichaOcr(JSON.parse(fx('ocr_ficha_ficticia.json')));
  const ref = L.deDadosEmbutidos(L.lerDadosEmbutidos(fx('keywords_ficha_ficticia.txt')));
  assert.equal(Object.keys(ocr.respostas).length, 26);
  for (const [id, a] of Object.entries(ref.respostas)) assert.equal(ocr.respostas[id]?.v, a.v, id);
  assert.equal(ocr.classificacao.classe, 'B');
  assert.equal(ocr.decisao.decisor, 'Eu decido');
  assert.ok(ocr.avisos.some((a) => a.includes('E-mail')), 'deve avisar e-mail duvidoso');
});

test('combinar relatório + ficha e detectar clínicas diferentes', () => {
  const fic = L.lerFichaOcr(JSON.parse(fx('ocr_ficha_ficticia.json')));
  const rel = L.lerRelatorioOcr(JSON.parse(fx('ocr_relatorio_ficticio.json')));
  const c = L.combinar([fic, rel]);
  assert.equal(c.nota, 35);
  assert.equal(c.fontes.length, 2);
  rel.identificacao.clinica = 'Outra Clínica Qualquer';
  assert.ok(L.combinar([fic, rel]).avisos[0].includes('clínicas diferentes'));
});

test('tipo do PDF pelo texto', () => {
  assert.equal(L.tipoPeloTexto('FICHA PREENCHIDA · USO INTERNO'), 'ficha');
  assert.equal(L.tipoPeloTexto('RELATÓRIO DE AUTODIAGNÓSTICO Notas por pilar'), 'relatorio');
  assert.equal(L.tipoPeloTexto('nota fiscal'), null);
});
