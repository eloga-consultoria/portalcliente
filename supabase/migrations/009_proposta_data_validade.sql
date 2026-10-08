-- =====================================================================
-- 009 · PROPOSTA EMITIDA: PERMITE AJUSTAR DATA DE EMISSÃO E VALIDADE
-- Continua proibido mudar número, cliente e conteúdo. Na cópia registrada
-- (snapshot) só podem mudar proposal.date e proposal.validity.
-- Sem remoções. Idempotente.
-- =====================================================================
begin;

create or replace function app.proposals_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code or new.client_id is distinct from old.client_id
     or (new.snapshot #- '{proposal,date}' #- '{proposal,validity}')
        is distinct from (old.snapshot #- '{proposal,date}' #- '{proposal,validity}') then
    raise exception 'Proposta emitida não pode ser alterada. Emita uma nova versão.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

commit;
