# V35 — orçamento operacional DEV

## Publicação e homologação observadas

- Commit funcional `0a3ed4e4a2b37ec98f8a9b3975e23e4d8c1c7eb9`, CI
  `38659598745` (#274) completed success.
- Publicado somente Worker `corsys-tronco-digital-dev`, versão
  `23727d71-ec86-4fc1-8650-346264573d9f`, URL
  `https://corsys-tronco-digital-dev.corsys1.workers.dev/`.
- Asset `index-BG7i9tNZ.js` remoto/local SHA256 idêntico:
  `aa9224bcee67a256a779b37bc236800047c253436825ce7e375e7fb320764518`.
- Sessão autenticada A no navegador: criou `DEV QA ORCAMENTO 0a3ed4e`, adicionou
  R$250 em setembro/2026, removeu e reinseriu a linha, digitou PUBLICAR e publicou.
  Tela confirmou histórico preservado e removeu controles de edição. Consulta
  posterior exibiu R$250/R$500/-R$250 e 200% acima do orçamento.
- Read-back banco: ciclo `ce7f052b-2f0b-4db0-9ff7-e29d44f0b195` published,
  uma linha, um evento budget.publish e três eventos budget.line. Esse novo ciclo
  fictício **permanece no DEV** como evidência imutável de publicação; não confundir
  com a fixture temporária anterior, que foi excluída. Sem movimento no ledger.
- Edge autenticado: 1440x1000 e 390x844 efetivos confirmados no DOM. Campos legíveis,
  sem alargamento horizontal do documento (1425/375 px úteis), tabela mobile com
  rolagem própria (295 px visíveis/650 px de conteúdo). Override restaurado.
  Isso é QA responsivo deste incremento, não paridade integral das 21 telas.
- Negativas HTTP reais anon nas quatro RPCs: HTTP401/SQLSTATE42501, todas PASS.
- Contagens preservadas: 17 cobranças e 16 pagamentos. Novos testes SQL permanecem
  revertidos; somente o orçamento fictício da jornada browser foi persistido.

Sessão real B no Edge concluiu criar rascunho, salvar R$250 em setembro/2026 e
publicar com confirmação. Controles de edição desapareceram. Seletor B mostrou
somente seu ciclo; o ciclo A não apareceu. Read-back confirmou ciclo B
`73d7be4f-bfc2-474c-a7ea-26320fb5b3a5` publicado no tenant B. Ambos os ciclos
fictícios publicados ficam preservados no DEV, sem movimentação financeira.
API cross-tenant com JWTs assinados A/B e concorrência independente ainda não comprovadas. Não converter
o gate SQL A/B ou as negativas anon em aceite desses cenários.

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
Publicação/QA browser deste novo fluxo registrados na seção mais recente acima.
As melhorias anteriores de orçamento consultivo já têm QA positivo separado.

## Segurança e limites de aceite

Guards server-side antes de consultar IDs, replay estrito e lock do ciclo com revisão
de conteúdo impedem sobrescrever edição desatualizada. Publicar revalida fontes e
preserva triggers históricos de imutabilidade. Definer usa search_path vazio e anon
não executa. Backend continua fonte dos valores realizados. Não há escrita offline.

Revisão estática e gates executados não aprovam toda a aplicação. Paridade visual
V35 completa, cenários HTTP A/B, papéis inferiores em todas RPCs e
concorrência independente continuam necessários. Conciliação OFX/CSV e transferência
positiva são outras pendências; Etapa 2 permanece em execução. Sem PROD/merge.
