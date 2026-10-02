# RELEASE CHECKLIST — V35

## Verificado nesta etapa
- [x] Hashes históricos das 16 migrations originais registrados; baselines 009/014 corrigidas antes da primeira aplicação.
- [x] Gramática SQL verificada na entrega inicial; revisão atual acompanhada pela CI.
- [x] Sintaxe dos scripts JS e quatro testes do guard DEV aprovados.
- [x] Dependências fixadas e lockfile gerado.
- [x] `npm audit --omit=dev --audit-level=high`: zero findings retornados.
- [x] Configuração TOML gerada pela CLI e parseada localmente.
- [x] CI estática preparada com permissions: contents:read e actions por SHA.

## Gates de runtime — não aprovados
- [x] Projeto existente DEV selecionado pelo usuário; plano Free verificado, sem nova infraestrutura paga.
- [x] 19 migrations aplicadas do zero e histórico local alinhado.
- [x] Catálogo de segurança e invariantes SQL executados.
- [ ] JWT/RLS cross-user e cross-tenant positivo/negativo.
- [ ] Master/Billing/Support e AAL1/AAL2 exercitados.
- [x] Financeiro, fechamento e imutabilidade em teste SQL com rollback.
- [ ] Suspensão e RPCs exercitados com JWT real.
- [ ] Concorrência, sobrealocação e idempotência.
- [ ] Correção das views administrativas comprovada em runtime.
- [x] CI remota aprovada para o incremento frontend: commit 04436e78c5116c550bff88ac4a905f3ddf083263, run 37077478804.

## Produto e deploy
- [ ] Frontend responsivo e integrações reais.
- [ ] Storage privado, auth, observabilidade e rollback.
- [ ] Preview Cloudflare e revisão desktop/mobile.
- [ ] Produção configurada e verificada.

## Resultado
**BLOCKED para release.** Checks estáticos aprovados não comprovam runtime, segurança ou deploy.

- [x] Auth users confirmados e vinculados a duas Lojas DEV.
- [x] RLS e RPCs com SET ROLE/claims simuladas aprovados, incluindo negação cross-tenant.
- [ ] HTTP/Data API com JWT assinado real (separado do teste SQL).

## Frontend DEV e publicação
- [x] Typecheck app/node, 13 testes frontend, build Vite e Wrangler dry-run aprovados.
- [x] npm audit completo: zero vulnerabilidades após atualização Wrangler 4.147.0.
- [x] Build sem configuração pública falha de forma explícita.
- [ ] Conta/plano/consumo Cloudflare verificados (painel bloqueado por verificação contra bots).
- [ ] Deploy e inspeção visual desktop/mobile — ainda não executados.
