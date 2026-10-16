# ADR 0013 — Pré-validação de publicação do Plano de Contas

Status: **aceito para diagnóstico no DEV**, 2026-10-09. Complementa `docs/adr/v35/0016-accounting-plans-effective-dating.md` e ADR 0012.

## Contexto
O sistema possui modelo com 91 contas, 86 vínculos hierárquicos e planos publicados imutáveis. Já há `publish_accounting_plan`, mas a UI não tem controle completo de prontidão. Dar uma validação apenas no navegador seria uma autorização insegura, e publicar rascunho com categoria ativa não classificada poderia comprometer os próximos lançamentos.

## Decisão
Uma função RPC de diagnóstico somente leitura retorna contagens e impeditivos reais do banco (`ready/issues`). A interface não oferece publicação; mostra a situação instantânea para correção de mapeamentos. Verifica: status, início futuro, plano concorrente published, existência de contas e analíticas ativas, hierarquia com parent não agrupador ou de natureza diferente, ciclo, categorias e contas financeiras ativas sem mapeamentos, targets inativos ou incompatíveis.

## Segurança e limitações
Permission `accounting.manage` antes de lookup e assinatura elegível, estrutura tenant-scoped, sem write, IDOR ou grant em tabelas. Usa SECURITY DEFINER em `public` com EXECUTE exclusivo a authenticated. A presença de `ready=true` não é prova de segurança permanente nem gera autorização para publicar. TOCTOU entre consulta e publicação requer revalidação dentro da mesma transação sob lock do tenant/plano/contas; a implementação futura não pode depender somente do preview.

## Evidência
Supabase DEV migration `20261009041818` (sha256 manifesto), script `scripts/verify_dev_accounting_prepublication.sql` com `ROLLBACK_PASS` nas duas Lojas, positivo/negativo, zero alterações financeiras. Homologação com JWT assinado, concorrência simultânea e paridade visual/mobile pendentes.

## Recuperação
Revogar EXECUTE da RPC se necessário; nenhuma reclassificação ou plano publicado foi criado/alterado. Somente DEV; nenhuma produção autorizada.
