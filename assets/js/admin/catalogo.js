// Catálogo de programas e preços salvo no banco (tabela app_settings, chave "catalogo").
import { db } from '../core/api.js';
import { aplicarCatalogo } from './operacional-modelo.js';

let carregado = false;
export async function carregarCatalogo(forcar = false) {
  if (carregado && !forcar) return;
  const { data, error } = await db.from('app_settings').select('value').eq('key', 'catalogo').maybeSingle();
  if (!error && data?.value) aplicarCatalogo(data.value);
  carregado = true;
}
