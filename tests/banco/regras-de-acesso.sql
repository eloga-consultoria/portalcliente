-- Teste das regras de acesso (RLS) em um Postgres local que imita o Supabase.
-- Rodar com: bash tests/banco/rodar.sh  (exige PostgreSQL instalado; nunca aponta para o Supabase)
\set ON_ERROR_STOP 0
insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000000a','admin@t'),('00000000-0000-0000-0000-00000000000b','a@t'),('00000000-0000-0000-0000-00000000000c','b@t');
insert into public.clients(id,name,slug,is_active,positioning_enabled,liberacoes) values
 ('10000000-0000-0000-0000-00000000000a','Clinica A','a',true,true,'{"plano":true}'),('10000000-0000-0000-0000-00000000000b','Clinica B','b',true,true,'{"plano":true}');
insert into public.profiles(user_id,role,client_id) values ('00000000-0000-0000-0000-00000000000a','admin',null),
 ('00000000-0000-0000-0000-00000000000b','client','10000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000c','client','10000000-0000-0000-0000-00000000000b');
insert into public.action_plan_views(client_id,dados) values ('10000000-0000-0000-0000-00000000000a','{"x":1}'),('10000000-0000-0000-0000-00000000000b','{"x":2}');
insert into public.self_assessments(client_id,source) values ('10000000-0000-0000-0000-00000000000a','manual');

\echo '--- ADMIN SEM MFA (aal1): deve ver 0 clientes'
set role authenticated; set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}';
select count(*) as clientes from public.clients;
\echo '--- ADMIN COM MFA (aal2): deve ver 2 clientes'
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}';
select count(*) as clientes from public.clients;
select count(*) as auditoria_visivel from public.audit_log;
\echo '--- ADMIN tenta apagar auditoria: deve dar erro ou 0'
delete from public.audit_log;
select count(*) as auditoria_depois from public.audit_log;
\echo '--- CLIENTE A: só vê a própria clínica (1), plano próprio (1), sem autodiagnostico (0)'
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal1"}';
select count(*) as clientes, max(name) from public.clients;
select count(*) as planos from public.action_plan_views;
select count(*) as autodiag from public.self_assessments;
select count(*) as auditoria from public.audit_log;
\echo '--- CLIENTE A tenta se promover a admin: deve dar 0 linhas / erro'
update public.profiles set role='admin' where user_id='00000000-0000-0000-0000-00000000000b';
\echo '--- CLIENTE A tenta liberar coisas para si: deve dar 0 linhas / erro'
update public.clients set liberacoes='{"plano":true,"dashboard":true}';
\echo '--- CLIENTE A cria posicionamento, envia, e tenta alterar depois (deve bloquear)'
insert into public.assessments(client_id,status,responses) values ('10000000-0000-0000-0000-00000000000a','draft','{}');
update public.assessments set status='submitted';
update public.assessments set responses='{"x":1}';
\echo '--- CLIENTE A tenta gravar posicionamento para a Clinica B: deve dar erro'
insert into public.assessments(client_id,status) values ('10000000-0000-0000-0000-00000000000b','draft');
\echo '--- CLIENTE A tenta ler plano após retirar liberação (0)'
reset role; update public.clients set liberacoes='{}' where name='Clinica A'; set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal1"}';
select count(*) as planos from public.action_plan_views;
\echo '--- CLIENTE A com acesso vencido: 0 clientes visiveis? (perfil)'
reset role; update public.clients set access_expires_at = now() - interval '1 day' where name='Clinica A'; set role authenticated;
select count(*) as docs from public.client_documents;
\echo '--- ANON: nada'
reset role; set role anon; set request.jwt.claims = '{}';
select count(*) from public.clients;
reset role;
\echo '--- auditoria registrada (como postgres)'
select action, count(*) from public.audit_log group by 1 order by 1;
