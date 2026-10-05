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
