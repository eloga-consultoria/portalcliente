import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerXlsx, lerCsv, mesclarRespostas, valores } from '../assets/js/core/planilha.js';

const buf = () => { const b = readFileSync(new URL('./fixtures/kit-teste.xlsx', import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test('lê .xlsx: abas visíveis, textos compartilhados, texto em partes e fórmulas', async () => {
  const e = await lerXlsx(buf());
  assert.deepEqual(e.abas.map((a) => a.nome), ['Agenda & Ocupação', 'Faltas']);   // a aba oculta fica de fora
  assert.deepEqual(e.abas[0].linhas, [['Profissional', 'Horas', 'Ocupação %'], ['Ana Souza', '', '0,375'], ['Bruno', '', '']]);
  assert.deepEqual(e.abas[1].linhas, [['Mês', 'Faltas'], ['Janeiro', '']]);
});

test('lê .csv com ponto e vírgula e aspas', () => {
  const e = lerCsv('﻿Item;Responsável;Prazo\n"POP; atendimento";;\nTreinamento;"Ana ""coord""";\n');
  assert.deepEqual(e.abas[0].linhas, [['Item', 'Responsável', 'Prazo'], ['POP; atendimento', '', ''], ['Treinamento', 'Ana "coord"', '']]);
});

test('cada cliente começa em branco: só as células vazias do modelo recebem resposta', async () => {
  const e = await lerXlsx(buf());
  const vazio = valores(mesclarRespostas(e, null));
  assert.deepEqual(vazio[0].linhas[1], ['Ana Souza', '', '0,375']);
  const respondido = mesclarRespostas(e, { abas: [{ linhas: [['X', 'Y', 'Z'], ['tentou mudar', '15', 'tentou'], [], ['Carla', '20', '']] }] });
  assert.equal(respondido[0].linhas[0][0].v, 'Profissional');   // cabeçalho nunca muda
  assert.equal(respondido[0].linhas[1][0].v, 'Ana Souza');      // célula do modelo é fixa
  assert.equal(respondido[0].linhas[1][1].v, '15');             // célula vazia recebe a resposta
  assert.equal(respondido[0].linhas[3][0].v, 'Carla');          // linha nova do cliente
  assert.equal(respondido[0].linhas[3][0].extra, true);
});
