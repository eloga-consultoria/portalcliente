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
