-- ARQUIVO ÚNICO · PROJETO OFICIAL (ELOGA Portal Estratégico · skatnnwkxcbzmoohexsx)
-- Migrations 001 a 010, nesta ordem. Testadas na réplica da estrutura oficial.
-- Rodar SOMENTE após backup e com autorização por escrito. NÃO inclui a réplica de teste.

-- ================= supabase/migrations/000_inspecao_somente_leitura.sql =================
-- =====================================================================
-- 000 · INSPEÇÃO (SOMENTE LEITURA)
-- Rode no Supabase > SQL Editor ANTES das migrations.
-- Não altera nada. Copie o resultado (aba "Results") e envie para revisão.
-- Não contém dados de clientes: apenas estrutura, políticas e contagens.
-- =====================================================================

select jsonb_pretty(jsonb_build_object(
  'versao_postgres', current_setting('server_version'),

  'tabelas', (select jsonb_agg(jsonb_build_object(
        'tabela', c.relname,
        'rls_ativo', c.relrowsecurity,
        'rls_forcado', c.relforcerowsecurity,
        'linhas_aprox', c.reltuples::bigint) order by c.relname)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'),

  'colunas', (select jsonb_agg(jsonb_build_object(
        'tabela', table_name, 'coluna', column_name, 'tipo', data_type,
        'nulo', is_nullable, 'padrao', column_default) order by table_name, ordinal_position)
      from information_schema.columns where table_schema = 'public'),

  'politicas_rls', (select jsonb_agg(jsonb_build_object(
        'tabela', tablename, 'politica', policyname, 'comando', cmd,
        'papeis', roles, 'using', qual, 'with_check', with_check) order by tablename, policyname)
      from pg_policies where schemaname in ('public','storage')),

  'funcoes', (select jsonb_agg(jsonb_build_object(
        'funcao', p.proname,
        'argumentos', pg_get_function_identity_arguments(p.oid),
        'security_definer', p.prosecdef,
        'search_path', p.proconfig) order by p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'),

  'gatilhos', (select jsonb_agg(jsonb_build_object(
        'tabela', event_object_table, 'gatilho', trigger_name,
        'evento', event_manipulation, 'acao', action_statement))
      from information_schema.triggers where trigger_schema = 'public'),

  'permissoes_anon_authenticated', (select jsonb_agg(jsonb_build_object(
        'tabela', table_name, 'papel', grantee, 'privilegio', privilege_type))
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon','authenticated')),

  'buckets', (select jsonb_agg(jsonb_build_object(
        'bucket', id, 'publico', public, 'limite_bytes', file_size_limit,
        'tipos_permitidos', allowed_mime_types))
      from storage.buckets),

  'extensoes', (select jsonb_agg(extname order by extname) from pg_extension),

  'perfis_por_papel', (select jsonb_object_agg(coalesce(role,'(vazio)'), qtd)
      from (select role, count(*) qtd from public.profiles group by role) x),

  'usuarios_auth', (select count(*) from auth.users),
  'usuarios_com_mfa', (select count(distinct user_id) from auth.mfa_factors where status = 'verified')
)) as inspecao;

-- ================= supabase/migrations/001_seguranca_base.sql =================
-- =====================================================================
-- 001 · SEGURANÇA BASE
-- • Funções auxiliares de permissão (admin exige MFA = aal2)
-- • Novas colunas em clients / profiles / assessments
-- • RLS refeita do zero nas tabelas existentes
-- • Trava no servidor do diagnóstico de posicionamento (cliente não altera
--   depois de enviar, nem com prazo vencido, nem sem liberação)
-- • Bucket de logos privado, com tipo e tamanho restritos
--
-- Idempotente: pode ser executada mais de uma vez.
-- Rode primeiro em um projeto de TESTE. Ver docs/LEIAME.md.
-- =====================================================================
begin;

create schema if not exists app;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------------
-- 1. Colunas novas (não remove nada do que já existe)
-- ---------------------------------------------------------------------
alter table public.clients
  add column if not exists positioning_enabled     boolean     not null default false,
  add column if not exists positioning_released_at timestamptz,
  add column if not exists contact_name            text,
  add column if not exists contact_email           text,
  add column if not exists phone                   text,
  add column if not exists profile                 text,
  add column if not exists payer                   text,
  add column if not exists stage                   text        not null default 'lead',
  add column if not exists origin                  text,
  add column if not exists logo_path               text,
  add column if not exists notes                   text,
  add column if not exists created_at              timestamptz not null default now(),
  add column if not exists updated_at              timestamptz not null default now();

do $$ begin
  alter table public.clients add constraint clients_stage_chk check (stage in
    ('lead','autodiagnostico','diagnostico_operacional','relatorio_emitido',
     'proposta_emitida','cliente_ativo','nao_fechou','encerrado'));
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists must_change_password boolean     not null default false,
  add column if not exists created_at           timestamptz not null default now(),
  add column if not exists updated_at           timestamptz not null default now();

alter table public.assessments
  add column if not exists notified_at   timestamptz,
  add column if not exists notify_status text,
  add column if not exists created_at    timestamptz not null default now(),
  add column if not exists updated_at    timestamptz not null default now();

-- Logos antigas eram públicas (logo_url). Passam a ser privadas (logo_path).
update public.clients
   set logo_path = split_part(split_part(logo_url, '/client-logos/', 2), '?', 1)
 where logo_path is null and logo_url like '%/client-logos/%';

-- ---------------------------------------------------------------------
-- 2. Funções de permissão
-- ---------------------------------------------------------------------
-- Admin = perfil 'admin' E sessão com MFA verificado (aal2).
create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                  where p.user_id = auth.uid() and p.role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function app.my_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.client_id from public.profiles p
   where p.user_id = auth.uid() and p.role <> 'admin' limit 1;
$$;

-- Acesso do cliente válido: ativo e dentro do prazo.
create or replace function app.client_access_ok(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients c
                  where c.id = p_client_id and c.is_active is true
                    and (c.access_expires_at is null or c.access_expires_at > now()));
$$;

create or replace function app.positioning_open(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.client_access_ok(p_client_id)
     and exists (select 1 from public.clients c
                  where c.id = p_client_id and c.positioning_enabled is true);
$$;

-- Operações feitas pelo servidor (edge functions / SQL Editor) não passam pelas travas do cliente.
create or replace function app.is_backend() returns boolean
language sql stable as $$
  select current_user in ('postgres','service_role','supabase_admin');
$$;

revoke all on function app.is_admin(), app.my_client_id(), app.client_access_ok(uuid),
                       app.positioning_open(uuid), app.is_backend() from public, anon;
grant execute on function app.is_admin(), app.my_client_id(), app.client_access_ok(uuid),
                          app.positioning_open(uuid), app.is_backend() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Trava do diagnóstico de posicionamento (independe da tela)
-- ---------------------------------------------------------------------
-- SECURITY INVOKER de propósito: assim current_user é o papel real de quem grava.
create or replace function app.assessments_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if app.is_backend() or app.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.client_id is distinct from app.my_client_id() then
      raise exception 'Acesso negado.' using errcode = '42501';
    end if;
    if not app.positioning_open(new.client_id) then
      raise exception 'O preenchimento não está liberado ou o prazo terminou.' using errcode = '42501';
    end if;
    if exists (select 1 from public.assessments a where a.client_id = new.client_id) then
      raise exception 'Já existe um preenchimento para esta clínica.' using errcode = '23505';
    end if;
    new.created_by    := auth.uid();
    new.created_at    := now();
    new.status        := 'draft';
    new.submitted_at  := null;
    new.notified_at   := null;
    new.notify_status := null;
  else
    if old.status <> 'draft' then
      raise exception 'O diagnóstico já foi enviado e não pode ser alterado.' using errcode = '42501';
    end if;
    if not app.positioning_open(old.client_id) then
      raise exception 'O preenchimento não está liberado ou o prazo terminou.' using errcode = '42501';
    end if;
    if new.status not in ('draft','submitted') then
      raise exception 'Situação inválida.' using errcode = '22023';
    end if;
    -- campos que o cliente nunca altera
    new.id            := old.id;
    new.client_id     := old.client_id;
    new.created_by    := old.created_by;
    new.created_at    := old.created_at;
    new.notified_at   := old.notified_at;
    new.notify_status := old.notify_status;
    new.submitted_at  := case when new.status = 'submitted' then now() else null end;
  end if;

  new.progress_percent := greatest(0, least(100, coalesce(new.progress_percent, 0)));
  if pg_column_size(new.responses) > 200000 then
    raise exception 'Respostas muito grandes.' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists trg_assessments_guard on public.assessments;
create trigger trg_assessments_guard before insert or update on public.assessments
  for each row execute function app.assessments_guard();

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_clients_touch on public.clients;
create trigger trg_clients_touch before update on public.clients
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS: remove TODAS as políticas antigas destas tabelas e recria
-- ---------------------------------------------------------------------
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename in ('clients','profiles','assessments')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.clients     enable row level security;
alter table public.profiles    enable row level security;
alter table public.assessments enable row level security;
alter table public.clients     force row level security;
alter table public.profiles    force row level security;
alter table public.assessments force row level security;

revoke all on public.clients, public.profiles, public.assessments from anon;
grant select, insert, update, delete on public.clients, public.profiles, public.assessments to authenticated;

-- clients
create policy clients_admin on public.clients for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy clients_self_read on public.clients for select to authenticated
  using (id = app.my_client_id());

-- profiles: cada um só lê o próprio; ninguém se auto-promove (sem insert/update para não-admin)
create policy profiles_admin on public.profiles for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = auth.uid());

-- assessments (posicionamento)
create policy assessments_admin on public.assessments for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy assessments_self_read on public.assessments for select to authenticated
  using (client_id = app.my_client_id());
create policy assessments_self_insert on public.assessments for insert to authenticated
  with check (client_id = app.my_client_id() and app.positioning_open(client_id));
create policy assessments_self_update on public.assessments for update to authenticated
  using (client_id = app.my_client_id() and status = 'draft' and app.positioning_open(client_id))
  with check (client_id = app.my_client_id());

-- ---------------------------------------------------------------------
-- 5. RPCs do próprio usuário
-- ---------------------------------------------------------------------
create or replace function public.my_mark_password_changed() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set must_change_password = false where user_id = auth.uid();
$$;
revoke all on function public.my_mark_password_changed() from public, anon;
grant execute on function public.my_mark_password_changed() to authenticated;

-- Liberar novo preenchimento (apaga respostas, mantém cadastro e login)
drop function if exists public.admin_reset_assessment(uuid);
create function public.admin_reset_assessment(p_client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  delete from public.assessments where client_id = p_client_id;
end $$;
revoke all on function public.admin_reset_assessment(uuid) from public, anon;
grant execute on function public.admin_reset_assessment(uuid) to authenticated;

-- A exclusão antiga (RPC chamada pelo navegador) é substituída pela edge function
-- admin-delete-client, que também apaga login e arquivos.
drop function if exists public.admin_delete_client(uuid);

-- ---------------------------------------------------------------------
-- 6. Storage: logos privadas, só PNG/JPG/WebP até 1 MB, acesso apenas admin
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-logos','client-logos', false, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 1048576,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

do $$ declare r record; begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and (qual like '%client-logos%' or with_check like '%client-logos%')
  loop execute format('drop policy %I on storage.objects', r.policyname); end loop;
end $$;

create policy client_logos_admin on storage.objects for all to authenticated
  using (bucket_id = 'client-logos' and app.is_admin())
  with check (bucket_id = 'client-logos' and app.is_admin());

commit;

-- ================= supabase/migrations/002_diagnostico_proposta.sql =================
-- =====================================================================
-- 002 · AUTODIAGNÓSTICO IMPORTADO, DIAGNÓSTICO OPERACIONAL, PROPOSTAS,
--       CONSENTIMENTO (LGPD)
-- Tabelas novas. Acesso exclusivo do admin, exceto consentimento
-- (cada usuário registra e lê o próprio aceite).
-- Não guarda dados de pacientes nem os PDFs: só os dados extraídos e o
-- hash (impressão digital) dos arquivos, para rastreabilidade.
-- =====================================================================
begin;

-- Autodiagnóstico do site, importado dos PDFs (relatório + ficha)
create table if not exists public.self_assessments (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  source         text not null check (source in ('dados_embutidos','ocr','manual')),
  filled_at      timestamptz,
  overall        int  check (overall between 0 and 100),
  level          text,
  lead_class     text check (lead_class in ('A','B','C')),
  pillars        jsonb not null default '[]'::jsonb,   -- [{id,name,score,level}]
  priorities     jsonb not null default '[]'::jsonb,   -- [{id,name,score,items:[{t,label}]}]
  unknowns       jsonb not null default '[]'::jsonb,   -- [{pillar,t}]
  answers        jsonb not null default '{}'::jsonb,   -- respostas item a item (ficha)
  identification jsonb not null default '{}'::jsonb,   -- estrutura, dores, momento (ficha)
  file_hashes    jsonb not null default '[]'::jsonb,   -- [{nome,tipo,sha256}]
  imported_by    uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists self_assessments_client_idx on public.self_assessments(client_id, created_at desc);

-- Sessão de 45 min + matriz + relatório (estado do módulo operacional)
create table if not exists public.operational_diagnoses (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  data             jsonb not null default '{}'::jsonb,
  status           text  not null default 'draft' check (status in ('draft','completed','archived')),
  report_issued_at timestamptz,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists operational_client_idx on public.operational_diagnoses(client_id, updated_at desc);

-- Propostas emitidas (fotografia imutável do que foi enviado ao cliente)
create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  diagnosis_id uuid references public.operational_diagnoses(id) on delete set null,
  code         text not null unique,
  issued_at    date not null default current_date,
  valid_until  date,
  snapshot     jsonb not null default '{}'::jsonb,
  status       text not null default 'emitida'
               check (status in ('emitida','enviada','aceita','recusada','expirada','cancelada')),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists proposals_client_idx on public.proposals(client_id, created_at desc);

-- Numeração sequencial por ano: ELG-2026-001
create table if not exists app.proposal_counters (year int primary key, n int not null default 0);

create or replace function public.admin_next_proposal_code() returns text
language plpgsql security definer set search_path = '' as $$
declare v_year int := extract(year from now())::int; v_n int;
begin
  if not app.is_admin() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  insert into app.proposal_counters(year, n) values (v_year, 1)
  on conflict (year) do update set n = app.proposal_counters.n + 1
  returning n into v_n;
  return format('ELG-%s-%s', v_year, lpad(v_n::text, 3, '0'));
end $$;
revoke all on function public.admin_next_proposal_code() from public, anon;
grant execute on function public.admin_next_proposal_code() to authenticated;

-- Termo de ciência e consentimento (LGPD), com versão e data
create table if not exists public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  client_id    uuid,
  term_version text not null,
  accepted_at  timestamptz not null default now(),
  user_agent   text
);
create index if not exists consents_user_idx on public.consents(user_id, term_version);

-- Proposta emitida: só o status pode mudar depois
create or replace function app.proposals_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code or new.snapshot is distinct from old.snapshot
     or new.issued_at is distinct from old.issued_at or new.client_id is distinct from old.client_id then
    raise exception 'Proposta emitida não pode ser alterada. Emita uma nova versão.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_proposals_guard on public.proposals;
create trigger trg_proposals_guard before update on public.proposals
  for each row execute function app.proposals_guard();

drop trigger if exists trg_self_assessments_touch on public.self_assessments;
create trigger trg_self_assessments_touch before update on public.self_assessments
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_operational_touch on public.operational_diagnoses;
create trigger trg_operational_touch before update on public.operational_diagnoses
  for each row execute function app.touch_updated_at();

-- RLS
alter table public.self_assessments      enable row level security;
alter table public.operational_diagnoses enable row level security;
alter table public.proposals             enable row level security;
alter table public.consents              enable row level security;
alter table public.self_assessments      force row level security;
alter table public.operational_diagnoses force row level security;
alter table public.proposals             force row level security;
alter table public.consents              force row level security;

revoke all on public.self_assessments, public.operational_diagnoses, public.proposals, public.consents from anon;
grant select, insert, update, delete on public.self_assessments, public.operational_diagnoses, public.proposals to authenticated;
grant select, insert on public.consents to authenticated;

do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies
            where schemaname = 'public'
              and tablename in ('self_assessments','operational_diagnoses','proposals','consents')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy self_assessments_admin on public.self_assessments for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy operational_admin on public.operational_diagnoses for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy proposals_admin on public.proposals for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy consents_self_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid() and (client_id is null or client_id = app.my_client_id()));
create policy consents_read on public.consents for select to authenticated
  using (user_id = auth.uid() or app.is_admin());

commit;

-- ================= supabase/migrations/003_auditoria.sql =================
-- =====================================================================
-- 003 · AUDITORIA (somente admin lê; ninguém altera nem apaga)
-- • Registro automático por gatilho em todas as tabelas de negócio
-- • Registro manual de eventos de tela (relatório gerado, exportação...)
-- • Histórico de login do Supabase Auth exposto apenas ao admin
-- • Retenção de 5 anos com expurgo mensal automático (pg_cron)
-- =====================================================================
begin;

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  actor_role  text,
  action      text not null,
  entity      text,
  entity_id   text,
  client_id   uuid,          -- sem FK: o registro sobrevive à exclusão do cliente
  client_name text,
  details     jsonb not null default '{}'::jsonb,
  ip          text,
  user_agent  text
);
create index if not exists audit_log_at_idx     on public.audit_log(at desc);
create index if not exists audit_log_client_idx on public.audit_log(client_id, at desc);
create index if not exists audit_log_action_idx on public.audit_log(action, at desc);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='audit_log'
  loop execute format('drop policy %I on public.audit_log', r.policyname); end loop;
end $$;
create policy audit_admin_read on public.audit_log for select to authenticated using (app.is_admin());

-- Imutável: bloqueia UPDATE, DELETE e TRUNCATE (exceto o expurgo de 5 anos)
create or replace function app.audit_immutable() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.audit_purge', true), '') = 'on' and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'O log de auditoria não pode ser alterado nem apagado.' using errcode = '42501';
end $$;
drop trigger if exists trg_audit_immutable on public.audit_log;
create trigger trg_audit_immutable before update or delete on public.audit_log
  for each row execute function app.audit_immutable();
drop trigger if exists trg_audit_no_truncate on public.audit_log;
create trigger trg_audit_no_truncate before truncate on public.audit_log
  for each statement execute function app.audit_immutable();

-- Contexto da requisição (quem, de onde)
create or replace function app.audit_insert(
  p_action text, p_entity text, p_entity_id text, p_client_id uuid, p_details jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_hdr   jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_role  text  := coalesce(nullif(current_setting('role', true), ''), 'none');
  v_actor uuid  := auth.uid();
  v_email text  := auth.jwt() ->> 'email';
  v_prole text;
  v_cname text;
begin
  -- Edge functions (service_role) informam o admin que originou a ação
  if v_actor is null and v_role = 'service_role' and (v_hdr ->> 'x-eloga-actor') ~* '^[0-9a-f-]{36}$' then
    v_actor := (v_hdr ->> 'x-eloga-actor')::uuid;
    select u.email into v_email from auth.users u where u.id = v_actor;
  end if;
  if v_actor is not null then
    select p.role into v_prole from public.profiles p where p.user_id = v_actor;
  end if;
  if p_client_id is not null then
    select c.name into v_cname from public.clients c where c.id = p_client_id;
  end if;
  insert into public.audit_log(actor_id, actor_email, actor_role, action, entity, entity_id,
                               client_id, client_name, details, ip, user_agent)
  values (v_actor, v_email,
          coalesce(v_prole, case when v_role in ('none','postgres') then 'sistema (SQL)'
                                 when v_role = 'service_role' then 'sistema' else v_role end),
          p_action, p_entity, p_entity_id, p_client_id,
          coalesce(v_cname, p_details ->> 'cliente'),
          coalesce(p_details, '{}'::jsonb),
          split_part(coalesce(v_hdr ->> 'cf-connecting-ip', v_hdr ->> 'x-forwarded-for', v_hdr ->> 'x-real-ip', ''), ',', 1),
          left(v_hdr ->> 'user-agent', 300));
end $$;
revoke all on function app.audit_insert(text,text,text,uuid,jsonb) from public, anon, authenticated;

-- Gatilho genérico. Argumentos (tg_argv) = colunas cuja alteração ISOLADA não gera
-- registro (ex.: salvamento automático de rascunho), para o log não virar ruído.
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb; v_new jsonb; v_diff jsonb; v_client uuid; v_id text;
  v_quiet text[] := coalesce(tg_argv::text[], '{}');
  v_heavy text[] := array['responses','data','snapshot','answers','identification','priorities','unknowns'];
  v_action text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, case when k = any(v_heavy) then '"(conteúdo alterado)"'::jsonb
                                    else jsonb_build_object('de', v_old -> k, 'para', v_new -> k) end)
      into v_diff
      from jsonb_object_keys(v_new) k
     where (v_new -> k) is distinct from (v_old -> k)
       and k not in ('updated_at')
       and not (k = any(v_quiet));
    if v_diff is null then return null; end if;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id');
  v_client := case when tg_table_name = 'clients' then (coalesce(v_new, v_old) ->> 'id')::uuid
                   else nullif(coalesce(v_new, v_old) ->> 'client_id', '')::uuid end;
  v_action := tg_table_name || '.' || case tg_op when 'INSERT' then 'criado'
                                               when 'UPDATE' then 'alterado' else 'excluido' end;
  -- Ações com nome de negócio
  if tg_table_name = 'assessments' and tg_op = 'UPDATE' and (v_new ->> 'status') = 'submitted'
     and (v_old ->> 'status') = 'draft' then v_action := 'posicionamento.enviado'; end if;
  if tg_table_name = 'clients' and tg_op = 'UPDATE' and v_diff ? 'positioning_enabled' then
    v_action := case when (v_new ->> 'positioning_enabled')::boolean
                     then 'posicionamento.liberado' else 'posicionamento.bloqueado' end;
  end if;

  perform app.audit_insert(v_action, tg_table_name, v_id, v_client,
    case tg_op
      when 'INSERT' then jsonb_build_object('registro', v_new - v_heavy)
      when 'DELETE' then jsonb_build_object('registro', v_old - v_heavy,
                                            'cliente', coalesce(v_old ->> 'name', null))
      else jsonb_build_object('alteracoes', v_diff) end);
  return null;
end $$;

drop trigger if exists trg_audit on public.clients;
create trigger trg_audit after insert or update or delete on public.clients
  for each row execute function app.audit_row();
drop trigger if exists trg_audit on public.profiles;
create trigger trg_audit after insert or update or delete on public.profiles
  for each row execute function app.audit_row();
drop trigger if exists trg_audit on public.assessments;
create trigger trg_audit after insert or update or delete on public.assessments
  for each row execute function app.audit_row('responses','progress_percent','schema_version');
drop trigger if exists trg_audit on public.self_assessments;
create trigger trg_audit after insert or update or delete on public.self_assessments
  for each row execute function app.audit_row();
drop trigger if exists trg_audit on public.operational_diagnoses;
create trigger trg_audit after insert or update or delete on public.operational_diagnoses
  for each row execute function app.audit_row('data');
drop trigger if exists trg_audit on public.proposals;
create trigger trg_audit after insert or update or delete on public.proposals
  for each row execute function app.audit_row();
drop trigger if exists trg_audit on public.consents;
create trigger trg_audit after insert on public.consents
  for each row execute function app.audit_row();

-- Eventos de tela (não alteram tabelas). Cliente comum só registra login/logout.
create or replace function public.log_event(
  p_action text, p_entity text default null, p_entity_id text default null,
  p_client_id uuid default null, p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]{2,30}\.[a-z_]{2,30}$' then raise exception 'Ação inválida.' using errcode = '22023'; end if;
  if pg_column_size(p_details) > 8000 then raise exception 'Detalhes muito grandes.' using errcode = '22023'; end if;
  if not app.is_admin() then
    if p_action not in ('sessao.login','sessao.logout','sessao.expirada','sessao.senha_alterada','acesso.negado','mfa.ativado') then
      raise exception 'Acesso negado.' using errcode = '42501';
    end if;
    p_client_id := app.my_client_id();
  end if;
  perform app.audit_insert(p_action, p_entity, p_entity_id, p_client_id, p_details);
end $$;
revoke all on function public.log_event(text,text,text,uuid,jsonb) from public, anon;
grant execute on function public.log_event(text,text,text,uuid,jsonb) to authenticated;

-- Histórico de autenticação do Supabase (logins, trocas de senha, MFA)
create or replace function public.admin_auth_events(p_since timestamptz default now() - interval '90 days',
                                                    p_limit int default 500)
returns table(at timestamptz, action text, actor text, ip text)
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  return query
    select e.created_at, e.payload ->> 'action', coalesce(e.payload ->> 'actor_username', e.payload ->> 'actor_id'),
           e.ip_address::text
      from auth.audit_log_entries e
     where e.created_at >= p_since
     order by e.created_at desc
     limit least(greatest(p_limit, 1), 2000);
end $$;
revoke all on function public.admin_auth_events(timestamptz,int) from public, anon;
grant execute on function public.admin_auth_events(timestamptz,int) to authenticated;

-- Retenção: 5 anos
create or replace function app.purge_audit_log() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform set_config('app.audit_purge', 'on', true);
  delete from public.audit_log where at < now() - interval '5 years';
  get diagnostics v_n = row_count;
  perform set_config('app.audit_purge', 'off', true);
  if v_n > 0 then
    perform app.audit_insert('auditoria.expurgo', 'audit_log', null, null,
                             jsonb_build_object('registros_removidos', v_n, 'regra', 'mais de 5 anos'));
  end if;
  return v_n;
end $$;
revoke all on function app.purge_audit_log() from public, anon, authenticated;

commit;

-- Agendamento mensal do expurgo (fora da transação; ignora se pg_cron não existir)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'eloga_expurgo_auditoria';
  perform cron.schedule('eloga_expurgo_auditoria', '0 6 1 * *', 'select app.purge_audit_log()');
exception when others then
  raise notice 'pg_cron indisponível: rode "select app.purge_audit_log();" uma vez por mês. (%)', sqlerrm;
end $$;

-- ================= supabase/migrations/004_portal_cliente.sql =================
-- =====================================================================
-- 004 · PORTAL DO CLIENTE: liberações, documentos publicados, plano de ação
--       (Painel Mestre PDCA), materiais e catálogo de programas
-- Regra geral: o cliente só lê o que a administração liberou, só da própria
-- clínica, e só com acesso ativo e dentro do prazo. Nada é editável pelo cliente.
-- =====================================================================
begin;

-- Catálogo de programas e preços (e outras configurações da ELOGA)
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Liberações por cliente: { "plano": true, "dashboard": false }
alter table public.clients add column if not exists liberacoes jsonb not null default '{}'::jsonb;

create or replace function app.liberado(p_client_id uuid, p_item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.client_access_ok(p_client_id)
     and coalesce((select (c.liberacoes ->> p_item)::boolean from public.clients c where c.id = p_client_id), false);
$$;
revoke all on function app.liberado(uuid, text) from public, anon;
grant execute on function app.liberado(uuid, text) to authenticated;

-- Relatório e proposta publicados para o cliente (fotografia do documento no momento da liberação)
create table if not exists public.client_documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  tipo         text not null check (tipo in ('relatorio','proposta')),
  titulo       text not null,
  html         text not null check (length(html) < 2000000),
  pode_baixar  boolean not null default false,
  publicado_em timestamptz not null default now(),
  publicado_por uuid default auth.uid(),
  unique (client_id, tipo)
);

-- Plano de ação (Painel Mestre PDCA): dados completos, só administração
create table if not exists public.action_plans (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Projeção mínima que o cliente pode ver (sem diagnóstico, SWOT, notas internas e relatórios)
create table if not exists public.action_plan_views (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  dados      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Materiais (arquivos no Storage ou links externos) e liberação por cliente
create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(titulo) between 1 and 200),
  descricao    text check (length(descricao) <= 1000),
  tipo         text not null check (tipo in ('arquivo','link')),
  url          text check (url is null or url ~* '^https://'),
  storage_path text,
  tamanho      bigint,
  mime         text,
  created_at   timestamptz not null default now(),
  check ((tipo = 'link' and url is not null) or (tipo = 'arquivo' and storage_path is not null))
);
create table if not exists public.material_access (
  material_id uuid not null references public.materials(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  pode_baixar boolean not null default false,
  liberado_em timestamptz not null default now(),
  primary key (material_id, client_id)
);

drop trigger if exists trg_action_plans_touch on public.action_plans;
create trigger trg_action_plans_touch before update on public.action_plans for each row execute function app.touch_updated_at();
drop trigger if exists trg_action_plan_views_touch on public.action_plan_views;
create trigger trg_action_plan_views_touch before update on public.action_plan_views for each row execute function app.touch_updated_at();
drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch before update on public.app_settings for each row execute function app.touch_updated_at();

-- RLS
alter table public.app_settings      enable row level security;  alter table public.app_settings      force row level security;
alter table public.client_documents  enable row level security;  alter table public.client_documents  force row level security;
alter table public.action_plans      enable row level security;  alter table public.action_plans      force row level security;
alter table public.action_plan_views enable row level security;  alter table public.action_plan_views force row level security;
alter table public.materials         enable row level security;  alter table public.materials         force row level security;
alter table public.material_access   enable row level security;  alter table public.material_access   force row level security;

revoke all on public.app_settings, public.client_documents, public.action_plans, public.action_plan_views,
              public.materials, public.material_access from anon;
grant select, insert, update, delete on public.app_settings, public.client_documents, public.action_plans,
              public.action_plan_views, public.materials, public.material_access to authenticated;

do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public'
            and tablename in ('app_settings','client_documents','action_plans','action_plan_views','materials','material_access')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy app_settings_admin on public.app_settings for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy action_plans_admin on public.action_plans for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy client_documents_admin on public.client_documents for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy client_documents_cliente on public.client_documents for select to authenticated
  using (client_id = app.my_client_id() and app.client_access_ok(client_id));

create policy action_plan_views_admin on public.action_plan_views for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy action_plan_views_cliente on public.action_plan_views for select to authenticated
  using (client_id = app.my_client_id() and (app.liberado(client_id, 'plano') or app.liberado(client_id, 'dashboard')));

create policy materials_admin on public.materials for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy materials_cliente on public.materials for select to authenticated
  using (app.client_access_ok(app.my_client_id())
         and exists (select 1 from public.material_access a where a.material_id = materials.id and a.client_id = app.my_client_id()));

create policy material_access_admin on public.material_access for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy material_access_cliente on public.material_access for select to authenticated
  using (client_id = app.my_client_id() and app.client_access_ok(client_id));

-- Storage: bucket privado de materiais (PDF e imagens, até 20 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais','materiais', false, 20971520, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp'];

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and (qual like '%''materiais''%' or with_check like '%''materiais''%')
  loop execute format('drop policy %I on storage.objects', r.policyname); end loop;
end $$;
create policy materiais_admin on storage.objects for all to authenticated
  using (bucket_id = 'materiais' and app.is_admin()) with check (bucket_id = 'materiais' and app.is_admin());
create policy materiais_cliente_leitura on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and app.client_access_ok(app.my_client_id()) and exists (
    select 1 from public.materials m join public.material_access a on a.material_id = m.id
     where m.storage_path = objects.name and a.client_id = app.my_client_id()));

-- Auditoria das novas tabelas (salvamentos automáticos do plano não geram ruído)
drop trigger if exists trg_audit on public.client_documents;
create trigger trg_audit after insert or update or delete on public.client_documents for each row execute function app.audit_row('html');
drop trigger if exists trg_audit on public.action_plans;
create trigger trg_audit after insert or delete on public.action_plans for each row execute function app.audit_row('data');
drop trigger if exists trg_audit on public.materials;
create trigger trg_audit after insert or update or delete on public.materials for each row execute function app.audit_row();
drop trigger if exists trg_audit on public.material_access;
create trigger trg_audit after insert or update or delete on public.material_access for each row execute function app.audit_row();
drop trigger if exists trg_audit on public.app_settings;
create trigger trg_audit after insert or update on public.app_settings for each row execute function app.audit_row('value');

-- Cliente pode registrar que abriu um documento ou material (rastreabilidade)
create or replace function public.log_event(
  p_action text, p_entity text default null, p_entity_id text default null,
  p_client_id uuid default null, p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]{2,30}\.[a-z_]{2,30}$' then raise exception 'Ação inválida.' using errcode = '22023'; end if;
  if pg_column_size(p_details) > 8000 then raise exception 'Detalhes muito grandes.' using errcode = '22023'; end if;
  if not app.is_admin() then
    if p_action not in ('sessao.login','sessao.logout','sessao.expirada','sessao.senha_alterada','acesso.negado','mfa.ativado',
                        'cliente.documento_aberto','cliente.material_aberto','cliente.plano_aberto') then
      raise exception 'Acesso negado.' using errcode = '42501';
    end if;
    p_client_id := app.my_client_id();
  end if;
  perform app.audit_insert(p_action, p_entity, p_entity_id, p_client_id, p_details);
end $$;

commit;

-- ================= supabase/migrations/005_compatibilidade_portal_antigo.sql =================
-- =====================================================================
-- 005 · COMPATIBILIDADE COM O PORTAL ANTIGO
-- O projeto oficial já tem tabelas criadas pelo HTML antigo (levantadas por
-- inspeção somente leitura em 05/10/2026). Esta migration:
-- • ajusta operational_diagnoses e action_plans ao portal novo sem perder dados
--   (o conteúdo antigo do plano fica guardado em legacy_data);
-- • fecha as tabelas e o bucket que o portal novo não usa (client_modules,
--   client_materials, strategies, client-materials): só admin com 2FA acessa;
-- • tira do visitante anônimo (anon) qualquer acesso direto às tabelas.
-- Não apaga linhas nem tabelas. Idempotente. Em projeto novo, só não encontra
-- o que ajustar.
-- =====================================================================
begin;

-- Diagnóstico operacional: data do último PDF e status padronizado
alter table public.operational_diagnoses add column if not exists report_issued_at timestamptz;
alter table public.operational_diagnoses drop constraint if exists operational_diagnoses_status_check;
update public.operational_diagnoses set status = 'draft'     where status = 'rascunho';
update public.operational_diagnoses set status = 'completed' where status = 'concluido';
alter table public.operational_diagnoses add constraint operational_diagnoses_status_check
  check (status in ('draft','completed','archived'));

-- Plano de ação: o formato antigo ({"items": [...]}) é guardado em legacy_data
-- e o campo data passa a receber o Painel Mestre PDCA.
alter table public.action_plans add column if not exists legacy_data jsonb;
update public.action_plans
   set legacy_data = data, data = '{}'::jsonb
 where legacy_data is null and data ? 'items' and not data ? 'clients';
alter table public.action_plans alter column data set default '{}'::jsonb;

-- Tabelas antigas que o portal novo não usa: somente admin com 2FA
do $$ declare t text; r record; begin
  foreach t in array array['client_modules','client_materials','strategies'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t || '_somente_admin', t);
  end loop;
end $$;

-- Bucket antigo de materiais: somente admin com 2FA (os novos ficam no bucket "materiais")
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and (qual like '%client-materials%' or with_check like '%client-materials%')
  loop execute format('drop policy %I on storage.objects', r.policyname); end loop;
  if exists (select 1 from storage.buckets where id = 'client-materials') then
    create policy client_materials_antigo_admin on storage.objects for all to authenticated
      using (bucket_id = 'client-materials' and app.is_admin()) with check (bucket_id = 'client-materials' and app.is_admin());
  end if;
end $$;

-- Visitante anônimo não acessa nenhuma tabela diretamente (o login não depende disso)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

commit;

-- ================= supabase/migrations/006_ajustes_verificador.sql =================
-- =====================================================================
-- 006 · AJUSTES APONTADOS PELO VERIFICADOR DO SUPABASE (Security/Performance Advisor)
-- • search_path fixo nas funções que ainda não tinham
-- • gatilho antigo handle_new_user não pode ser chamado pela API
-- • regras de acesso avaliam auth.uid() uma vez por consulta (mais rápido)
-- • índices nas chaves estrangeiras mais consultadas
-- Sem remoções. Idempotente.
--
-- Avisos que permanecem DE PROPÓSITO: as funções admin_*, log_event e
-- my_mark_password_changed são SECURITY DEFINER chamáveis por usuários logados;
-- cada uma confere no início se quem chama é admin com 2FA ou o próprio usuário.
-- =====================================================================
begin;

alter function app.is_backend()       set search_path = '';
alter function app.touch_updated_at() set search_path = '';
alter function app.audit_immutable()  set search_path = '';

do $$ begin
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke execute on function public.handle_new_user() from public, anon, authenticated;
  end if;
end $$;

alter policy profiles_self_read on public.profiles
  using (user_id = (select auth.uid()));
alter policy consents_self_insert on public.consents
  with check (user_id = (select auth.uid()) and (client_id is null or client_id = (select app.my_client_id())));
alter policy consents_read on public.consents
  using (user_id = (select auth.uid()) or (select app.is_admin()));

-- Tabela interna do contador de propostas: só acessada pela função do servidor
alter table app.proposal_counters enable row level security;

create index if not exists assessments_client_idx     on public.assessments(client_id);
create index if not exists profiles_client_idx        on public.profiles(client_id);
create index if not exists material_access_client_idx on public.material_access(client_id);
create index if not exists proposals_diagnosis_idx    on public.proposals(diagnosis_id);

commit;

-- ================= supabase/migrations/007_cliente_edita_plano.sql =================
-- =====================================================================
-- 007 · CLIENTE PODE EDITAR O PLANO DE AÇÃO (quando a ELOGA liberar)
-- O cliente nunca grava direto nas tabelas. Ele chama esta função, que:
-- • confere login de cliente, acesso válido e as liberações "plano" e "plano_editar";
-- • aceita SOMENTE a lista de ações (plano) da própria clínica;
-- • remove < > ` dos textos e valida identificadores, status e progresso
--   (nenhum texto digitado pode virar código na tela da ELOGA);
-- • atualiza o plano completo (admin) e a projeção que o cliente vê;
-- • registra na auditoria (no máximo 1 registro a cada 15 minutos por clínica).
-- Sem remoções. Idempotente.
-- =====================================================================
begin;

create or replace function public.cliente_salvar_plano(p_plano jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cli   uuid := app.my_client_id();
  v_chave text;
  v_plano jsonb;
begin
  if auth.uid() is null or v_cli is null then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not (app.liberado(v_cli, 'plano') and app.liberado(v_cli, 'plano_editar')) then
    raise exception 'A edição do plano não está liberada.' using errcode = '42501';
  end if;
  if p_plano is null or jsonb_typeof(p_plano) <> 'array'
     or jsonb_array_length(p_plano) > 500 or pg_column_size(p_plano) > 500000 then
    raise exception 'Plano inválido.' using errcode = '22023';
  end if;

  -- Textos: remove os caracteres que poderiam formar código na tela
  v_plano := regexp_replace(p_plano::text, '[<>`]', '', 'g')::jsonb;

  if exists (
    select 1 from jsonb_array_elements(v_plano) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'id', '') !~ '^[A-Za-z0-9_-]{1,64}$'
        or coalesce(e->>'pilar', '') !~ '^[a-z_]{0,30}$'
        or coalesce(e->>'status', 'Não iniciado') not in ('Não iniciado', 'Em andamento', 'Concluído')
        or coalesce(e->>'progresso', '0') !~ '^[0-9]{1,3}(\.[0-9]+)?$'
        or coalesce(e->>'relFmt', '') not in ('', 'lista', 'kanban')
        or coalesce(e->>'when', '')        !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        or coalesce(e->>'inicio', '')      !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        or coalesce(e->>'concluidoEm', '') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
  ) then
    raise exception 'Plano inválido.' using errcode = '22023';
  end if;

  -- O painel guarda a clínica pela própria chave (id do cliente)
  v_chave := v_cli::text;

  update public.action_plans
     set data = jsonb_set(data, array['clients', v_chave, 'plano'], v_plano), updated_at = now()
   where client_id = v_cli and (data -> 'clients') ? v_chave;
  if not found then
    raise exception 'Plano não encontrado. Peça à ELOGA para abrir o plano uma vez.' using errcode = 'P0002';
  end if;

  update public.action_plan_views
     set dados = jsonb_set(dados, array['clients', v_chave, 'plano'], v_plano), updated_at = now()
   where client_id = v_cli and (dados -> 'clients') ? v_chave;

  if not exists (select 1 from public.audit_log
                  where client_id = v_cli and action = 'cliente.plano_editado'
                    and at > now() - interval '15 minutes') then
    perform app.audit_insert('cliente.plano_editado', 'action_plans', v_chave, v_cli,
                             jsonb_build_object('acoes', jsonb_array_length(v_plano)));
  end if;
end $$;

revoke all on function public.cliente_salvar_plano(jsonb) from public, anon;
grant execute on function public.cliente_salvar_plano(jsonb) to authenticated;

commit;

-- ================= supabase/migrations/008_planilhas_preenchiveis.sql =================
-- =====================================================================
-- 008 · PLANILHAS PREENCHÍVEIS (kits operacionais) EM MATERIAIS
-- • materials.estrutura: o modelo da planilha (abas e células) lido do .xlsx/.csv.
-- • material_respostas: UMA CÓPIA POR CLIENTE. Cada clínica preenche a sua;
--   outra clínica que receber o mesmo material começa em branco.
-- • O cliente só lê e grava a própria cópia, de material liberado para ele,
--   com acesso válido. O endereço do Drive só é gravado pelo servidor.
-- • Bucket "materiais" passa a aceitar .xlsx e .csv (o arquivo original).
-- Sem remoções. Idempotente.
-- =====================================================================
begin;

alter table public.materials add column if not exists estrutura      jsonb;
alter table public.materials add column if not exists permite_linhas boolean not null default true;

create table if not exists public.material_respostas (
  id             uuid primary key default gen_random_uuid(),
  material_id    uuid not null references public.materials(id) on delete cascade,
  client_id      uuid not null references public.clients(id)   on delete cascade,
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  drive_url      text,
  drive_em       timestamptz,
  created_at     timestamptz not null default now(),
  unique (material_id, client_id)
);
create index if not exists material_respostas_client_idx on public.material_respostas(client_id);

alter table public.material_respostas enable row level security;
alter table public.material_respostas force row level security;
revoke all on public.material_respostas from anon;
grant select, insert, update, delete on public.material_respostas to authenticated;

-- Material liberado para a clínica do usuário e com modelo de planilha
create or replace function app.planilha_liberada(p_material uuid, p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_client = app.my_client_id()
     and app.client_access_ok(p_client)
     and exists (select 1 from public.material_access a join public.materials m on m.id = a.material_id
                  where a.material_id = p_material and a.client_id = p_client and m.estrutura is not null);
$$;
revoke all on function app.planilha_liberada(uuid, uuid) from public, anon;
grant execute on function app.planilha_liberada(uuid, uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'material_respostas' and policyname = 'material_respostas_admin') then
    create policy material_respostas_admin on public.material_respostas for all to authenticated
      using (app.is_admin()) with check (app.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'material_respostas' and policyname = 'material_respostas_cliente_ler') then
    create policy material_respostas_cliente_ler on public.material_respostas for select to authenticated
      using (app.planilha_liberada(material_id, client_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'material_respostas' and policyname = 'material_respostas_cliente_criar') then
    create policy material_respostas_cliente_criar on public.material_respostas for insert to authenticated
      with check (app.planilha_liberada(material_id, client_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'material_respostas' and policyname = 'material_respostas_cliente_alterar') then
    create policy material_respostas_cliente_alterar on public.material_respostas for update to authenticated
      using (app.planilha_liberada(material_id, client_id)) with check (app.planilha_liberada(material_id, client_id));
  end if;
end $$;

-- Trava: o cliente não troca de material/clínica nem grava o endereço do Drive
create or replace function app.material_respostas_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  if pg_column_size(new.dados) > 1000000 then
    raise exception 'Planilha muito grande.' using errcode = '22023';
  end if;
  if app.is_backend() or app.is_admin() then return new; end if;
  new.atualizado_por := auth.uid();
  if tg_op = 'INSERT' then
    new.drive_url := null; new.drive_em := null; new.created_at := now();
  else
    new.id := old.id; new.material_id := old.material_id; new.client_id := old.client_id;
    new.drive_url := old.drive_url; new.drive_em := old.drive_em; new.created_at := old.created_at;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_material_respostas_guard' and tgrelid = 'public.material_respostas'::regclass) then
    create trigger trg_material_respostas_guard before insert or update on public.material_respostas
      for each row execute function app.material_respostas_guard();
  end if;
  -- Auditoria: início do preenchimento e exclusão (os salvamentos automáticos não poluem o log)
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit' and tgrelid = 'public.material_respostas'::regclass) then
    create trigger trg_audit after insert or delete on public.material_respostas
      for each row execute function app.audit_row('dados');
  end if;
end $$;

-- Arquivo original da planilha no bucket de materiais
update storage.buckets
   set allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp',
                                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv']
 where id = 'materiais';

commit;

-- ================= supabase/migrations/009_proposta_data_validade.sql =================
-- =====================================================================
-- 009 · PROPOSTA EMITIDA: PERMITE AJUSTAR DATA DE EMISSÃO E VALIDADE
-- Continua proibido mudar número, cliente e conteúdo. Na cópia registrada
-- (snapshot) só podem mudar proposal.date e proposal.validity.
-- Sem remoções. Idempotente.
-- =====================================================================
begin;

create or replace function app.proposals_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code or new.client_id is distinct from old.client_id
     or (new.snapshot #- '{proposal,date}' #- '{proposal,validity}')
        is distinct from (old.snapshot #- '{proposal,date}' #- '{proposal,validity}') then
    raise exception 'Proposta emitida não pode ser alterada. Emita uma nova versão.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

commit;

-- ================= supabase/migrations/010_plano_cliente_restricoes.sql =================
-- =====================================================================
-- 010 · PLANO PDCA: CLIENTE NÃO EXCLUI DEMANDAS NEM TROCA O PILAR
-- Reforça no servidor o que a tela já impede: a lista enviada pelo cliente
-- precisa conter todas as demandas atuais, com o mesmo pilar de cada uma.
-- Sem remoções. Idempotente.
-- =====================================================================
begin;

create or replace function public.cliente_salvar_plano(p_plano jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cli   uuid := app.my_client_id();
  v_chave text;
  v_plano jsonb;
  v_atual jsonb;
begin
  if auth.uid() is null or v_cli is null then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not (app.liberado(v_cli, 'plano') and app.liberado(v_cli, 'plano_editar')) then
    raise exception 'A edição do plano não está liberada.' using errcode = '42501';
  end if;
  if p_plano is null or jsonb_typeof(p_plano) <> 'array'
     or jsonb_array_length(p_plano) > 500 or pg_column_size(p_plano) > 500000 then
    raise exception 'Plano inválido.' using errcode = '22023';
  end if;

  -- Textos: remove os caracteres que poderiam formar código na tela
  v_plano := regexp_replace(p_plano::text, '[<>`]', '', 'g')::jsonb;

  if exists (
    select 1 from jsonb_array_elements(v_plano) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'id', '') !~ '^[A-Za-z0-9_-]{1,64}$'
        or coalesce(e->>'pilar', '') !~ '^[a-z_]{0,30}$'
        or coalesce(e->>'status', 'Não iniciado') not in ('Não iniciado', 'Em andamento', 'Concluído')
        or coalesce(e->>'progresso', '0') !~ '^[0-9]{1,3}(\.[0-9]+)?$'
        or coalesce(e->>'relFmt', '') not in ('', 'lista', 'kanban')
        or coalesce(e->>'when', '')        !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        or coalesce(e->>'inicio', '')      !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
        or coalesce(e->>'concluidoEm', '') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
  ) then
    raise exception 'Plano inválido.' using errcode = '22023';
  end if;

  -- O painel guarda a clínica pela própria chave (id do cliente)
  v_chave := v_cli::text;

  -- Somente a ELOGA exclui demandas ou troca o pilar vinculado
  select data -> 'clients' -> v_chave -> 'plano' into v_atual
    from public.action_plans where client_id = v_cli;
  if jsonb_typeof(v_atual) = 'array' then
    if exists (select 1 from jsonb_array_elements(v_atual) a
                where not exists (select 1 from jsonb_array_elements(v_plano) n where n->>'id' = a->>'id')) then
      raise exception 'Somente a ELOGA pode excluir demandas do plano.' using errcode = '42501';
    end if;
    if exists (select 1 from jsonb_array_elements(v_atual) a join jsonb_array_elements(v_plano) n on n->>'id' = a->>'id'
                where coalesce(n->>'pilar', '') is distinct from coalesce(a->>'pilar', '')) then
      raise exception 'Somente a ELOGA pode alterar o pilar da demanda.' using errcode = '42501';
    end if;
  end if;

  update public.action_plans
     set data = jsonb_set(data, array['clients', v_chave, 'plano'], v_plano), updated_at = now()
   where client_id = v_cli and (data -> 'clients') ? v_chave;
  if not found then
    raise exception 'Plano não encontrado. Peça à ELOGA para abrir o plano uma vez.' using errcode = 'P0002';
  end if;

  update public.action_plan_views
     set dados = jsonb_set(dados, array['clients', v_chave, 'plano'], v_plano), updated_at = now()
   where client_id = v_cli and (dados -> 'clients') ? v_chave;

  if not exists (select 1 from public.audit_log
                  where client_id = v_cli and action = 'cliente.plano_editado'
                    and at > now() - interval '15 minutes') then
    perform app.audit_insert('cliente.plano_editado', 'action_plans', v_chave, v_cli,
                             jsonb_build_object('acoes', jsonb_array_length(v_plano)));
  end if;
end $$;

revoke all on function public.cliente_salvar_plano(jsonb) from public, anon;
grant execute on function public.cliente_salvar_plano(jsonb) to authenticated;

revoke all on function public.cliente_salvar_plano(jsonb) from public, anon;
grant execute on function public.cliente_salvar_plano(jsonb) to authenticated;

commit;
