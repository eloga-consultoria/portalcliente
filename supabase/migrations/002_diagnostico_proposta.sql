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
