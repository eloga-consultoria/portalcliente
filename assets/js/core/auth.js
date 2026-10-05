// Autenticação: login, troca obrigatória de senha, MFA do admin, termo LGPD, inatividade.
import { db, q, registrar } from './api.js';
import { CONFIG } from '../config.js';
import { html, montar, $, urlSegura } from './dom.js';
import { mensagemErro, avisar, ocupado } from './ui.js';

const LOGO = 'assets/img/eloga-logo.png';

// ------------------------------------------------------------- senha forte
export function avaliarSenha(s) {
  const falta = [];
  if (s.length < 10) falta.push('ao menos 10 caracteres');
  if (!/[a-z]/.test(s)) falta.push('uma letra minúscula');
  if (!/[A-Z]/.test(s)) falta.push('uma letra maiúscula');
  if (!/\d/.test(s)) falta.push('um número');
  if (!/[^A-Za-z0-9]/.test(s)) falta.push('um símbolo');
  if (/^(.)\1+$/.test(s) || /123456|senha|password|eloga/i.test(s)) falta.push('evitar sequências e palavras óbvias');
  return falta;
}

function campoSenha(id, rotulo, autocomplete) {
  return html`<div class="field"><label for="${id}">${rotulo}</label>
    <div class="pass-wrap"><input id="${id}" type="password" autocomplete="${autocomplete}" required>
    <button type="button" data-ver="${id}" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div></div>`;
}
function ligarMostrarSenha(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver]'); if (!b) return;
    const i = root.querySelector('#' + b.dataset.ver);
    const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    b.textContent = ver ? 'Ocultar' : 'Mostrar';
    b.setAttribute('aria-pressed', String(ver));
  });
}

// ------------------------------------------------------------- moldura
function telaAuth(root, conteudo) {
  montar(root, html`<div class="auth">
    <aside class="auth-side">
      <img src="${LOGO}" alt="ELOGA Consultoria & Estratégias em Saúde" class="brandlogo" style="height:46px">
      <div>
        <h1>Diagnóstico estratégico <em>da sua clínica</em>.</h1>
        <p>Um ambiente exclusivo para clientes da ELOGA conduzirem o diagnóstico com método, confidencialidade e foco em resultado.</p>
        <ul class="trust">
          <li><span class="ic">1</span><span><b>Acesso individual</b>Cada clínica vê somente as próprias informações.</span></li>
          <li><span class="ic">2</span><span><b>Dados protegidos</b>Conexão criptografada e regras de acesso no servidor.</span></li>
          <li><span class="ic">3</span><span><b>LGPD</b>Sem dados de pacientes. Você pode solicitar a exclusão a qualquer momento.</span></li>
        </ul>
      </div>
      <p class="xs" style="color:#8fa6b2;position:relative;z-index:1">ELOGA · Consultoria &amp; Estratégias em Saúde</p>
    </aside>
    <section class="auth-main"><div class="auth-box">${conteudo}</div></section>
  </div>`);
  ligarMostrarSenha(root);
}

