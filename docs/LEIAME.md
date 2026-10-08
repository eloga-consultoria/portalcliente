# Portal Estratégico ELOGA — Guia de instalação

> **Regra de ouro:** tudo é feito primeiro em um projeto Supabase de **TESTE**.
> O projeto oficial só é alterado depois da sua autorização por escrito (Etapa 6).
> Nunca envie em chat, e-mail ou print: senha do banco, chave `secret`/`service_role`,
> token do Supabase ou a senha do backup.

## Visão geral

| Peça | Onde fica | Custo |
|---|---|---|
| Telas do portal (este repositório) | GitHub Pages | Grátis |
| Banco, logins, arquivos | Supabase (plano Free) | Grátis |
| Funções seguras (criar acesso, enviar posicionamento) | Supabase Edge Functions | Grátis |
| E-mail do posicionamento para a ELOGA | Google Apps Script **exclusivo do portal** | Grátis |
| Backup criptografado 2×/semana | GitHub Actions | Grátis |

O portal **não tem nenhuma ligação** com o site institucional nem com o formulário de autodiagnóstico.
Os PDFs do site são importados manualmente no menu **Importar**.

## Ordem das etapas

| # | Etapa | Quem faz | Tempo |
|---|---|---|---|
| 1 | Criar o projeto Supabase de TESTE | Você | 5 min |
| 2 | Rodar os arquivos SQL no projeto de teste | Você | 10 min |
| 3 | Criar seu login de administradora | Você | 5 min |
| 4 | Publicar as funções e configurar segredos | Você | 15 min |
| 5 | Ligar o GitHub Pages e testar | Você + Claude | 30 min |
| 6 | Passar para o projeto oficial (**só com sua autorização**) | Você + Claude | 30 min |
| 7 | Ligar o backup automático | Você | 10 min |

---

## Etapa 1 — Projeto de teste

1. Entre em supabase.com > **New project**.
2. Nome: `eloga-portal-teste`. Região: **South America (São Paulo)**.
3. Crie uma senha do banco forte e guarde no seu gerenciador de senhas.
4. Aguarde o projeto ficar pronto.

## Etapa 2 — Banco (SQL Editor)

**Atalho:** no projeto de teste, cole de uma vez o arquivo `supabase/teste/TUDO_PROJETO_TESTE.sql`
(é a junção dos itens abaixo). Ou rode, um por vez, nesta ordem
(abra o arquivo aqui no GitHub, clique em **Copy raw file**, cole e clique **Run**):

| Ordem | Arquivo | Para quê |
|---|---|---|
| 1 | `supabase/teste/replica_estrutura_oficial_SOMENTE_TESTE.sql` | Copia a estrutura do oficial (sem dados). **Só no teste.** |
| 2 | `supabase/migrations/001_seguranca_base.sql` | Regras de acesso, 2FA obrigatória para admin, travas |
| 3 | `supabase/migrations/002_diagnostico_proposta.sql` | Autodiagnóstico importado, diagnóstico operacional, propostas, LGPD |
| 4 | `supabase/migrations/003_auditoria.sql` | Auditoria (5 anos, não apagável) |
| 5 | `supabase/migrations/004_portal_cliente.sql` | Liberações, documentos, plano de ação, materiais, catálogo |
| 6 | `supabase/migrations/005_compatibilidade_portal_antigo.sql` | Ajusta as tabelas do portal antigo sem perder dados e fecha as que não são mais usadas |
| 7 | `supabase/migrations/006_ajustes_verificador.sql` | Ajustes finos pedidos pelo verificador de segurança do Supabase |
| 8 | `supabase/migrations/007_cliente_edita_plano.sql` | Permite (quando liberado) que o cliente edite as ações do plano, com validação no servidor |
| 9 | `supabase/migrations/008_planilhas_preenchiveis.sql` | Planilhas preenchíveis em Materiais (uma cópia por clínica) |
| 10 | `supabase/migrations/009_proposta_data_validade.sql` | Permite ajustar data de emissão e validade de proposta já emitida (conteúdo continua travado) |

✅ Esperado: "Success. No rows returned" em todos.
Se aparecer erro, **pare** e envie o print da mensagem (sem dados de clientes).

> Os arquivos podem ser rodados de novo sem estragar nada (são "idempotentes").
> Eles foram testados num PostgreSQL local que imita o Supabase: `bash tests/banco/rodar.sh`.

### Configurações de login (Authentication)

| Onde | O que ajustar |
|---|---|
| Authentication > Sign In / Providers | **Desligar** "Allow new users to sign up" (só a ELOGA cria acessos) |
| Authentication > Sign In / Providers > Email | Ligado; senha mínima **10** caracteres |
| Authentication > Multi-Factor | **TOTP (app autenticador) ligado** |
| Authentication > URL Configuration | Site URL: `https://eloga-consultoria.github.io/portalcliente/` |

## Etapa 3 — Seu login de administradora

1. **Authentication > Users > Add user > Create new user**: seu e-mail e uma senha forte,
   marcando **Auto Confirm User**.
2. No **SQL Editor**, rode (troque o e-mail):

```sql
update public.profiles set role = 'admin', client_id = null
 where user_id = (select id from auth.users where email = 'SEU-EMAIL-AQUI');
insert into public.profiles (user_id, role)
select u.id, 'admin' from auth.users u
 where u.email = 'SEU-EMAIL-AQUI'
   and not exists (select 1 from public.profiles p where p.user_id = u.id);
```

