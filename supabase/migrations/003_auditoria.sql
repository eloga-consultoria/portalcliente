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
    if p_action not in ('sessao.login','sessao.logout','sessao.expirada','acesso.negado','mfa.ativado') then
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
