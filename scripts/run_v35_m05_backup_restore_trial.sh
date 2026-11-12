#!/usr/bin/env bash
# ==============================================================================
# CorSys Tronco Digital V35 — M05.02: Sequência Reproduzível do Ensaio de Backup & Restore
# PostgreSQL 17 Descartável — Runner Endurecido (Hardening de Segurança)
#
# Uso:
#   ./scripts/run_v35_m05_backup_restore_trial.sh [SOURCE_CONN] [RESTORE_CONN] [DUMP_FILE]
#
# Variáveis de controle operacional e segurança:
#   CONFIRM_DISPOSABLE_TARGET=true   Confirmação explícita para destinos que não contenham sufixo padrão
#   OUTPUT_DIR="/caminho/seguro"     Diretório seguro fora do repositório para dumps e logs (padrão: /tmp ou .tmp/)
#
# Exemplos:
#   ./scripts/run_v35_m05_backup_restore_trial.sh "service=v35-fixture-source" "service=v35-fixture-restore"
#   CONFIRM_DISPOSABLE_TARGET=true ./scripts/run_v35_m05_backup_restore_trial.sh "postgres://user:pwd@127.0.0.1:5432/source_db" "postgres://user:pwd@127.0.0.1:5432/restore_trial_db"
# ==============================================================================

set -euo pipefail

# Criação de arquivos restrita por padrão (0600 para arquivos, 0700 para diretórios)
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ------------------------------------------------------------------------------
# Função de Higienização de Credenciais (Proteção de Segredos em Logs e Erros)
# ------------------------------------------------------------------------------
sanitize_conn() {
  local conn="$1"
  # URL style: postgres[ql]://user:password@host[:port]/db... -> postgresql://user:***@host...
  # Key-value DSN style: password=secret -> password=***
  echo "$conn" \
    | sed -E 's#(postgres(ql)?://[^:]+:)[^@]+@#\1***@#g' \
    | sed -E "s#(password=)[^ ']+#\1***#g"
}

