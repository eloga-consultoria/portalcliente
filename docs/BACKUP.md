# Backup do Portal ELOGA

O plano gratuito do Supabase **não oferece backups que você possa baixar**.
Por isso o portal tem duas camadas próprias, ambas gratuitas e criptografadas.

| Camada | Como | Frequência | Onde fica | Conteúdo |
|---|---|---|---|---|
| **1. Automático (recomendado)** | GitHub Actions, workflow "Backup do banco" | Segunda e quinta, 06:17 + quando você clicar | Aba **Actions** do GitHub, por 90 dias | Banco completo do portal + logins |
| **2. Manual pelo portal** | Menu **Backup** (admin) | Quando quiser (o painel lembra após 30 dias) | Seu computador / Drive | Dados das tabelas do portal |

> **Arquivos de materiais** (PDFs e imagens enviados em Materiais) não entram no backup do banco.
> Guarde sempre os originais na pasta da ELOGA no Google Drive.

## Ligar o backup automático (10 min)

1. Supabase > seu projeto > botão **Connect** > aba **Session pooler** > copie a "URI".
   Ela tem a forma `postgresql://postgres.CODIGO:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`.
   Troque `[YOUR-PASSWORD]` pela senha do banco.
   (Use o *Session pooler*: a conexão direta não funciona a partir do GitHub.)
2. Crie uma **senha de backup** com 20 caracteres ou mais e guarde no seu gerenciador de senhas
   **e** em um segundo lugar seguro. **Sem ela, nenhum backup pode ser aberto — nem por você.**
3. GitHub > **Settings > Secrets and variables > Actions > New repository secret**:
   - `SUPABASE_DB_URL` = a URI do passo 1
   - `BACKUP_SENHA` = a senha do passo 2
4. GitHub > **Actions > Backup do banco > Run workflow**. Aguarde o ✅ verde.
5. Abra a execução: no fim da página, em **Artifacts**, aparece `eloga-backup-N`.

✅ Pronto. A partir daí roda sozinho duas vezes por semana. Isso também evita que o
projeto gratuito do Supabase seja **pausado por inatividade** (ele pausa após 7 dias sem uso).

### Por que é seguro num repositório público

- Os segredos ficam guardados cifrados pelo GitHub e nunca aparecem nos registros.
- O arquivo é criptografado (AES-256) **antes** de sair da máquina do GitHub.
  Quem baixar sem a senha vê apenas dados embaralhados.
- Nada é gravado no código do repositório.

## Rotina recomendada

| Quando | O que fazer |
|---|---|
| Toda semana | Olhar a aba Actions: os dois backups da semana estão verdes? |
| Todo mês | Baixar o backup mais recente e guardar no Drive da ELOGA (pasta restrita) |
| A cada 6 meses | Testar uma restauração no projeto de **teste** (abaixo) |
| Antes de qualquer mudança no banco | Rodar o backup manualmente |

Os artefatos ficam 90 dias no GitHub. A cópia mensal no Drive garante o histórico mais longo.

## Restaurar (sempre primeiro no projeto de TESTE)

Precisa de um computador com PostgreSQL 17 (cliente) e GnuPG instalados. Peça apoio técnico se preciso.

```bash
# 1. Abrir o arquivo (pede a BACKUP_SENHA)
gpg -d eloga-backup-AAAA-MM-DD_HHMM.tar.gpg | tar -xf -
#    gera portal.dump (tabelas do portal) e logins.dump (logins)

# 2. Restaurar no projeto de TESTE (URI do Session pooler do projeto de teste)
pg_restore --no-owner --clean --if-exists -d "URI-DO-PROJETO-DE-TESTE" portal.dump
pg_restore --data-only -d "URI-DO-PROJETO-DE-TESTE" logins.dump   # só se precisar dos logins
```

Restaurar no projeto **oficial** só com autorização por escrito e depois de testar no projeto de teste.

## Backup manual pelo portal (camada 2)

Menu **Backup** > defina uma senha > **Gerar backup**. O arquivo `.eloga-backup` é criptografado no seu
navegador (AES-256-GCM, PBKDF2 com 600.000 iterações). É uma cópia extra dos registros para
guardar no Drive. Na mesma tela, a opção de conferência confirma que o arquivo abre com a senha;
a recuperação de registros a partir dele é feita com apoio técnico.
Não substitui o backup automático.
