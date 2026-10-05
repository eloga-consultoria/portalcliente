#!/usr/bin/env bash
# Sobe um PostgreSQL TEMPORÁRIO e local, aplica as migrations e testa as regras de acesso.
# Não se conecta ao Supabase. Uso: bash tests/banco/rodar.sh
set -euo pipefail
# O PostgreSQL não roda como root: em contêiner, reexecuta como usuário postgres.
if [ "$(id -u)" = 0 ]; then exec su postgres -s /bin/bash -c "bash \"$0\""; fi
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DIR="$(mktemp -d)"; PORTA=$((20000 + RANDOM % 20000))
trap '$BIN/pg_ctl -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$BIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORTA -k $DIR" -l "$DIR/log" start >/dev/null
P="psql -h $DIR -p $PORTA -U postgres -q -v ON_ERROR_STOP=1"
$P -c "create database teste"
for f in tests/banco/supabase-imitacao.sql supabase/teste/base_minima_SOMENTE_PROJETO_TESTE.sql supabase/migrations/00[1-9]*.sql supabase/migrations/00[1-9]*.sql; do
  $P -d teste -f "$RAIZ/$f" >/dev/null 2>&1 || { echo "FALHOU: $f"; $P -d teste -f "$RAIZ/$f"; exit 1; }
done
echo "Migrations aplicadas (duas vezes, para provar que podem ser repetidas)."
psql -h "$DIR" -p $PORTA -U postgres -d teste -f "$RAIZ/tests/banco/regras-de-acesso.sql" 2>&1 | grep -v '^SET\|^RESET\|^INSERT\|^$'
