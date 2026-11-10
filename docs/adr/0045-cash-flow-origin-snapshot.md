# ADR 0045 — Origem, ranking e saldo no Fluxo de Caixa

O RPC de leitura valida finance.read antes de consultar a Loja. Uma instrução SQL monta a página, a contagem exata, o ranking e a evolução. A página jamais serve como total. Páginas solicitadas em instantes diferentes podem observar novos commits.

As despesas são medidas pela data de liquidação. Cada parcela alocada entra uma vez, com descrição e categoria registradas na origem até o instante de gravação do pagamento. Um estorno financeiro abate a composição original na própria data. Uma reversão posterior só da alocação não reescreve o fato de caixa histórico. Sobras de pagamento ficam sem categoria; excesso de alocação impede apresentar o resultado. Nomes de categoria vêm do catálogo atual. O protótipo indica ranking por categoria e não define reclassificação retroativa.

Para integrante, a origem usa alocações ativas de pagamento. Depois de estorno, o detalhe recupera as alocações existentes antes do estorno e exclui as previamente desfeitas. Recebíveis institucionais usam os vínculos do recibo e correções registradas até o recebimento. Campos ausentes permanecem sem classificação.

Saldo de abertura corresponde à soma anterior ao intervalo. Saldo final e evolução diária incluem todos os fatos do ledger até cada data, inclusive abertura, transferências e estornos. O relatório mantém DRE por competência e saldo conciliado em seus fluxos próprios.
