# ADR-0034 — Ágapes com participantes e cobranças

21/10/2026. Somente DEV. Fonte funcional: HTML V35 original, modal `event` / Novo Ágape: data, valor padrão e participantes selecionados.

Reutilizar `events`, `event_participants` e `charges`, sem novas tabelas, grants de escrita ou políticas RLS. Duas RPCs, `preview_agape_event` e `create_agape_event`, exigem `charges.create` e `members.read`, assinatura apta e autorização no servidor. Categoria ativa de integrantes com classificação publicada; até200 participantes ativos do mesmo tenant, IDs únicos, valor finito em centavos e total limitado. Evento/vencimento têm intervalo validado e competência aberta.

A prévia inclui participantes, nomes, valor individual/total, classificação e fingerprint. O comando serializa organização com NO KEY UPDATE, período com UPDATE e categoria/integrantes com SHARE compatível com FKs. Recalcula a prévia; obsolescência é PT409. Idempotência conserva o evento e os vínculos; payload divergente é22023. Mesmo nome normalizado/data no tenant não pode gerar outro ágape, inclusive após cancelar cobranças. Sem escrita direta por authenticated.

Cada participante pago recebe uma cobrança source_kind=event e chave agape:evento:integrante, vinculada em event_participants. Valor zero registra o participante com charge_id nulo, sem criar dívida. Não cria pagamentos ou movimentações de caixa. Cobranças canceladas permanecem vinculadas e consultáveis; o evento conserva seu histórico. Cancelamento financeiro usa o comando existente por cobrança, sem apagar participantes.

UI: seleção explícita, prévia, confirmação GERAR, chave preservada em envio incerto, histórico paginado e participantes com situação de cobrança. Mantém valor padrão uniforme, conforme o modal original; edição posterior/valores individuais por participante e exclusão de evento não fazem parte deste incremento.

Migration65 `20261021225055` aplicada somente DEV. SQL A/B26 negativas rollback PASS, incluindo permissão, isolamento, participantes inválidos, prévia obsoleta, fechamento, replay/duplicidade e histórico cancelado. Participação gratuita sem cobrança e caixa preservado. Oito testes focados de UI/contrato/recuperação após resposta perdida PASS; HTTP/UI real ainda pendentes neste checkpoint.
