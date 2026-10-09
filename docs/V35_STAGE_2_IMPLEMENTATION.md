## Incremento 9 — Pré-validação contábil sem publicação, 2026-10-09

Foi aplicada no Supabase DEV a migration `20261009041818_accounting_plan_prepublication_preview`. A nova RPC `preview_accounting_plan_publication(organization_id,plan_id)` é diagnóstico **somente leitura** e exige `accounting.manage` (incluindo assinatura elegível), com `anon` sem EXECUTE, validação da Loja e do plano. Não modifica nenhum plano, mapeamento, conta, charge ou payment. O relatório JSON traz `ready`, lista de razões `issues` e contagens para: status draft, início futuro, sobreposição com published, estrutura vazia, analíticas ativas, hierarquia inválida, ciclos contábeis, categorias ativas sem mapeamento, contas bancárias/caixa ativas sem mapeamento e mapeamentos que passaram a apontar para conta inativa/natureza incorreta. Verificação instantânea **não garante** que os dados permanecerão válidos até a publicação.

UI de Plano de Contas: componente `AccountingPrepublication`, botão “Verificar condições de publicação”, mensagens em português e contagens de pendências. Limites de escopo e de resposta são verificados no cliente apenas como defesa adicional, jamais como autorização. Sessão de verificação é descartada ao trocar de plano ou após configuração alterada; falha/resultado desconhecido não indica aprovação. **Não há botão de publicação neste incremento.** Uma futura RPC transacional deverá repetir todos os critérios com lock e idempotência imediatamente antes de publicar. O comando legado `publish_accounting_plan` continua existindo no banco e já checa vínculos ativos e sobreposição; não foi alterado nem invocado pela interface desta entrega.

`scripts/verify_dev_accounting_prepublication.sql` retornou `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS` em A/B: rascunho 91 contas sem vínculos foi negado, preenchimento válido de todas as categorias e contas financeiras ficou pronto, inativação de alvo e ciclo pai/filho detectados, estrutura vazia e sobreposição publicada rejeitadas, outros tenant/usuário e TREASURER/VIEWER/assinatura suspensa negados, anon sem EXECUTE. Fixture de teste e alterações de roles/assinaturas foram totalmente revertidos. Estado anterior confirmado: 6 planos, 14 contas próprias, 91 contas-modelo, 17 charges e 16 payments. SQL com claims simuladas não é HTTP/JWT real nem corrida simultânea entre sessões; visual/mobile V35 e publicação real não foram homologados.

## Incremento 8 — Plano de Contas V35: rascunhos e vínculos, 2026-10-08 Brasil / 2026-10-09 UTC

Inspeção DEV: uma estrutura padrão `corsys_complete_br` com 91 contas-modelo e 86 vínculos hierárquicos; tabelas `accounting_plans`/`accounting_accounts`/`financial_category_account_mappings`/`financial_account_accounting_mappings` já existentes, com 6 planos de teste e 14 contas reais. ADR canônico `docs/adr/v35/0016-accounting-plans-effective-dating.md`: publicado é imutável e válido somente entre primeiro/último dia de competência mensal. O sistema existente já possuía `create_accounting_plan` (template, cópia de plano, blank) e `publish_accounting_plan`, com bloqueio de sobreposição/ausência de mapeamentos; **não duplicamos esse esquema**.

Nova migration DEV `20261009014331_tenant_accounting_drafts_and_mappings`: RPC `create_tenant_accounting_draft` reutiliza o constructor existente, mas exige `accounting.manage`, início em mês futuro, autorização RLS/tenant, idempotência server-side e motivo auditado. RPC `set_draft_accounting_mapping` vincula categoria ou conta de caixa/banco a conta analítica ativa em draft próprio, restringe nature `revenue`/ `cost|expense|financial_result` / `patrimonial`, lock no plano, comparação explícita de conta esperada para evitar lost update, idempotência/audit. Backends existentes continuam protegendo planos publicados e validando FK/compatibilidade. Sem grants nas tabelas nem alterações de RLS, cobranças, pagamentos ou plano publicado.

UI `AccountingPlans` integrada em `FinancialStructure`: lista de planos próprios (publicado apenas leitura), criação de draft com template real/duplicata/blank, vigências mensais, leitura das contas e configuração de vínculos compatíveis por tipo/domínio. Falha de transporte preserva mesmo payload/chave; conflito `40001` exige atualização. Não oferece publicação automática e deixa pendente validação de cobertura antes de expor publicação. Limites UI 100 planos, 200 categorias/contas e 300 contas/vínculos por plano, sem paginação total (risco de catálogos maiores).

