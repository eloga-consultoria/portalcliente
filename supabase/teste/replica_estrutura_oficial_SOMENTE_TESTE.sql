-- =====================================================================
-- RÉPLICA DA ESTRUTURA DO PROJETO OFICIAL · SOMENTE PROJETO DE TESTE
--
-- Reproduz as tabelas, regras, funções e gatilhos que o portal antigo criou
-- no projeto oficial (levantados por inspeção somente leitura em 05/10/2026),
-- SEM NENHUM DADO. Serve para testar as migrations 001-005 exatamente no
-- cenário que elas vão encontrar no oficial.
--
-- NUNCA rode este arquivo no projeto oficial.
-- =====================================================================
begin;

create schema if not exists private;

create table if not exists private.admin_allowlist (
  email      text not null primary key,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path to 'public' as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  segment           text,
  city              text,
  instagram         text,
  website           text,
  logo_url          text,
  is_active         boolean not null default true,
  access_expires_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  access_email      text,
  tax_id            text,
  contact_name      text,
  phone             text
);

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  client_id  uuid references public.clients(id) on delete set null,
  full_name  text,
  role       text not null default 'client' check (role = any (array['admin'::text, 'client'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,
  title            text not null default 'Diagnóstico de Posicionamento',
  schema_version   text not null default 'ELOGA_POSICIONAMENTO_V2',
  status           text not null default 'draft' check (status = any (array['draft','submitted','in_review','completed'])),
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  responses        jsonb not null default '{}'::jsonb,
  scores           jsonb not null default '{}'::jsonb,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.strategies (
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null unique references public.assessments(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,
  generated_by          uuid references auth.users(id) on delete set null,
  positioning_statement text, value_proposition text, central_message text, instagram_bio text,
  editorial_matrix      jsonb not null default '[]'::jsonb,
  content_plan          jsonb not null default '[]'::jsonb,
  recommendations       jsonb not null default '{}'::jsonb,
  ai_prompt text, report_notes text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.operational_diagnoses (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null unique references public.clients(id) on delete cascade,
  data              jsonb not null default '{}'::jsonb,
  autodiagnosis     jsonb not null default '{}'::jsonb,
  integral_report   jsonb not null default '{}'::jsonb,
  document_settings jsonb not null default '{}'::jsonb,
  status            text not null default 'draft' check (status = any (array['draft','completed','archived'])),
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  portal_state      jsonb not null default '{}'::jsonb
);

create table if not exists public.client_modules (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  module_key text not null,
  enabled    boolean not null default false,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, module_key)
);

create table if not exists public.action_plans (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null unique references public.clients(id) on delete cascade,
  title             text not null default 'Plano de Ação',
  status            text not null default 'draft' check (status = any (array['draft','active','completed','archived'])),
  progress_percent  integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  visible_to_client boolean not null default false,
  data              jsonb not null default '{"items": []}'::jsonb,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  dashboard_data    jsonb not null default '{}'::jsonb,
  swot_data         jsonb not null default '{"forcas": [], "ameacas": [], "fraquezas": [], "oportunidades": []}'::jsonb,
  pillar_diagnosis  jsonb not null default '{}'::jsonb,
  monthly_reports   jsonb not null default '{}'::jsonb,
  report_config     jsonb not null default '{}'::jsonb,
  period_start      date,
  period_end        date
);

create table if not exists public.client_materials (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  title             text not null,
  description       text,
  material_type     text not null default 'link' check (material_type = any (array['link','file'])),
  external_url      text, storage_path text, file_name text, mime_type text,
  visible_to_client boolean not null default false,
  sort_order        integer not null default 0,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- funções antigas
create or replace function private.current_profile_role() returns text
language sql stable security definer set search_path to 'public','private' as $$
  select role from public.profiles where user_id = auth.uid(); $$;
create or replace function private.current_client_id() returns uuid
language sql stable security definer set search_path to 'public','private' as $$
  select client_id from public.profiles where user_id = auth.uid(); $$;
create or replace function private.current_client_access_valid() returns boolean
language sql stable security definer set search_path to 'public','private' as $$
  select exists (select 1 from public.clients c where c.id = private.current_client_id()
    and c.is_active = true and (c.access_expires_at is null or c.access_expires_at > now())); $$;
grant usage on schema private to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public','private' as $$
declare is_admin boolean;
begin
  select exists(select 1 from private.admin_allowlist a where lower(a.email) = lower(new.email)) into is_admin;
  insert into public.profiles(user_id, full_name, role, client_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email,''), '@', 1)),
          case when is_admin then 'admin' else 'client' end, null)
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.seed_default_client_modules() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  insert into public.client_modules (client_id, module_key, enabled) values
    (new.id,'dashboard',true),(new.id,'positioning',false),(new.id,'reports',false),
    (new.id,'materials',false),(new.id,'documents',false),(new.id,'action_plan',false)
  on conflict (client_id,module_key) do nothing;
  return new;
end; $$;

create or replace function public.admin_reset_assessment(p_client_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public','private' as $$
declare v_deleted integer;
begin
  if private.current_profile_role() is distinct from 'admin' then raise exception 'Acesso restrito à administração ELOGA.'; end if;
  delete from public.assessments where client_id = p_client_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok',true,'deleted_assessments',v_deleted);
end; $$;

create or replace function public.admin_delete_client(p_client_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public','private' as $$
begin
  if private.current_profile_role() is distinct from 'admin' then raise exception 'Acesso restrito à administração ELOGA.'; end if;
  update public.profiles set client_id = null where client_id = p_client_id and role = 'client';
  delete from public.clients where id = p_client_id;
  return jsonb_build_object('ok', true);
end; $$;

-- ---------------------------------------------------------------- gatilhos antigos
drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_assessments_updated_at on public.assessments;
create trigger trg_assessments_updated_at before update on public.assessments for each row execute function public.set_updated_at();
drop trigger if exists trg_strategies_updated_at on public.strategies;
create trigger trg_strategies_updated_at before update on public.strategies for each row execute function public.set_updated_at();
drop trigger if exists operational_diagnoses_set_updated_at on public.operational_diagnoses;
create trigger operational_diagnoses_set_updated_at before update on public.operational_diagnoses for each row execute function public.set_updated_at();
drop trigger if exists client_modules_set_updated_at on public.client_modules;
create trigger client_modules_set_updated_at before update on public.client_modules for each row execute function public.set_updated_at();
drop trigger if exists action_plans_set_updated_at on public.action_plans;
create trigger action_plans_set_updated_at before update on public.action_plans for each row execute function public.set_updated_at();
drop trigger if exists client_materials_set_updated_at on public.client_materials;
create trigger client_materials_set_updated_at before update on public.client_materials for each row execute function public.set_updated_at();
drop trigger if exists clients_seed_default_modules on public.clients;
create trigger clients_seed_default_modules after insert on public.clients for each row execute function public.seed_default_client_modules();

-- ---------------------------------------------------------------- RLS antiga
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.strategies enable row level security;
alter table public.operational_diagnoses enable row level security;
alter table public.client_modules enable row level security;
alter table public.action_plans enable row level security;
alter table public.client_materials enable row level security;
grant all on public.clients, public.profiles, public.assessments, public.strategies, public.operational_diagnoses,
  public.client_modules, public.action_plans, public.client_materials to anon, authenticated;

do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public'
            and tablename in ('clients','profiles','assessments','strategies','operational_diagnoses','client_modules','action_plans','client_materials')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy action_plans_admin_manage on public.action_plans for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy action_plans_client_select on public.action_plans for select to authenticated using (client_id = private.current_client_id() and visible_to_client = true and private.current_client_access_valid());
create policy assessments_admin_delete on public.assessments for delete to authenticated using (private.current_profile_role() = 'admin');
create policy assessments_insert_scoped on public.assessments for insert to authenticated with check (private.current_profile_role() = 'admin' or (client_id = private.current_client_id() and private.current_client_access_valid()));
create policy assessments_select_scoped on public.assessments for select to authenticated using (private.current_profile_role() = 'admin' or (client_id = private.current_client_id() and private.current_client_access_valid()));
create policy assessments_update_scoped on public.assessments for update to authenticated
  using (private.current_profile_role() = 'admin' or (client_id = private.current_client_id() and private.current_client_access_valid() and status = 'draft'))
  with check (private.current_profile_role() = 'admin' or (client_id = private.current_client_id() and private.current_client_access_valid() and status = any (array['draft','submitted'])));
create policy client_materials_admin_manage on public.client_materials for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy client_materials_client_select on public.client_materials for select to authenticated using (client_id = private.current_client_id() and visible_to_client = true and private.current_client_access_valid());
create policy client_modules_admin_manage on public.client_modules for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy client_modules_select_own on public.client_modules for select to authenticated using (private.current_profile_role() = 'admin' or (client_id = private.current_client_id() and private.current_client_access_valid()));
create policy clients_admin_manage on public.clients for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy clients_select_scoped on public.clients for select to authenticated using (private.current_profile_role() = 'admin' or id = private.current_client_id());
create policy operational_diagnoses_admin_manage on public.operational_diagnoses for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy profiles_admin_manage on public.profiles for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy profiles_select_scoped on public.profiles for select to authenticated using (private.current_profile_role() = 'admin' or user_id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and role = 'client' and client_id = private.current_client_id());
create policy strategies_admin_manage on public.strategies for all to authenticated using (private.current_profile_role() = 'admin') with check (private.current_profile_role() = 'admin');
create policy strategies_select_scoped on public.strategies for select to authenticated using (private.current_profile_role() = 'admin' or (client_id = private.current_client_id() and private.current_client_access_valid()));

-- ---------------------------------------------------------------- Storage antigo
insert into storage.buckets (id, name, public) values ('client-logos','client-logos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-materials','client-materials', false, 15728640,
        array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do nothing;

drop policy if exists admin_delete_client_logos on storage.objects;
create policy admin_delete_client_logos on storage.objects for delete to authenticated using (bucket_id = 'client-logos' and private.current_profile_role() = 'admin');
drop policy if exists admin_insert_client_logos on storage.objects;
create policy admin_insert_client_logos on storage.objects for insert to authenticated with check (bucket_id = 'client-logos' and private.current_profile_role() = 'admin');
drop policy if exists admin_update_client_logos on storage.objects;
create policy admin_update_client_logos on storage.objects for update to authenticated using (bucket_id = 'client-logos' and private.current_profile_role() = 'admin') with check (bucket_id = 'client-logos' and private.current_profile_role() = 'admin');
drop policy if exists public_read_client_logos on storage.objects;
create policy public_read_client_logos on storage.objects for select to public using (bucket_id = 'client-logos');
drop policy if exists client_materials_storage_admin_all on storage.objects;
create policy client_materials_storage_admin_all on storage.objects for all to authenticated using (bucket_id = 'client-materials' and private.current_profile_role() = 'admin') with check (bucket_id = 'client-materials' and private.current_profile_role() = 'admin');
drop policy if exists client_materials_storage_client_read on storage.objects;
create policy client_materials_storage_client_read on storage.objects for select to authenticated
  using (bucket_id = 'client-materials' and (storage.foldername(name))[1] = private.current_client_id()::text and private.current_client_access_valid()
         and exists (select 1 from public.client_materials m where m.client_id = private.current_client_id() and m.storage_path = objects.name and m.visible_to_client = true));

commit;
