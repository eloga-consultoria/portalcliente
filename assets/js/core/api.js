// Camada única de acesso ao Supabase: tratamento padronizado de erros.
import { CONFIG } from '../config.js';

if (!window.supabase?.createClient) throw new Error('Biblioteca do Supabase não carregada.');

// Sessão guardada no sessionStorage: some ao fechar a aba e não persiste no computador.
export const db = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Executa uma consulta do supabase-js e lança erro se houver. */
export async function q(consulta) {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}

/** Chama uma edge function com o token da sessão. Erros vêm em português do servidor. */
export async function funcao(nome, corpo) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
  let r;
  try {
    r = await fetch(`${CONFIG.supabaseUrl}/functions/v1/${nome}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(corpo),
    });
  } catch { throw new Error('Sem conexão com o servidor. Verifique a internet e tente novamente.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 404 && !j.error) throw new Error(`Função “${nome}” não publicada no Supabase. Veja docs/LEIAME.md.`);
    throw new Error(j.error || 'Não foi possível concluir a ação.');
  }
  return j;
}

/** Registro de auditoria de eventos de tela. Nunca bloqueia a operação principal. */
export async function registrar(acao, { entidade = null, id = null, cliente = null, detalhes = {} } = {}) {
  try {
    const { error } = await db.rpc('log_event', {
      p_action: acao, p_entity: entidade, p_entity_id: id ? String(id) : null, p_client_id: cliente, p_details: detalhes,
    });
    if (error) console.warn('auditoria', error.message);
  } catch (e) { console.warn('auditoria', e); }
}

/** Baixa a logo privada do cliente como data URL (para relatórios). */
export async function logoComoDataUrl(caminho) {
  if (!caminho) return '';
  const { data, error } = await db.storage.from('client-logos').download(caminho);
  if (error || !data) return '';
  return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => ok(''); fr.readAsDataURL(data); });
}
