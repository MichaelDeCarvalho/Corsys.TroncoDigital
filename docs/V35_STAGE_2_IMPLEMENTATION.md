# V35 — etapa 2: integrantes, parâmetros e estrutura financeira

Estado: EM EXECUÇÃO. Etapa 1 encerrada conforme V35_STAGE_1_CLOSURE_REPORT.md.
Fonte obrigatória: V35_PILOT_V35_INVENTORY.md, HTML V35, ADRs e matrizes de cobertura. Não reduzir campos/regras ao que já existe no banco.

## Conciliação inicial — 2026-10-08

| Área obrigatória | Fonte atual observada | Lacuna/entrega |
|---|---|---|
| Busca de integrantes e situação cadastral | view-integrantes-F001/F003; members tem active/away/inactive/disconnected | Implementados busca por nome/preferencial/telefone/WhatsApp/e-mail, filtro, reset e contagem da amostra |
| Ficha cadastral | members possui nomes, degree_or_office, contatos, iniciação/admissão e notes | Consulta implementada dos campos existentes, sem CPF; cadastro/edição ainda pendentes |
| Cargo com vigência | member_offices referencia office_type_id com effective_from/to | Não tratar texto degree_or_office como cargo vigente; catálogo e histórico ainda precisam de UI/comandos |
| Isenção e valor individual | DYN-015-F007/F008; recurring_member_terms contém term_type/override_amount/effective_from/to | Implementar edição versionada vinculada à regra; individual prevalece sobre geral e isenção ativa impede geração. Sem valor fixo na ficha |
| Status/saldo por período | view-integrantes-F002, A001/A002 e tabela piloto | Consulta financeira atual separada; filtro de período, status derivado, mensalidade, isenção, saldo/crédito e último pagamento ainda obrigatórios |
| Cadastro/edição de integrantes | DYN-015-F001..F008 | members tem somente policy SELECT; nenhuma RPC pública de member encontrada. Criar contratos validados/auditados, proteção de ID e concorrência; não abrir INSERT/UPDATE direto por conveniência |
| Categorias e comportamentos | financial_categories: domain, active, allow_recurrence/installments/default_behavior | UI e comandos de configuração, vigências e preservação do histórico pendentes |
| Recorrência e termos | recurring_rules / recurring_member_terms | Configuração etapa2; prévia/geração idempotente e saldos etapa3. Preservar regras mútuas/GLP/ágape/joia definidas no piloto/ADRs |
| Contas/fundos/meios de pagamento | financial_accounts / funds / payment_methods | Cadastros, ativação/desativação e vínculos próprios sem reescrever fatos |
| Plano contábil e mapeamentos | accounting_plans/accounts, category/account mappings | Rascunhos, validação, publicação e sucessoras imutáveis; não alterar plano publicado |
| Identidade e parâmetros da Loja | organization_settings | Editar dados/contatos, timezone e parâmetros previstos no inventário; integrações/secrets separados |

Esta tabela é início de execução, não inventário substituto do piloto completo. Linhas e fragmentos adicionais permanecem obrigatórios conforme a fonte.

## Incremento 1 — consulta cadastral

Código: Members.tsx integrado ao Workspace; loadTenantData seleciona campos reais da tabela members, mantém organization_id/RLS/abort e rejeição de organização inesperada. Até 200 registros carregados, busca na amostra explicitamente indicada; paginação e busca no banco continuam pendentes.
Situação cadastral separada de posição financeira. Texto de grau/cargo é exibido como registrado, sem afirmar histórico vigente. Observações renderizadas como texto, datas sem conversão de fuso, contatos sem envios/automação. CPF não carregado.
Nenhuma migration, grant, policy, usuário, credencial ou valor financeiro alterado.

Verificação executada: typecheck PASS; 32 testes frontend PASS (incluem filtros combinados, busca sem acento/contato, limpeza, ficha e texto sem execução de HTML). Build Vite PASS com chave pública placeholder de validação; não autentica nem constitui publicação.
SQL no DEV com authenticated/claims simuladas A/B: consulta positiva dos campos ampliados e ausência de linhas estrangeiras; DEV_MEMBER_CONSULTATION_COLUMNS_RLS_PASS. Não é nova execução HTTP com credenciais.
Visual autenticado desktop/mobile e deploy deste incremento ainda não verificados. CI remota deve ser conferida após push.

## Próximo incremento

Contratos de criação/edição de integrante e termos, com validação server-side, autorização members.manage, ID estrangeiro negado, auditoria e vigência. Conferir permissões/ADRs antes de escolher contrato; members.manage é intenção a confrontar com catálogo real, não permissão afirmada como existente.
Mensalidade/isenção não devem ser campos soltos que alteram valores históricos. Manter layout único entre todas as lojas.
