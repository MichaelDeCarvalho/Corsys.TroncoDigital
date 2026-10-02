# RELEASE CHECKLIST

> Use somente itens aplicáveis à mudança. Item sem execução deve permanecer NÃO AVALIADO/BLOCKED.

## Código
- [ ] lint
- [ ] typecheck
- [ ] testes
- [ ] build
- [ ] regressão

## Banco
- [ ] migration versionada
- [ ] backup se necessário
- [ ] RLS revisada
- [ ] cross-user/cross-tenant testado
- [ ] rollback/forward-fix

## Segurança
- [ ] auth
- [ ] autorização
- [ ] fail-closed
- [ ] secrets
- [ ] CORS
- [ ] webhooks
- [ ] inputs
- [ ] logs
- [ ] insecure defaults quando aplicável

## IA
- [ ] API key server-side
- [ ] output validado
- [ ] tools autorizadas
- [ ] prompt injection considerado
- [ ] dados minimizados
- [ ] tamanho de arquivos avaliado

## Jobs assíncronos
- [ ] status persistido
- [ ] retry seguro
- [ ] idempotência
- [ ] timeouts
- [ ] correlation/job ID
- [ ] falha de etapa não repete etapas concluídas

## GitHub / CI
- [ ] PR revisado
- [ ] Actions least privilege
- [ ] secrets protegidos
- [ ] dependências revisadas
- [ ] deploy protegido

## Produção
- [ ] env vars
- [ ] observabilidade
- [ ] rollback
- [ ] documentação atualizada

## Resultado
- [ ] PASS
- [ ] BLOCKED

### Estado inicial ECC — 2026-10-02

BLOCKED para release do produto: não há código/runtime versionado para executar os checks acima.
