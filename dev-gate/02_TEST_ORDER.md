# 02 — Ordem dos testes

## GATE A — Migration
1. banco vazio;
2. aplicar 001–016;
3. repetir do zero com `db reset`;
4. `migration list` sem divergência.

Falhou aqui: não continuar.

## GATE B — Invariantes
Executar os scripts SQL já presentes em `scripts/`:
- `verify_financial_invariants.sql`
- `verify_post_v31_invariants.sql`

## GATE C — Auth/RLS
Criar:
- Tenant A + ADMIN A;
- Tenant B + ADMIN B;
- um integrante em cada tenant.

Provar:
- ADMIN A vê somente organização/membros/tickets A;
- ADMIN B vê somente organização/membros/tickets B;
- A não consegue criar chamado para B;
- B não consegue criar chamado para A;
- tenant não lê configuração Master;
- tenant não lê `platform_staff`.

## GATE D — Master/AAL2
Depois de configurar MFA real:
- AAL1 não recebe privilégio Master;
- AAL2 recebe somente o papel cadastrado;
- SUPPORT não vira MASTER;
- último MASTER ativo não pode ser removido.

## GATE E — Financeiro
Testar comandos positivos e negativos:
- cobranças;
- pagamentos/alocações;
- correções/reversões;
- AP/AR;
- aprovação;
- período fechado;
- plano de contas;
- billing SaaS;
- plano/promoção V35.

## GATE F — Concorrência/idempotência
Enviar duas requisições simultâneas para operações críticas e confirmar:
- nenhuma duplicidade;
- nenhum saldo negativo/inconsistente;
- request/idempotency key reaproveitada com segurança.

## Saída
Só marcar o banco como `runtime_validated` depois de A–F em PASS.
