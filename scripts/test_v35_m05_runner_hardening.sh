#!/usr/bin/env bash
# ==============================================================================
# CorSys Tronco Digital V35 — Teste de Validação de Hardening do Runner M05.02
# Testa guardas de segurança para origem e destino, higienização e fail-closed
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUNNER="$ROOT_DIR/scripts/run_v35_m05_backup_restore_trial.sh"
TEST_TMP_DIR="$(mktemp -d /tmp/v35_test_hardening_XXXXXX)"
trap 'rm -rf "$TEST_TMP_DIR"' EXIT

echo "=== INICIANDO TESTES DE SEGURANÇA E HARDENING DO RUNNER M05.02 ==="

PASS_COUNT=0
FAIL_COUNT=0

assert_pass() {
  local name="$1"
  echo "  [PASS] $name"
  PASS_COUNT=$((PASS_COUNT + 1))
}

assert_fail() {
  local name="$1"
  local reason="$2"
  echo "  [FAIL] $name: $reason"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# ------------------------------------------------------------------------------
# TESTE 1: Higienização de senhas em URLs e strings de conexão
# ------------------------------------------------------------------------------
echo "--- TESTE 1: Higienização de Senhas (sanitize_conn) ---"

TEST_DSN_1="postgres://postgres:SuperSecretPassword123@127.0.0.1:5432/my_restore_trial"
TEST_DSN_2="postgresql://app_user:AnotherSecret@db.example.com:5432/test_db?sslmode=require"
TEST_DSN_3="host=localhost port=5432 dbname=v35_restore_trial user=postgres password=MyP@ssw0rd! connect_timeout=10"

OUTPUT_1="$(bash -c "source <(sed -n '/sanitize_conn() {/,/^}/p' '$RUNNER'); sanitize_conn '$TEST_DSN_1'")"
OUTPUT_2="$(bash -c "source <(sed -n '/sanitize_conn() {/,/^}/p' '$RUNNER'); sanitize_conn '$TEST_DSN_2'")"
OUTPUT_3="$(bash -c "source <(sed -n '/sanitize_conn() {/,/^}/p' '$RUNNER'); sanitize_conn '$TEST_DSN_3'")"

if [[ "$OUTPUT_1" == "postgres://postgres:***@127.0.0.1:5432/my_restore_trial" ]] && \
   [[ "$OUTPUT_2" == "postgresql://app_user:***@db.example.com:5432/test_db?sslmode=require" ]] && \
   [[ "$OUTPUT_3" == *"password=***"* ]] && ! echo "$OUTPUT_3" | grep -q "MyP@ssw0rd!"; then
  assert_pass "Senhas completamente ofuscadas em DSNs de URL e chave-valor"
else
  assert_fail "Higienização de senhas falhou" "Saídas: $OUTPUT_1 | $OUTPUT_2 | $OUTPUT_3"
fi

# ------------------------------------------------------------------------------
# TESTE 2: Rejeição de Origem ou Destino com Identificadores Proibidos (Produção)
# ------------------------------------------------------------------------------
echo "--- TESTE 2: Rejeição de Origem/Destino com Palavras Proibidas ---"

PROD_TARGETS=(
  "postgres://user:pwd@db.szqkdekwhzxsoxorgvaz.supabase.co:5432/postgres"
  "postgres://user:pwd@10.0.0.1:5432/corsys_prod"
  "host=db.internal dbname=corsys_production user=admin password=sec"
  "service=v35-live-cluster"
)

for target in "${PROD_TARGETS[@]}"; do
  # Testar como destino
  set +e
  OUT_DST="$("$RUNNER" "service=v35-fixture-source" "$target" 2>&1)"
  EXIT_DST=$?
  # Testar como origem
  OUT_SRC="$("$RUNNER" "$target" "service=v35-fixture-restore" 2>&1)"
  EXIT_SRC=$?
  set -e

  if [[ $EXIT_DST -ne 0 ]] && echo "$OUT_DST" | grep -q "ERRO DE SEGURANÇA CRÍTICO: Destino contém identificadores de produção" && \
     [[ $EXIT_SRC -ne 0 ]] && echo "$OUT_SRC" | grep -q "ERRO DE SEGURANÇA CRÍTICO: Origem contém identificadores de produção"; then
    assert_pass "Origem e Destino proibidos rejeitados com sucesso: $target"
  else
    assert_fail "Alvo proibido não foi rejeitado devidamente" "Target: $target, ExitDst: $EXIT_DST, ExitSrc: $EXIT_SRC"
  fi
done

# ------------------------------------------------------------------------------
# TESTE 3: Rejeição de Origem e Destino Sem Indicador Descartável Sem Confirmação
# ------------------------------------------------------------------------------
echo "--- TESTE 3: Rejeição de Alvos Sem Indicador Descartável Sem Confirmação ---"

REGULAR_TARGET="postgres://user:pwd@127.0.0.1:5432/regular_database"

set +e
OUT_SRC_UN="$(CONFIRM_DISPOSABLE_SOURCE=false CONFIRM_DISPOSABLE_TARGET=true "$RUNNER" "$REGULAR_TARGET" "service=v35-fixture-restore" 2>&1)"
EXIT_SRC_UN=$?
OUT_DST_UN="$(CONFIRM_DISPOSABLE_SOURCE=true CONFIRM_DISPOSABLE_TARGET=false "$RUNNER" "service=v35-fixture-source" "$REGULAR_TARGET" 2>&1)"
EXIT_DST_UN=$?
set -e

if [[ $EXIT_SRC_UN -ne 0 ]] && echo "$OUT_SRC_UN" | grep -q "ERRO DE SEGURANÇA: Origem .* não possui identificador padrão" && \
   [[ $EXIT_DST_UN -ne 0 ]] && echo "$OUT_DST_UN" | grep -q "ERRO DE SEGURANÇA: Destino .* não possui identificador padrão"; then
  assert_pass "Origem e Destino não descartáveis rejeitados quando flags de confirmação são false"
else
  assert_fail "Alvo não descartável deveria ter sido rejeitado" "SrcExit: $EXIT_SRC_UN, DstExit: $EXIT_DST_UN"
fi

# ------------------------------------------------------------------------------
# TESTE 4: Rejeição Quando Origem e Destino Apontam Para a Mesma Base (Simulação)
# ------------------------------------------------------------------------------
echo "--- TESTE 4: Rejeição de Origem e Destino Idênticos (Simulação via Mock) ---"

MOCK_BIN_DIR="$TEST_TMP_DIR/bin"
mkdir -p "$MOCK_BIN_DIR"

cat << 'MOCK_EOF' > "$MOCK_BIN_DIR/psql"
#!/usr/bin/env bash
if [[ "$*" == *"SELECT coalesce(inet_server_addr()::text"* ]]; then
  echo "127.0.0.1|5432|same_db|postgres"
  exit 0
fi
exit 0
MOCK_EOF
chmod +x "$MOCK_BIN_DIR/psql"

set +e
OUT="$(PATH="$MOCK_BIN_DIR:$PATH" CONFIRM_DISPOSABLE_SOURCE=true CONFIRM_DISPOSABLE_TARGET=true "$RUNNER" "postgres://user:pwd@127.0.0.1:5432/same_db" "postgres://user:pwd@127.0.0.1:5432/same_db" 2>&1)"
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]] && echo "$OUT" | grep -q "ERRO DE SEGURANÇA CRÍTICO: Origem e Destino apontam para a mesma base de dados"; then
  assert_pass "Origem e Destino idênticos sumariamente rejeitados"
