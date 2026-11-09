## Estado atual M01.02 — 09/11/2026

PR #28 integrado e migration de reconciliação aplicada **somente DEV** `szqkdekwhzxsoxorgvaz`, versão real `20261109190747`. Testes SQL de grants, autorização simulada Master/AAL2, negativas, expiração idempotente, preservação da reserva, observação sanitizada e rollback passaram. Nenhum envio nem retry. **Faltam** validação HTTP/JWT real, evidência externa para retry seguro, vínculo/papel/termos (M01.03) e homologação de convite autorizado (M01.04). Priorizar cursor vigente, que atualiza registros históricos abaixo.

## Atualização vigente — ativação M01.01 no DEV (09/11/2026)

O registro abaixo é histórico da retomada de 01/11/2026, quando **não existia** consumidor. Agora, no Supabase DEV szqkdekwhzxsoxorgvaz, a migration `20261109184607` e a Edge Function `onboarding-invite` ACTIVE v1 (`verify_jwt=true`) estão aplicadas após PR #26 integrado `b32692dc1b1bd94713c23d0760ff4965001a8ee0`. **Nenhum convite foi disparado ou homologado**. Ainda faltam M01.02 (reconciliação), M01.03 (vínculo/papel/termos) e M01.04 (aceite JWT/SMTP/convite real com autorização específica). Fonte operacional: `docs/V35_SESSION_CURSOR.md`.

# V35 — pendências comprovadas na retomada de 01/11/2026

Este registro substitui inferências a partir das tabelas históricas de cobertura, sem declarar revisão integral nem reabrir homologações aprovadas. Estado observado no código após PR #19 (`6042cedc`).

| Pendência | Evidência / próxima ação |
|---|---|
| PDF e XLSX dos recortes consultados | Implementados no PR20, CI407 PASS e publicados DEV. PDF usa impressão nativa; recortes têm abrangência explícita, não exportação integral. |
| Ferramentas de desenvolvimento | Corrigidas no PR21 (Vite 6.4.5, Vitest 5.0.5, Wrangler 4.156.1), CI409 PASS, npm audit zero avisos conhecidos na execução; incorporadas na publicação DEV585995d2. |
| Diário/Razão detalhados e exportação integral | Relatorios.tsx consulta agregados DRE/estrutura, não livro diário. Não rotular recorte como relatório integral. Conferir contrato contábil antes de implementar. |
| Auditoria Master consultável | PR22 integrado, migration DEV20261102000933, CI413 e SQL PASS; leitura/filtros UI reais MASTER/MFA PASS, 5 eventos preservados. Negativas HTTP independentes e página adicional não executadas; SQL negativo anterior preservado. |
| Convite de onboarding entregue | MasterOnboarding.tsx informa apenas tarefa enfileirada e não há Edge Function consumidora implantada. SMTP personalizado do Supabase DEV foi configurado pelo proprietário; um e-mail de recuperação de teste teve aceite de envio confirmado no painel. Caixa de entrada/entrega final e convites não foram verificados/enviados. Implementar consumidor idempotente/autorizado usando Auth Admin server-side; não anunciar convite entregue sem observação real. |
| Privacidade/portabilidade/retencão | Configuracoes.tsx mantém operações em homologação. Exige fluxo backend com autorização, auditoria, escopo e retenção definidos, sem exclusão financeira histórica. |
| Publicação de plano contábil | AccountingPlans.tsx informa publicação automática indisponível; conferir regras de vínculos/vigência antes de comando novo. |
| DRE por rubricas V35 | Handoff registra ausência de separação completa de Receita Bruta/Deduções/Receita Líquida/Custos/Despesas Operacionais. Não classificar por heurística de descrição. |
| Gates remanescentes | Conferir registros específicos de sessão read-only P1 e emissão SaaS; somente HTTP/UI ainda não comprovados, com identidades/OTP do proprietário quando necessários. Não repetir P0, RBAC ou financeiro A/B aprovados. |

Produção, novas credenciais, custos e mudanças comerciais reais continuam fora da autorização DEV. A autorização do proprietário permite integrar próximos PRs de baixo impacto no DEV com CI aprovado. Mudanças críticas devem ser avaliadas pelo seu risco concreto.
