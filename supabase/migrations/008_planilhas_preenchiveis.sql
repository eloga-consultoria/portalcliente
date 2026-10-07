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
