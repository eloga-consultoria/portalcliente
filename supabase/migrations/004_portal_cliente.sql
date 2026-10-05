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