`scripts/verify_dev_accounting_draft_mappings.sql` executado no Supabase DEV e retornou `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS`: ADMIN A/B, idempotência de plano/mapeamento, 91 contas e 86 pais, duplicação de contas e vínculos, segunda alteração condicionada, rejeição de stale/natureza errada/FK cruzada/roles sem permissão/suspensão, escrita direta negada, plano published rejeitado, anon sem EXECUTE e invariantes charges/payments intactas. Todas as alterações de teste foram revertidas. Claims simuladas SQL não comprovam sessão JWT por HTTP, corrida de múltiplas conexões, revisão visual/mobile ou paridade integral com os 21 painéis V35. Frontend/CI conferir na revisão final.

## Incremento 7 — Identidade institucional da Loja, 2026-10-08 Brasil / 2026-10-09 UTC

A tabela existente `organization_settings` passa a ter comando exclusivo `save_tenant_identity` com `settings.manage`/bloqueio de assinatura, idempotência, escopo por Loja, lock na organização para inicialização concorrente, atualização apenas de telefone, e-mail, chave PIX, endereço, CEP, cidade, UF e país. Exige `expected_updated_at` em edições e rejeita revisões antigas. Não altera logo, textos de relatório, timezone ou outras configurações. Auditoria registra campos e motivo, sem gravar dados privados/PIX. UI em `TenantIdentity.tsx` com formulário vinculado e retry seguro, conectada ao Plano de Contas. Nenhuma operação monetária decorre do armazenamento da chave PIX.

Migrations DEV `20261009012944_tenant_identity_commands` e `20261009013042_tenant_settings_monotonic_version`, incluídas no manifesto com hashes. A segunda migração corrige especificamente o trigger `organization_settings_set_updated_at`, cujo helper compartilhado usava `now()` (timestamp fixo dentro da transação), tornando conflitos indistinguíveis. Novo trigger exclusivo usa `greatest(clock_timestamp(),old.updated_at + interval '1 microsecond')`. Outras tabelas preservadas.

`scripts/verify_dev_tenant_identity.sql` passou em A/B com transação `ROLLBACK`: primeira gravação/retry, update/versionamento monotônico, stale, cadastro repetido, e-mail inválido, auditoria sem chave PIX, INSERT/UPDATE direto negado, TREASURER/VIEWER/suspensão negados e charges preservadas. Claims SQL simuladas não provam HTTP/JWT real, corrida simultânea de conexões independentes ou revisão visual desktop/mobile. Esses gates e a paridade integral V35 permanecem pendentes.

## Incremento 6 — catálogos de tesouraria, 2026-10-08 Brasil / 2026-10-09 UTC

Implementados cadastro, leitura, ativação e desativação de contas financeiras, fundos e formas de pagamento no módulo Plano de Contas. Duas RPCs servidor `create_treasury_catalog_item` e `set_treasury_catalog_status` exigem `settings.manage` e assinatura elegível, validam tipo/parametrização, têm idempotência, auditoria, lock e rejeição de duplicata de nome normalizado. Alterar status usa pré-condição `expected_active`, com erro `40001` para concorrência e atualização obrigatória; não há exclusão de linha nem lançamento de caixa/ledger. Leitura cliente segue grants SELECT/RLS existentes e verifica organização explicitamente. Formulários mostram falhas e permitem retry idempotente de resposta ambígua.

Migrations DEV `20261009011416_tenant_treasury_catalog_commands` e correção aditiva `20261009011533_treasury_catalog_scope_error_fix`, ambas no manifesto com SHA. A segunda corrige retorno de item inexistente sob SQL dinâmico (`EXECUTE INTO` não altera `FOUND`) e preserva segurança fail-closed. Nenhuma alteração de tabela/RLS/grants de tabela, fatos financeiros ou produção.

`scripts/verify_dev_treasury_catalog.sql` executado com `DEV_TREASURY_CATALOG_ROLLBACK_PASS` nas duas Lojas A/B: criar conta/fundo/meio, payload/retry idempotente, nomes duplicados, campos não permitidos, status/reativação/staleness, auditoria, IDs e leituras cruzadas negados, TREASURER/VIEWER/assinatura suspensa negados, anon sem EXECUTE, escrita direta negada e charges/payments preservados. Todos os fixtures foram revertidos. Claims SQL simuladas não equivalem a sessão HTTP/JWT real, concorrência simultânea ou aprovação de telas V35. Catálogo de fundo vazio no DEV permanece vazio até cadastro autorizado.