else
  assert_fail "Falha ao rejeitar origem e destino idênticos" "Exit: $EXIT_CODE, Out: $OUT"
fi

# ------------------------------------------------------------------------------
# TESTE 5: Rejeição Quando a Base de Destino Não Está Vazia (Simulação)
# ------------------------------------------------------------------------------
echo "--- TESTE 5: Rejeição de Destino Não Vazio (Simulação via Mock) ---"

cat << 'MOCK_EOF' > "$MOCK_BIN_DIR/psql"
#!/usr/bin/env bash
if [[ "$*" == *"SELECT coalesce(inet_server_addr()::text"* ]]; then
  if [[ "$*" == *"source"* ]]; then
    echo "127.0.0.1|5432|v35_source|postgres"
  else
    echo "127.0.0.1|5432|v35_restore_trial|postgres"
  fi
  exit 0
fi
if [[ "$*" == *"SELECT count(*)"* && "$*" == *"pg_class"* ]]; then
  echo "42"
  exit 0
fi
exit 0
MOCK_EOF

set +e
OUT="$(PATH="$MOCK_BIN_DIR:$PATH" CONFIRM_DISPOSABLE_SOURCE=true CONFIRM_DISPOSABLE_TARGET=true "$RUNNER" "postgres://user:pwd@127.0.0.1:5432/v35_source" "postgres://user:pwd@127.0.0.1:5432/v35_restore_trial" 2>&1)"
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]] && echo "$OUT" | grep -q "ERRO DE SEGURANÇA CRÍTICO: A base de destino .* NÃO está vazia! Foram encontrados 42 objetos"; then
  assert_pass "Destino não vazio rejeitado antes de qualquer modificação"
else
  assert_fail "Destino não vazio deveria ter sido rejeitado" "Exit: $EXIT_CODE, Out: $OUT"
fi

# ------------------------------------------------------------------------------
# TESTE 6: Permissões de Saída e Proteção dos Artefatos
# ------------------------------------------------------------------------------
echo "--- TESTE 6: Permissões do Diretório de Artefatos (umask 077 / chmod 700) ---"

MOCK_OUT_DIR="$TEST_TMP_DIR/artifacts_test"
export OUTPUT_DIR="$MOCK_OUT_DIR"

set +e
CONFIRM_DISPOSABLE_SOURCE=false CONFIRM_DISPOSABLE_TARGET=false "$RUNNER" "postgres://u:p@127.0.0.1:5432/src" "postgres://u:p@127.0.0.1:5432/invalid" >/dev/null 2>&1 || true
set -e

if [[ -d "$MOCK_OUT_DIR" ]]; then
  PERMS="$(stat -c '%a' "$MOCK_OUT_DIR" 2>/dev/null || stat -f '%A' "$MOCK_OUT_DIR" 2>/dev/null || echo "unknown")"
  if [[ "$PERMS" == "700" || "$PERMS" == *rwx------* ]]; then
    assert_pass "Diretório de saída criado com permissões restritas 700 ($PERMS)"
  else
    assert_fail "Diretório de saída criado com permissões inseguras" "Perms: $PERMS"
  fi
else
  assert_fail "Diretório de saída não foi criado" ""
fi

# ------------------------------------------------------------------------------
# RESUMO FINAL DOS TESTES
# ------------------------------------------------------------------------------
echo ""
echo "=== RESUMO DA VALIDAÇÃO DO RUNNER M05.02 ==="
echo "Total de Asserções Aprovadas : $PASS_COUNT"
echo "Total de Falhas              : $FAIL_COUNT"

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "SUCESSO: Todas as guardas de segurança e proteções fail-closed para origem e destino foram validadas!"
  exit 0
else
  echo "ERRO: Ocorreram falhas nos testes de segurança!"
  exit 1
fi
