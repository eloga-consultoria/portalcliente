// Exportações seguras: CSV com acentos (abre direto no Excel em português) e JSON.
// Protege contra "injeção de fórmula": células que começam com = + - @ viram texto.
export function celula(v) {
  let s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function csv(linhas) {
  const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const corpo = [cols.map(celula).join(';'), ...linhas.map((l) => cols.map((c) => celula(l[c])).join(';'))].join('\r\n');
  return new Blob(['﻿' + corpo], { type: 'text/csv;charset=utf-8' });
}
export const json = (obj) => new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
