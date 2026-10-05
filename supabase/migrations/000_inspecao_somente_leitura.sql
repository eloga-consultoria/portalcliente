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
