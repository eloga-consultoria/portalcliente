// "Minha conta" (cliente e admin): troca de senha, encerrar sessões, termo e direitos LGPD.
import { db, q, registrar } from '../core/api.js';
import { CONFIG } from '../config.js';
import { html, montar, $, urlSegura, fmtDataHora } from '../core/dom.js';
import { avisar, mensagemErro, ocupado, confirmar } from '../core/ui.js';
import { avaliarSenha, sair, TERMO } from '../core/auth.js';

export async function render(el, _p, sessao) {
  const admin = sessao.perfil.role === 'admin';
  const aceite = await q(db.from('consents').select('term_version, accepted_at').eq('user_id', sessao.perfil.user_id).order('accepted_at', { ascending: false }).limit(1));
  let fatores = [];
  if (admin) { const f = await db.auth.mfa.listFactors(); fatores = (f.data?.totp || []).filter((x) => x.status === 'verified'); }
  montar(el, html`<div class="wrap stack" style="max-width:860px">
    <div class="page-head"><div><span class="eyebrow">Segurança</span><h1>Minha conta</h1><p>${sessao.email}</p></div></div>
    <div class="card"><div class="card-head"><div><h2>Alterar senha</h2><p>Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p></div></div>
      <form id="f-pw" class="grid g2" novalidate>
        <div class="field"><label for="pw1">Nova senha</label><input id="pw1" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="pw2">Confirme</label><input id="pw2" type="password" autocomplete="new-password"></div>
        <p id="pw-msg" class="small span-2" role="alert" style="margin:0"></p>
        <div><button class="btn strong" type="submit">Salvar nova senha</button></div>
      </form></div>
    <div class="card"><div class="card-head"><div><h2>Sessões</h2><p>Encerre o acesso em todos os computadores e celulares em que você entrou.</p></div></div>
      <button class="btn danger" type="button" id="sair-todos">Sair de todos os dispositivos</button></div>
    ${admin ? html`<div class="card"><div class="card-head"><div><h2>Verificação em duas etapas</h2><p>Obrigatória para o acesso administrativo.</p></div>
      <span class="badge ${fatores.length ? 'ok' : 'bad'}">${fatores.length ? 'Ativa' : 'Inativa'}</span></div>
      ${fatores.map((f) => html`<p class="small muted">${f.friendly_name || 'Autenticador'} · cadastrado em ${fmtDataHora(f.created_at)}</p>`)}
      <p class="small muted">Trocou de celular? Peça a remoção do fator antigo no painel do Supabase (Authentication → Users → seu usuário → MFA) e entre de novo para cadastrar o novo.</p></div>` : ''}
    <div class="card"><div class="card-head"><div><h2>Privacidade (LGPD)</h2>
      <p>${aceite[0] ? 'Termo ' + aceite[0].term_version + ' aceito em ' + fmtDataHora(aceite[0].accepted_at) + '.' : 'Termo ainda não registrado.'}</p></div></div>
      <details><summary class="linkbtn">Ler o termo</summary><div class="small" style="margin-top:12px">${TERMO}</div></details>
      ${!admin ? html`<p class="small" style="margin-top:12px">Para acessar, corrigir, exportar ou excluir seus dados, escreva para
        <a href="${urlSegura('mailto:' + CONFIG.contato.email + '?subject=Solicita%C3%A7%C3%A3o%20LGPD%20-%20Portal%20ELOGA')}">${CONFIG.contato.email}</a>. Respondemos em até 15 dias.</p>` : ''}
    </div></div>`);

  $('#f-pw', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#pw1', el).value, b = $('#pw2', el).value, msg = $('#pw-msg', el);
    msg.style.color = 'var(--bad)';
    const falta = avaliarSenha(a);
    if (falta.length) { msg.textContent = 'A senha precisa ter ' + falta.join(', ') + '.'; return; }
    if (a !== b) { msg.textContent = 'As senhas não coincidem.'; return; }
    await ocupado(e.submitter || $('#f-pw [type=submit]', el), async () => {
      const { error } = await db.auth.updateUser({ password: a });
      if (error) { msg.textContent = mensagemErro(error); return; }
      msg.style.color = 'var(--ok)'; msg.textContent = 'Senha alterada.'; $('#pw1', el).value = $('#pw2', el).value = '';
      registrar('sessao.senha_alterada');
      avisar('Senha alterada.', 'ok');
    });
  });
  $('#sair-todos', el).addEventListener('click', async () => {
    if (await confirmar('Sair de todos os dispositivos?', 'Todas as sessões abertas, inclusive esta, serão encerradas.', { rotulo: 'Sair de todos', perigo: true })) sair({ todos: true });
  });
}
