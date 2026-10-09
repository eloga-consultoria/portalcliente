import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gerarIndex, gerarVersaoJs } from '../tools/versionar.mjs';

test('index.html com versões em dia (rode node tools/versionar.mjs antes de publicar)', () => {
  const atual = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(gerarIndex(atual), atual);
  assert.equal(fs.readFileSync(new URL('../assets/js/core/versao.js', import.meta.url), 'utf8'), gerarVersaoJs(), 'versão do painel PDCA desatualizada');
  assert.match(atual, /<script type="importmap">/);
  assert.match(atual, /script-src 'self' 'sha256-/);
});