**Paridade parcial:** contas/fundos/formas do `view-plano-contas`; pendem vínculos contábeis, status em operações posteriores, saldos, caixa/bancos, conciliação, meios adicionais do piloto, 91 códigos, parâmetros da Loja e testes visual/mobile.

## Incremento 5 — sucessão/encerramento de termos futuros, 2026-10-08

Implementado o comando `transition_member_term`: ADMIN/`settings.manage`; usa idempotência, validação de escopo, lock de integrante e linha, auditoria, requisito de competência futura e encerramento inclusivo na competência anterior. Escolha de término sem sucessor retorna ao valor da regra geral; sucessor pode ser `standard`, `exempt` ou `override_amount`. O tipo/valor do termo anterior, cobrança e pagamento já registrados permanecem intactos. Não substitui geração de cobranças.

Schema aplicado somente no Supabase DEV, migração `20261008211155_member_term_transition`; fonte e sha256 versionados no manifesto. UI `MemberConfiguration` acrescenta a substituição/encerramento de termo sem fim, seleção da competência, valor/isenção, motivo e botão de atualização após conflito. O formulário usa o retry idempotente e a autorização do banco; `40001` é conflito definitivo, não resultado ambíguo.

Testes SQL reais com `ROLLBACK` executados no DEV para organizações A/B: cenário positivo, retry idempotente, vigência/sucessor, fechamento puro, valores inválidos (NaN, Infinity, precisão, overflow), período inválido, referência cruzada, `40001`, auditoria, cargos TREASURER/VIEWER e assinatura suspensa negados, anon sem EXECUTE e contagens de charges/payments preservadas: `DEV_MEMBER_TERM_TRANSITION_ROLLBACK_PASS`. Script versionado em `scripts/verify_dev_member_term_transition.sql`. SQL com claims AAL1 simuladas não equivale a HTTP/JWT real ou corrida simultânea; novo frontend/CI, preview e paridade integral requerem homologação separada.

Próximo: contas/fundos/meios, parâmetros da Loja, plano/mapeamentos, regras especiais e operações financeiras, sem perder o escopo do HTML V35.

# V35 — etapa 2: integrantes, parâmetros e estrutura financeira

## Incremento 4 — categorias e regras mensais, 2026-10-08

Implementados cadastro de categoria (nome, descrição, domínio, ativa/inativa, recorrência de integrante e parcelamento), regra mensal (descrição, categoria elegível, valor positivo, competência inicial futura, dia1..31) e preço sucessor futuro. Integração na área Plano de Contas/Categorias e Regras, layout comum por Loja. Não homologar o Plano de Contas completo.

RPCs settings.manage: IDs próprios, allow_recurrence/active/member_receivable obrigatórios para regra, idempotência, auditoria, rejeição de nomes duplicados, preços finitos de2casas até999999999999.99. Reajuste serializa pela regra, exige UUID da última versão (stale40001), encerra período anterior no mês antes do sucessor e acrescenta preço. Valor original preservado; charges/payments não recebem UPDATE/INSERT. Alteração futura não muda cobranças postadas.

UI consulta até200categorias/regras/preços; preços limitados aos IDs de regras próprias. Erro/empty/retry explícitos, resposta ambígua mantém envio e bloqueia campos, conflito requer atualização. Última versão exibida pode ser uma programação futura. Limite200não é paginação completa; se amostra não inclui última versão, backend nega versão obsoleta. Históricos/cargas maiores exigem paginação.

Verificação: DEV_MONTHLY_RULE_CATALOG_ROLLBACK_PASS antes/depois migration20261008203643; positivosA/B categoria/regra/preço, retrymesmoUUID/semduplo audit, payload alterado22023, duplicado23505, futuro/precisão/NaN/Infinity22023, IDs estrangeiros23503, staleness40001, leitura cruzada oculta, escrita direta negada, TREASURER e assinatura suspensa3RPCs42501, anon semEXECUTE, termo isento em nova regra positivo; counts charges/payments preservados. Claims SQL simuladas, NÃO HTTP/JWT real ou corrida simultânea. TudoROLLBACK;8categorias originais, regras/preços/termos0, ADMIN A/B/assinaturasactive/flagsallow_recurrencefalse conferidos.
Typecheck,45testes frontend e build PASS, sem auth/deploy com placeholder. CI registrar no PR após push. Advisors43/3/1, sem nova política/grant de tabela. Changelog/documentação oficial consultados; PostgreSQL17.11 e nenhum índice público gistfloat/ltree encontrado na inspeção restrita relevante. Não é auditoria integral das alterações da plataforma.

