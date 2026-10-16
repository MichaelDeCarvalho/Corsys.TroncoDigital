# ADR-0030 — Concorrência mensal e conflito HTTP

Data: 2026-10-16. DEV somente.

## Evidência e decisão

Gate HTTP A encontrou um vencedor e timeout na disputa entre chaves distintas;
SQL confirmou uma obrigação por competência e limpeza, mas isso não aprovava
ambas as respostas. O contador de deadlocks chegou a2. Migration57 substitui
FOR UPDATE por FOR NO KEY UPDATE na organização nos três comandos mensais,
compatível com KEY SHARE das FKs de idempotência, mantendo serialização.

Após57 não houve novo deadlock observado, mas o timeout persistiu. A documentação
oficial Supabase descreve retries infinitos quando conflitos de negócio lançam
40001 no PostgREST14. Migration58 muda somente os conflitos de situação/prévia
mensais para PT409, que exige nova revisão e retorna HTTP409. UI trata o código
como rejeição conhecida, sem repetir prévia obsoleta. Não altera grants, tabelas,
RLS, eventos ou valores. Migrations56/57 preservadas sem edição.

## Validação e limites

SQL A/B com rollback4positivos/56negativos PASS após57 e58. Regressão HTTP final
pendente. O helper usa chave de cleanup única por execução e confirma desativação,
cancelamento e saldo10; execuções diagnósticas deixaram somente histórico fictício
identificado, sem caixa movimentado. Outros comandos históricos com40001 precisam
ser auditados antes de alegar fechamento integral da Etapa2; não corrigidos em massa.

Fontes: https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS
https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
