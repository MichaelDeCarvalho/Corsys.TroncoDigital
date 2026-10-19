## Estado vigente Work — 19/10/2026

Supersede checkpoints históricos abaixo: identidade SQL rollback PASS; HTTP identidade/catálogo A/B PASS (10calls/10requests por identidade, cleanup confirmado). Cobertura2/13, outras11 pendentes. CI312/head1d9249d SUCCESS. SDK instalado e docs atuais não repetem POST por409; db.retry=false é explícito. Não confundir com retry interno PostgREST40001. Evidência e fontes: V35_EXECUTION_20261019.md.


## Execução 19/10/2026 — DEV

- CI #302 do checkpoint anterior: SUCCESS.
- Migration `20261019205415_legacy_business_http_conflicts_pt409.sql` aplicada ao Supabase DEV e versionada no PR #5: 13 RPCs, 17 raises `40001` substituídos por `PT409`. Read-back: zero `40001` explícitos nessas funções, SECURITY DEFINER e search_path preservados.
- `src/lib/supabase.ts`: `db.retry=false`, para impedir retries automáticos de HTTP 409 em comandos financeiros. Sem deploy.
- Gate `verify_dev_member_profiles.sql`: PASS (ROLLBACK). Gate `verify_dev_tenant_identity.sql`: bloqueado pelo controle de segurança da ferramenta (NÃO EXECUTADO). Gate `verify_dev_treasury_catalog.sql`: FAIL por fixture `user_roles_organization_id_role_id_fkey` (não é prova de falha PT409; necessita corrigir fixture e reexecutar).
- CI da revisão atual, HTTP A/B com JWT real, validação de demais gates e análise de regressão: PENDENTES. Não mesclar nem promover produção.
# Conflitos HTTP históricos — auditoria DEV em 2026-10-16

## Escopo e evidência

Revisão READ-ONLY da revisão DEV do PostgreSQL (`szqkdekwhzxsoxorgvaz`) e do código da branch de homologação V35. Foram localizadas **13 RPCs públicas, 17 ocorrências de `RAISE EXCEPTION ... ERRCODE='40001'`** e nenhuma ocorrência no schema `private`. Todas as 13 são `SECURITY DEFINER`, com `search_path` restrito, dono `postgres` e assinaturas únicas. Contagem por função conferida no catálogo `pg_proc`; cada ocorrência é uma rejeição explícita por estado/versão da regra, não um erro gerado automaticamente pelo motor de serialização.

O problema não é apenas SQL: interfaces existentes reconheciam `40001` para descartar chaves pendentes, sinalizar conflito e exigir atualização de prévia/registro; `PT409` precisava ser reconhecido **antes** de substituir o código no servidor.

## Funções candidatas e classificação

| RPC | Ocorrências | Natureza do conflito |
|---|---:|---|
| `correct_tenant_institutional_obligation_idempotent` | 1 | obrigação alterada desde a prévia |
| `create_master_promotion_successor_idempotent` | 1 | oferta original deixou de ser última versão publicada |
| `generate_monthly_member_charges` | 2 | fingerprint/quantidade de geração divergente |
| `publish_tenant_budget` | 1 | revisão orçamentária divergente |
| `publish_validated_accounting_plan` | 2 | rascunho deixou de ser válido ou vigência alterada |
| `reverse_tenant_institutional_movement` | 2 | alocações ou histórico modificados concorrencialmente |
| `save_member_profile` | 1 | integrante atualizado por outra operação |
| `save_tenant_identity` | 2 | revisão divergente ou criação concorrente |
| `schedule_tenant_monthly_price` | 1 | última versão de preço divergente |
| `set_draft_accounting_mapping` | 1 | vínculo contábil alterado |
| `set_tenant_budget_line` | 1 | revisão de orçamento divergente |
| `set_treasury_catalog_status` | 1 | situação atual do cadastro divergente |
| `transition_member_term` | 1 | condição do integrante já sucedida |
| **Total** | **17** | **13 RPCs** |

## Contrato e consumidores

- Antes da migration: `40001` permanece reconhecido para compatibilidade com DEV e possíveis falhas de serialização reais.
- UI em revisão separada: `PT409` tratado como **conflito definitivo**, com comando/chave pendente descartado, `uncertain=false` e instrução de atualizar dados. No caso Master, evita classificar origem promocional obsoleta como transporte incerto.
- Não alterar idempotência, RLS, permissão, cálculo financeiro, `SECURITY DEFINER`, `search_path` ou assinaturas.
- `PT409` já é usado pela recorrência institucional mensal em migrations 57/58 e foi homologado por HTTP A/B; não repetir esse gate.
- **Atenção:** o cliente usa `@supabase/supabase-js` 2.117.2. A documentação atual indica retries automáticos inclusive em HTTP 409 em chamadas PostgREST; antes do aceite, observar que uma resposta `PT409` é concluída em tempo delimitado e não reinicia gravações sem controle. O cliente atual tem timeout de 15 segundos; isso não substitui teste HTTP real.

## Estado desta revisão

**PARCIAL — frontend preparado, banco não alterado.** Novas verificações de regressão UI foram adicionadas para `PT409` em geração mensal e ofertas Master; CI ainda deve executá-las na revisão proposta. Testes históricos de `40001` permanecem.

## Próximo lote de implementação

1. Produzir **nova migration**, sem editar migrations 1–58, para substituir somente os 17 `ERRCODE='40001'` de negócio identificados por `PT409` (ou código HTTP não-retryable fundamentado quando indispensável). Verificar as definições atuais e barrar divergência antes de executar.
2. Validar com SQL transacional/rollback e checagens de ACL, RLS, assinaturas, `SECURITY DEFINER`, `search_path`, idempotência, auditoria e no-write em conflito.
3. Executar gate HTTP assinado e real para A e B somente nos fluxos impactados (prioridade financeiro, orçamento e estorno); verificar rejeição delimitada, versão/estado, nenhuma duplicidade e read-back. Não reutilizar competências QA com histórico impeditivo.
4. Atualizar evidências e handoff. Não declarar Etapa 2 fechada apenas por esta correção; permanecem anual/especial/reajuste, negociação/parcelamento, multiaprovadores e paridade visual V35.

Documentação oficial: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

Referência sobre retries do cliente: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js
