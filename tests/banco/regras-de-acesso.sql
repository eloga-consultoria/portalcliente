-- Teste das regras de acesso (RLS) em um Postgres local que imita o Supabase.
-- Rodar com: bash tests/banco/rodar.sh  (exige PostgreSQL instalado; nunca aponta para o Supabase)
\set ON_ERROR_STOP 0
insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000000a','admin@t'),('00000000-0000-0000-0000-00000000000b','a@t'),('00000000-0000-0000-0000-00000000000c','b@t');
insert into public.clients(id,name,slug,is_active,positioning_enabled,liberacoes) values
 ('10000000-0000-0000-0000-00000000000a','Clinica A','a',true,true,'{"plano":true}'),('10000000-0000-0000-0000-00000000000b','Clinica B','b',true,true,'{"plano":true}');
-- o gatilho antigo (handle_new_user) já criou os perfis; aqui só ajustamos papel e clínica
insert into public.profiles(user_id,role,client_id) values ('00000000-0000-0000-0000-00000000000a','admin',null),
 ('00000000-0000-0000-0000-00000000000b','client','10000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000c','client','10000000-0000-0000-0000-00000000000b')
on conflict (user_id) do update set role = excluded.role, client_id = excluded.client_id;
insert into public.action_plan_views(client_id,dados) values ('10000000-0000-0000-0000-00000000000a','{"x":1}'),('10000000-0000-0000-0000-00000000000b','{"x":2}');
insert into public.self_assessments(client_id,source) values ('10000000-0000-0000-0000-00000000000a','manual');

\echo '--- ADMIN SEM MFA (aal1): deve ver 0 clientes'
set role authenticated; set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}';
select count(*) as clientes from public.clients;
\echo '--- ADMIN COM MFA (aal2): deve ver 3 clientes (2 de teste + 1 antiga)'
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
\echo '--- CLIENTE A: tabelas antigas fechadas (0, 0, 0)'
select count(*) as modulos_antigos from public.client_modules;
select count(*) as materiais_antigos from public.client_materials;
select count(*) as planos_completos from public.action_plans;
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
\echo '--- plano antigo preservado em legacy_data (1 linha com items, data vazio)'
select count(*) as legado from public.action_plans where legacy_data ? 'items' and data = '{}'::jsonb;
\echo '--- auditoria registrada (como postgres)'
select action, count(*) from public.audit_log group by 1 order by 1;

\echo '=== EDIÇÃO DO PLANO PELO CLIENTE (007) ==='
reset role;
insert into public.action_plans(client_id, data) values ('10000000-0000-0000-0000-00000000000a',
  '{"clients":{"10000000-0000-0000-0000-00000000000a":{"nome":"Clinica A","plano":[],"swot":{"forcas":["interno"]}}}}')
on conflict (client_id) do update set data = excluded.data;
update public.clients set liberacoes='{"plano":true}', access_expires_at=null where name='Clinica A';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal1"}';
\echo '--- sem liberação de edição: deve dar erro'
select public.cliente_salvar_plano('[{"id":"a1","what":"Ação","status":"Em andamento","progresso":20}]');
reset role; update public.clients set liberacoes='{"plano":true,"plano_editar":true}' where name='Clinica A'; set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal1"}';
\echo '--- com liberação: grava (sem erro)'
select public.cliente_salvar_plano('[{"id":"a1","what":"Ação <script>x</script>","status":"Em andamento","progresso":20,"when":"2026-11-30"}]');
\echo '--- id malicioso: deve dar erro'
select public.cliente_salvar_plano('[{"id":"a1'');alert(1);(''","what":"x"}]');
\echo '--- status inventado: deve dar erro'
select public.cliente_salvar_plano('[{"id":"a1","status":"Hackeado"}]');
\echo '--- cliente B tentando gravar: grava só no plano dele (não existe -> erro)'
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","aal":"aal1"}';
select public.cliente_salvar_plano('[{"id":"b1","what":"x"}]');
reset role;
\echo '--- resultado: texto sem < >, SWOT preservada, auditoria registrada'
select data->'clients'->'10000000-0000-0000-0000-00000000000a'->'plano'->0->>'what' as acao,
       data->'clients'->'10000000-0000-0000-0000-00000000000a'->'swot' as swot_preservada
  from public.action_plans where client_id='10000000-0000-0000-0000-00000000000a';
select count(*) as auditoria_plano from public.audit_log where action='cliente.plano_editado';
