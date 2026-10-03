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
- [x] Preview Cloudflare inicial publicado e verificado.
- [ ] Revisão desktop/mobile autenticada completa.
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
- [x] Preview inicial publicado e tela de login/assets verificados.
- [x] Proprietário confirmou dois logins reais e visualização somente da Loja própria.
- [ ] Fluxo autenticado desktop/mobile e teste negativo HTTP/JWT completo.

## Preservação e consulta financeira
- [x] Escopo mínimo V35 obrigatório e módulos pendentes registrados em docs/V35_COVERAGE.md.
- [x] ZIP reenviado é idêntico por hash à fonte importada.
- [x] Gate de preservação: 29 ADRs, 19 migrations, 51 documentos, 263 declarações.
- [x] Typecheck, 23 testes frontend e build aprovados neste incremento.
- [x] Consultas SQL das três views sob role authenticated executadas (vazias; não prova de isolamento positivo/negativo).
- [ ] Publicação remota da nova consulta financeira verificada após push.
- [x] HTML do piloto recebido e inventariado: 21 telas, Cliente 360º, campos/ações/abas e formulários dinâmicos; referência versionada e integridade no gate.
- [ ] Paridade funcional/visual com HTML original do piloto: cliques e homologação desktop/mobile das duas Lojas e Master pendentes.

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.