3. No primeiro acesso ao portal, ele vai pedir para ler um QR Code com um app
   autenticador (Google Authenticator, Microsoft Authenticator ou similar).
   **Sem a verificação em 2 etapas, o admin não enxerga nenhum dado** — isso é proposital.

## Etapa 4 — Funções e segredos

### 4.1 Apps Script exclusivo do portal (e-mail do posicionamento)

Siga o passo a passo no topo de `integracoes/apps-script-portal/Codigo.gs`.
É um projeto **novo** no script.google.com, separado do script do site.
Ao final você terá: uma **URL do App da Web** e uma **senha (PORTAL_TOKEN)** que você inventou.

### 4.2 Segredos das funções (Supabase)

Supabase > **Edge Functions > Secrets > Add new secret**:

| Nome | Valor |
|---|---|
| `APPS_SCRIPT_URL` | URL do App da Web do passo 4.1 |
| `APPS_SCRIPT_TOKEN` | A mesma senha usada em `PORTAL_TOKEN` |
| `ALLOWED_ORIGINS` | `https://eloga-consultoria.github.io` |

### 4.3 Publicar as funções (pelo GitHub, sem instalar nada)

1. Supabase > ícone do seu perfil > **Account > Access Tokens > Generate new token**
   (nome: `github-portal`). Copie.
2. GitHub > este repositório > **Settings > Secrets and variables > Actions > New repository secret**:
   - `SUPABASE_ACCESS_TOKEN` = o token do passo 1
   - `SUPABASE_PROJECT_REF` = o código do projeto de teste (aparece na URL: `supabase.com/dashboard/project/ESTE-CODIGO`)
3. GitHub > **Actions > Publicar funções no Supabase > Run workflow**. No campo de confirmação,
   digite o mesmo código do projeto. Aguarde o ✅ verde.

## Etapa 5 — Colocar o portal no ar e testar

1. GitHub > **Settings > Pages** > Source: **Deploy from a branch** >
   Branch: `claude/new-session-a85477`, pasta `/ (root)` > **Save**.
2. Endereço do portal: `https://eloga-consultoria.github.io/portalcliente/`
3. **Para testar com o projeto de teste**, me envie aqui **apenas**:
   - a **Project URL** do projeto de teste (Settings > API), e
   - a **Publishable key** (`sb_publishable_...`) — ela é pública por natureza.
   Eu aponto o portal para o teste. Nunca envie a `secret`/`service_role` nem a senha do banco.

### Roteiro de teste (marque cada item)

- [ ] Entrar como admin e cadastrar a verificação em 2 etapas
- [ ] Cadastrar um cliente **fictício** e criar o acesso (senha temporária aparece uma vez)
- [ ] Importar um PDF de autodiagnóstico de teste e conferir os dados lidos
- [ ] Preencher o Diagnóstico operacional (horários, salas, profissionais) e ver a capacidade
- [ ] Gerar o relatório escolhendo seções, e a proposta
- [ ] Em **Portal do cliente**, liberar posicionamento, relatório, plano e um material
- [ ] Em outra janela anônima, entrar como o cliente: trocar senha, aceitar termo, ver só o liberado
- [ ] Cliente envia o posicionamento → ver apenas o agradecimento; o PDF chega **só** em eloga.contato@gmail.com
- [ ] Conferir tudo em **Auditoria**

## Etapa 6 — Projeto oficial (somente com sua autorização por escrito)

⚠️ Ao rodar a migration 001 no projeto oficial, **o HTML antigo deixa de funcionar para o admin**
(as novas regras exigem verificação em 2 etapas). Por isso a troca é feita de uma vez:

1. **Backup antes de tudo:** ligue a Etapa 7 apontando para o projeto oficial e rode o backup manual.
   Confira que o arquivo apareceu.
2. Rode no oficial o `000_inspecao_somente_leitura.sql` (não altera nada) e me envie o resultado:
   eu confiro se a estrutura bate com o que as migrations esperam.
3. Com o "ok" da conferência e **a sua autorização escrita**, rode **001 → 009** no oficial
   (**não** rode o arquivo da pasta `supabase/teste`).
4. Ajuste as configurações de login (Etapa 2) e os segredos (Etapa 4.2) no oficial.
5. Troque o segredo `SUPABASE_PROJECT_REF` no GitHub pelo código oficial e rode **Publicar funções** de novo.
6. Eu volto o portal para o projeto oficial.
7. Teste o roteiro de novo com um cliente fictício e depois exclua esse cliente.
8. Desative o HTML antigo e, no Supabase oficial, **exclua as funções antigas**
   `admin-create-client`, `admin-edit-client` e `admin-delete-auth-user`
   (substituídas por `admin-clientes`).

## Etapa 7 — Backup automático (grátis)

Ver `docs/BACKUP.md`.

---

## Documentos relacionados

| Documento | Conteúdo |
|---|---|
| `docs/SEGURANCA.md` | Como o portal protege os dados e o que testar |
| `docs/BACKUP.md` | Backup automático, manual e como restaurar |
| `docs/LGPD.md` | Dados tratados, finalidade, retenção e pedidos dos titulares |

## Atualizações do portal (cache do navegador)

Antes de cada publicação, rode `node tools/versionar.mjs`. Ele marca cada arquivo do portal com uma
versão (`?v=...`), para o navegador baixar sempre a versão nova. O teste `npm test` acusa se esquecer.
