# ADR-0036 — Mútuas por faixa e atribuição explícita

21/10/2026. Backend DEV; UI/HTTP ainda pendentes neste checkpoint.

Reutilizar mutual_batches, mutual_assignments e cobranças imutáveis source_kind=mutual. Operador informa faixa, valor unitário, competência/emissão/vencimento, categoria e integrante de cada número. Não inferir destinatários, gerar repasse ou tratar a categoria como receita universal.

Validador privado limita até200 números, exige cobertura única/completa da faixa, UUIDs válidos, valor positivo em centavos, total limitado e datas coerentes. Prévia/comando públicos exigem charges.create+members.read e assinatura apta. Integrantes ativos, categoria e classificação publicada pertencem ao tenant. A prévia inclui a natureza/código contábil existentes; a DRE conserva a regra do plano, sem reclassificação automática.

Comando trava organização NO KEY UPDATE, período UPDATE e categoria/integrantes SHARE; recompõe fingerprint. Idempotência retorna o mesmo lote; divergência22023 e obsolescência/sobreposição PT409. Faixas sobrepostas na mesma competência são recusadas mesmo após cancelar as cobranças. Cada número gera exatamente uma charge e um vínculo; múltiplos números podem ser atribuídos explicitamente ao mesmo integrante. Sem pagamentos, saldos manuais ou novos grants de escrita/RLS.

Migration66 `20261021230557` aplicada somente DEV. SQL A/B rollback PASS com36 negativas e as duas faixas documentadas710–721/722–745; total36 cobranças por tenant no teste, todas revertidas pela transação. Replay, vínculo, auditoria única, período, permissão, isolamento, preenchimento/duplicação e histórico cancelado conferidos. Caixa preservado. Não equivale a homologação HTTP/UI real ou aceite contábil de natureza específica para repasses.
