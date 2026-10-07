// Teste de tela: planilha preenchível (kit) com cópia por cliente.
// Uso: SAIDA=/tmp/prints node tests/e2e/planilha.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { criarBanco, ligar } from './supabase-falso.mjs';

const RAIZ = new URL('../../', import.meta.url).pathname;
const SAIDA = process.env.SAIDA || '/tmp/eloga-e2e-planilha';
fs.mkdirSync(SAIDA, { recursive: true });
const servidor = spawn('python3', ['-m', 'http.server', '8767', '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const BASE = 'http://127.0.0.1:8767/index.html';

const banco = criarBanco();
const ADM = 'a0000000-0000-4000-8000-000000000001';
banco.usuarios['admin@eloga.test'] = { id: ADM, email: 'admin@eloga.test', senha: 'Senha-Admin-123!', role: 'admin', aal: 'aal1', fatores: [] };
banco.profiles.push({ user_id: ADM, role: 'admin', client_id: null, must_change_password: false });
const clientes = [['c1', 'Clínica Alfa', 'alfa@teste.com'], ['c2', 'Clínica Beta', 'beta@teste.com']].map(([k, nome, email], i) => {
  const id = `c000000${i}-0000-4000-8000-00000000000${i}`, uid = `u000000${i}-0000-4000-8000-00000000000${i}`;
  banco.clients.push({ id, name: nome, is_active: true, access_email: email, liberacoes: {}, stage: 'cliente_ativo', updated_at: banco.agora, created_at: banco.agora });
  banco.usuarios[email] = { id: uid, email, senha: 'Clinica-Segura-2026!', role: 'client', aal: 'aal1', fatores: [] };
  banco.profiles.push({ user_id: uid, role: 'client', client_id: id, must_change_password: false });
  banco.consents.push({ id: 'k' + i, user_id: uid, client_id: id, term_version: 'v1-2026-10' });
  return { id, nome, email };
});
const atual = { u: null };
const erros = [];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'pt-BR' })).newPage();
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
await ligar(page, banco, atual);
const passo = async (nome, fn) => {
  try { await fn(); await page.screenshot({ path: `${SAIDA}/${nome}.png`, fullPage: true }); console.log('ok  ', nome); }
  catch (e) { erros.push(`${nome}: ${e.message.split('\n')[0]}`); console.log('FALHA', nome, e.message.split('\n')[0]); await page.screenshot({ path: `${SAIDA}/${nome}-FALHA.png`, fullPage: true }).catch(() => {}); }
};
const entrar = async (email, senha, mfa = false) => {
  await page.goto(BASE); await page.waitForSelector('#f-login');
  await page.fill('#l-email', email); await page.fill('#l-senha', senha); await page.click('#f-login [type=submit]');
  if (mfa) {
    await page.waitForSelector('#f-mfa, .page-head h1:text("Clientes")');
    if (await page.$('#f-mfa')) { await page.fill('#m-cod', '123456'); await page.click('#f-mfa [type=submit]'); }
    await page.waitForSelector('.page-head h1:text("Clientes")');
  }
  else { await page.waitForSelector('.abertura, .cartao-portal'); if (await page.$('.abertura .pular')) await page.click('.abertura .pular'); await page.waitForSelector('.cartao-portal'); }
};
const sair = async () => { await page.click('#btn-sair'); await page.waitForSelector('#f-login'); };

await passo('P1-admin-importa-planilha', async () => {
  await entrar('admin@eloga.test', 'Senha-Admin-123!', true);
  await page.goto(BASE + '#/materiais'); await page.waitForSelector('#f-arq');
  await page.fill('#a-tit', 'Kit agenda e ocupação');
  await page.setInputFiles('#a-arq', RAIZ + 'tests/fixtures/kit-teste.xlsx');
  await page.click('#f-arq [type=submit]');
  await page.waitForSelector('text=Planilha preenchível');
  const m = banco.materials[0];
  if (!m?.estrutura?.abas?.length) throw new Error('estrutura não gravada');
  clientes.forEach((c) => banco.material_access.push({ material_id: m.id, client_id: c.id, pode_baixar: false, liberado_em: banco.agora }));
});
await passo('P2-cliente-alfa-preenche', async () => {
  await sair(); await entrar(clientes[0].email, 'Clinica-Segura-2026!');
  await page.goto(BASE + '#/materiais'); await page.click('[data-preencher]');
  await page.waitForSelector('table.planilha input');
  await page.locator('table.planilha input').first().fill('15');
  await page.click('[data-nova-linha]'); await page.locator('table.planilha tr.extra input').first().fill('Carla');
  await page.waitForFunction(() => /Salvo às/.test(document.querySelector('#flag-planilha')?.textContent || ''), null, { timeout: 8000 });
  const r = banco.material_respostas[0];
  if (!r || r.client_id !== clientes[0].id) throw new Error('resposta não gravada para a Alfa');
  if (JSON.stringify(r.dados).indexOf('15') < 0 || JSON.stringify(r.dados).indexOf('Carla') < 0) throw new Error('valores não gravados');
});
await passo('P3-cliente-alfa-envia-drive', async () => {
  await page.click('[data-enviar]'); await page.waitForSelector('text=Planilha enviada para a ELOGA');
});
await passo('P4-cliente-beta-em-branco', async () => {
  await sair(); await entrar(clientes[1].email, 'Clinica-Segura-2026!');
  await page.goto(BASE + '#/materiais'); await page.click('[data-preencher]');
  await page.waitForSelector('table.planilha input');
  const v = await page.locator('table.planilha input').first().inputValue();
  if (v !== '') throw new Error('a Beta viu dados de outra clínica: ' + v);
});
await passo('P5-admin-ve-respostas', async () => {
  await sair(); await entrar('admin@eloga.test', 'Senha-Admin-123!', true);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3 && !(await page.$('[data-respostas]')); i++) { await page.click('.topbar nav a[data-rota="materiais"]'); await page.waitForTimeout(1500); }
  await page.click('[data-respostas]');
  await page.waitForSelector('.modal [data-ver-resp]'); await page.click('.modal [data-ver-resp]');
  await page.waitForSelector('.modal table.planilha:has-text("Carla")');
});
await browser.close(); servidor.kill();
console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\nTudo certo. Capturas em ' + SAIDA);
process.exit(erros.length ? 1 : 0);
