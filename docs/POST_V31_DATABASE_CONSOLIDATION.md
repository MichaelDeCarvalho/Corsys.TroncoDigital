# Consolidação do Banco — pós-V31

## Objetivo
Transformar as decisões aprovadas na V31 em invariantes de banco antes da aplicação real.

## Domínios consolidados

### Plano de Contas
`accounting_plans` + `accounting_accounts` + mapeamentos.

Um plano publicado:
- possui vigência mensal;
- não se sobrepõe a outro plano publicado da mesma organização;
- não aceita INSERT/UPDATE/DELETE estrutural;
- é resolvido pela competência do fato.

### Integrantes
Foram mantidos charges/payments/allocations e adicionados:
- `member_offices`;
- `recurring_member_terms`;
- negociações de dívida;
- comunicações;
- preferências por usuário.

### Institucional
Contas a pagar/receber foram modeladas separadamente de pagamentos/recebimentos.

A UI “Editar” não altera o fato postado: cria `*_corrections`.

### Aprovação
Política por vigência, threshold digitável e número mínimo de aprovadores. A exigência é snapshot no fato.

### Caixa e Bancos
Saldo deriva de abertura + pagamentos de integrantes + recebimentos institucionais − pagamentos institucionais ± transferências e reversões.

### Conciliação
Extrato importado fica separado; matches vinculam a fatos internos sem substituir a fonte financeira.

### Orçamento
Ciclos e linhas contábeis/fundos ficam separados do realizado.

### SaaS
Control plane, assinaturas, faturas, pagamentos, preço histórico, contatos e cobrança permanecem fora do financeiro dos tenants.

## Invariantes
1. Saldo não é fonte primária mutável.
2. Tenant A não pode acessar Tenant B.
3. Plano publicado é histórico.
4. Fato postado é corrigido por novo evento.
5. Pagamento/recebimento não pode ser alocado acima do disponível.
6. Cancelamento institucional atinge somente saldo aberto.
7. Aprovação obrigatória deve ser satisfeita antes da liquidação.
8. Importação não confirma linhas inválidas.
9. Billing SaaS nunca entra no DRE/caixa da Loja.
10. Preferência de UI nunca concede permissão.
