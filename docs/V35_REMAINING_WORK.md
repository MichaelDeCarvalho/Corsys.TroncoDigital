# V35 — pendências comprovadas na retomada de 01/11/2026

Este registro substitui inferências a partir das tabelas históricas de cobertura, sem declarar revisão integral nem reabrir homologações aprovadas. Estado observado no código após PR #19 (`6042cedc`).

| Pendência | Evidência / próxima ação |
|---|---|
| PDF e XLSX dos recortes consultados | Implementação nesta branch, ADR-0041. Validar CI e publicação DEV. |
| Atualização de ferramentas com avisos de segurança | npm audit identificou Vite, Vitest/mocker e Wrangler/Miniflare/undici. Correções propostas pelo registro: Vite 6.4.5, Vitest 5.0.5, Wrangler 4.156.1; validar em lote separado, sem `audit fix --force`. |
| Diário/Razão detalhados e exportação integral | Relatorios.tsx consulta agregados DRE/estrutura, não livro diário. Não rotular recorte como relatório integral. Conferir contrato contábil antes de implementar. |
| Auditoria Master consultável | Aba audit de MasterOperations.tsx é informativa. Precisa contrato de leitura privilegiado, filtros/paginação, minimização e testes de autorização; não abrir SELECT à tabela backend para contornar essa dependência. |
| Convite de onboarding entregue | MasterOnboarding.tsx informa apenas tarefa enfileirada. Conferir consumidor e provider; não anunciar e-mail entregue sem execução observada. |
| Privacidade/portabilidade/retencão | Configuracoes.tsx mantém operações em homologação. Exige fluxo backend com autorização, auditoria, escopo e retenção definidos, sem exclusão financeira histórica. |
| Publicação de plano contábil | AccountingPlans.tsx informa publicação automática indisponível; conferir regras de vínculos/vigência antes de comando novo. |
| DRE por rubricas V35 | Handoff registra ausência de separação completa de Receita Bruta/Deduções/Receita Líquida/Custos/Despesas Operacionais. Não classificar por heurística de descrição. |
| Gates remanescentes | Conferir registros específicos de sessão read-only P1 e emissão SaaS; somente HTTP/UI ainda não comprovados, com identidades/OTP do proprietário quando necessários. Não repetir P0, RBAC ou financeiro A/B aprovados. |

Produção, novas credenciais, custos e mudanças comerciais reais continuam fora da autorização DEV. A autorização do proprietário permite integrar próximos PRs de baixo impacto no DEV com CI aprovado. Mudanças críticas devem ser avaliadas pelo seu risco concreto.
