# Dicionário de dados — núcleo financeiro v1

## Convenções

- IDs: `uuid`.
- timestamps: `timestamptz`.
- moeda: `numeric(14,2)`.
- competência/período: `date` normalizado para o primeiro dia do mês.
- `organization_id`: boundary de isolamento da Loja.
- fatos financeiros confirmados: append-only.
- campos de saldo não são persistidos como autoridade.

---

## organizations
Representa a Loja.

Campos principais:
- `id`: PK.
- `name`: nome institucional.
- `number`: número da Loja.
- `orient`: Oriente.
- `obedience`: Potência/Obediência.
- `cnpj`: opcional.
- `status`: `active|inactive`.

---

## organization_settings
Configurações institucionais 1:1.

- `pix_key`
- `phone`
- `email`
- `address`
- `report_texts`
- `logo_path`
- `timezone`

---

## members
Cadastro de integrantes.

- `full_name`
- `preferred_name`
- `degree_or_office`
- `initiation_date`
- `admission_date`
- `cpf`
- `phone`
- `whatsapp`
- `email`
- `notes`
- `status`: `active|inactive|away|disconnected`

Não possui coluna de saldo.

---

## member_user_links
Liga um integrante a um usuário Auth para o futuro Portal do Integrante.

Um usuário só pode representar um integrante por organização.

---

## financial_categories
Categorias configuráveis.

`domain`:
- `member_receivable`
- `institutional_revenue`
- `institutional_expense`

A categoria é configurável; o domínio é uma fronteira arquitetural.

---

## recurring_rules
Regra recorrente lógica.

Exemplo:
`Mensalidade`.

- `category_id`
- `frequency`
- `due_day`
- `active`

---

## recurring_rule_versions
Histórico de preço/vigência.

Exemplo:
- 06/2025–08/2026 = R$130
- 09/2026–... = R$150

Ranges da mesma regra não podem se sobrepor.

---

## recurring_rule_members
Vínculo do integrante com a regra recorrente por vigência.

Ranges do mesmo integrante/regra não podem se sobrepor.

---

## recurring_rule_exceptions
Exceção por integrante e competência.

Tipos:
- `exempt`
- `override_amount`
- `discount_amount`

---

# Núcleo de recebíveis

## charges
Obrigação financeira do integrante.

Campos centrais:
- `member_id`
- `category_id`
- `source_kind`
- `generation_key`
- `description`
- `reference`
- `competence`
- `issue_date`
- `due_date`
- `accounting_period`
- `quantity`
- `unit_amount`
- `original_amount`

`source_kind`:
- `manual`
- `recurring`
- `event`
- `mutual`
- `migration_opening`
- `migration_reconciled`
- `replacement`

Não possui:
- saldo restante;
- valor pago;
- status financeiro persistido.

Esses valores são derivados.

---

## charge_adjustments
Ajusta uma cobrança sem reescrever seu valor original.

`direction`:
- `increase`
- `decrease`

`adjustment_kind`:
- `discount`
- `waiver`
- `credit_correction`
- `debit_correction`

Não pode reduzir o valor efetivo abaixo do total já alocado.

---

## charge_cancellations
Evento único de cancelamento.

Antes de cancelar, alocações ativas devem ser revertidas.

---

## charge_plans
Agrupa cobranças parceladas.

As parcelas reais continuam sendo registros individuais em `charges`.

---

# Créditos do integrante

## payments
Pagamento efetuado pelo integrante.

- `payment_date`
- `accounting_period`
- `amount`
- `payment_method_id`
- `financial_account_id`
- `source_kind`

`source_kind`:
- `operational`: afeta posição do integrante e caixa atual;
- `migration_reconciled`: afeta posição migrada, mas não caixa atual.

Pagamento operacional exige conta financeira.

---

## member_credits
Crédito transferível que não representa pagamento.

Uso esperado:
- crédito de abertura;
- crédito migrado;
- crédito transferível formal.

Não usar para desconto de uma cobrança específica.

---

## receivable_allocations
Relaciona uma fonte de crédito a uma cobrança.

Exatamente uma origem:
- `payment_id`; ou
- `member_credit_id`.

Também carrega `organization_id` e `member_id` para FKs compostas e isolamento estrutural.

---

## allocation_reversals
Reverte uma alocação sem apagá-la.

---

## payment_reversals
Estorno explícito de pagamento.

Só pode ser criado depois da reversão das alocações ativas do pagamento.

---

## member_credit_reversals
Estorno explícito de crédito transferível.

---

# Eventos especializados

## events
Evento/Ágape.

## event_participants
Participante + valor individual + cobrança materializada.

`UNIQUE(event_id, member_id)` evita duplicidade do participante.

## mutual_batches
Faixa de mútuas, valor e competência.

## mutual_assignments
Mútua individual atribuída ao integrante e ligada a uma `charge`.

---

# Caixa e contas

## financial_accounts
Representa onde o dinheiro está.

Não possui saldo atual persistido.

## account_opening_entries
Movimento explícito de abertura/migração da conta.

É imutável.

## funds
Representa finalidade/reserva.

Saldo do fundo será derivado na Fase 2.

---

# Governança

## financial_periods
Identifica uma competência financeira.

Não armazena status.

## period_events
Eventos append-only:
- `close`
- `reopen`

O estado atual do período deriva do último evento.

## audit_logs
Auditoria de negócio.

Append-only.

## idempotency_keys
Controle técnico de retry por organização + usuário + chave.

Não é exposto ao cliente por SELECT.

---

# Legado

## legacy_financial_records
Registro histórico informativo que não participa dos cálculos canônicos.

Uso:
quando um dado legado deve ser preservado, mas não há contexto suficiente para registrá-lo com segurança em `charges/payments/allocations`.

Não altera:
- saldo do integrante;
- caixa;
- views financeiras canônicas.

---

# Views canônicas

## v_charge_balances
Deriva:
- valor efetivo;
- alocado;
- aberto;
- status de liquidação;
- `integrity_ok`.

## v_payment_balances
Deriva:
- alocado;
- crédito disponível;
- estorno;
- `integrity_ok`.

## v_member_credit_balances
Deriva saldo dos créditos transferíveis.

## v_member_financial_position
Deriva:
- recebíveis em aberto;
- crédito de pagamentos;
- outros créditos;
- posição líquida.

## v_member_statement
Extrato cronológico com débito, crédito e saldo acumulado.

Alocações não aparecem como novo débito/crédito porque apenas explicam a liquidação entre fatos já registrados.

## v_member_financial_reconciliation
Compara:
- posição líquida;
- saldo final do extrato.

`reconciled = false` é sinal de erro de integridade/regressão e deve bloquear confiança nos indicadores.
