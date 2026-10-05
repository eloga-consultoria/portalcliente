// Ponto de entrada do Portal ELOGA: sessão, fluxo de acesso e rotas.
import { db, q } from './core/api.js';
import { CONFIG } from './config.js';
import { html, montar, $, urlSegura } from './core/dom.js';
import { avisarErro, carregando } from './core/ui.js';
import { telaLogin, telaTrocarSenha, garantirMfa, telaTermo, sair, vigiarInatividade } from './core/auth.js';

// Proteção contra exibição do portal dentro de outro site (clickjacking):
// o GitHub Pages não permite o cabeçalho X-Frame-Options.
if (window.top !== window.self) { document.documentElement.innerHTML = ''; window.top.location = window.self.location.href; }

const root = document.getElementById('app');
let iniciado = false;
export const sessao = { perfil: null, cliente: null, email: '' };

// ------------------------------------------------------------------ rotas
const ROTAS_ADMIN = {
  painel:    { titulo: 'Clientes',  modulo: () => import('./admin/clientes.js') },
  cliente:   { titulo: 'Cliente',   modulo: () => import('./admin/cliente.js'), menu: 'painel' },
  importar:  { titulo: 'Importar autodiagnóstico', modulo: () => import('./admin/importar.js') },
  auditoria: { titulo: 'Auditoria', modulo: () => import('./admin/auditoria.js') },
  backup:    { titulo: 'Backup',    modulo: () => import('./admin/backup.js') },
  materiais: { titulo: 'Materiais', modulo: () => import('./admin/materiais.js') },
  configuracoes: { titulo: 'Configurações', modulo: () => import('./admin/configuracoes.js') },
  conta:     { titulo: 'Minha conta', modulo: () => import('./admin/conta.js') },
};
const MENU_ADMIN = [['painel', 'Clientes'], ['importar', 'Importar'], ['materiais', 'Materiais'], ['configuracoes', 'Programas e preços'], ['auditoria', 'Auditoria'], ['backup', 'Backup'], ['conta', 'Minha conta']];
const ROTAS_CLIENTE = {
  inicio: { titulo: 'Início', modulo: () => import('./client/portal.js') },
  posicionamento: { titulo: 'Diagnóstico de posicionamento', modulo: () => import('./client/portal.js').then((m) => ({ render: m.renderPosicionamento })), menu: 'inicio' },
  documento: { titulo: 'Documento', modulo: () => import('./client/documentos.js'), menu: 'inicio' },
  plano: { titulo: 'Plano de ação', modulo: () => import('./client/plano.js'), menu: 'inicio' },
  materiais: { titulo: 'Materiais', modulo: () => import('./client/materiais.js'), menu: 'inicio' },
  conta:  { titulo: 'Minha conta', modulo: () => import('./client/conta.js') },
};

let limpar = null;
let antesDeSair = null;
/** Telas com edição registram aqui um salvamento a ser concluído antes de trocar de tela. */
export function aoSairDaTela(fn) { antesDeSair = fn; }

function lerRota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { nome: partes[0] || '', params: partes.slice(1) };
}
export const ir = (...partes) => { location.hash = '#/' + partes.map(encodeURIComponent).join('/'); };

async function navegar() {
  const admin = sessao.perfil?.role === 'admin';
  const rotas = admin ? ROTAS_ADMIN : ROTAS_CLIENTE;
  let { nome, params } = lerRota();
  if (!rotas[nome]) { nome = admin ? 'painel' : 'inicio'; params = []; history.replaceState(null, '', '#/' + nome); }
  if (antesDeSair) { try { await antesDeSair(); } catch (e) { avisarErro(e); } antesDeSair = null; }
  if (typeof limpar === 'function') { try { limpar(); } catch { /* */ } }
  limpar = null;

  document.querySelectorAll('.topbar nav a').forEach((a) => {
    const alvo = rotas[nome].menu || nome;
    a.toggleAttribute('aria-current', a.dataset.rota === alvo);
    if (a.dataset.rota === alvo) a.setAttribute('aria-current', 'page');
  });
  document.title = `${rotas[nome].titulo} · Portal ELOGA`;
  const main = $('#conteudo');
  montar(main, carregando());
  try {
    const mod = await rotas[nome].modulo();
    limpar = await mod.render(main, params, sessao);
  } catch (e) {
    avisarErro(e);
    montar(main, html`<div class="wrap"><div class="card"><h2>Não foi possível abrir esta tela</h2><p class="muted">Tente novamente. Se persistir, saia e entre de novo.</p>
      <button class="btn secondary" type="button" id="tentar">Tentar novamente</button></div></div>`);
    $('#tentar', main)?.addEventListener('click', navegar);
  }
  main.focus({ preventScroll: true });
  scrollTo({ top: 0 });
}

