# Conflitos HTTP — inventário DEV 2026-10-16

Consulta read-only de pg_proc/pg_get_functiondef encontrou40001 em13 funções.
A presença textual exige revisão por caso; não prova por si timeout em todos.
A recorrência institucional foi corrigida em57/58 e HTTP A passou; B pendente.
Não mudar migrations já aplicadas nem converter falhas reais de serialização
em conflito de negócio sem avaliar locks/retry/consumidores e regressões.

## Próximo lote

- correct_tenant_institutional_obligation_idempotent
- create_master_promotion_successor_idempotent
- generate_monthly_member_charges
- publish_tenant_budget
- publish_validated_accounting_plan
- reverse_tenant_institutional_movement
- save_member_profile
- save_tenant_identity
- schedule_tenant_monthly_price
- set_draft_accounting_mapping
- set_tenant_budget_line
- set_treasury_catalog_status
- transition_member_term

Prioridade: comandos financeiros e preview/optimistic lock. Aceite: rejeição HTTP
explícita e limitada, nenhum efeito persistido indevido, atualização da UI para
nova prévia, SQL rollback, duas identidades reais e concorrência quando pertinente.
Cadastro de conflitos não significa remediação concluída. Outros fluxos/lotes V35
permanecem sujeitos ao inventário e referência HTML original.

Fonte oficial: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
