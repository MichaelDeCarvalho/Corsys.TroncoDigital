# ADR 0047 — Projeção de leitura da trilha de chamados

A trilha consulta os eventos de estado persistidos por chamado em ordem
`created_at, id`. A Loja solicita eventos `customer` e valida Loja, chamado e
visibilidade na resposta. O detalhe Master usa a autorização do fluxo Master
existente. A política de linhas permanece compartilhada com o papel SUPPORT
elegível e exige vínculo com a Loja na leitura de cliente.

A migration proposta restringe o SELECT autenticado às colunas necessárias
para a transição e seu escopo. Motivo bruto e identificador do autor ficam fora
da projeção dos dois leitores. A alteração preserva a política de linhas e os
escritores internos. O leitor acusa histórico incompleto acima de 200 eventos.

Antes da ativação, validar no PostgreSQL descartável a leitura Master e SUPPORT
elegíveis, as negativas AAL1 e anônima, o isolamento A/B, a visibilidade
`customer`, as negativas para colunas sensíveis e a gravação interna. JWT real,
gateway e ativação ficam pendentes de autorização para DEV.
