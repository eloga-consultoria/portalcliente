// Utilitários compartilhados pelas edge functions do Portal ELOGA.
// Segredos vêm SOMENTE de variáveis de ambiente do Supabase (nunca do HTML).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://eloga-consultoria.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.includes(origin) ? origin : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export class Falha extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}

export function responder(req: Request, status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Envolve o handler: CORS, só POST, origem permitida, erros sem detalhes internos. */
export function servir(handler: (req: Request) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    try {
      if (req.method !== "POST") throw new Falha(405, "Método não permitido.");
      const origin = req.headers.get("origin");
      if (origin && !ORIGENS.includes(origin)) throw new Falha(403, "Origem não autorizada.");
      return responder(req, 200, await handler(req));
    } catch (e) {
      if (e instanceof Falha) return responder(req, e.status, { error: e.message });
      console.error(e);
      return responder(req, 500, { error: "Erro interno. Tente novamente em instantes." });
    }
  });
}

function jwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
  } catch { return {}; }
}

/** Cliente com service_role. O cabeçalho x-eloga-actor identifica o autor no log de auditoria. */
export function adminDb(actorId?: string): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: actorId ? { "x-eloga-actor": actorId } : {} },
  });
}

export interface Usuario { id: string; email: string; aal: string; role: string | null; client_id: string | null }

/** Valida o JWT no servidor de Auth e carrega o perfil. */
export async function usuario(req: Request): Promise<Usuario> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Falha(401, "Sessão expirada. Entre novamente.");
  const db = adminDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new Falha(401, "Sessão expirada. Entre novamente.");
  const { data: perfil } = await db.from("profiles").select("role, client_id")
    .eq("user_id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    aal: String(jwtPayload(token).aal ?? "aal1"),
    role: perfil?.role ?? null,
    client_id: perfil?.client_id ?? null,
  };
}

/** Admin = papel admin + MFA verificado nesta sessão. */
export async function exigirAdmin(req: Request): Promise<Usuario> {
  const u = await usuario(req);
  if (u.role !== "admin") throw new Falha(403, "Acesso restrito à administração.");
  if (u.aal !== "aal2") throw new Falha(403, "Confirme o código do autenticador (MFA) para continuar.");
  return u;
}

export async function lerJson(req: Request, limiteBytes = 64_000): Promise<Record<string, unknown>> {
  const texto = await req.text();
  if (texto.length > limiteBytes) throw new Falha(413, "Conteúdo muito grande.");
  try {
    const obj = JSON.parse(texto || "{}");
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new Error();
    return obj as Record<string, unknown>;
  } catch { throw new Falha(400, "Requisição inválida."); }
}

// ---------- validação ----------
export function texto(v: unknown, campo: string, { obrigatorio = false, max = 200 } = {}): string | null {
  if (v === undefined || v === null || v === "") {
    if (obrigatorio) throw new Falha(400, `Informe ${campo}.`);
    return null;
  }
  if (typeof v !== "string") throw new Falha(400, `${campo} inválido.`);
  const s = v.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (obrigatorio && !s) throw new Falha(400, `Informe ${campo}.`);
  if (s.length > max) throw new Falha(400, `${campo} muito longo (máximo ${max} caracteres).`);
  return s || null;
}

export function email(v: unknown, obrigatorio = false): string | null {
  const s = texto(v, "o e-mail", { obrigatorio, max: 254 });
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new Falha(400, "E-mail inválido.");
  return s ? s.toLowerCase() : null;
}

export function uuid(v: unknown, campo = "identificador"): string {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new Falha(400, `${campo} inválido.`);
  return v;
}

export function dataIso(v: unknown, campo: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || isNaN(Date.parse(v))) throw new Falha(400, `${campo} inválida.`);
  return new Date(v).toISOString();
}

/** Senha temporária forte (o cliente troca no primeiro acesso). */
export function senhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const simbolos = "!@#$%*?";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  let s = "";
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return s.slice(0, 5) + "-" + s.slice(5, 10) + simbolos[bytes[0] % simbolos.length] + s.slice(10);
}

export async function auditar(db: SupabaseClient, acao: string, entidade: string, entidadeId: string | null,
                              clientId: string | null, detalhes: Record<string, unknown>, ator: Usuario) {
  const { error } = await db.from("audit_log").insert({
    actor_id: ator.id, actor_email: ator.email, actor_role: ator.role, action: acao,
    entity: entidade, entity_id: entidadeId, client_id: clientId,
    client_name: (detalhes.cliente as string) ?? null, details: detalhes,
  });
  if (error) console.error("auditoria", error.message);
}
