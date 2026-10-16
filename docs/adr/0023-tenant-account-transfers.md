# ADR 0023 — Transferências internas no ledger e estornos imutáveis

Status: implementada apenas em DEV, não homologada para PROD, 2026-10-10.

## Contexto
O V35 já mantém `financial_account_transfers`, `financial_account_transfer_reversals` e a view de movimentos com dois sinais iguais e contrários para transferências/estornos. O sistema não tinha interface nem comando auditado para criar esses fatos. Transferências entre contas não são receitas/despesas e não devem ser introduzidas como lançamentos artificiais da DRE.

## Decisão
Criar duas RPCs SECURITY DEFINER para lançamento e reversão, preservando tabelas e views existentes. Exigir permission `institutional.manage`, assinaturas aptas à escrita, contas da mesma Loja, pelo menos duas contas distintas, disponibilidade do saldo do ledger, datas não futuras, competência aberta e idempotência por chave e payload. Reversão gera evento separado e não apaga a transferência original; uma transferência só pode ser estornada uma vez. As contas são bloqueadas por ID para serializar transferências entre elas; outras operações financeiras concorrentes exigem teste adicional. A UI apresenta as movimentações tenant-scoped e a confirmação `ESTORNAR`.

## Evidência e riscos
SQL DEV `verify_dev_account_transfer_guards.sql` passou cenários negativos com ROLLBACK; fixture completa de duas contas ativas em organização de teste foi bloqueada pelo executor e não foi forçada. **Positivo financeiro não testado em SQL**, diferentemente de testes frontend simulados. Preparar segunda conta patrimonial ativa por plano publicado/versão sucessora e avaliar signed JWT HTTP, concorrência e demais movimentos em homologação antes de release. Sem alteração de PROD.

