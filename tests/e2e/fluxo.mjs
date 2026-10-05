// Teste de ponta a ponta das telas com Supabase falso.
// Uso: PDFS=/caminho/relatorio.pdf,/caminho/ficha.pdf SAIDA=/tmp/prints node tests/e2e/fluxo.mjs
// Requer: npm i playwright (e um Chromium disponível).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { criarBanco, ligar } from './supabase-falso.mjs';

const RAIZ = new URL('../../', import.meta.url).pathname;
const SAIDA = process.env.SAIDA || '/tmp/eloga-e2e';
const PDFS = (process.env.PDFS || '').split(',').filter(Boolean);
const PDFS2 = (process.env.PDFS2 || '').split(',').filter(Boolean);
fs.mkdirSync(SAIDA, { recursive: true });

const servidor = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const BASE = 'http://127.0.0.1:8765/index.html';

const erros = [];
const banco = criarBanco();
banco.usuarios['admin@eloga.test'] = { id: 'a0000000-0000-4000-8000-000000000001', email: 'admin@eloga.test', senha: 'Senha-Admin-123!', role: 'admin', aal: 'aal1', fatores: [] };
banco.profiles.push({ user_id: 'a0000000-0000-4000-8000-000000000001', role: 'admin', client_id: null, must_change_password: false });
const atual = { u: null };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'pt-BR' });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__impressoes = 0; window.print = () => { window.__impressoes++; window.dispatchEvent(new Event('afterprint')); }; });
page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
await ligar(page, banco, atual);

const passo = async (nome, fn) => {
  try { await fn(); await page.screenshot({ path: `${SAIDA}/${nome}.png`, fullPage: true }); console.log('ok  ', nome); }
  catch (e) { erros.push(`${nome}: ${e.message.split('\n')[0]}`); console.log('FALHA', nome, e.message.split('\n')[0]); await page.screenshot({ path: `${SAIDA}/${nome}-FALHA.png`, fullPage: true }).catch(() => {}); }
};
const confirmarModal = async (rotulo) => { await page.locator('.modal-foot .btn', { hasText: rotulo }).click(); };

