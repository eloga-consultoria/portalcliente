// Edge function: envia à ELOGA o PDF do diagnóstico de posicionamento
// logo após o envio pelo cliente. O cliente NÃO recebe o relatório.
// O Apps Script só aceita esta etapa com o token secreto (APPS_SCRIPT_TOKEN),
// que fica guardado aqui no servidor e nunca no navegador.
import { adminDb, Falha, lerJson, servir, texto, usuario } from "../_shared/comum.ts";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

servir(async (req) => {
  const u = await usuario(req);
  if (u.role === "admin" || !u.client_id) throw new Falha(403, "Acesso negado.");
  const corpo = await lerJson(req, Math.ceil(MAX_PDF_BYTES * 1.4) + 10_000);
  const pdf = texto(corpo.pdf_base64, "o PDF", { obrigatorio: true, max: Math.ceil(MAX_PDF_BYTES * 1.4) })!;
  if (!/^[A-Za-z0-9+/=]+$/.test(pdf) || !atob(pdf.slice(0, 8)).startsWith("%PDF")) {
    throw new Falha(400, "Arquivo inválido.");
  }

  const db = adminDb(u.id);
  const { data: cliente } = await db.from("clients").select("id, name, segment, city, access_email")
    .eq("id", u.client_id).maybeSingle();
  const { data: avaliacao } = await db.from("assessments")
    .select("id, status, submitted_at, notify_status").eq("client_id", u.client_id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!cliente || !avaliacao) throw new Falha(404, "Diagnóstico não encontrado.");
  if (avaliacao.status !== "submitted") throw new Falha(409, "O diagnóstico ainda não foi enviado.");
  if (avaliacao.notify_status === "enviado") return { ok: true, ja_enviado: true };

  const url = Deno.env.get("APPS_SCRIPT_URL");
  const token = Deno.env.get("APPS_SCRIPT_TOKEN");
  if (!url || !token) throw new Falha(500, "Envio de e-mail não configurado.");

  const nomeArquivo = "ELOGA_Posicionamento_" +
    (cliente.name || "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_") + ".pdf";
  const form = new URLSearchParams({
    stage: "posicionamento",
    token,
    clinic_name: cliente.name ?? "",
    segment: cliente.segment ?? "",
    city: cliente.city ?? "",
    portal_email: cliente.access_email ?? "",
    submitted_at: avaliacao.submitted_at ?? "",
    pdf_filename: nomeArquivo,
    pdf_base64: pdf,
  });

  let ok = false;
  try {
    const r = await fetch(url, { method: "POST", body: form, redirect: "follow" });
    const j = await r.json().catch(() => ({}));
    ok = r.ok && j?.ok === true;
  } catch (e) {
    console.error("apps-script", e);
  }

  await db.from("assessments").update({
    notify_status: ok ? "enviado" : "falhou",
    notified_at: new Date().toISOString(),
  }).eq("id", avaliacao.id);

  await db.from("audit_log").insert({
    actor_id: u.id, actor_email: u.email, actor_role: u.role,
    action: ok ? "posicionamento.email_enviado" : "posicionamento.email_falhou",
    entity: "assessments", entity_id: avaliacao.id, client_id: cliente.id, client_name: cliente.name,
    details: { arquivo: nomeArquivo },
  });

  if (!ok) throw new Falha(502, "Não foi possível confirmar o envio do e-mail à ELOGA.");
  return { ok: true };
});
