# V35 — orçamento operacional DEV

## Entrega de 2026-10-14 Brasil

Migration DEV #53 `20261015001840_tenant_budget_lifecycle`, frontend
`BudgetManagement` em Financeiro > Planejar orçamento. Reutiliza estrutura e views
V35; não altera ledger, RLS ou grants de tabela. Decisão: ADR-0006.

Jornada: criar rascunho com início/fim em competência → inserir/substituir/remover
linhas por conta ou fundo → revisar todas as linhas → digitar PUBLICAR e informar
motivo → publicação imutável → acompanhamento em Orçado × realizado.
Contas devem ser analíticas/ativas, de resultado, cobertas por plano publicado na
competência; fundos devem ser ativos da Loja. Histórico publicado permanece.
Limites explícitos: 100 ciclos, 300 contas, 100 fundos e 400 linhas por ciclo.

## Evidência

- Tipos, 224 testes em 36 arquivos e build PASS; sete novos testes cobrem tenant,
  payload/revisão, confirmação, retry idêntico, staleness e orçamento publicado.
- `DEV_BUDGET_LIFECYCLE_ROLLBACK_PASS` no DEV A/B após DDL: create/replay, edição,
  remoção, publicação/replay, payload divergente, stale, vazio, precisão/NaN/Infinity/
  overflow, conta estrangeira, competência, VIEWER, suspensão, anon e escrita direta.
- Fixtures, mudanças de perfil/assinatura, orçamentos e auditorias do gate revertidos.
- Regressões `verify_security_catalog.sql`, `FINANCIAL_INVARIANTS_PASS` e
  `DEV_BUDGET_READ_ROLLBACK_PASS` aprovadas. Preservação: 29 ADRs históricos,
  53 migrations, 51 documentos de baseline, 263 declarações históricas e 21 telas.
- Advisors: 82 funções definer autenticadas (incluem quatro novas intencionais),
  três tabelas backend RLS sem policies e aviso de proteção contra senha vazada.
  Não é scanner limpo; não abrir grants/policies para remover avisos.
- Primeiras tentativas do conector retornaram requestState expirado; consulta
  confirmou função ausente, repetição posterior de apply_migration bem-sucedida
  e migration #53 confirmada. Não foi repetida aplicação após confirmação.

SQL usa claims simuladas; não equivale a JWT HTTP nem sessões concorrentes reais.
Publicação/QA browser deste novo fluxo ainda devem ser registrados após execução.
As melhorias anteriores de orçamento consultivo já têm QA positivo separado.

## Segurança e limites de aceite

Guards server-side antes de consultar IDs, replay estrito e lock do ciclo com revisão
de conteúdo impedem sobrescrever edição desatualizada. Publicar revalida fontes e
preserva triggers históricos de imutabilidade. Definer usa search_path vazio e anon
não executa. Backend continua fonte dos valores realizados. Não há escrita offline.

Revisão estática e gates executados não aprovam toda a aplicação. Paridade visual
V35 completa, desktop/mobile, cenários HTTP A/B, papéis inferiores em todas RPCs e
concorrência independente continuam necessários. Conciliação OFX/CSV e transferência
positiva são outras pendências; Etapa 2 permanece em execução. Sem PROD/merge.
