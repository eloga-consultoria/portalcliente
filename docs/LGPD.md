# LGPD no Portal ELOGA

## Mapa do tratamento

| Item | Descrição |
|---|---|
| Controladora | ELOGA · Consultoria & Estratégias em Saúde — eloga.contato@gmail.com |
| Titulares | Responsáveis e equipe de gestão das clínicas clientes e potenciais clientes |
| Dados tratados | Cadastro da clínica e do responsável (nome, e-mail, telefone, cidade, segmento); respostas do autodiagnóstico, do diagnóstico operacional e do posicionamento; registros de acesso (data, IP, navegador) |
| **Dados que NÃO entram** | Dados de pacientes (nomes, diagnósticos, documentos) e dados sensíveis. O termo orienta o cliente a não informá-los |
| Finalidade | Diagnóstico, recomendações, proposta e acompanhamento da consultoria |
| Base legal | Procedimentos preliminares a contrato e execução de contrato (art. 7º, V); legítimo interesse para segurança e auditoria (art. 7º, IX); cumprimento de obrigação legal quando aplicável (art. 7º, II) |
| Operadores | Supabase (banco, logins, arquivos), Google (e-mail do posicionamento), GitHub (hospedagem das telas e backups criptografados) |
| Ciência do titular | Termo exibido no primeiro acesso; aceite gravado com data, versão e navegador (tabela `consents`) |

## Retenção

| Dado | Prazo | Como é aplicado |
|---|---|---|
| Cadastro, diagnósticos, propostas, documentos | Pelo tempo necessário às finalidades e às obrigações legais; exclusão a pedido | Admin > cliente > **Excluir** (exige digitar o nome) |
| Registro de auditoria | 5 anos | Expurgo automático mensal (pg_cron). Sem pg_cron: rodar `select app.purge_audit_log();` 1×/mês |
| Backups automáticos | 90 dias no GitHub + cópias mensais no Drive | Revisar e apagar cópias antigas do Drive anualmente |
| PDFs importados do site | **Não são armazenados** | O portal guarda apenas os dados extraídos e a "impressão digital" (hash) do arquivo |

> A auditoria mantém o registro de que um cliente foi excluído (quem, quando), sem os dados do
> cliente, para prestação de contas — legítimo interesse e defesa em processos (art. 7º, VI e IX).

## Pedidos dos titulares (art. 18) — POP

| Etapa | Ação | Prazo |
|---|---|---|
| 1 | Receber o pedido por eloga.contato@gmail.com e confirmar a identidade (resposta a partir do e-mail cadastrado) | 1 dia útil |
| 2 | Registrar o pedido (data, tipo, titular) | Mesmo dia |
| 3 | **Acesso/portabilidade:** enviar o cadastro, o PDF do relatório e o posicionamento exportado (Admin > cliente > Posicionamento > CSV ou JSON) | Até 15 dias |
| 3 | **Correção:** ajustar no cadastro | Até 15 dias |
| 3 | **Exclusão:** fazer backup, excluir o cliente no portal (apaga login, respostas, diagnósticos, propostas e logo) | Até 15 dias |
| 4 | Responder ao titular informando o que foi feito | Junto com a etapa 3 |

## Incidente de segurança

1. Bloquear imediatamente os acessos envolvidos (Admin > cliente > **Bloquear**) e trocar senhas/segredos.
2. Consultar a **Auditoria** para entender o que foi acessado, por quem e quando.
3. Avaliar risco aos titulares. Havendo risco ou dano relevante, comunicar a ANPD e os titulares
   em até 3 dias úteis (Resolução CD/ANPD nº 15/2024).
4. Registrar o incidente e as medidas tomadas.

## Mudança no termo

Ao alterar o texto do termo (`assets/js/core/auth.js`), mude também `termoVersao` em
`assets/js/config.js`. Todos os clientes verão o novo termo no próximo acesso e o novo aceite fica registrado.
