import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capacidade, contextoPadrao, minutosDeAtendimento } from '../assets/js/admin/operacional-modelo.js';

const ctx = (extra = {}) => Object.assign(contextoPadrao(), { duracao: 50, salas: 4, profissionais: 3, simultaneos: 2 }, extra);

test('desconta o intervalo de fechamento', () => {
  assert.equal(minutosDeAtendimento({ aberto: true, ini: '08:00', fim: '18:00', intIni: '12:00', intFim: '13:00' }), 540);
  assert.equal(minutosDeAtendimento({ aberto: true, ini: '08:00', fim: '12:00', intIni: '', intFim: '' }), 240);
  assert.equal(minutosDeAtendimento({ aberto: false, ini: '08:00', fim: '18:00' }), 0);
});

test('exemplo validado: 4 salas, 3 profissionais, 2 pacientes, 10 horários', () => {
  const c = capacidade(ctx());
  assert.equal(c.porHorario, 6);                 // menor(4,3) × 2
  assert.equal(c.porDia[0].horarios, 10);        // 540 ÷ 50
  assert.equal(c.porDia[0].atendimentos, 60);
  assert.equal(c.semanal, 300);                  // seg a sex
  assert.equal(c.mensal, 1300);                  // 300 × 52/12
  assert.equal(c.gargalo, 'profissionais');
  assert.equal(c.ganhoMensal, 433);              // com 4 profissionais: 80/dia
});

test('gargalo em salas, sábado meio período, ocupação e receita', () => {
  const x = ctx({ salas: 4, profissionais: 5, simultaneos: 1, atendimentosMes: 800, valorSessao: 150 });
  x.dias.sab = { aberto: true, ini: '08:00', fim: '12:00', intIni: '', intFim: '' };
  const c = capacidade(x);
  assert.equal(c.porHorario, 4);
  assert.equal(c.porDia[5].horarios, 4);         // 240 ÷ 50
  assert.equal(c.semanal, 5 * 40 + 16);
  assert.equal(c.gargalo, 'salas');
  assert.equal(c.ocupacao, Math.round(800 / c.mensal * 100));
  assert.equal(c.receitaPotencial, c.mensal * 150);
});

test('sem salas, profissionais ou duração não calcula', () => {
  assert.equal(capacidade(ctx({ salas: '' })), null);
  assert.equal(capacidade(ctx({ duracao: 0 })), null);
});
