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
