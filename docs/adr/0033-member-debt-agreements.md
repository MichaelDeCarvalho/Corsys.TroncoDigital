# ADR-0033 — Negociação de débitos de integrantes

2026-10-19. Implementação DEV; sem merge/produção.

Reutilizar as quatro tabelas de acordos existentes, suas políticas RLS e os fatos imutáveis de cobranças/ajustes. A prévia e o comando exigem `charges.create` e `charges.adjust`, com assinatura apta e autorização interna. Nenhum novo grant de escrita em tabelas.

O acordo vincula os débitos originais e registra seu saldo aberto. Um ajuste de diminuição `credit_correction` transfere somente esse saldo; pagamentos e alocações anteriores permanecem nos originais. Novas cobranças `replacement` e parcelas são vinculadas ao acordo. A soma efetiva das cobranças, após a transferência, representa o valor já pago mais a dívida negociada. O comando não cria pagamentos nem movimenta caixa. Um estorno posterior de pagamento reabre o valor anteriormente alocado no original, sem apagar a negociação.

O comando serializa organização (`NO KEY UPDATE`), período, integrante, cobranças em ordem de ID e categorias, recomputa a prévia e exige fingerprint. Idempotência retorna o mesmo acordo; payload divergente é `22023`; prévia diferente é `PT409`. Um segundo acordo sobre débitos já consumidos é recusado. Duas permissões são verificadas antes de qualquer leitura protegida ou escrita.

Limites deliberados deste incremento: até 50 débitos de uma categoria e classificação contábil publicada idêntica à dos originais; até 24 parcelas, sem aumento do saldo ou juros inventados; categoria deve permitir parcelamento quando houver mais de uma parcela. O acordo não pode anteceder a emissão dos débitos nem usar período fechado. Distribuição em centavos inteiros, com centavos excedentes nas primeiras parcelas; vencimentos calculados a partir do primeiro dia escolhido (31/jan → 28/fev → 31/mar). Não há comando de cancelamento integral de acordo neste incremento; cancelamentos individuais existentes continuam auditados e o estado financeiro deve ser conferido no extrato.

A UI exige prévia e confirmação `NEGOCIAR`; edição invalida a prévia. Em transporte incerto mantém payload/chave e bloqueia alterações até verificar o envio. Erros definitivos descartam a chave e exigem nova prévia. Histórico e parcelas são consultados por organização/integrante, com limites e validação de soma/escopo.

Revisão21/10: migration64 usa NO KEY UPDATE no integrante para compatibilidade com FKs e ordena locks de cobranças por vencimento/emissão/id, igual ao FIFO existente. Preserva62/63 aplicadas. SQL30 negativas após64 PASS; HTTP/UI B após64 PASS, A antes64 PASS. Probe de duas sessões pelo conector inconclusivo; não é prova de ausência absoluta de deadlock.

Migrations aditivas #62 `20261019235201` e #63 `20261019235427` aplicadas somente DEV. A segunda impede negociação retroativa anterior à emissão; a primeira aplicada é preservada. SQL A/B rollback PASS com 30 negativas, arredondamento, datas, pagamentos parciais e estorno posterior. Evidência de UI/HTTP deve ser registrada separadamente; simulação não é homologação real.
