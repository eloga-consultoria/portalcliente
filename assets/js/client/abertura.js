// Abertura com o slogan da ELOGA, exibida ao cliente uma vez por acesso.
import { html, montar } from '../core/dom.js';

export function abertura() {
  if (sessionStorage.getItem('eloga_abertura')) return;
  sessionStorage.setItem('eloga_abertura', '1');
  const el = document.createElement('div');
  el.className = 'abertura';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Boas-vindas');
  montar(el, html`<div class="conteudo">
      <img src="assets/img/eloga-marca-clara.png" alt="ELOGA">
      <p class="frase">Você decide transformar.</p>
      <p class="frase">Nós construímos juntos.</p>
      <p class="frase">Seu resultado é o nosso.</p>
      <div class="traco" aria-hidden="true"></div></div>
    <button type="button" class="pular">Entrar no portal</button>`);
  document.body.appendChild(el);
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fechado = false;
  const fechar = () => {
    if (fechado) return; fechado = true;
    el.classList.add('saindo');
    setTimeout(() => el.remove(), reduzido ? 0 : 600);
    document.getElementById('conteudo')?.focus({ preventScroll: true });
  };
  el.querySelector('.pular').addEventListener('click', fechar);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); }, { once: true });
  el.querySelector('.pular').focus();
  setTimeout(fechar, reduzido ? 2500 : 5200);
}
