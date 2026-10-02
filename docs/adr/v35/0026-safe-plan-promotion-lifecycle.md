# ADR-0026 — Lifecycle seguro de Planos SaaS e Ofertas

## Status
Aceito.

## Contexto
O Master precisa corrigir nome/código de um rascunho, desativar catálogo e excluir somente itens que nunca geraram histórico ou vínculo.

## Decisão
1. Nome e código passam a existir como snapshots da versão do Plano SaaS.
2. Todo rascunho pode editar nome/código; uma versão publicada anterior mantém o snapshot histórico.
3. Publicar o sucessor atualiza a identidade corrente do catálogo sem reescrever snapshots antigos.
4. Plano com versão publicada, assinatura, onboarding, promoção vinculada ou mudança agendada não pode ser excluído; pode ser desativado.
5. Oferta publicada/encerrada, resgatada, vinculada a cliente ou aplicada em fatura não pode ser excluída; pode ser desativada.
6. Desativação impede novas contratações/resgates e preserva contratos/fatos existentes.
7. Histórico de versões é consultável por vigência e status.

## Consequências
Excluir é operação excepcional e controlada. A rotina normal para retirar algo de comercialização é Desativar. Ações Master exigem autenticação privilegiada e auditoria.
