# ADR 0021 — Política de aprovação de despesas com vigência

Status: DEV only, 2026-10-10.

## Contexto
O esquema V35 já fornece `expense_approval_policies`, `private.current_expense_approval_policy`, `publish_expense_approval_policy`, restrição EXCLUDE para vigências publicadas, e decisões imutáveis. Faltava um comando autorizado e interface para criar rascunhos e publicar sem habilitar INSERT/UPDATE direto via navegador.

## Decisão
RPCs `create_tenant_approval_policy_draft` e `publish_tenant_approval_policy_idempotent` exigem `approvals.manage`, validam dinheiro/datas/motivo, auditam e usam idempotência do tenant. Não alterar políticas publicadas; sucessão se dá por datas não sobrepostas. UI `ApprovalPolicies` requer publicação explícita e não substitui a fila de votos `PayableApprovals`.

## Consequências e testes
SQL DEV A/B com rollback `DEV_APPROVAL_POLICY_LIFECYCLE_ROLLBACK_PASS`; políticas de 2028 criadas/publicadas temporariamente sem afetar versões existentes de 2030. Anon EXECUTE negado. Não avaliado em HTTP JWT real ou sessão concorrente, nem parametrização de cargos e delegações. PROD bloqueada.

