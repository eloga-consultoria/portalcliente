#!/usr/bin/env bash
# Junta a réplica (só teste) e as migrations 001-005 em um arquivo para colar de uma vez no SQL Editor.
set -euo pipefail
cd "$(dirname "$0")/../.."
{
  echo "-- ARQUIVO ÚNICO · SOMENTE PROJETO DE TESTE (eloga-portal-teste)"
  echo "-- Gerado por tests/banco/montar-arquivo-unico.sh. NUNCA rode no projeto oficial."
  for f in supabase/teste/replica_estrutura_oficial_SOMENTE_TESTE.sql supabase/migrations/00[1-7]*.sql; do
    printf '\n-- ================= %s =================\n' "$f"; cat "$f"
  done
} > supabase/teste/TUDO_PROJETO_TESTE.sql
echo "gerado: supabase/teste/TUDO_PROJETO_TESTE.sql"
