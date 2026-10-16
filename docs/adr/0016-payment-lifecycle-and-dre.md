# ADR 0016 — Pagamentos de integrantes e DRE derivada de fatos contábeis

Status: aprovado exclusivamente em DEV, 2026-10-09. Não confundir com ADR `docs/adr/v35/0016-accounting-plans-effective-dating.md`.

## Contexto
A base já fornece `register_payment` e `allocate_payment_to_charge` idempotentes, `reverse_payment` com reversão de alocações, `v_charge_balances`, `v_payment_balances` e `v_dre_entries`. O frontend V35 ainda não expunha os comandos de pagamentos nem DRE. Pagamento sem alocação é crédito disponível e não quitação; DRE não pode somar novamente caixa recebido ao fato de receita.

## Decisão
Reutilizar as RPCs existentes, sem duplicar regras no React. Para estorno, criar a RPC `reverse_member_payment_idempotent` que valida permissão/motivo/competência, encapsula idempotência e chama a reversão antiga e auditada. A interface mostra o crédito disponível e obrigações abertas do mesmo integrante/Loja, oferece alocação com valor positivo dentro dos saldos conhecidos (checagem final é do banco), exige razão para estorno e reenvia chave/payload invariantes após resposta de rede incerta.

Para DRE, criar `read_tenant_dre` como consulta autorizada `reports.read`, somando valores assinados de `v_dre_entries` por competência e conta contábil histórica, somente naturezas de resultado. Mostrar receitas/custos/despesas/resultados separados de caixa, créditos e orçamento, que permanecem módulos futuros.

## Limites e rollback
UI interrompe a consulta se mais de 150 registros por lista de integrante ou 1500 linhas DRE, não mostra somatório parcial enganoso. Sem paginação real nem orçamento×realizado. Função `reverse_payment` original continua disponível a clientes autorizados; prevenir migração incompatível silenciosa. SQL A/B rollback PASS, sem novos fatos persistidos. Para contenção, revogar EXECUTE das duas RPCs novas; evitar apagar fatos/alterar ledger.

## Aceite ainda pendente
Assinaturas JWT HTTP reais, concorrência simultânea independente, telas administrativas institucionais e Master SaaS, classificação neutra/repasse, teste visual desktop/mobile e paridade integral HTML V35. PROD não autorizado.
