# V35 — PLANO MESTRE DE EXECUÇÃO (macroetapas e microentregas)

> **Decisão do proprietário — 03/11/2026:** concluir TODO o escopo aprovado da V35 **antes** de disponibilizar Beta para clientes. Este plano é o índice operacional vivo; não substitui código, ADRs nem evidência de testes. Não reduzir o escopo para um MVP sem nova decisão explícita.

## 1. Como consultar este documento

- **Entrada rápida:** [V35_SESSION_CURSOR.md](V35_SESSION_CURSOR.md) indica a única microentrega ativa, os bloqueios e a próxima ação.
- **Contrato e arquitetura:** `AGENTS.md`, `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, código atual e `docs/adr/`; documentos históricos não provam comportamento executável.
- **Histórico técnico:** `SESSION_HANDOFF.md` (registro acumulado), `docs/V35_REMAINING_WORK.md` (lacunas já identificadas), `docs/V35_PILOT_V35_INVENTORY.md` e `docs/V35_PILOT_PARITY.md` (escopo original).
- **Fonte da verdade por afirmação:** código/DB/CI/ambiente real e revisão Git exata. Anotações antigas ou estados de `V35_COVERAGE.md` **não** reabrem entregas sem nova evidência.
- **Arquivos `sources/`, quando presentes, são somente leitura.** Não alterar HTML de referência, textos legais ou protótipos para fazer o código passar.

## 2. Semântica de estados

- `A_CONFERIR`: não houve reconciliação suficiente de inventário, código e evidências; **não** presumir falta de implementação.
- `PENDENTE_CONFIRMADO`: ausência/limitação demonstrada em código ou evidência recente; exige microentrega.
- `EM_EXECUCAO`: há branch/revisão e trabalho delimitado em andamento.
- `PR_ABERTO`: código/documentação propostos, ainda não integrados; CI informado à parte.
- `INTEGRADO`: PR incorporado, mas **não** necessariamente publicado/homologado.
- `HOMOLOGADO_DEV`: comportamento do escopo comprovado em DEV; não significa pronto para PROD.
- `CONCLUIDO`: critérios funcionais, segurança, qualidade e evidências exigidas para a microentrega satisfeitos.
- `BLOQUEADO`: ação pendente de decisão, acesso ou pré-requisito externo identificado.

Cada microentrega tem **um único ID permanente**. Não promover por inferência, não apagar o histórico e não transformar CI verde em homologação de HTTP, navegador, RLS ou entrega de e-mail.

## 3. Macroetapas

| ID | Macroetapa | Condição de conclusão | Estado atual |
|---|---|---|---|
| M00 | Controle de execução e continuidade | Plano, cursor e protocolo de revisão incorporados | PR de documentação em preparação |
| M01 | Onboarding, identidades e convites | Provisionamento → convite → aceite → vínculo de Loja/papel/termos, autorizado e recuperável | PENDENTE_CONFIRMADO |
| M02 | Operações financeiras da Loja | Todos os cenários V35 faltantes reconciliados e homologados; invariantes preservadas | A_CONFERIR |
| M03 | Contabilidade, DRE e relatórios completos | Plano publicado com segurança, rubricas validadas, Diário/Razão e exportação integral | PENDENTE_CONFIRMADO |
| M04 | Operação Master SaaS | Catálogo, contratos, faturamento e suporte nos fluxos aprovados | A_CONFERIR |
| M05 | Privacidade, recuperação e segurança operacional | Portabilidade, retenção, auditoria, backups e recuperação verificáveis | PENDENTE_CONFIRMADO |
| M06 | Paridade integral V35 e qualidade transversal | 21 telas e fluxos de inventário conferidos, inclusive mobile/acessibilidade e regressão direcionada | A_CONFERIR |
| M07 | Release integral e entrada em operação | Ambiente PROD separado, implantação auditada, rollback, aceite do proprietário, Beta liberado | BLOQUEADO por M01–M06 e aprovação específica |

**Progresso percentual:** não informado até existir matriz de aceite por requisito reconciliada com o código. Quantidade de telas presentes não é percentual de conclusão.

## 4. Microentregas rastreáveis

| ID | Entrega verificável | Situação na retomada | Evidência inicial / condição |
|---|---|---|---|
| M00.01 | Criar quadro mestre, cursor e regra de atualização | CONCLUIDO | PR #25 integrado em `639ef08a`; cursor e quadro disponíveis em `main` |
| M00.02 | Reconciliar microentregas de cada macro com inventário e código antes de executar | A_CONFERIR | Não reutilizar estados históricos como pendências |
| M01.01 | Consumidor idempotente e autorizado do job `onboarding_invite` | INTEGRADO | PR #26 em `b32692dc`; migration DEV `20261109184607`, Edge ACTIVE v1/JWT; end-to-end JWT real/convite **não homologado**, sem envios |
| M01.02 | Claim/lease, retry, expiração, deduplicação e reconciliação de envio Auth | INTEGRADO | PR #28, CI 3/3 PASS; migration DEV `20261109190747` aplicada, permissões/expiração/observação SQL rollback PASS; **retry permanece bloqueado** sem evidência externa e JWT HTTP real não testado |
| M01.03 | Vínculo explícito à Loja, perfil inicial e aceite versionado | INTEGRADO | PR #31 integrado em `0addb828`; CI 3/3 PASS; callback e documento SHA-256 fail-closed; migration/UI/Edge **não publicados DEV**, termos oficiais e JWT real pendentes |
| M01.04 | Homologar convite real DEV com usuário autorizado, negativas e auditoria | BLOQUEADO | Depende de termos oficiais aprovados, ativação técnica M01.03 no DEV, destinatário de teste e autorização separada de envio/JWT real |
| M02.01 | Reconciliar operações financeiras e cadastros V35 | INTEGRADO | [Matriz de requisitos, código e gates](V35_M0201_FINANCIAL_RECONCILIATION.md), PR #33 integrado `a320ca9a`. |
| M02.02 | Implementar lacunas financeiras confirmadas | INTEGRADO | A/B/C/D integradas: PR #34, #37, #38 e #40 / `86f1c626`; CI #459 3/3 PASS; DEV não publicado nem homologado. [Gate financeiro](V35_M0203_DEV_GATE.md). |
| M02.03 | Aceite funcional financeiro final sem repetir gates equivalentes | AGUARDA_AUTORIZACAO_DEV | [Roteiro específico](V35_M0203_DEV_GATE.md) preparado, sem execução; exige migration D e frontend DEV autorizados, JWT/QA real A/B e checks financeiros novos. |
| M03.01 | Publicação versionada e idempotente do plano contábil | INTEGRADO_COM_GATES_PENDENTES | `AccountingPrepublication.tsx`, RPC `publish_validated_accounting_plan`, migrations DEV `20261009162535`/`20261009165809`, ADRs 0014/0015 e testes UI/SQL A/B rollback já presentes; read-back DEV confirma funções e grants. JWT real, concorrência e UX final não homologados; não reconstruir. |
| M03.02 | Validar com regra de negócio as rubricas e mapeamentos contábeis V35 | AGUARDA_DECISAO_CONTABIL | Sem classificação arbitrária; validar rubricas de dedução, competência, correções e cancelamentos com profissional contábil e proprietário [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43). |
| M03.03 | Completar DRE por rubricas e preservar competência/histórico | PARCIAL_INTEGRADO | PR #42 integrado `b9b0fb54`, CI #463 3/3 PASS; receita registrada, custo, despesas, resultado antes do financeiro e resultado financeiro; Receita Bruta/Deduções/Receita Líquida aguardam classificação por plano/competência [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43); DEV não publicado. |
| M03.04 | Implementar Diário/Razão detalhados e exportação integral conciliável | BLOQUEADO_DECISAO_CONTABIL | V35 requer partidas e contrapartidas balanceadas que as views DRE e caixa não trazem; matriz de eventos [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43). Exportação atual permanece recorte, nunca livro completo. |
| M04.01 | Reconciliar emissão manual SaaS, ciclos e contratos | PARCIAL_RECONCILIADO | [Evidência e gates](V35_M0401_MANUAL_BILLING_RECONCILIATION.md): `MasterBilling`, preview/emissão idempotente, migration e RPCs já existentes no DEV; anon negado; JWT Master/AAL2 real, ciclos/contratos/preços e faturas reais não homologados. Não reconstruir. |
| M04.02 | Reconciliar sessões temporárias Master e limites somente leitura | INTEGRADO_COM_GATES_PENDENTES | PR #45 merge `e9976342`, CI #467 3/3 PASS; validação frontend de tenant/escopo/15min e idempotência; sem homologação JWT Master/AAL2, concorrência e auditoria em DEV. |
| M04.03 | Completar operação de jobs, erros, SLA, trilhas e fluxos restantes Master | EM_EXECUCAO | M04.03-A Saúde/Jobs read-only filtrável por status/tipo/Loja e paginação keyset em revisão. Política SELECT Master sem AAL2 explícito — [issue #46](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/46); endurecer servidor em PR separado. Sem retry. |
| M04.04 | Definir integrações de pagamento/fiscal/automação não incluídas no contrato V35 | A_CONFERIR | **Não** ampliar escopo para gateway automático sem decisão comercial e custo aprovado |
| M05.01 | Portabilidade, correção, minimização e retenção de dados no backend | PENDENTE_CONFIRMADO | `Configuracoes.tsx` mantém funções em homologação; não apagar ledger histórico |
| M05.02 | Backups, restauração comprovada, monitoramento e runbooks operacionais | A_CONFERIR | Exigir evidência de restauração, não apenas opção na interface |
| M05.03 | Termos, consentimento, autorização e segurança de release | A_CONFERIR | Aceite versionado, least privilege, MFA, RLS e LGPD proporcional |
| M06.01 | Matriz de equivalência funcional de todas as 21 telas com inventário V35 | A_CONFERIR | Presença de componente ≠ paridade completa dos controles/ações |
| M06.02 | Desktop/mobile, teclado/acessibilidade, vazio/erro/loading, tema e ergonomia | A_CONFERIR | Conferir telas e fluxos impactados sem repetir testes visuais já aprovados |
| M06.03 | Suite final por risco: autorização A/B, integridade, concorrência, regressão e recuperação | A_CONFERIR | Planilha de evidências por critério; resultados não executados nunca são PASS |
| M07.01 | Preparar e isolar PROD, custos, domínio e configuração pública | BLOQUEADO | Não tocar PROD, secrets, Workers existentes ou credenciais sem aprovação |
| M07.02 | Implantação controlada, migrations, backup/rollback e smoke pós-publicação | BLOQUEADO | Apenas após M01–M06 e autorização específica |
| M07.03 | Aceite integral V35 e autorização explícita para Beta/cliente | BLOQUEADO | Beta **apenas após V35 completa** conforme decisão de 03/11 |

## 5. Regra por ciclo de desenvolvimento

1. Ler `docs/V35_SESSION_CURSOR.md`, verificar `git status` e `origin/main` e preservar alterações locais; nunca `reset --hard` por conveniência.
2. Inspecionar **apenas** o domínio da microentrega ativa: contratos, código, migrations, consumidores e evidências relevantes.
3. Reclassificar `A_CONFERIR` somente após evidência. Se já entregue, referenciar commit/PR/teste e **avançar**, sem reconstrução.
4. Executar **uma** microentrega por PR pequeno, com descrição de escopo, riscos, compatibilidade, testes impactados e critérios de aceite.
5. Após CI, registrar separadamente: **codificado**, **integrado**, **publicado DEV**, **homologado DEV**. Merge de baixo impacto DEV segue autorização existente; segurança crítica ou ativação de novos acessos exige autorização específica; PROD sempre exige aprovação.
6. Atualizar o cursor **na mesma revisão** do código e acrescentar o fato à parte superior de `SESSION_HANDOFF.md`; atualizar arquitetura/contexto/ADR/segurança quando o impacto justificar.
7. Não repetir gates aprovados sem mudança material que invalide a evidência; registrar essa justificativa quando houver repetição.

## 6. Definição de concluído

Para marcar um ID como `CONCLUIDO`: requisito e regra de negócio localizados; implementação verificada na revisão indicada; testes pertinentes (inclusive negativas, se acesso/financeiro); ambiente e publication state declarados; evidências/riscos remanescentes escritos; documentação/handoff atualizados. Se algum desses passos for **não aplicável**, justificar. PR aberto ou CI verde sozinho não satisfaz todos os itens.

**Limites permanentes:** Supabase DEV `szqkdekwhzxsoxorgvaz` para trabalhos autorizados; sem produção, mudança de secrets/credenciais, deleção/renomeação de Workers nem leitura de chaves do navegador. Ativação de novas capacidades sensíveis requer aprovação específica.
