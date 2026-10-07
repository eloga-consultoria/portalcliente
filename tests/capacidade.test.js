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

test('capacidade por especialidade: soma profissionais × simultâneos, limitada pelas salas', () => {
  const base = { ...contextoPadrao(), duracao: 60, salas: 4, especialidades: ['ABA', 'Fonoaudiologia'],
    esp: { ABA: { prof: 2, simult: 2 }, Fonoaudiologia: { prof: 1, simult: 1 } } };
  const c = capacidade(base);
  assert.equal(c.modo, 'especialidade');
  assert.equal(c.profissionais, 3);
  assert.equal(c.porHorario, 5);                       // 2×2 + 1×1, há sala para todos
  assert.equal(c.gargalo, 'profissionais');
  assert.deepEqual(c.especialidades.map((e) => e.porHorario), [4, 1]);
  const poucasSalas = capacidade({ ...base, salas: 2 });   // 3 profissionais, 2 salas
  assert.equal(poucasSalas.gargalo, 'salas');
  assert.equal(poucasSalas.porHorario, 3);              // 5 × 2/3, arredondado para baixo
  assert.ok(poucasSalas.ganhoMensal > 0);
});

test('especialidade sem profissionais informados volta ao cálculo geral', () => {
  const c = capacidade({ ...contextoPadrao(), duracao: 60, salas: 4, profissionais: 3, simultaneos: 2, especialidades: ['ABA'], esp: { ABA: { prof: '', simult: 2 } } });
  assert.equal(c.modo, 'geral');
  assert.equal(c.porHorario, 6);
});

test('com salas limitando, a soma por especialidade bate com o total por horário', () => {
  const c = capacidade({ ...contextoPadrao(), duracao: 50, salas: 4, especialidades: ['ABA', 'Fonoaudiologia'],
    esp: { ABA: { prof: 3, simult: 2 }, Fonoaudiologia: { prof: 2, simult: 1 } } });
  assert.equal(c.porHorario, 6);                         // 8 × 4/5 = 6,4
  assert.equal(c.especialidades.reduce((s, e) => s + e.porHorario, 0), 6);
});
