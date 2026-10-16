# ADR 0015 — Exclusão mútua contábil por Loja e ativação somente com mapeamento

**Status:** aprovado exclusivamente no DEV, 2026-10-09. Complementa ADR 0014.

## Contexto
Publicar plano de contas exigia bloqueio `SHARE` em cinco tabelas de múltiplas Lojas, bloqueando clientes independentes e abrindo possibilidade de deadlock com RPC de vínculos que travava plano antes da organização. Uma categoria ou conta financeira adicionada ativa após a publicação poderia não estar mapeada, enquanto o plano publicado é imutável.

## Decisão
Criar trigger único `private.guard_tenant_accounting_change` (BEFORE INSERT/UPDATE/DELETE) nas seis tabelas `financial_categories`, `financial_accounts`, `accounting_accounts`, os dois catálogos de mapeamento e `accounting_plans`. O trigger trava `organizations` por `organization_id`, detecta troca ilegítima de tenant e rejeita alterações com destino a plano publicado. A RPC de mapeamento obedece ordem organização→plano; a RPC de publicação remove os cinco `SHARE LOCKS`, mas mantém rechecagem transacional e constraint de exclusão.

Para categorias, ativação/criação ativa ou alteração de domínio ativa exige mapeamento válido em todo published com `valid_to` na competência atual ou futura; para contas financeiras, ativação/criação ativa exige mapeamento analítico patrimonial equivalente. Conta bancária nova começa inativa, auditada como tal. Categorias novas são sugeridas inativas no frontend e os erros `23514` são tratados como recusa definida, instruindo a criar sucessor.

## Alternativas
Manter locks globais evita phantom writes, porém impede concorrência entre Lojas. Somente advisory locks nos RPCs não protegeria alterações privilegiadas fora dos RPCs. Triggers de linha com lock de organização estabelecem a mesma ordem transacional para todos os DML pertinentes. A camada de banco continua como boundary, não a interface.

## Consequências
- Reduz dependência de travas globais e serializa somente escritas da mesma Loja.
- Carga de trigger cresce proporcionalmente às linhas alteradas, inclusive ao copiar o modelo de 91 contas; monitorar.
- A garantia depende de mutações por INSERT/UPDATE/DELETE das tabelas envolvidas; administradores privilegiados usando DDL/TRUNCATE ou tabelas não cobertas continuam fora desse escopo.
- Categorias ativadas depois de um plano publicado precisam de mapeamentos no plano publicado, que é imutável, portanto dependem de planejamento de sucessor e início da nova competência. Não alterar histórico.
- Contrato do RPC de cadastro de conta financeira foi alterado para retornar conta `active=false` inicialmente; revisar consumidores antes de deploy.
- Executar prova de concorrência com sessões PostgreSQL independentes e transações sobrepostas antes de considerar a revisão pronta para produção.

## Evidência
Migration DEV #32 `20261009165809_tenant_scoped_accounting_publication_guard`, SHA256 no manifesto; cinco gates SQL A/B PASS e ROLLBACK sem movimento financeiro. Tentativa pela API de executar queries paralelas não produziu uma disputa demonstrável; status de concorrência `NOT EVALUATED`. HTTP/JWT assinado, teste de concorrência real, visual V35 e observabilidade pendentes.

## Recuperação
Contenção reversível: revogar EXECUTE da publicação validada e dos cadastros até forward-fix, sem desfazer imutabilidade ou apagar planos. Qualquer retorno ao bloqueio de tabela exige nova migration e testes específicos; não editar migrations aplicadas.
