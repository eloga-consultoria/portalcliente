-- =====================================================================
-- 011 · "PING" PARA MANTER O PROJETO ATIVO (plano gratuito do Supabase)
-- O Supabase pausa o projeto sem atividade no banco. A ação do GitHub
-- "Manter portal ativo" chama esta função todo dia. Ela só devolve a hora:
-- não lê nem grava nenhum dado.
-- Sem remoções. Idempotente.
-- =====================================================================
begin;

create or replace function public.ping() returns timestamptz
language sql stable security invoker set search_path = '' as $$ select now() $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

commit;