// ------------------------------------------------------------- ADMIN
await passo('01-login', async () => { await page.goto(BASE); await page.waitForSelector('#f-login'); });
await passo('02-login-erro', async () => {
  await page.fill('#l-email', 'admin@eloga.test'); await page.fill('#l-senha', 'errada'); await page.click('#f-login [type=submit]');
  await page.waitForFunction(() => document.querySelector('#l-erro').textContent.includes('incorretos'));
});
await passo('03-mfa-cadastro', async () => {
  await page.fill('#l-senha', 'Senha-Admin-123!'); await page.click('#f-login [type=submit]');
  await page.waitForSelector('#f-mfa');
});
await passo('04-painel', async () => {
  await page.fill('#m-cod', '123456'); await page.click('#f-mfa [type=submit]');
  await page.waitForSelector('.page-head h1:text("Clientes")');
});
let clienteId = null;
if (PDFS.length) {
  await passo('05-importar-ocr', async () => {
    await page.goto(BASE + '#/importar'); await page.waitForSelector('#zona');
    await page.setInputFiles('#arquivos', PDFS);
    await page.waitForSelector('#f-conf', { timeout: 180000 });
  });
  await passo('06-conferencia-gravar', async () => {
    await page.fill('[data-campo="identificacao.email"]', 'maria@clinica-teste.com.br');
    await page.click('#f-conf [type=submit]');
    await page.waitForSelector('.cli-menu [aria-current=page]:has-text("Autodiagnóstico")', { timeout: 15000 });
    clienteId = banco.clients[0]?.id;
  });
}
if (!clienteId) {
  banco.clients.push({ id: 'c0000000-0000-4000-8000-000000000001', name: "Clínica Teste D'Ávila", segment: 'Terapias', city: 'São Paulo/SP', stage: 'lead', is_active: true, positioning_enabled: false, created_at: banco.agora, updated_at: banco.agora });
  clienteId = banco.clients[0].id;
}
const abaCliente = async (aba, nome, extra) => passo(nome, async () => {
  await page.goto(`${BASE}#/cliente/${clienteId}/${aba}`); await page.waitForSelector('#painel-aba > :not(.loading)'); if (extra) await extra();
});
await abaCliente('preparacao', '07-preparacao');
await abaCliente('sessao', '08-sessao', async () => {
  await page.click('[data-acao="cron"]');
  await page.fill('[data-k="session.ctx.salas"]', '4'); await page.fill('[data-k="session.ctx.profissionais"]', '3');
  await page.fill('[data-k="session.ctx.simultaneos"]', '2'); await page.fill('[data-k="session.ctx.atendimentosMes"]', '900');
  await page.fill('[data-k="session.ctx.valorSessao"]', '150');
  await page.click('[data-lista="session.ctx.especialidades"][data-v="ABA"]'); await page.click('[data-lista="session.ctx.cobranca"][data-v="Pacote de sessões"]');
  await page.waitForFunction(() => document.querySelector('#caixa-capacidade')?.textContent.includes('1.300'));
  await page.waitForTimeout(1200);
});
await abaCliente('matriz', '09-matriz', async () => {
  const b = page.locator('[data-nota]'); const n = await b.count();
  for (const alvo of ['|g|3', '|i|2', '|u|3', '|p|2']) { const el = page.locator(`[data-nota$="${alvo}"]`).first(); if (await el.count()) await el.click(); }
  await page.fill('[data-k="matrix.findings.0.t"]', 'Sessões realizadas sem conferência com a guia'); await page.waitForTimeout(1200);
  if (!n) throw new Error('matriz sem frentes');
});
await abaCliente('relatorio', '10-relatorio', async () => { await page.click('[data-acao="pdf-relatorio"]'); await page.waitForTimeout(800); if (!(await page.evaluate(() => window.__impressoes))) throw new Error('impressão não chamada'); });
await abaCliente('proposta', '11-proposta', async () => {
  await page.click('[data-acao="emitir-proposta"]'); await confirmarModal('Emitir e gerar PDF');
  await page.waitForSelector('text=ELG-2026-001', { timeout: 8000 });
});
await abaCliente('visao', '12-visao-geral', async () => {
  await page.fill('#ac-email', 'cliente@clinica-teste.com.br'); await page.click('#f-acesso [type=submit]');
  await page.waitForSelector('.secret'); await page.screenshot({ path: `${SAIDA}/12b-senha.png` }); await confirmarModal('Concluído');
  await page.waitForSelector('[data-acao="posicionamento"]'); await page.click('[data-acao="posicionamento"]'); await confirmarModal('Liberar');
  await page.waitForSelector('.badge.purple:text("Liberado")');
});
await abaCliente('autodiagnostico', '13-autodiagnostico');
await abaCliente('portal', '13b-liberacoes', async () => {
  await page.check('[data-lib="plano"]'); await page.waitForTimeout(300);
  await page.check('[data-lib="dashboard"]'); await page.waitForTimeout(300);
  await page.click('[data-publicar="relatorio"]'); await page.waitForSelector('[data-retirar="relatorio"]');
  await page.check('[data-baixar="relatorio"]');
});
// plano de ação de exemplo (o painel isolado só grava quando há edição)
const planoExemplo = { current: 'x', clients: { x: { nome: "Clínica Teste D'Ávila", periodoInicio: '2026-10-01', periodoFim: '2027-03-31', planoVersao: 3, plano: [
  { id: 'd1', pilar: 'faturamento', what: 'Implantar conferência de agenda antes do faturamento', why: 'Sessões não faturadas', who: 'Recepção', when: '2026-10-30', status: 'Em andamento', progresso: 40, inicio: '2026-10-06', checks: {} },
  { id: 'd2', pilar: 'comercial', what: 'Registrar origem de cada novo contato', why: 'Sem dados de canal', who: 'Comercial', when: '2026-10-20', status: 'Concluído', progresso: 100, inicio: '2026-10-06', concluidoEm: '2026-10-15', checks: {} },
  { id: 'd3', pilar: 'qualidade', what: 'Implantar pesquisa de satisfação (NPS)', why: 'Sem medição da experiência', who: 'Gestão', when: '2026-11-15', status: 'Não iniciado', progresso: 0, checks: {} }] } } };
await abaCliente('plano', '13c-plano-admin', async () => { await page.waitForSelector('iframe.painel-frame'); await page.waitForTimeout(2500); });
banco.action_plan_views = [{ client_id: clienteId, dados: planoExemplo }];
await passo('13d-materiais', async () => {
  await page.goto(BASE + '#/materiais'); await page.waitForSelector('#f-link');
  await page.fill('#l-tit', 'E-book Jornada do Paciente'); await page.fill('#l-url', 'https://drive.google.com/exemplo');
  await page.click('#f-link [type=submit]'); await page.waitForSelector('text=E-book Jornada do Paciente');
  banco.material_access.push({ material_id: banco.materials[0].id, client_id: clienteId, pode_baixar: false });
});
await passo('13e-programas', async () => { await page.goto(BASE + '#/configuracoes'); await page.waitForSelector('[data-formato]'); });
await abaCliente('historico', '14-historico');
await passo('15-auditoria', async () => { await page.goto(BASE + '#/auditoria'); await page.waitForSelector('#lista table, #lista .empty'); });
await passo('16-backup', async () => { await page.goto(BASE + '#/backup'); await page.waitForSelector('#f-bkp'); });
await passo('17-conta', async () => { await page.goto(BASE + '#/conta'); await page.waitForSelector('#f-pw'); });
if (PDFS2.length) {
  await passo('18-importar-embutido', async () => {
    await page.goto(BASE + '#/importar/' + clienteId); await page.waitForSelector('#zona');
    await page.setInputFiles('#arquivos', PDFS2);
    await page.waitForSelector('#f-conf'); await page.waitForSelector('.badge.ok:text("Leitura exata")');
  });
}
await passo('19-painel-final', async () => { await page.goto(BASE + '#/painel'); await page.waitForSelector('table.t'); });
await passo('20-sair', async () => { await page.click('#btn-sair'); await page.waitForSelector('#f-login'); });

