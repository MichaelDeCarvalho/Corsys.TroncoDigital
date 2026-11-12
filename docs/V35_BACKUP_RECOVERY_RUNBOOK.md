# V35 — Ensaio de Backup e Restauração (Runbook M05.02)

> **Status:** PREPARADO (Scripts executáveis de bootstrap, carga, ensaio e asserções entregues)  
> **Homologação:** PENDENTE_EVIDENCIA_EXECUCAO_OBSERVADA (A ser verificado após execução do restore)  
> **Ambiente:** PostgreSQL 17 descartável isolado / Cluster CI

---

## 1. Arquitetura do Ensaio: Origem vs. Destino Vazio

O ensaio reproduzível de backup e restauração opera entre dois bancos de dados descartáveis em um cluster PostgreSQL 17:

1. **Base de Origem (`v35-fixture-source`)**:
   - É preparada a partir do script `scripts/v35_m05_prepare_source_db.sql` (criação dos papéis de cluster, schema `auth`, tabela `auth.users` e funções mínimas).
   - Recebe a aplicação de todas as migrations do repositório (`supabase/migrations/*.sql`) em ordem cronológica.
   - Recebe a carga da fixture sintética de 2 Lojas via `scripts/v35_m05_fixture_seed.sql`.
   - Executa a suíte de asserções `scripts/v35_m05_backup_verify_checks.sql`, gerando o log de baseline (`source_checks.log`).
   - É exportada integralmente com `pg_dump --format=custom`.

2. **Base de Destino (`v35-fixture-restore`)**:
   - É criada como um **banco de dados vazio** (`createdb v35-fixture-restore`).
   - Requer apenas que os papéis de nível de servidor/cluster (`anon`, `authenticated`, `service_role`, `authenticator`) estejam presentes no cluster PostgreSQL.
   - **Deixa o dump recriar os schemas e objetos que ele contém**: o arquivo gerado pelo `pg_dump` já inclui as instruções de criação dos schemas (`public`, `private`, `auth`, `extensions`), extensões (`pgcrypto`, `btree_gist`), tabelas, views, triggers, funções, políticas RLS e dados.
   - Restaura o dump com `pg_restore --exit-on-error --single-transaction`.
   - Executa os mesmos checks `scripts/v35_m05_backup_verify_checks.sql`, gerando `restore_checks.log`.
   - As saídas são comparadas com `diff -u source_checks.log restore_checks.log`.

---

## 2. Artefatos Executáveis Entregues

A infraestrutura executável da M05.02 é composta pelos seguintes arquivos:

1. **`scripts/run_v35_m05_backup_restore_trial.sh`**:  
   Runner automatizado que orquestra todo o ensaio (conexões, bootstrap da origem, migrations, fixture, checks pré-dump, pg_dump, restauração no destino vazio, checks pós-restore e comparação diff).
2. **`scripts/v35_m05_prepare_source_db.sql`**:  
   Bootstrap de papéis e schema `auth` / `auth.users` na base de origem antes da aplicação das migrations.
3. **`scripts/v35_m05_fixture_seed.sql`**:  
   Carga determinística de 2 Lojas (Loja A: `00000000-0000-4000-8000-000000000001`, Loja B: `00000000-0000-4000-8000-000000000002`), com identidades, vínculos, contas a pagar em centavos exatos, cobranças, chamados, eventos de trilha (M04.03-C) e logs de auditoria imutáveis.
4. **`scripts/v35_m05_backup_verify_checks.sql`**:  
   Script de 5 blocos com asserções estritas que falham com `RAISE EXCEPTION` sob qualquer divergência de contagem, centavos, integridade referencial ou violação de RLS/projeção.

---

## 3. Roteiro Passo a Passo de Execução

### Opção A: Execução Automatizada via Script Runner
```bash
# Executa todo o fluxo (origem -> migrations -> fixture -> dump -> restore no destino vazio -> checks -> diff)
chmod +x scripts/run_v35_m05_backup_restore_trial.sh
./scripts/run_v35_m05_backup_restore_trial.sh "service=v35-fixture-source" "service=v35-fixture-restore"
```

### Opção B: Sequência Manual Reproduzível

```bash
# Passo 1: Sanidade das conexões de origem e destino
psql 'service=v35-fixture-source' -X -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();'
psql 'service=v35-fixture-restore' -X -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();'

# Passo 2: Preparação inicial da base de origem
psql 'service=v35-fixture-source' -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_prepare_source_db.sql

# Passo 3: Aplicação de todas as migrations do repositório em ordem na origem
for migration in $(ls -1 supabase/migrations/*.sql | sort); do
  psql 'service=v35-fixture-source' -X -v ON_ERROR_STOP=1 -f "$migration"
done

# Passo 4: Carga da fixture sintética de 2 Lojas na origem
psql 'service=v35-fixture-source' -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_fixture_seed.sql

# Passo 5: Execução dos checks na origem e captura do log de baseline
psql 'service=v35-fixture-source' -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql > source_checks.log 2>&1
cat source_checks.log

# Passo 6: Geração do dump binário completo da origem (pg_dump)
pg_dump --dbname='service=v35-fixture-source' --format=custom --file=v35_m05_trial.dump
pg_restore --list v35_m05_trial.dump > dump_toc.txt

# Passo 7: Garantir papéis do servidor no cluster de destino
psql 'service=v35-fixture-restore' -X -v ON_ERROR_STOP=1 << 'EOF'
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

# Passo 8: Restauração no destino vazio (o dump recria schemas, tabelas e objetos)
pg_restore --dbname='service=v35-fixture-restore' --exit-on-error --single-transaction v35_m05_trial.dump

# Passo 9: Execução dos mesmos checks no destino restaurado e captura do log
psql 'service=v35-fixture-restore' -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql > restore_checks.log 2>&1
cat restore_checks.log

# Passo 10: Comparação estrita entre a origem e o destino
diff -u source_checks.log restore_checks.log
```

---

## 4. Como Comparar e Validar as Duas Saídas

A comparação entre `source_checks.log` e `restore_checks.log` deve atender aos seguintes critérios:

1. **Resultado de Status**: Ambas as saídas devem terminar com a linha:
   ```text
   status
   -----------------------------
   V35_M0502_VERIFICATION_PASS
   (1 row)
   ```
2. **Confirmação dos 5 Blocos**: Ambos os arquivos devem conter exatamente os 5 avisos de sucesso:
   - `NOTICE:  CHECK 1 PASS: Contagens, vínculos FK, valores em centavos e auditoria verificados com sucesso.`
   - `NOTICE:  CHECK 2 PASS: Isolamento e projeção restrita da Loja A verificados com sucesso.`
   - `NOTICE:  CHECK 3 PASS: Isolamento e projeção restrita da Loja B verificados com sucesso.`
   - `NOTICE:  CHECK 4 PASS: Negação anônima (fail-closed) verificada com sucesso.`
   - `NOTICE:  CHECK 5 PASS: Master AAL1 negado e Master AAL2 autorizado com privilégio mínimo.`
3. **Ausência de Diff**: O comando `diff -u source_checks.log restore_checks.log` deve retornar saída vazia (código de saída `0`), provando que a integridade, contagens, centavos e isolamento RLS são 100% idênticos antes e depois da restauração.

---

## 5. Critérios de Homologação

- O ensaio permanece classificado como `PENDENTE_EVIDENCIA_EXECUCAO_OBSERVADA`.
- A microentrega M05.02 transiciona para o estado `VERIFICADO` somente após a execução efetivamente observada em ambiente descartável PostgreSQL 17 real, acompanhada do registro de horários, comandos executados e hashes dos artefatos produzidos.