// ------------------------------------------------------------- login
export function telaLogin(root, { mensagem = '' } = {}) {
  telaAuth(root, html`
    <span class="eyebrow">Portal ELOGA</span>
    <h2>Acessar portal</h2>
    <p class="lead">Use o e-mail e a senha enviados pela ELOGA.</p>
    ${mensagem ? html`<div class="notice info" role="status">${mensagem}</div>` : ''}
    <form id="f-login" novalidate>
      <div class="field"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required autofocus></div>
      ${campoSenha('l-senha', 'Senha', 'current-password')}
      <p id="l-erro" class="small" style="color:var(--bad);min-height:1.2em;margin:0" role="alert" aria-live="assertive"></p>
      <button class="btn primary lg block" type="submit">Entrar</button>
      ${CONFIG.recuperacaoPorEmail
        ? html`<button type="button" class="linkbtn" id="l-esqueci">Esqueci minha senha</button>`
        : html`<p class="small muted" style="margin:0">Esqueceu a senha? <a href="${urlSegura('mailto:' + CONFIG.contato.email + '?subject=Nova%20senha%20do%20Portal%20ELOGA')}">Peça uma nova à ELOGA</a> ou pelo <a href="${urlSegura(CONFIG.contato.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>.</p>`}
    </form>
    <p class="auth-foot">Ao entrar, você concorda com o tratamento de dados descrito no termo de uso do portal, apresentado no primeiro acesso.
      <a href="${urlSegura(CONFIG.contato.site + 'privacidade.html')}" target="_blank" rel="noopener">Política de privacidade</a>.</p>`);

  const form = $('#f-login', root);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#l-email', root).value.trim(), senha = $('#l-senha', root).value;
    const erro = $('#l-erro', root);
    if (!email || !senha) { erro.textContent = 'Informe e-mail e senha.'; return; }
    await ocupado(form.querySelector('[type=submit]'), async () => {
      const { error } = await db.auth.signInWithPassword({ email, password: senha });
      // Mensagem genérica: não revela se o e-mail existe
      if (error) erro.textContent = /banned/i.test(error.message) ? mensagemErro(error)
        : /too many|rate/i.test(error.message) ? mensagemErro(error) : 'E-mail ou senha incorretos.';
      else registrar('sessao.login');
    });
  });
  $('#l-esqueci', root)?.addEventListener('click', async () => {
    const email = $('#l-email', root).value.trim();
    if (!email) { $('#l-erro', root).textContent = 'Informe seu e-mail acima.'; return; }
    await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    avisar('Se o e-mail estiver cadastrado, você receberá as instruções em instantes.');
  });
}

// ------------------------------------------------------------- troca obrigatória
export function telaTrocarSenha(root, { obrigatoria = true, aoConcluir }) {
  telaAuth(root, html`
    <span class="eyebrow">${obrigatoria ? 'Primeiro acesso' : 'Segurança'}</span>
    <h2>Crie sua senha</h2>
    <p class="lead">${obrigatoria ? 'Por segurança, troque a senha temporária enviada pela ELOGA por uma senha só sua.' : 'Defina uma nova senha.'}</p>
    <form id="f-senha" novalidate>
      ${campoSenha('s-nova', 'Nova senha', 'new-password')}
      ${campoSenha('s-conf', 'Confirme a nova senha', 'new-password')}
      <p class="xs muted" style="margin:0">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
      <p id="s-erro" class="small" style="color:var(--bad);min-height:1.2em;margin:0" role="alert"></p>
      <button class="btn primary lg block" type="submit">Salvar nova senha</button>
      <button class="btn ghost block" type="button" id="s-sair">Sair</button>
    </form>`);
  $('#s-sair', root).onclick = () => sair();
  $('#f-senha', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#s-nova', root).value, b = $('#s-conf', root).value, erro = $('#s-erro', root);
    const falta = avaliarSenha(a);
    if (falta.length) { erro.textContent = 'A senha precisa ter ' + falta.join(', ') + '.'; return; }
    if (a !== b) { erro.textContent = 'As senhas não coincidem.'; return; }
    await ocupado(e.submitter || $('#f-senha [type=submit]', root), async () => {
      const { error } = await db.auth.updateUser({ password: a });
      if (error) { erro.textContent = mensagemErro(error); return; }
      await db.rpc('my_mark_password_changed');
      avisar('Senha atualizada.', 'ok');
      aoConcluir();
    });
  });
}

// ------------------------------------------------------------- MFA (admin)
/** Garante sessão aal2. Retorna true se já está ok; caso contrário desenha a tela e chama aoConcluir. */
export async function garantirMfa(root, aoConcluir) {
  const { data: nivel, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (nivel.currentLevel === 'aal2') return true;
  const fatores = await q(db.auth.mfa.listFactors());
  const totp = (fatores.totp || []).find((f) => f.status === 'verified');
  if (totp) telaDesafioMfa(root, totp.id, aoConcluir);
  else await telaCadastroMfa(root, aoConcluir);
  return false;
}

function formCodigo(titulo, intro, extra = '') {
  return html`<span class="eyebrow">Verificação em duas etapas</span><h2>${titulo}</h2><p class="lead">${intro}</p>
    ${extra}
    <form id="f-mfa" novalidate>
      <div class="field"><label for="m-cod">Código de 6 dígitos do aplicativo autenticador</label>
        <input id="m-cod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus></div>
      <p id="m-erro" class="small" style="color:var(--bad);min-height:1.2em;margin:0" role="alert"></p>
      <button class="btn primary lg block" type="submit">Confirmar</button>
      <button class="btn ghost block" type="button" id="m-sair">Sair</button>
    </form>`;
}

async function verificarCodigo(root, fatorId, aoConcluir) {
  $('#m-sair', root).onclick = () => sair();
  $('#f-mfa', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#m-cod', root).value.replace(/\D/g, '');
    const erro = $('#m-erro', root);
    if (code.length !== 6) { erro.textContent = 'Digite os 6 números.'; return; }
    await ocupado($('#f-mfa [type=submit]', root), async () => {
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: fatorId, code });
      if (error) { erro.textContent = mensagemErro(error); return; }
      await db.auth.refreshSession();
      aoConcluir();
    });
  });
}

function telaDesafioMfa(root, fatorId, aoConcluir) {
  telaAuth(root, formCodigo('Confirme sua identidade', 'Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou similar) e digite o código atual.'));
  verificarCodigo(root, fatorId, aoConcluir);
}

async function telaCadastroMfa(root, aoConcluir) {
  // Remove cadastros incompletos anteriores antes de criar um novo
  const fatores = await q(db.auth.mfa.listFactors());
  for (const f of fatores.all || []) if (f.status !== 'verified') await db.auth.mfa.unenroll({ factorId: f.id });
  const novo = await q(db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Portal ELOGA ' + new Date().toISOString().slice(0, 10) }));
  const qr = String(novo.totp.qr_code || '');
  telaAuth(root, formCodigo('Ative a verificação em duas etapas',
    'O acesso administrativo exige um segundo fator. Faça isto uma única vez:',
    html`<ol class="small" style="padding-left:18px;margin:0 0 16px">
      <li>Instale um aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator, Authy).</li>
      <li>No aplicativo, escolha “adicionar conta” e leia o QR code abaixo.</li>
      <li>Digite o código de 6 dígitos que aparecer.</li></ol>
      ${qr.startsWith('data:image/svg+xml') ? html`<img src="${qr}" alt="QR code para o aplicativo autenticador" style="width:200px;height:200px;margin:0 auto 12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px">` : ''}
      <p class="xs muted">Sem câmera? Digite esta chave no aplicativo: <code style="word-break:break-all">${novo.totp.secret}</code></p>`));
  await verificarCodigo(root, novo.id, async () => { await registrar('mfa.ativado'); aoConcluir(); });
}

// ------------------------------------------------------------- termo LGPD
export const TERMO = html`
  <p><b>Quem trata os dados:</b> ELOGA · Consultoria &amp; Estratégias em Saúde (controladora), contato ${CONFIG.contato.email}.</p>
  <p><b>Quais dados:</b> dados cadastrais da clínica e do responsável (nome, e-mail, cidade, segmento) e as respostas sobre a gestão e o posicionamento da clínica.
  <b>Não informe dados de pacientes</b> (nomes, diagnósticos, documentos): o portal não foi feito para isso.</p>
  <p><b>Para quê:</b> elaborar o diagnóstico, as recomendações e a proposta de consultoria. Base legal: execução de procedimentos preliminares a contrato e legítimo interesse (art. 7º, V e IX, da LGPD).</p>
  <p><b>Com quem:</b> fornecedores de tecnologia que hospedam o portal e enviam e-mails (Supabase e Google), sob contrato e com dados protegidos. Não vendemos nem compartilhamos para publicidade.</p>
  <p><b>Por quanto tempo:</b> durante o relacionamento e por até 5 anos após o encerramento, para comprovação das entregas; antes disso, você pode pedir a exclusão.</p>
  <p><b>Seus direitos (art. 18):</b> confirmação, acesso, correção, portabilidade, exclusão e revogação do consentimento, pelo e-mail ${CONFIG.contato.email}.</p>
  <p><b>Segurança:</b> acesso individual com senha, conexão criptografada, regras de acesso no servidor e registro de auditoria.</p>`;

export function telaTermo(root, { clientId, aoConcluir }) {
  telaAuth(root, html`
    <span class="eyebrow">Termo de ciência · ${CONFIG.termoVersao}</span>
    <h2>Seus dados, com cuidado</h2>
    <div class="card tight small" style="max-height:46vh;overflow:auto;margin:16px 0">${TERMO}</div>
    <form id="f-termo">
      <label class="check"><input type="checkbox" id="t-ok" required> <span>Li e estou de acordo com o tratamento dos dados descrito acima.</span></label>
      <p id="t-erro" class="small" style="color:var(--bad);min-height:1.2em;margin:8px 0 0" role="alert"></p>
      <button class="btn primary lg block" type="submit" style="margin-top:8px">Continuar</button>
      <button class="btn ghost block" type="button" id="t-sair" style="margin-top:8px">Sair</button>
    </form>`);
  $('#t-sair', root).onclick = () => sair();
  $('#f-termo', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!$('#t-ok', root).checked) { $('#t-erro', root).textContent = 'Marque a caixa para continuar.'; return; }
    await ocupado($('#f-termo [type=submit]', root), async () => {
      try {
        await q(db.from('consents').insert({ client_id: clientId, term_version: CONFIG.termoVersao, user_agent: navigator.userAgent.slice(0, 300) }));
        aoConcluir();
      } catch (err) { $('#t-erro', root).textContent = mensagemErro(err); }
    });
  });
}

// ------------------------------------------------------------- sessão
export async function sair({ todos = false, motivo = '' } = {}) {
  await registrar(motivo ? 'sessao.expirada' : 'sessao.logout', { detalhes: todos ? { escopo: 'todos os dispositivos' } : {} });
  await db.auth.signOut({ scope: todos ? 'global' : 'local' }).catch(() => {});
  sessionStorage.setItem('eloga_msg_login', motivo);
  location.hash = '';
  location.reload();
}

let timer = null;
export function vigiarInatividade(minutos) {
  const reiniciar = () => {
    clearTimeout(timer);
    timer = setTimeout(() => sair({ motivo: 'Sua sessão foi encerrada após ' + minutos + ' minutos sem atividade. Entre novamente.' }), minutos * 60_000);
  };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => addEventListener(ev, reiniciar, { passive: true }));
  reiniciar();
}