// ------------------------------------------------------------- CLIENTE
await passo('21-cliente-troca-senha', async () => {
  await page.fill('#l-email', 'cliente@clinica-teste.com.br'); await page.fill('#l-senha', 'Temp-12345!x'); await page.click('#f-login [type=submit]');
  await page.waitForSelector('#f-senha');
  await page.fill('#s-nova', 'curta'); await page.fill('#s-conf', 'curta'); await page.click('#f-senha [type=submit]');
  await page.waitForFunction(() => document.querySelector('#s-erro').textContent.includes('10 caracteres'));
});
await passo('22-cliente-termo', async () => {
  await page.fill('#s-nova', 'Clinica-Segura-2026!'); await page.fill('#s-conf', 'Clinica-Segura-2026!'); await page.click('#f-senha [type=submit]');
  await page.waitForSelector('#f-termo');
});
await passo('23-cliente-abertura', async () => {
  await page.check('#t-ok'); await page.click('#f-termo [type=submit]');
  await page.waitForSelector('.abertura'); await page.waitForTimeout(3600);
});
await passo('23b-cliente-inicio', async () => {
  await page.click('.abertura .pular'); await page.waitForSelector('.cartao-portal'); await page.waitForTimeout(700);
});
await passo('24-cliente-etapa1', async () => {
  await page.click('a[href="#/posicionamento"]'); await page.waitForSelector('#comecar'); await page.click('#comecar'); await page.waitForSelector('.stepper');
  await page.fill('#q_p1_story', 'Nasceu para oferecer cuidado integrado à família — com "aspas" e acentuação.');
  await page.locator('label.chip:has([data-q="p1_values"])').first().click();
  await page.locator('label.chip:has([name="q_p1_score"][value="3"])').click();
  await page.click('[data-guia="p1_story"]'); await page.waitForSelector('.drawer'); await page.screenshot({ path: `${SAIDA}/24b-guia.png` }); await page.keyboard.press('Escape');
  await page.waitForFunction(() => /Salvo/.test(document.querySelector('#saveflag')?.textContent || ''), null, { timeout: 8000 });
});
await passo('25-cliente-revisao', async () => { for (let i = 0; i < 6; i++) await page.click('#avancar'); await page.waitForSelector('#enviar'); });
await passo('26-cliente-enviado', async () => {
  await page.click('#enviar'); await confirmarModal('Enviar agora');
  await page.waitForSelector('.thanks h1:text("Obrigada")');
  if (banco.assessments[0]?.status !== 'submitted') throw new Error('não marcou como enviado');
});
await passo('27-cliente-relatorio', async () => { await page.goto(BASE + '#/documento/relatorio'); await page.waitForSelector('#doc-cliente .cover'); });
await passo('27b-cliente-plano', async () => { await page.goto(BASE + '#/plano/plano'); await page.waitForSelector('iframe.painel-frame'); await page.waitForTimeout(2500); });
await passo('27c-cliente-dashboard', async () => { await page.goto(BASE + '#/plano/dashboard'); await page.waitForSelector('iframe.painel-frame'); await page.waitForTimeout(2500); });
await passo('27d-cliente-materiais', async () => { await page.goto(BASE + '#/materiais'); await page.waitForSelector('text=E-book Jornada do Paciente'); });
await passo('27e-cliente-inicio-final', async () => { await page.goto(BASE + '#/inicio'); await page.waitForSelector('.cartao-portal'); });

// celular
await passo('28-celular', async () => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto(BASE + '#/conta'); await page.waitForSelector('#f-pw'); });

await browser.close();
servidor.kill();
console.log('\nImpressões, e-mails e funções chamadas:', banco.audit_log.map((x) => x.action).join(', '));
if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
console.log('\nTudo certo. Capturas em', SAIDA);
