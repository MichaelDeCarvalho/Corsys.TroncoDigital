# V35 — Evidência do gate HTTP real de autorização, Grupo A (somente leitura)

**Data da execução reportada pelo proprietário:** 15/11/2026 (Brasil).  
**Ambiente:** Supabase DEV `szqkdekwhzxsoxorgvaz` e cópia local Windows do GitHub `main` (`8461e92760041bb4f76901e714fa6e4d6bbb0f8b`), com a correção local descrita abaixo.  
**Comando executado pelo proprietário:** `npm.cmd run test:negative-auth:readonly --prefix dev-gate`.  
**Fonte da evidência:** saída do terminal PowerShell fornecida pelo proprietário na conversa de homologação; o CI do repositório não possui os secrets/TOTP para reproduzir o gate HTTP real.

## Resultado observado — Grupo A: 5/5 PASS

| Grupo | Cenário | Evidência literal reportada | Estado |
|---|---|---|---|
| A 1/5 | Loja A → Loja B | `PASS [Group A 1/5]: Tenant A -> B cross-tenant read RPCs (42501) and views (0 rows) blocked.` | PASS |
| A 2/5 | Loja B → Loja A | `PASS [Group A 2/5]: Tenant B -> A cross-tenant read RPCs (42501) and views (0 rows) blocked.` | PASS |
| A 3/5 | Usuário autenticado sem `finance.read` | `PASS [Group A 3/5]: Authenticated user without finance.read denied (42501) on all financial read RPCs.` | PASS |
| A 4/5 | Master AAL1 sem MFA | `PASS [Group A 4/5]: Master AAL1 denied (42501 / 0 rows) on restricted Master read queries.` | PASS |
| A 5/5 | Master AAL2 após TOTP | `PASS [Group A 5/5]: Master AAL2 authorized for read-only Master overview, tenant directory, audit and saas_jobs.` | PASS |

**Marcadores finais reportados:**

```text
SKIPPED [Group B — Persistent Operations]: Blocked by default. Read-only gate completed without mutating DEV state.
PASS: negative HTTP authorization suite completed successfully.
```

## Diagnóstico e correção incorporada

1. Primeira execução: autenticação inicial da Loja A falhou por credenciais locais; corrigida pelo proprietário, sem alterar código do produto.
2. Segunda execução: A 1/5 e A 2/5 passaram, mas A 3/5 detectou `PGRST202` em `read_tenant_cash_flow_detail`. Essa falha **não é** negativa `42501` e foi corretamente recusada por `assertPermissionDenied`.
3. Causa verificada no código da revisão `8461e92`: o cenário sem `finance.read` omitia `p_page`, argumento obrigatório na assinatura atual da RPC; as chamadas positiva e cross-tenant já informavam `p_page: 0`.
4. Correção mínima, aplicada primeiro na cópia Windows e posteriormente versionada neste PR: acrescentar `p_page: 0` apenas à chamada `noFinanceClient.rpc('read_tenant_cash_flow_detail', ...)`. Não relaxar as asserções nem trocar a semântica de autorização.
5. Terceira execução: A 1/5–A 3/5 passaram; falha inicial de autenticação Master decorrente do e-mail fixture divergente, corrigido localmente após verificar a identidade Master e fator TOTP no DEV.
6. Quarta execução: A 1/5–A 4/5 passaram, o roteiro solicitou TOTP; ao informar o fator localmente, A 5/5 e o marcador final PASS foram observados.

**Requisitos de segurança preservados:** sem tokens, senhas, chaves ou TOTP versionados; nenhuma RLS, policy, role, função SQL, migration, usuário ou dado financeiro alterado pela correção do teste. O Grupo B permaneceu bloqueado e não foi executado.

## Alcance do aceite e limites

- **VERIFICADO POR SAÍDA FORNECIDA PELO PROPRIETÁRIO:** subgate HTTP somente leitura de autorização A/B, sem `finance.read`, Master AAL1 e Master AAL2; 5/5 PASS. Isso fecha **apenas este subgate específico** de M02.03, M04.03 e M06.03.
- **NÃO EXECUTADO NESTE GATE:** Grupo B persistente (escritas negativas, abertura/encerramento de sessão e outras operações), cenários de concorrência/recuperação, QA visual/cliques de todas as 21 telas, fluxos de onboarding/convite, cobrança real ou release.
- **NÃO AVALIADO POR CI NESTA EVIDÊNCIA:** reexecução da suíte com JWT/TOTP real; CI pode validar sintaxe/testes estáticos, mas não substituir o gate HTTP real.
- **BLOQUEIOS INDEPENDENTES:** M01.03/M01.04 (termos oficiais/ativação), M03.02–M03.04 (definição contábil, issue #43), M05.01 (LGPD/retenção/portabilidade), M05.02 (recuperação e integração do PR pendente), paridade funcional/visual M06 e PROD/lançamento M07.

## Próxima microentrega

Avançar na **M06.01/M06.02 — paridade integral das 21 telas**, confrontando a referência imutável `docs/pilot/v35-planos-ofertas.reference.html` e `docs/V35_PILOT_V35_INVENTORY.md` com os componentes React. Fazer ajustes pontuais por tela/fluxo e testes de regressão, sem inventar dados ou reduzir escopo. Utilizar `docs/V35_SCREEN_PARITY_MATRIX.md` como controle de evidência, sem transformar o gate de autorização em homologação visual.