// ------------------------------------------------------------------ layout
function montarLayout() {
  const admin = sessao.perfil.role === 'admin';
  const menu = admin ? MENU_ADMIN : [['inicio', 'Início'], ['conta', 'Minha conta']];
  const nome = admin ? 'Administração ELOGA' : sessao.cliente?.name || '';
  montar(root, html`
    <a class="skip" href="#conteudo">Pular para o conteúdo</a>
    <header class="topbar no-print"><div class="wrap">
      <a href="#/${admin ? 'painel' : 'inicio'}" aria-label="Início"><img src="assets/img/eloga-marca-clara.png" alt="ELOGA" class="brandlogo"></a>
      <nav aria-label="Menu principal">${menu.map(([r, t]) => html`<a href="#/${r}" data-rota="${r}">${t}</a>`)}</nav>
      <div class="who"><span class="who-name">${admin ? 'Conectada como' : ''} <b>${nome}</b></span>
        <button class="btn sm secondary" type="button" id="btn-sair">Sair</button></div>
    </div></header>
    <main id="conteudo" tabindex="-1"></main>
    <footer class="footer no-print"><div class="wrap">
      <span>ELOGA · Consultoria &amp; Estratégias em Saúde</span>
      <nav aria-label="Contatos">
        <a href="${urlSegura(CONFIG.contato.instagram)}" target="_blank" rel="noopener">${CONFIG.contato.instagramLabel}</a>
        <a href="${urlSegura(CONFIG.contato.site)}" target="_blank" rel="noopener">Site</a>
        <a href="${urlSegura(CONFIG.contato.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="${urlSegura('mailto:' + CONFIG.contato.email)}">${CONFIG.contato.email}</a>
      </nav></div></footer>`);
  $('#btn-sair').addEventListener('click', () => sair());
  addEventListener('hashchange', navegar);
  vigiarInatividade(admin ? CONFIG.inatividadeAdmin : CONFIG.inatividadeCliente);
  navegar();
  if (!admin) import('./client/abertura.js').then((m) => m.abertura()).catch(() => {});
}

// ------------------------------------------------------------------ fluxo de acesso
async function iniciar() {
  montar(root, carregando('Abrindo o portal...'));
  const { data: { session } } = await db.auth.getSession();
  if (!session) { iniciado = false; return telaLogin(root); }
  sessao.email = session.user.email;
  const perfil = await q(db.from('profiles').select('user_id, role, client_id, must_change_password').eq('user_id', session.user.id).maybeSingle());
  if (!perfil) {
    await db.auth.signOut();
    return telaLogin(root, { mensagem: 'Este acesso ainda não está vinculado a uma clínica. Fale com a ELOGA.' });
  }
  sessao.perfil = perfil;

  if (perfil.must_change_password) return telaTrocarSenha(root, { aoConcluir: iniciar });

  if (perfil.role === 'admin') {
    const ok = await garantirMfa(root, iniciar);
    if (!ok) return;
    return montarLayout();
  }

  if (!perfil.client_id) {
    await db.auth.signOut();
    return telaLogin(root, { mensagem: 'Este acesso ainda não está vinculado a uma clínica. Fale com a ELOGA.' });
  }
  sessao.cliente = await q(db.from('clients').select('*').eq('id', perfil.client_id).maybeSingle());
  const termo = await q(db.from('consents').select('id').eq('user_id', session.user.id).eq('term_version', CONFIG.termoVersao).limit(1));
  if (!termo.length) return telaTermo(root, { clientId: perfil.client_id, aoConcluir: iniciar });
  montarLayout();
}

async function boot() {
  const msg = sessionStorage.getItem('eloga_msg_login') || '';
  sessionStorage.removeItem('eloga_msg_login');
  // Só reage a entrada e saída. Renovação de token NÃO redesenha a tela
  // (no portal antigo isso apagava respostas não salvas a cada hora).
  db.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_IN' && !iniciado) { iniciado = true; setTimeout(() => iniciar().catch(falhaGeral), 0); }
    if (evento === 'SIGNED_OUT' && iniciado) { iniciado = false; location.reload(); }
  });
  const { data: { session } } = await db.auth.getSession();
  if (session) { iniciado = true; await iniciar(); } else telaLogin(root, { mensagem: msg });
}

function falhaGeral(e) {
  avisarErro(e);
  montar(root, html`<div class="wrap" style="padding:48px 0"><div class="card"><h2>Não foi possível abrir o portal</h2>
    <p class="muted">Verifique sua conexão e tente novamente.</p><button class="btn primary" type="button" id="recarregar">Recarregar</button></div></div>`);
  $('#recarregar')?.addEventListener('click', () => location.reload());
}

boot().catch(falhaGeral);
