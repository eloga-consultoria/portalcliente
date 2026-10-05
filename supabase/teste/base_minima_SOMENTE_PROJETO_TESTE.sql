-- =====================================================================
-- BASE MÍNIMA · USAR SOMENTE EM UM PROJETO SUPABASE DE TESTE (VAZIO)
--
-- O projeto oficial já tem as tabelas clients, profiles e assessments.
-- Um projeto de teste novo não tem. Este arquivo cria só o esqueleto
-- dessas três tabelas para que as migrations 001 a 004 possam ser testadas.
--
-- NUNCA rode este arquivo no projeto oficial (produção).
-- Ele não apaga nada (usa "if not exists"), mas não é necessário lá.
-- =====================================================================
begin;

create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique,
  segment           text,
  city              text,
  is_active         boolean not null default true,
  access_email      text,
  access_expires_at timestamptz,
  logo_url          text
);

create table if not exists public.profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  role      text not null default 'client' check (role in ('admin','client')),
  client_id uuid references public.clients(id) on delete cascade
);

create table if not exists public.assessments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  created_by       uuid default auth.uid(),
  status           text not null default 'draft',
  progress_percent int  not null default 0,
  responses        jsonb not null default '{}'::jsonb,
  schema_version   text,
  submitted_at     timestamptz
);

commit;
