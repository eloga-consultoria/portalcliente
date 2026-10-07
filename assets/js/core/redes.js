// Ícones das redes sociais e contatos da ELOGA (SVG fixo, sem conteúdo externo).
import { html, confiavel, urlSegura } from './dom.js';
import { CONFIG } from '../config.js';

const SVG = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 10.2v6.3M7.5 7.4v.1M11.2 16.5v-6.3m0 2.9c0-1.7 1-2.9 2.6-2.9s2.4 1.1 2.4 2.9v3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.5 19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8.6c.2-.5.6-.5.9-.4l.9 2c.1.3 0 .5-.2.7l-.4.5c.6 1.2 1.5 2.1 2.7 2.7l.5-.4c.2-.2.4-.3.7-.2l2 .9c.2.3.1.7-.4.9-1 .6-2.2.6-3.6-.2a8.6 8.6 0 0 1-3.3-3.3C8.4 10.8 8.4 9.6 9 8.6z" fill="currentColor"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};

/** Linha de ícones com os canais da ELOGA. */
export function redesSociais(classe = '') {
  const c = CONFIG.contato;
  const itens = [
    ['instagram', c.instagram, 'Instagram ' + (c.instagramLabel || '')],
    ['linkedin', c.linkedin, 'LinkedIn'],
    ['whatsapp', c.whatsapp, 'WhatsApp'],
    ['site', c.site, 'Site da ELOGA'],
    ['email', c.email && 'mailto:' + c.email, 'E-mail ' + (c.email || '')],
  ].filter(([, url]) => url);
  return html`<nav class="redes ${classe}" aria-label="Redes sociais e contatos da ELOGA">
    ${itens.map(([k, url, rotulo]) => html`<a href="${urlSegura(url)}" ${k === 'email' ? '' : html`target="_blank" rel="noopener noreferrer"`} aria-label="${rotulo.trim()}" title="${rotulo.trim()}">${confiavel(SVG[k])}</a>`)}</nav>`;
}
