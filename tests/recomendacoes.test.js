import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoPadrao, capacidade } from '../assets/js/admin/operacional-modelo.js';
import { gerarRecomendacoes } from '../assets/js/admin/recomendacoes.js';

function estado() {
  const s = estadoPadrao();
  Object.assign(s.auto.pillars, { fat: 30, fin: 55, com: 70, age: 45, exp: 80, reg: 65 });
  s.session.fronts = ['fat', 'age'];
  s.matrix.scores = { fat: { g: 3, i: 3, u: 3, p: 2 }, age: { g: 2, i: 2, u: 1, p: 2 } };
  s.session.D.decisorPresent = 'sim';
  return s;
}

test('gera recomendações vinculadas à frente prioritária e ao formato', () => {
  const recs = gerarRecomendacoes(estado());
  assert.ok(recs.length >= 3 && recs.length <= 5);
  assert.match(recs[0], /Faturamento e ciclo de receita \(Programa de acompanhamento\)/);
  assert.ok(recs.every((r) => !/\{(svc|SVC|ociosa)\}/.test(r)), 'sem marcadores sobrando');
  assert.match(recs.at(-1), /devolutiva/);
});

test('frentes manuais múltiplas entram nas recomendações', () => {
  const s = estado(); s.matrix.ovFronts = ['fat', 'reg'];
  const recs = gerarRecomendacoes(s).join(' ');
  assert.match(recs, /Regulatório/);
  assert.match(recs, /faturamento e ciclo de receita e regulatório/);
});

test('sem notas nem matriz não gera nada', () => {
  assert.deepEqual(gerarRecomendacoes(estadoPadrao()), []);
});

test('ocupação ideal: meta, lacuna e receita da lacuna', () => {
  const ctx = { ...estadoPadrao().session.ctx, duracao: 60, salas: 2, profissionais: 2, simultaneos: 1, atendimentosMes: 200, valorSessao: 100 };
  const c = capacidade(ctx);
  assert.equal(c.ocupacaoIdeal, 85);
  assert.equal(c.metaMensal, Math.round(c.mensal * 0.85));
  assert.equal(c.lacuna, c.metaMensal - 200);
  assert.equal(c.receitaLacuna, c.lacuna * 100);
  const acima = capacidade({ ...ctx, atendimentosMes: c.mensal, ocupacaoIdeal: 80 });
  assert.ok(acima.lacuna < 0);
  assert.equal(acima.receitaLacuna, null);
});

test('bônus da proposta: catálogo, valor ajustado, avulso e decisão rápida', async () => {
  const { bonusDaProposta, valorOpcao, normalizarEstado } = await import('../assets/js/admin/operacional-modelo.js');
  const s = normalizarEstado(estado());
  s.proposal.bonus = { plano: { on: true }, scripts: { on: true, valor: 500, rapido: true }, cartao: { on: false } };
  s.proposal.bonusExtras = [{ name: 'Mentoria extra', valor: 300 }, { name: '  ', valor: 900 }];
  const b = bonusDaProposta(s);
  assert.deepEqual(b.map((x) => x.id), ['plano', 'scripts', 'x0']);
  assert.equal(b.find((x) => x.id === 'scripts').valor, 500);
  assert.equal(b.find((x) => x.id === 'scripts').rapido, true);
  assert.equal(b.find((x) => x.id === 'plano').valor, 1500);
  s.proposal.bonusSnapshot = [{ id: 'plano', name: 'Congelado', valor: 1, items: [] }];
  assert.equal(bonusDaProposta(s)[0].name, 'Congelado');
  assert.equal(valorOpcao({ type: 'programa', fronts: ['fat'], months: 3, prices: { pr_fat: 2000 }, system: false }), 6000);
});
