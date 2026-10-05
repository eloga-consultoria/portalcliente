-- =====================================================================
-- 005 · COMPATIBILIDADE COM O PORTAL ANTIGO
-- O projeto oficial já tem tabelas criadas pelo HTML antigo (levantadas por
-- inspeção somente leitura em 05/10/2026). Esta migration:
-- • ajusta operational_diagnoses e action_plans ao portal novo sem perder dados
--   (o conteúdo antigo do plano fica guardado em legacy_data);
-- • fecha as tabelas e o bucket que o portal novo não usa (client_modules,
--   client_materials, strategies, client-materials): só admin com 2FA acessa;
-- • tira do visitante anônimo (anon) qualquer acesso direto às tabelas.
-- Não apaga linhas nem tabelas. Idempotente. Em projeto novo, só não encontra
-- o que ajustar.
-- =====================================================================
begin;

-- Diagnóstico operacional: data do último PDF e status padronizado
alter table public.operational_diagnoses add column if not exists report_issued_at timestamptz;
alter table public.operational_diagnoses drop constraint if exists operational_diagnoses_status_check;
update public.operational_diagnoses set status = 'draft'     where status = 'rascunho';
update public.operational_diagnoses set status = 'completed' where status = 'concluido';
alter table public.operational_diagnoses add constraint operational_diagnoses_status_check
  check (status in ('draft','completed','archived'));

-- Plano de ação: o formato antigo ({"items": [...]}) é guardado em legacy_data
-- e o campo data passa a receber o Painel Mestre PDCA.
alter table public.action_plans add column if not exists legacy_data jsonb;
update public.action_plans
   set legacy_data = data, data = '{}'::jsonb
 where legacy_data is null and data ? 'items' and not data ? 'clients';
alter table public.action_plans alter column data set default '{}'::jsonb;

-- Tabelas antigas que o portal novo não usa: somente admin com 2FA
do $$ declare t text; r record; begin
  foreach t in array array['client_modules','client_materials','strategies'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t || '_somente_admin', t);
  end loop;
end $$;

-- Bucket antigo de materiais: somente admin com 2FA (os novos ficam no bucket "materiais")
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and (qual like '%client-materials%' or with_check like '%client-materials%')
  loop execute format('drop policy %I on storage.objects', r.policyname); end loop;
  if exists (select 1 from storage.buckets where id = 'client-materials') then
    create policy client_materials_antigo_admin on storage.objects for all to authenticated
      using (bucket_id = 'client-materials' and app.is_admin()) with check (bucket_id = 'client-materials' and app.is_admin());
  end if;
end $$;

-- Visitante anônimo não acessa nenhuma tabela diretamente (o login não depende disso)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

commit;
