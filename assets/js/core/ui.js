// Componentes de interface: avisos (toast), janelas (modal), confirmações, erros em português.
import { html, montar, $, esc } from './dom.js';

// ---------------------------------------------------------------- erros
/** Converte qualquer erro (Supabase, rede, nosso) em mensagem clara em português. */
export function mensagemErro(e) {
  const msg = String(e?.message ?? e ?? '');
  const code = String(e?.code ?? '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Acesso ainda não confirmado. Fale com a ELOGA.';
  if (/user is banned|banned/i.test(msg)) return 'Acesso bloqueado. Fale com a ELOGA para reativação.';
  if (/too many|rate limit|429/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
  if (/jwt expired|refresh token|session.*(missing|expired)|not authenticated/i.test(msg)) return 'Sua sessão expirou. Entre novamente.';
  if (/row-level security|permission denied|42501/i.test(msg + code) && !/[ãçéíóúâê]/i.test(msg)) return 'Você não tem permissão para esta ação.';
  if (/password should be|weak.?password|password is known/i.test(msg)) return 'Senha fraca. Use ao menos 10 caracteres com letras maiúsculas, minúsculas, números e símbolo, e evite senhas comuns.';
  if (/same.?password|new password should be different/i.test(msg)) return 'A nova senha precisa ser diferente da atual.';
  if (/invalid totp|invalid code|code.*(invalid|expired)|mfa/i.test(msg) && /code|totp/i.test(msg)) return 'Código do autenticador inválido ou expirado. Confira o horário do celular e tente o código atual.';
  if (/duplicate key|23505/i.test(msg + code) && !/[ãçéíóúâê]/i.test(msg)) return 'Já existe um registro com esses dados.';
  if (/payload too large|413/i.test(msg)) return 'Arquivo muito grande.';
  // Mensagens já em português (geradas pelo nosso banco e funções)
  if (/[ãçéíóúâêõà]/i.test(msg) && msg.length < 300) return msg;
  return 'Não foi possível concluir a ação. Tente novamente; se persistir, fale com a ELOGA.';
}

// ---------------------------------------------------------------- toast
export function avisar(texto, tipo = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.setAttribute('role', tipo === 'bad' ? 'alert' : 'status');
  t.textContent = texto;
  box.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'bad' ? 7000 : 3500);
}
export const avisarErro = (e) => { console.error(e); avisar(mensagemErro(e), 'bad'); };

// ---------------------------------------------------------------- modal
/**
 * Abre uma janela. `corpo` é html`` seguro. `acoes` = [{rotulo, classe, valor}].
 * Retorna Promise com o valor do botão (ou null ao fechar). Fecha com Esc e devolve o foco.
 */
export function janela({ titulo, corpo, acoes = [{ rotulo: 'Fechar', classe: 'secondary', valor: null }], largo = false, aoAbrir, validar }) {
  return new Promise((resolver) => {
    const anterior = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-back';
    montar(back, html`<div class="modal ${largo ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <div class="modal-head"><h2 id="mdl-t">${titulo}</h2><button class="xbtn" type="button" data-x aria-label="Fechar">×</button></div>
      <div class="modal-body">${corpo}</div>
      <div class="modal-foot">${acoes.map((a, i) => html`<button type="button" class="btn ${a.classe || 'secondary'}" data-i="${i}">${a.rotulo}</button>`)}</div>
    </div>`);
    document.body.appendChild(back);
    const fechar = (v) => { back.remove(); document.removeEventListener('keydown', tecla); anterior?.focus?.(); resolver(v); };
    const tecla = (e) => {
      if (e.key === 'Escape') fechar(null);
      if (e.key === 'Tab') { // mantém o foco dentro da janela
        const f = [...back.querySelectorAll('button,input,select,textarea,a[href]')].filter((x) => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', tecla);
    back.addEventListener('click', async (e) => {
      if (e.target === back || e.target.closest('[data-x]')) return fechar(null);
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const a = acoes[+b.dataset.i];
      if (a.valor !== null && validar) {
        const ok = await validar(back, a.valor);
        if (!ok) return;
      }
      fechar(a.valor);
    });
    aoAbrir?.(back);
    (back.querySelector('[autofocus]') || back.querySelector('.modal-foot .btn:last-child'))?.focus();
  });
}

export async function confirmar(titulo, texto, { rotulo = 'Confirmar', perigo = false } = {}) {
  const v = await janela({
    titulo, corpo: html`<p>${texto}</p>`,
    acoes: [{ rotulo: 'Cancelar', classe: 'secondary', valor: null }, { rotulo, classe: perigo ? 'danger solid' : 'strong', valor: true }],
  });
  return v === true;
}

/** Confirmação forte: digitar o nome exato (exclusões). */
export async function confirmarDigitando(titulo, texto, nome, rotulo = 'Excluir definitivamente') {
  let digitado = '';
  const v = await janela({
    titulo,
    corpo: html`<div class="stack"><div class="notice bad">${texto}</div>
      <div class="field"><label for="cfm-nome">Para confirmar, digite o nome: <b>${nome}</b></label>
      <input id="cfm-nome" type="text" autocomplete="off" autofocus></div><p class="small muted" id="cfm-err" aria-live="assertive"></p></div>`,
    acoes: [{ rotulo: 'Cancelar', classe: 'secondary', valor: null }, { rotulo, classe: 'danger solid', valor: true }],
    validar: (el) => {
      digitado = el.querySelector('#cfm-nome').value;
      const ok = digitado.normalize('NFC').trim().toLowerCase() === String(nome).normalize('NFC').trim().toLowerCase();
      el.querySelector('#cfm-err').textContent = ok ? '' : 'O nome digitado não confere.';
      return ok;
    },
  });
  return v === true ? digitado : null;
}

// ---------------------------------------------------------------- botões ocupados
export async function ocupado(botao, fn) {
  if (!botao || botao.getAttribute('aria-busy') === 'true') return;
  const original = botao.innerHTML;
  botao.setAttribute('aria-busy', 'true'); botao.disabled = true;
  botao.innerHTML = '<span class="spin" aria-hidden="true"></span>' + esc(botao.textContent.trim());
  try { return await fn(); }
  finally { botao.removeAttribute('aria-busy'); botao.disabled = false; botao.innerHTML = original; }
}

export const carregando = (texto = 'Carregando...') => html`<div class="loading" role="status"><span class="spin" aria-hidden="true"></span>${texto}</div>`;
export const vazio = (titulo, texto = '', acao = '') => html`<div class="empty"><h3>${titulo}</h3><p>${texto}</p>${acao}</div>`;
