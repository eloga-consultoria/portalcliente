// Edge function: envia ao Google Drive da ELOGA a cópia da planilha preenchida por um cliente.
// Cada clínica tem a sua cópia (material_respostas). O Apps Script do portal cria ou atualiza
// uma Planilha Google na pasta da clínica e devolve o endereço, que fica visível só para a ELOGA.
import { adminDb, Falha, lerJson, servir, usuario, uuid } from "../_shared/comum.ts";

type Celula = string;
interface Aba { nome: string; linhas: Celula[][] }

/** Mesma regra do portal: células preenchidas no modelo são fixas; as vazias recebem a resposta. */
function mesclar(estrutura: { abas?: Aba[] }, dados: { abas?: { linhas?: Celula[][] }[] }): Aba[] {
  return (estrutura?.abas ?? []).map((aba, ia) => {
    const resp = dados?.abas?.[ia]?.linhas ?? [];
    const cols = Math.max(1, ...aba.linhas.map((l) => l.length));
    const total = Math.min(Math.max(aba.linhas.length, resp.length), 500);
    const linhas = Array.from({ length: total }, (_, i) => Array.from({ length: cols }, (_, j) => {
      const fixo = String(aba.linhas[i]?.[j] ?? "");
      return (fixo || String(resp[i]?.[j] ?? "")).slice(0, 2000);
    }));
    return { nome: String(aba.nome || `Aba ${ia + 1}`).slice(0, 90), linhas };
  });
}

servir(async (req) => {
  const u = await usuario(req);
  const corpo = await lerJson(req);
  const materialId = uuid(corpo.material_id, "Material");
  // Cliente envia a própria cópia; a administração (com 2FA) pode reenviar a de qualquer clínica
  let clientId = u.client_id;
  if (u.role === "admin") {
    if (u.aal !== "aal2") throw new Falha(403, "Confirme o código do autenticador (MFA) para continuar.");
    clientId = uuid(corpo.client_id, "Cliente");
  }
  if (!clientId) throw new Falha(403, "Acesso negado.");

  const db = adminDb(u.id);
  const [{ data: cli }, { data: mat }, { data: acesso }, { data: resp }] = await Promise.all([
    db.from("clients").select("id, name, is_active, access_expires_at").eq("id", clientId).maybeSingle(),
    db.from("materials").select("id, titulo, estrutura").eq("id", materialId).maybeSingle(),
    db.from("material_access").select("material_id").eq("material_id", materialId).eq("client_id", clientId).maybeSingle(),
    db.from("material_respostas").select("id, dados").eq("material_id", materialId).eq("client_id", clientId).maybeSingle(),
  ]);
  if (!cli || !mat?.estrutura) throw new Falha(404, "Planilha não encontrada.");
  if (u.role !== "admin") {
    const vencido = cli.access_expires_at && new Date(cli.access_expires_at) < new Date();
    if (!acesso || !cli.is_active || vencido) throw new Falha(403, "Esta planilha não está liberada para a sua clínica.");
  }
  if (!resp) throw new Falha(409, "Preencha a planilha antes de enviar.");

  const url = Deno.env.get("APPS_SCRIPT_URL"), token = Deno.env.get("APPS_SCRIPT_TOKEN");
  if (!url || !token) throw new Falha(500, "O envio para o Drive ainda não foi configurado pela ELOGA. Seus dados estão salvos no portal.");

  const abas = mesclar(mat.estrutura, resp.dados);
  const form = new URLSearchParams({
    stage: "planilha", token,
    chave: `${materialId}:${clientId}`,
    titulo: `${mat.titulo} · ${cli.name}`.slice(0, 180),
    cliente: cli.name ?? "",
    abas: JSON.stringify(abas),
  });
  let link = "";
  try {
    const r = await fetch(url, { method: "POST", body: form, redirect: "follow" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.ok === true && typeof j.url === "string" && /^https:\/\/docs\.google\.com\//.test(j.url)) link = j.url;
  } catch (e) { console.error("apps-script", e); }

  await db.from("audit_log").insert({
    actor_id: u.id, actor_email: u.email, actor_role: u.role,
    action: link ? "cliente.planilha_enviada" : "cliente.planilha_falhou",
    entity: "material_respostas", entity_id: resp.id, client_id: cli.id, client_name: cli.name,
    details: { material: mat.titulo },
  });
  if (!link) throw new Falha(502, "Não foi possível salvar a cópia no Drive agora. Seus dados continuam salvos no portal; tente de novo mais tarde.");
  await db.from("material_respostas").update({ drive_url: link, drive_em: new Date().toISOString() }).eq("id", resp.id);
  return { ok: true, enviado_em: new Date().toISOString() };
});
