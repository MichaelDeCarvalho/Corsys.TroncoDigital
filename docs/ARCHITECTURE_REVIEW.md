# Revisão arquitetural consolidada

## Correções incorporadas após a revisão

### 1. Competência normalizada
Campos de competência e período contábil são `date` e devem representar o primeiro dia do mês.

Exemplo:

```text
09/2026 -> 2026-09-01
```

Isso evita strings ambíguas e facilita ordenação, filtros e constraints.

### 2. Pagamentos históricos não inflam caixa
`payments.source_kind` diferencia:

- `operational`: pagamento do sistema atual e entrada real em conta/caixa;
- `migration_reconciled`: histórico importado, preservado para rastreabilidade, mas não contado como entrada atual.

Pagamento operacional exige `financial_account_id`.

### 3. Desconto não é crédito transferível
`charge_adjustments` trata:

- desconto;
- isenção;
- correção de débito;
- correção de crédito vinculada à cobrança.

`member_credits` fica reservado para crédito transferível do integrante, como saldo credor migrado ou crédito administrativo formal não vinculado a uma cobrança específica.

### 4. Fechamento é append-only
O estado fechado/aberto de um período deriva do último registro em `period_events`.

Não existe um `status` financeiro que precise ser sincronizado manualmente.

### 5. Integridade cross-tenant
Entidades financeiras carregam `organization_id` e `member_id` quando necessário e usam FKs compostas para impedir que uma alocação ligue registros de organizações ou integrantes diferentes.

### 6. Mutações financeiras diretas bloqueadas
Tabelas financeiras confirmadas têm trigger de imutabilidade contra `UPDATE`/`DELETE`.

A aplicação deve criar correções por eventos novos.

### 7. Views não escondem erro de integridade
As views calculam `integrity_ok`.

Se um estado impossível for introduzido por operação privilegiada indevida, a leitura não "corrige" silenciosamente o saldo com `greatest(0, ...)`.

### 8. RLS e grants separados
O schema usa:

- grants mínimos;
- RLS;
- helpers de autorização;
- views `security_invoker`.

### 9. Idempotência em duas camadas
Há:

- `generation_key` para geração determinística de cobranças;
- `idempotency_keys` para retry de comandos.

### 10. Caixa e recebíveis permanecem separados
Cobrança nunca aumenta saldo bancário.
Somente movimento real de caixa altera conta financeira.


## Regra de migração histórica

Um pagamento legado só entra em `payments` como `migration_reconciled` quando há contexto suficiente para que ele participe corretamente da posição financeira migrada — normalmente com suas cobranças/alocações correspondentes.

Se o dado antigo for apenas informativo e não puder ser reconciliado com segurança, ele entra em `legacy_financial_records`.

`legacy_financial_records` é **non-posting**:

- não altera saldo do integrante;
- não altera caixa;
- não entra nas views canônicas de saldo;
- permanece disponível para consulta/auditoria da migração.
