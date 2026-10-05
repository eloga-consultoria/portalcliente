import { test } from 'node:test';
import assert from 'node:assert/strict';

// backup.js importa módulos de tela; aqui testamos só a criptografia isolada
const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../assets/js/admin/backup.js', import.meta.url), 'utf8'));
const inicio = src.indexOf('const ITERACOES'), fim = src.indexOf('async function todasAsLinhas');
const mod = await import('data:text/javascript,' + encodeURIComponent(src.slice(inicio, fim).replace(/export /g, '') + '\nexport { cifrar, decifrar };'));

test('backup criptografado abre com a senha certa e recusa a errada', async () => {
  const dados = { tabelas: { clients: [{ name: "Clínica D'Ávila 😀" }] } };
  const c = await mod.cifrar(dados, 'senha-muito-segura-123');
  assert.equal(c.formato, 'ELOGA-BACKUP-1');
  assert.ok(!JSON.stringify(c).includes('Ávila'), 'conteúdo não pode aparecer em claro');
  assert.deepEqual(await mod.decifrar(c, 'senha-muito-segura-123'), dados);
  await assert.rejects(mod.decifrar(c, 'senha-errada-000000'), /Senha incorreta/);
  const adulterado = { ...c, dados: c.dados.slice(0, -4) + 'AAAA' };
  await assert.rejects(mod.decifrar(adulterado, 'senha-muito-segura-123'), /Senha incorreta ou arquivo alterado/);
});
