# ADR 0017 — Obrigações institucionais e eventos de liquidação no frontend

Status: aprovado apenas para DEV, 2026-10-09.

## Contexto
O schema já distinguia contas a pagar, contas a receber, decisões de aprovação, pagamentos, recebimentos e respectivas alocações. As RPCs `create_institutional_payable`, `create_institutional_receivable`, `register_institutional_payable_payment` e `register_institutional_receipt` já são idempotentes e auditadas. A tela não deve calcular valores financeiros finais nem permitir que obrigação pendente de aprovação seja paga.

## Decisão
Criar um componente `InstitutionalOperations` separado dos recebimentos de integrantes, com loader de categorias, fundos, métodos e contas financeiras por Loja. Os lançamentos usam as RPCs existentes, competência contábil explícita, valor exato em decimal e idempotência; liquidação parcial é evento separado. Para pagamento, a UI lista apenas obrigações com `approval_status=approved/not_required`. Impedir valores acima do saldo consultado é defesa em profundidade, e regras obrigatórias continuam no banco. Não disponibilizar edição/cancelamento sem protocolos de evento da V35.

## Consequências, evidência e limites
Sem migration/schema novo. Views devem devolver dados com `integrity_ok` verdadeiro e `organization_id` correto. Mais de 150 obrigações por tipo requer paginação futura, e o cliente falha fechado para impedir relatório parcial enganoso. `scripts/verify_dev_institutional_lifecycle.sql` foi executado DEV A/B com rollback, validando criação/replay e liquidação parcial. CI do commit funcional `69d4d5a4`: 101 testes aprovados. O script SQL legado `verify_dev_financial_commands.sql` apresentou precondição de fixture divergente e deve ser revisado, sem sobrescrever dados DEV para adequá-lo.

HTTP/JWT assinados reais, concorrência de sessões, autorização da fila de aprovadores e fidelidade visual V35 não foram homologados; release de produção bloqueado.