log() {
  echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

SOURCE_CONN="${1:-${SOURCE_CONN:-service=v35-fixture-source}}"
RESTORE_CONN="${2:-${RESTORE_CONN:-service=v35-fixture-restore}}"

# ------------------------------------------------------------------------------
# Diretório Seguro de Artefatos (Fora do Repositório ou em .tmp/ Gitignored)
# ------------------------------------------------------------------------------
if [[ -n "${OUTPUT_DIR:-}" ]]; then
  TRIAL_OUTPUT_DIR="$OUTPUT_DIR"
elif [[ -d "/tmp" && -w "/tmp" ]]; then
  TRIAL_OUTPUT_DIR="/tmp/corsys_v35_m05_trial_$(date '+%Y%m%d_%H%M%S')"
else
  TRIAL_OUTPUT_DIR="${ROOT_DIR}/.tmp/v35_m05_trial_artifacts"
fi

mkdir -p "$TRIAL_OUTPUT_DIR"
chmod 700 "$TRIAL_OUTPUT_DIR"

DUMP_FILE="${3:-${DUMP_FILE:-${TRIAL_OUTPUT_DIR}/v35_m05_trial.dump}}"
SOURCE_CHECKS_LOG="${TRIAL_OUTPUT_DIR}/source_checks.log"
RESTORE_CHECKS_LOG="${TRIAL_OUTPUT_DIR}/restore_checks.log"
DIFF_LOG="${TRIAL_OUTPUT_DIR}/checks_diff.log"
DUMP_TOC_LOG="${TRIAL_OUTPUT_DIR}/dump_toc.txt"

log "=== INICIANDO ENSAIO M05.02: BACKUP & RESTAURAÇÃO EM POSTGRESQL 17 DESCARTÁVEL ==="
log "Origem  : $(sanitize_conn "$SOURCE_CONN")"
log "Destino : $(sanitize_conn "$RESTORE_CONN")"
log "Artefato: $DUMP_FILE"
log "Logs em : $TRIAL_OUTPUT_DIR"

# ------------------------------------------------------------------------------
# ETAPA 1: Pré-validações de Segurança e Sanidade das Conexões (Fail-Closed)
# ------------------------------------------------------------------------------
log "[1/7] Executando verificações de segurança prévias (fail-closed)..."

# 1.1 Proibição de identificadores conhecidos de Produção ou DEV gerenciado
FORBIDDEN_KEYWORDS="prod|production|live|szqkdekwhzxsoxorgvaz|supabase\.co"
SANITIZED_RESTORE="$(sanitize_conn "$RESTORE_CONN")"
if echo "$SANITIZED_RESTORE" | grep -Eiq "($FORBIDDEN_KEYWORDS)"; then
  echo "ERRO DE SEGURANÇA CRÍTICO: Destino contém identificadores de produção ou projeto remoto gerenciado!" >&2
  echo "String sanitizada: $SANITIZED_RESTORE" >&2
  exit 1
fi

# 1.2 Exigência de identificação explícita de ambiente descartável
DISPOSABLE_KEYWORDS="trial|restore|test|temp|fixture|disposable"
if ! echo "$SANITIZED_RESTORE" | grep -Eiq "($DISPOSABLE_KEYWORDS)"; then
  if [[ "${CONFIRM_DISPOSABLE_TARGET:-false}" != "true" ]]; then
    echo "ERRO DE SEGURANÇA: Destino '$SANITIZED_RESTORE' não possui identificador padrão de ambiente descartável ('trial', 'restore', 'fixture', 'test', 'temp')." >&2
    echo "Para confirmar conscientemente este destino descartável de ensaio, defina a variável CONFIRM_DISPOSABLE_TARGET=true." >&2
    exit 1
  fi
fi

# 1.3 Conectividade e extração da identidade efetiva das conexões
SOURCE_IDENTITY="$(psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -At -c "SELECT coalesce(inet_server_addr()::text, 'local_socket'), coalesce(inet_server_port(), 0), current_database(), current_user;" 2>&1)" || {
  echo "ERRO: Falha ao conectar à base de origem: $(sanitize_conn "$SOURCE_CONN")" >&2
  exit 1
}

RESTORE_IDENTITY="$(psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 -At -c "SELECT coalesce(inet_server_addr()::text, 'local_socket'), coalesce(inet_server_port(), 0), current_database(), current_user;" 2>&1)" || {
  echo "ERRO: Falha ao conectar à base de destino: $(sanitize_conn "$RESTORE_CONN")" >&2
  exit 1
}

IFS='|' read -r SRC_ADDR SRC_PORT SRC_DB SRC_USER <<< "$SOURCE_IDENTITY"
IFS='|' read -r DST_ADDR DST_PORT DST_DB DST_USER <<< "$RESTORE_IDENTITY"

log "  -> Identidade Origem: host=$SRC_ADDR, port=$SRC_PORT, db=$SRC_DB, user=$SRC_USER"
log "  -> Identidade Destino: host=$DST_ADDR, port=$DST_PORT, db=$DST_DB, user=$DST_USER"

# 1.4 Bloqueio contra Origem e Destino coincidentes
if [[ "$SRC_ADDR" == "$DST_ADDR" && "$SRC_PORT" == "$DST_PORT" && "$SRC_DB" == "$DST_DB" ]]; then
  echo "ERRO DE SEGURANÇA CRÍTICO: Origem e Destino apontam para a mesma base de dados ($SRC_DB no host $SRC_ADDR:$SRC_PORT)!" >&2
  echo "Operação abortada para evitar corrupção ou sobrescrita acidental da base de origem." >&2
  exit 1
fi

if [[ "$SRC_DB" == "$DST_DB" && "$SRC_ADDR" == "$DST_ADDR" ]]; then
  echo "ERRO DE SEGURANÇA CRÍTICO: Base de origem e destino possuem o mesmo nome ($SRC_DB) no mesmo servidor!" >&2
  exit 1
fi

# 1.5 Confirmação de que o Destino está VAZIO e adequado para restauração
EXISTING_TABLES_COUNT="$(psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 -At -c "
  SELECT count(*)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND c.relkind IN ('r', 'v', 'm', 'p', 'S');
")" || {
  echo "ERRO: Falha ao verificar objetos na base de destino." >&2
  exit 1
}

if [[ "$EXISTING_TABLES_COUNT" -ne 0 ]]; then
  echo "ERRO DE SEGURANÇA CRÍTICO: A base de destino '$DST_DB' NÃO está vazia! Foram encontrados $EXISTING_TABLES_COUNT objetos de usuário." >&2
  echo "O ensaio de restore exige uma base de destino limpa/vazia para garantir idempotência e evitar destruição de dados existentes." >&2
  exit 1
fi
log "  -> Base de destino vazia e adequada para restore confirmada (0 objetos preexistentes)."

# ------------------------------------------------------------------------------
# ETAPA 2: Preparação da Base de Origem (Papéis de Cluster, Schema Auth e Users)
# ------------------------------------------------------------------------------
log "[2/7] Preparando pré-requisitos na base descartável de origem..."
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_prepare_source_db.sql > /dev/null

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
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_fixture_seed.sql > /dev/null

log "  -> Executando scripts/v35_m05_backup_verify_checks.sql na origem..."
psql "$SOURCE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql > "$SOURCE_CHECKS_LOG" 2>&1
chmod 600 "$SOURCE_CHECKS_LOG"
cat "$SOURCE_CHECKS_LOG"

if ! grep -q "V35_M0502_VERIFICATION_PASS" "$SOURCE_CHECKS_LOG"; then
  echo "ERRO CRÍTICO: Checks falharam na base de origem! Inspecione $SOURCE_CHECKS_LOG." >&2
  exit 1
fi
log "  -> Origem validada e aprovada com V35_M0502_VERIFICATION_PASS."

# ------------------------------------------------------------------------------
# ETAPA 5: Geração do Dump Completo da Origem (pg_dump)
# ------------------------------------------------------------------------------
log "[5/7] Gerando dump customizado da base de origem (pg_dump)..."
pg_dump --dbname="$SOURCE_CONN" --format=custom --file="$DUMP_FILE"
chmod 600 "$DUMP_FILE"
pg_restore --list "$DUMP_FILE" > "$DUMP_TOC_LOG"
chmod 600 "$DUMP_TOC_LOG"

DUMP_SIZE="$(ls -lh "$DUMP_FILE" | awk '{print $5}')"
DUMP_SHA256="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
log "  -> Dump gerado: $DUMP_FILE (Tamanho: $DUMP_SIZE, SHA-256: $DUMP_SHA256)"

# ------------------------------------------------------------------------------
# ETAPA 6: Preparação dos Papéis do Servidor no Destino e Restauração Completa
# ------------------------------------------------------------------------------
log "[6/7] Garantindo papéis de cluster no destino e restaurando dump..."
# O destino deve ser vazio com os papéis do servidor disponíveis.
# O dump recria os schemas (public, private, auth, extensions), tabelas, policies e dados.
psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 << 'EOF' > /dev/null
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
psql "$RESTORE_CONN" -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql > "$RESTORE_CHECKS_LOG" 2>&1
chmod 600 "$RESTORE_CHECKS_LOG"
cat "$RESTORE_CHECKS_LOG"

if ! grep -q "V35_M0502_VERIFICATION_PASS" "$RESTORE_CHECKS_LOG"; then
  echo "ERRO CRÍTICO: Checks falharam na base restaurada! Inspecione $RESTORE_CHECKS_LOG." >&2
  exit 1
fi

log "  -> Comparando diff entre checks da origem e do restore..."
if diff -u "$SOURCE_CHECKS_LOG" "$RESTORE_CHECKS_LOG" > "$DIFF_LOG"; then
  log "SUCESSO: As saídas de verificação da origem e da base restaurada são IDÊNTICAS!"
else
  echo "AVISO: Diferenças encontradas entre a saída da origem e do restore. Verifique $DIFF_LOG:" >&2
  cat "$DIFF_LOG" >&2
  exit 1
fi

chmod 600 "$DIFF_LOG"

log "=== ENSAIO M05.02 CONCLUÍDO COM SUCESSO: ORIGEM E RESTORE 100% EQUIVALENTES ==="
log "Evidências preservadas para auditoria em: $TRIAL_OUTPUT_DIR"
log "  - Dump       : $DUMP_FILE (SHA-256: $DUMP_SHA256)"
log "  - Checks Orig: $SOURCE_CHECKS_LOG"
log "  - Checks Rest: $RESTORE_CHECKS_LOG"
log "  - Diff       : $DIFF_LOG"
