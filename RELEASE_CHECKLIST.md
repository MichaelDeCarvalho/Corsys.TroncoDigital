# RELEASE CHECKLIST — V35

## Verificado nesta etapa
- [x] 16 migrations originais preservadas byte a byte e hashes registrados.
- [x] 17 migrations e 3 scripts passam por parser de gramática SQL.
- [x] Sintaxe dos scripts JS e quatro testes do guard DEV aprovados.
- [x] Dependências fixadas e lockfile gerado.
- [x] `npm audit --omit=dev --audit-level=high`: zero findings retornados.
- [x] Configuração TOML gerada pela CLI e parseada localmente.
- [x] CI estática preparada com permissions: contents:read e actions por SHA.

## Gates de runtime — não aprovados
- [ ] Projeto Supabase DEV selecionado/criado com custo confirmado.
- [ ] 17 migrations aplicadas do zero e histórico alinhado.
- [ ] Catálogo de segurança e invariantes SQL executados.
- [ ] JWT/RLS cross-user e cross-tenant positivo/negativo.
- [ ] Master/Billing/Support e AAL1/AAL2 exercitados.
- [ ] Financeiro, fechamento, imutabilidade e suspensão.
- [ ] Concorrência, sobrealocação e idempotência.
- [ ] Correção das views administrativas comprovada em runtime.
- [ ] CI remota aprovada na revisão do PR.

## Produto e deploy
- [ ] Frontend responsivo e integrações reais.
- [ ] Storage privado, auth, observabilidade e rollback.
- [ ] Preview Cloudflare e revisão desktop/mobile.
- [ ] Produção configurada e verificada.

## Resultado
**BLOCKED para release.** Checks estáticos aprovados não comprovam runtime, segurança ou deploy.