Paridade parcial obrigatória: DYN-008 natureza neutra/repasse e vínculo contábil DRE ainda pendentes; domínio operacional não substitui natureza contábil. DYN-009 mensal implementado, regras especiais/anuais/institucionais, edição/ativação e geração/prévia ainda pendentes. Flags de parcelamento configuradas não homologam a jornada de parcelamento. Não concluir etapa2 nem perder mútuas710–721/722–745, GLP, ágapes, joia e demais regras documentadas. Reajuste não executa cobrança/Stripe.

Recuperação: forward-fix; se falha operacional, revogar EXECUTE das três RPCs e manter leituras/histórico. Sem reset/drop/backfill/produção. Migração23 no manifesto com hash alinhado. Próximo: sucessão de termos individuais e catálogos/estrutura contábil restantes.


## Validação final de valores individuais — 2026-10-08

Migration20261008202409 rejeita NaN/Infinity/-Infinity, valores acima de999999999999.99, negativos e precisão maior que2casas com22023 antes de qualquer persistência. Correção aditiva da RPC, sem editar migration já aplicada; mesmo catálogo/permissões/idem/audit. PostgreSQL aceita NaN em comparação não negativa; validação explícita necessária no servidor, além do formulário. Teste rollback ampliado NaN/Infinity/overflow passou antes/depois de aplicação. Nenhum valor não finito persistido pelo teste. Total22migrations alinhadas ao manifesto. Advisors permanecem40/3/1.
CI do incremento cargos/termos8a4beff0:37838896130/run46 completed success. Nenhuma publicação feita pela CI (bundle apenas validado sem upload). CI da correção de validação conferir no commit seguinte. Etapa2 em execução; HTTP real novo e paridade visual pendentes.


## Etapa 2 — cargos e termos futuros, 2026-10-08

Implementados catálogo de cargos (criação), atribuição com vigência e programação de mensalidade individual/isenta/geral. Migration CLI2.119.0 alinhada ao DEV20261008201550, duas RPCs idempotentes/auditadas com search_path vazio, require_permission antes de consultas e sem grants diretos ou alterações de RLS. settings.manage (ADMIN) para catálogo/termos; members.write (ADMIN/TREASURER) para atribuição de cargo. Motivo de programação obrigatório.
Termos começam em competência futura, cargos hoje ou depois; exclusões existentes rejeitam sobreposição. Vários cargos diferentes simultâneos continuam permitidos pelo contrato existente. Configurações não reescrevem ledger nem geram cobranças. Sucessão/encerramento de vigência aberta, ativação/desativação de catálogo e regras/preços versionados ainda pendentes.
Tela conectada lê quatro tabelas com organização/integrante explícitos, AbortSignal e rejeição de escopo inesperado. Mostra históricos, vazio real e até200registros. Falha ambígua bloqueia edição e repete mesma chave/payload até confirmação. Catálogo de regras mensais permanece vazio no DEV; fluxo mensal depende do próximo incremento de regras/categorias/preços, sem catálogo fictício persistido para aparentar funcionamento.

DEV_MEMBER_CONFIGURATION_ROLLBACK_PASS antes/depois de DDL; após aplicação também ADMIN A/B positivos, retries, sobreposição23P01, IDs estrangeiros23503, precisão/retroatividade22023, auditoria, TREASURER cargo positivo/configuração financeira negada, VIEWER e suspensão42501, anon sem EXECUTE. Claims SQL simuladas; NÃO nova prova HTTP/JWT ou corrida simultânea. Todos fixtures e mudanças de papel/assinatura/eligibilidade revertidos por ROLLBACK.
Typecheck/39 testes frontend/build PASS, chave pública placeholder só para build, sem publicação/homologação visual. CI desta entrega conferir no commit remoto. Advisors:40RPC definer autenticadas (38 anteriores +2 novas intencionais),3backend RLS sem policy e aviso preexistente de senha vazada; não declarar scanner limpo.
Próximo: categorias elegíveis e regras mensais/preços com vigência; depois sucessão de termos e estruturas financeiras. Etapa2 EM EXECUÇÃO. Paridade integral do HTML V35 continua obrigatória, inclusive campos ainda ausentes no banco. Produção e entrada em operação não autorizadas.


## Etapa 2 — cadastro/edição cadastral implementados, 2026-10-08

