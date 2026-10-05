// Edge function: gestão de ACESSOS dos clientes (somente admin com MFA).
// Ações: criar_acesso · redefinir_senha · alterar_email · bloquear · excluir
// O cadastro em si (nome, cidade, etapa...) é editado direto na tabela clients,
// protegido por RLS. Aqui fica só o que exige a chave service_role.
import {
  adminDb, auditar, dataIso, email, exigirAdmin, Falha, lerJson, senhaTemporaria, servir, texto, uuid,
} from "../_shared/comum.ts";

const BUCKET_LOGOS = "client-logos";

servir(async (req) => {
  const admin = await exigirAdmin(req);
  const corpo = await lerJson(req);
  const acao = texto(corpo.acao, "a ação", { obrigatorio: true, max: 30 });
  const clientId = uuid(corpo.client_id, "Cliente");
  const db = adminDb(admin.id);

  const { data: cliente, error: eCli } = await db.from("clients")
    .select("id, name, access_email, is_active").eq("id", clientId).maybeSingle();
  if (eCli) throw new Falha(500, "Não foi possível consultar o cliente.");
  if (!cliente) throw new Falha(404, "Cliente não encontrado.");

  const { data: perfis } = await db.from("profiles").select("user_id, role")
    .eq("client_id", clientId).neq("role", "admin");
  const usuarios = (perfis ?? []).map((p) => p.user_id as string);
  const base = { cliente: cliente.name };

  switch (acao) {
    case "criar_acesso": {
      if (usuarios.length) throw new Falha(409, "Este cliente já possui acesso. Use “Gerar nova senha”.");
      const mail = email(corpo.email, true)!;
      const expira = dataIso(corpo.access_expires_at, "Data de validade");
      const senha = senhaTemporaria();
      const { data: criado, error } = await db.auth.admin.createUser({
        email: mail, password: senha, email_confirm: true,
        user_metadata: { client_id: clientId },
      });
      if (error || !criado?.user) {
        const ja = /already|registered|exists/i.test(error?.message ?? "");
        throw new Falha(ja ? 409 : 500, ja ? "Este e-mail já está em uso por outro acesso." : "Não foi possível criar o acesso.");
      }
      const { error: eP } = await db.from("profiles").upsert({
        user_id: criado.user.id, role: "client", client_id: clientId, must_change_password: true,
      });
      if (eP) {
        await db.auth.admin.deleteUser(criado.user.id);
        throw new Falha(500, "Não foi possível vincular o acesso ao cliente. Nada foi criado.");
      }
      await db.from("clients").update({
        access_email: mail, is_active: true, ...(expira ? { access_expires_at: expira } : {}),
      }).eq("id", clientId);
      await auditar(db, "acesso.criado", "auth.users", criado.user.id, clientId, { ...base, email: mail }, admin);
      return { ok: true, senha_temporaria: senha, email: mail };
    }

    case "redefinir_senha": {
      if (!usuarios.length) throw new Falha(404, "Este cliente ainda não possui acesso.");
      const senha = senhaTemporaria();
      for (const id of usuarios) {
        const { error } = await db.auth.admin.updateUserById(id, { password: senha });
        if (error) throw new Falha(500, "Não foi possível gerar a nova senha.");
      }
      await db.from("profiles").update({ must_change_password: true }).in("user_id", usuarios);
      await auditar(db, "acesso.senha_redefinida", "auth.users", usuarios.join(","), clientId, base, admin);
      return { ok: true, senha_temporaria: senha, email: cliente.access_email };
    }

    case "alterar_email": {
      if (!usuarios.length) throw new Falha(404, "Este cliente ainda não possui acesso.");
      const mail = email(corpo.email, true)!;
      const { error } = await db.auth.admin.updateUserById(usuarios[0], { email: mail, email_confirm: true });
      if (error) {
        const ja = /already|registered|exists/i.test(error.message);
        throw new Falha(ja ? 409 : 500, ja ? "Este e-mail já está em uso por outro acesso." : "Não foi possível alterar o e-mail.");
      }
      await db.from("clients").update({ access_email: mail }).eq("id", clientId);
      await auditar(db, "acesso.email_alterado", "auth.users", usuarios[0], clientId,
        { ...base, de: cliente.access_email, para: mail }, admin);
      return { ok: true };
    }

    case "bloquear": {
      const bloquear = corpo.bloqueado === true;
      for (const id of usuarios) {
        const { error } = await db.auth.admin.updateUserById(id, { ban_duration: bloquear ? "876000h" : "none" });
        if (error) throw new Falha(500, "Não foi possível atualizar o bloqueio do login.");
      }
      const { error } = await db.from("clients").update({ is_active: !bloquear }).eq("id", clientId);
      if (error) throw new Falha(500, "Não foi possível atualizar o cadastro.");
      await auditar(db, bloquear ? "acesso.bloqueado" : "acesso.desbloqueado", "clients", clientId, clientId, base, admin);
      return { ok: true };
    }

    case "excluir": {
      // Confirmação digitando o nome, conferida também no servidor
      const confirmacao = texto(corpo.confirmacao, "a confirmação", { obrigatorio: true, max: 300 });
      const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();
      if (norm(confirmacao!) !== norm(cliente.name)) throw new Falha(400, "O nome digitado não confere.");

      const etapas: Record<string, string> = {};
      // 1) Arquivos (logo)
      const { data: arquivos } = await db.storage.from(BUCKET_LOGOS).list(clientId, { limit: 100 });
      if (arquivos?.length) {
        const { error } = await db.storage.from(BUCKET_LOGOS).remove(arquivos.map((a) => `${clientId}/${a.name}`));
        if (error) throw new Falha(500, "Falha ao apagar a logo. Nada mais foi excluído; tente novamente.");
      }
      etapas.arquivos = `${arquivos?.length ?? 0} removido(s)`;
      // 2) Logins
      for (const id of usuarios) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error && !/not.?found/i.test(error.message)) {
          throw new Falha(500, "Falha ao apagar o login do cliente. Os dados foram mantidos; tente novamente.");
        }
      }
      etapas.logins = `${usuarios.length} removido(s)`;
      // 3) Dados (tabelas novas caem em cascata; as antigas são apagadas explicitamente)
      for (const tabela of ["assessments", "profiles"]) {
        const { error } = await db.from(tabela).delete().eq("client_id", clientId);
        if (error) throw new Falha(500, `Falha ao apagar dados (${tabela}). Tente novamente.`);
      }
      const { error: eDel } = await db.from("clients").delete().eq("id", clientId);
      if (eDel) throw new Falha(500, "Falha ao apagar o cadastro. Tente novamente.");
      etapas.dados = "removidos";
      await auditar(db, "cliente.excluido_definitivo", "clients", clientId, clientId, { ...base, etapas }, admin);
      return { ok: true, etapas };
    }

    default:
      throw new Falha(400, "Ação desconhecida.");
  }
});
