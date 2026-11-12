#!/usr/bin/env bash
# ==============================================================================
# CorSys Tronco Digital V35 — M05.02: Sequência Reproduzível do Ensaio de Backup & Restore
# PostgreSQL 17 Descartável
#
# Uso:
#   ./scripts/run_v35_m05_backup_restore_trial.sh [SOURCE_CONN] [RESTORE_CONN] [DUMP_FILE]
#
# Exemplos:
#   ./scripts/run_v35_m05_backup_restore_trial.sh "service=v35-fixture-source" "service=v35-fixture-restore"
#   ./scripts/run_v35_m05_backup_restore_trial.sh "postgres://postgres:pwd@127.0.0.1:5432/source_db" "postgres://postgres:pwd@127.0.0.1:5432/restore_db"
# ==============================================================================

set -euo pipefail

SOURCE_CONN="${1:-${SOURCE_CONN:-service=v35-fixture-source}}"
RESTORE_CONN="${2:-${RESTORE_CONN:-service=v35-fixture-restore}}"
DUMP_FILE="${3:-${DUMP_FILE:-v35_m05_trial.dump}}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "=== INICIANDO ENSAIO M05.02: BACKUP & RESTAURAÇÃO EM POSTGRESQL 17 DESCARTÁVEL ==="
log "Origem  : $SOURCE_CONN"
log "Destino : $RESTORE_CONN"
log "Dump    : $DUMP_FILE"

# ------------------------------------------------------------------------------
# ETAPA 1: Sanidade das Conexões
# ------------------------------------------------------------------------------
log "[1/7] Verificando conexões de origem e destino..."
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -c "SELECT current_database() AS source_db, current_user, version();"
psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 -c "SELECT current_database() AS restore_db, current_user, version();"

# ------------------------------------------------------------------------------
# ETAPA 2: Preparação da Base de Origem (Papéis de Cluster, Schema Auth e Users)
# ------------------------------------------------------------------------------
log "[2/7] Preparando pré-requisitos na base descartável de origem..."
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_prepare_source_db.sql

# ------------------------------------------------------------------------------
# ETAPA 3: Aplicação de Todas as Migrations do Repositório na Origem
# ------------------------------------------------------------------------------
log "[3/7] Aplicando migrations do repositório em ordem na origem..."
MIGRATION_COUNT=0
for migration in $(ls -1 supabase/migrations/*.sql | sort); do
  psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f "$migration" > /dev/null
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
done
log "  -> $MIGRATION_COUNT migrations aplicadas com sucesso na base de origem."

# ------------------------------------------------------------------------------
# ETAPA 4: Carga da Fixture Sintética e Execução dos Checks de Origem (Baseline)
# ------------------------------------------------------------------------------
log "[4/7] Carregando fixture sintética de 2 Lojas e executando checks na origem..."
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_fixture_seed.sql

log "  -> Executando scripts/v35_m05_backup_verify_checks.sql na origem..."
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql > source_checks.log 2>&1
cat source_checks.log

if ! grep -q "V35_M0502_VERIFICATION_PASS" source_checks.log; then
  echo "ERRO CRÍTICO: Checks falharam na base de origem! Inspecione source_checks.log."
  exit 1
fi
log "  -> Origem validada e aprovada com V35_M0502_VERIFICATION_PASS."

# ------------------------------------------------------------------------------
# ETAPA 5: Geração do Dump Completo da Origem (pg_dump)
# ------------------------------------------------------------------------------
log "[5/7] Gerando dump customizado da base de origem (pg_dump)..."
pg_dump --dbname="$SOURCE_CONN" --format=custom --file="$DUMP_FILE"
pg_restore --list "$DUMP_FILE" > dump_toc.txt
log "  -> Dump gerado: $DUMP_FILE ($(ls -lh "$DUMP_FILE" | awk '{print $5}'))"

# ------------------------------------------------------------------------------
# ETAPA 6: Preparação dos Papéis do Servidor no Destino e Restauração Completa
# ------------------------------------------------------------------------------
log "[6/7] Garantindo papéis de cluster no destino e restaurando dump..."
# O destino deve ser vazio com os papéis do servidor disponíveis.
# O dump recria os schemas (public, private, auth, extensions), tabelas, policies e dados.
psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 << 'EOF'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
  GRANT anon, authenticated, service_role TO authenticator;
END $$;
EOF

log "  -> Executando pg_restore em transação única no destino vazio..."
pg_restore --dbname="$RESTORE_CONN" --exit-on-error --single-transaction "$DUMP_FILE"
log "  -> Restauração concluída com sucesso."

# ------------------------------------------------------------------------------
# ETAPA 7: Execução dos Mesmos Checks no Destino e Comparação Estrita
# ------------------------------------------------------------------------------
log "[7/7] Executando os mesmos checks no destino restaurado e comparando saídas..."
psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql > restore_checks.log 2>&1
cat restore_checks.log

if ! grep -q "V35_M0502_VERIFICATION_PASS" restore_checks.log; then
  echo "ERRO CRÍTICO: Checks falharam na base restaurada! Inspecione restore_checks.log."
  exit 1
fi

log "  -> Comparando diff entre source_checks.log e restore_checks.log..."
if diff -u source_checks.log restore_checks.log > checks_diff.log; then
  log "SUCESSO: As saídas de verificação da origem e da base restaurada são IDÊNTICAS!"
else
  log "AVISO: Diferenças encontradas entre a saída da origem e do restore. Verifique checks_diff.log:"
  cat checks_diff.log
  exit 1
fi

log "=== ENSAIO M05.02 CONCLUÍDO COM SUCESSO: ORIGEM E RESTORE 100% EQUIVALENTES ==="