Novo comando public.save_member_profile usa members.write (ADMIN/TREASURER no catálogo existente), require_permission e bloqueio de assinatura. Payload permitido limitado a dados cadastrais; desconhecidos/CPF/organization_id/roles/valores financeiros rejeitados. Criação/edição transacionais por RPC, sem INSERT/UPDATE/DELETE direto para authenticated, sem alteração de RLS.
Reutiliza idempotency_begin/complete; mesmo envio retorna UUID sem novo audit, chave com payload diferente22023. Edição bloqueia a linha e compara updated_at exato, stale40001; ID estrangeiro23503, org/perfil/status não permitido42501. Trigger específico de members avança updated_at com clock_timestamp/maior que anterior, inclusive dentro da mesma transação; demais tabelas mantêm trigger original.
Audit registra ator, entidade, situação e nomes dos campos alterados; não copia contatos/observações para snapshots. Motivo livre deve evitar dados sensíveis desnecessários.
Formulário conectado ao Workspace: nome/preferencial, quatro situações, texto de grau/cargo, telefone/WhatsApp/e-mail, datas e observações; motivo obrigatório, duplicidade bloqueada, conflito pede reload. Falha ambígua mantém payload/chave e campos bloqueados até confirmação por retry; callback tardio não atualiza outra Loja.
Grau/cargo textual não substitui catálogo/cargo vigente. Termos futuros e cargos com vigência implementados no incremento seguinte; regras/preços, sucessão de termos, criação de login, CPF, vínculos e paridade integral continuam pendentes; não concluir etapa2.

Migration gerada pela CLI2.119.0 e aplicada no DEV com versão20261008195936; fonte/hash no manifesto. Recuperação: forward-fix aditivo; se houver falha operacional, revogar EXECUTE da novaRPC e manter leituras/dados, sem apagar integrantes/ledger. Não aplicada produção.
DEV_MEMBER_PROFILE_COMMANDS_ROLLBACK_PASS antes e depois da aplicação: positivosA/B, retry, payload divergente, mass-assignment/date/name inválidos, estrangeiros, escrita direta, stale, VIEWER, suspensão e Master sem papeltenant. Claims simuladas/SQL, NÃO HTTP/JWT real novo. Zero integrantes temporários remanescentes; A/B ADMIN e assinaturasactive conferidos.
npm run check PASS: typecheck,36 testes frontend, build com chaveplaceholder; build não prova login/deploy. HTTP real novo, concorrência simultânea e homologação visual pendentes. CI do incremento de consulta880cc5a/run37834705645success; novaCI conferir após push.

Advisors pós-DDL:38 RPCs definer autenticadas (37 existentes + novaRPC intencional com require_permission),3 tabelas backend RLS sem policies e aviso preexistente de proteção contra senhas vazadas. Não declarar scanner zero nem modificar grants/RLS backend para remover avisos:
- [RPC autenticada definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Tabelas backend sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)


Estado: EM EXECUÇÃO. Etapa 1 encerrada conforme V35_STAGE_1_CLOSURE_REPORT.md.
Fonte obrigatória: V35_PILOT_V35_INVENTORY.md, HTML V35, ADRs e matrizes de cobertura. Não reduzir campos/regras ao que já existe no banco.

## Conciliação inicial — 2026-10-08

| Área obrigatória | Fonte atual observada | Lacuna/entrega |
|---|---|---|
| Busca de integrantes e situação cadastral | view-integrantes-F001/F003; members tem active/away/inactive/disconnected | Implementados busca por nome/preferencial/telefone/WhatsApp/e-mail, filtro, reset e contagem da amostra |
| Ficha cadastral | members possui nomes, degree_or_office, contatos, iniciação/admissão e notes | Consulta implementada dos campos existentes, sem CPF; cadastro/edição ainda pendentes |
| Cargo com vigência | member_offices referencia office_type_id com effective_from/to | Não tratar texto degree_or_office como cargo vigente; catálogo (criação), histórico e programação futura conectados; sucessão/encerramento e catálogo completo pendentes |
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

Contratos de criação/edição de integrante e termos, com validação server-side, autorização members.write, ID estrangeiro negado, auditoria e vigência. Conferir permissões/ADRs antes de escolher contrato; members.write foi conferida no catálogo e utilizada no incremento acima; o texto abaixo preserva a conciliação inicial.
Mensalidade/isenção não devem ser campos soltos que alteram valores históricos. Manter layout único entre todas as lojas.

