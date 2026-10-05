import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celula } from '../assets/js/admin/exportar.js';

test('CSV neutraliza fórmulas e escapa separadores', () => {
  assert.equal(celula('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(celula('+55 11'), "'+55 11");
  assert.equal(celula('-10'), "'-10");
  assert.equal(celula("Clínica D'Ávila"), "Clínica D'Ávila");
  assert.equal(celula('a;b'), '"a;b"');
  assert.equal(celula(['x', 'y']), 'x, y');
  assert.equal(celula(null), '');
});
