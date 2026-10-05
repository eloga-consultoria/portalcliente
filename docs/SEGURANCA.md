# Segurança do Portal ELOGA

## Princípio

**Quem decide o que cada pessoa vê é o banco de dados, não a tela.**
Mesmo que alguém altere o código no próprio navegador, o Supabase só entrega o que as
regras de acesso (RLS) permitem.

## Camadas de proteção

| Camada | O que faz |
|---|---|
| Regras de acesso (RLS) forçadas em todas as tabelas | Cliente só lê a própria clínica e só o que foi liberado; nada é editável pelo cliente, exceto o próprio posicionamento enquanto aberto |
| Admin exige verificação em 2 etapas (TOTP) | Sem o código do app autenticador, o perfil admin não enxerga nenhum dado |
| Trava do posicionamento no servidor | Depois de enviado, vencido ou sem liberação, não pode ser alterado |
| Prazo e bloqueio de acesso | Acesso vencido ou inativo deixa de ver documentos, plano e materiais |
| Funções no servidor (edge functions) | Criar acesso, trocar senha/e-mail, bloquear e excluir: só admin com 2FA; a chave mestra nunca vai para o navegador |
| Senha temporária + troca obrigatória | Gerada no servidor, mostrada uma única vez |
| Sessão | Encerra após inatividade (cliente 30 min, admin 20 min) e ao fechar o navegador |
| Auditoria imutável | Registra quem fez o quê, quando, de onde; ninguém altera ou apaga; guarda 5 anos |
| Arquivos privados | Logos e materiais em buckets privados, com tipo e tamanho limitados e links temporários |
| Navegador | Política de segurança de conteúdo (CSP), sem scripts de terceiros, proteção contra o portal ser embutido em outro site, textos sempre escapados |
| Plano de ação | Roda isolado (sandbox); o cliente recebe só uma projeção sem diagnóstico, SWOT ou relatórios mensais |
| Posicionamento | O PDF vai **somente** para o e-mail da ELOGA; o cliente vê apenas o agradecimento |

## O que nunca fazer

- Nunca colocar no código, no chat ou em prints: senha do banco, chave `secret`/`service_role`,
  token do Supabase, `PORTAL_TOKEN`, senha de backup.
- Nunca gravar no repositório (é público): PDFs, planilhas ou backups de clientes, CPF, dados de pacientes.
- Nunca rodar SQL no projeto oficial sem backup e sem autorização por escrito.
- Nunca reativar o cadastro aberto ("Allow new users to sign up").

## Testes que comprovam as regras

| Teste | Como rodar | O que comprova |
|---|---|---|
| Regras do banco | `bash tests/banco/rodar.sh` (PostgreSQL local, nunca o Supabase) | Admin sem 2FA vê 0; cliente vê só a própria clínica; não se promove a admin; não libera itens para si; posicionamento trava após envio; não grava para outra clínica; auditoria não pode ser apagada; visitante anônimo não lê nada |
| Leitura de PDFs, exportações, backup, capacidade | `npm test` | Cálculos e leitores corretos; CSV protegido contra fórmulas maliciosas; backup abre só com a senha |
| Telas de ponta a ponta | `node tests/e2e/fluxo.mjs` (Supabase simulado) | Fluxo completo admin + cliente |

## Checklist no projeto real (após instalar)

- [ ] Login de cliente com senha errada mostra mensagem genérica
- [ ] Admin sem 2FA não vê clientes
- [ ] Cliente fictício não vê nada que não foi liberado
- [ ] Retirar a liberação some com o item na próxima abertura
- [ ] Acesso vencido bloqueia documentos
- [ ] Auditoria registrou todos os passos acima
- [ ] "Allow new users to sign up" desligado
