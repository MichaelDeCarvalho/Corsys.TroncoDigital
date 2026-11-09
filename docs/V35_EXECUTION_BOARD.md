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
| M01.03 | Vínculo explícito do usuário à organização, papel inicial mínimo e aceite de termos | A_CONFERIR | Revisar regras de `user_roles`, `saas_terms_acceptances` e fluxos de ativação; não elevar privilégio automaticamente |
| M01.04 | Homologar convite real DEV com usuário autorizado, negativas e auditoria | A_CONFERIR | SMTP DEV aceitou **um teste de recuperação**, não um convite nem confirmação de entrega |
| M02.01 | Reconciliar pendências reais dos fluxos financeiros e cadastros V35 | A_CONFERIR | Aproveitar gates A/B, JWT/RLS, estornos, recorrência e demais evidências já aprovadas |
| M02.02 | Fechar somente lacunas demonstradas: mútuas, repasse neutro, transferências, aprovações e operações específicas | A_CONFERIR | Conferir código atual e `SESSION_HANDOFF.md`; não reconstruir fluxos homologados |
| M02.03 | Aceite funcional financeiro final sem repetir gates equivalentes | A_CONFERIR | Cobrir somente casos sem evidência, mudanças que invalidem gate anterior e bloqueios reais |
| M03.01 | Publicação versionada e idempotente do plano contábil | PENDENTE_CONFIRMADO | `AccountingPlans.tsx` ainda sinaliza publicação indisponível; revisar RPCs anteriores |
| M03.02 | Validar com regra de negócio as rubricas e mapeamentos contábeis V35 | BLOQUEADO para classificação arbitrária | Não deduzir categorias de descrições; solicitar apenas decisão de negócio indispensável |
| M03.03 | Completar DRE por rubricas e preservar competência/histórico | PENDENTE_CONFIRMADO | Não misturar regime de caixa com competência, nem alterar fatos anteriores |
| M03.04 | Implementar Diário/Razão detalhados e exportação integral conciliável | PENDENTE_CONFIRMADO | XLSX/PDF atuais representam **recortes consultados**, não livros completos |
| M04.01 | Reconciliar emissão manual SaaS, ciclos e contratos | A_CONFERIR | Confrontar migration/PR/DEV; não assumir que ausência de gateway bloqueia cobrança **manual** aprovada |
| M04.02 | Reconciliar sessões temporárias Master e limites somente leitura | A_CONFERIR | Testes P0 e auditoria Master já aprovados em escopos registrados; verificar P1 |
| M04.03 | Completar operação de jobs, erros, SLA, trilhas e fluxos restantes Master | A_CONFERIR | Registrar estados reais; não equiparar queued/sent/delivered |
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
