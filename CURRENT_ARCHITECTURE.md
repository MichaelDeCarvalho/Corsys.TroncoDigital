## Cobrança SaaS Master — Emissão manual de faturas (29/10/2026)

Migração incremental `20261029204044_v35_master_manual_invoice.sql` (ordenada após `20261029021140_v35_master_readonly_support_sessions`) aplicada no DEV com RPCs `preview_saas_manual_invoice` e `issue_saas_manual_invoice`. Operações restritas a operadores `MASTER` com MFA `aal2` (`private.require_platform_staff('MASTER')`). Preço unitário e total derivados estritamente do contrato ativo em `saas_subscription_price_terms`, sem fallback para catálogo de planos ou versões de plano; exige termo unívoco cobrindo todo o mês de competência sem sobreposições ou lacunas (`55000`); proíbe qualquer envio de preços arbitrários pelo cliente e rejeita assinaturas em `trialing` (`55000`). Valida normalização da competência ao primeiro dia do mês (`extract(day from competence) = 1`), prestação de serviço mensal e vencimento >= competência. Verificação atômica de faturas ativas preexistentes bloqueia duplicidade de faturamento para o mesmo período. Idempotência server-side com hash de payload (incluindo descrição normalizada) via `private.idempotency_begin`/`complete`, serialização transacional com lock da Loja (`for update`), numeração sequencial por `saas_invoice_seq` com prefixo da plataforma e registro de auditoria em `saas_master_audit_logs`. Interface `MasterBilling` integrada com consulta prévia detalhada (somente leitura), invalidação imediata de prévia na alteração de parâmetros, descarte de respostas assíncronas concorrentes, bloqueio visual diante de faturas já emitidas, preservação de chave de idempotência em erros de rede incertos e atualização reativa da listagem. Script dry-run `supabase/tests/test_master_manual_invoice_rollback.sql` com rollback transacional completo e conformidade de schemas/FKs. Banco DEV: RPCs instaladas e script SQL rollback PASS em 29/10/2026; read-back sem faturas/itens/auditoria/fixtures persistentes; anon sem EXECUTE nas duas RPCs. Produção não alterada; testes HTTP Master real e concorrência independentes ainda pendentes. ADR-0039.

## Monitoramento de exceções e ErrorBoundary (App.tsx) — 29/10/2026

Serviço `src/lib/error-monitor.ts` e componente `ErrorBoundary` em `src/App.tsx`. Captura falhas de renderização da árvore de componentes React com component stack e categoria `render_error`, renderizando tela de contingência resiliente sem expor stack traces ou dados sensíveis (Clean UI). Captura eventos e erros do ciclo de vida de autenticação (`session_authenticated`, `session_anonymous`, `auth_error`, `auth_retry_requested`) e falhas de inicialização de configuração (`config_error`). Higienização fail-closed via `sanitizeContext` com mascaramento automático de credenciais, senhas, tokens, JWTs e chaves. Sem dependências externas ou telemetria intrusiva.

## Sessões temporárias Master somente leitura (P1) — 28/10/2026


Migração incremental 20261029000000_v35_master_readonly_support_sessions.sql preparada: RPCs `start_master_support_session`, `get_active_master_support_session` e `end_master_support_session`. Exigem operador MASTER com garantia MFA AAL2 (`private.require_platform_staff('MASTER')`), vinculação rígida a `auth.uid()` e à Loja (`organization_id`), motivo obrigatório (5..500 caracteres) e escopo estritamente `read_only`. Validade determinística no servidor de 15 minutos (`clock_timestamp() + interval '15 minutes'`), replay sem duplicação ou renovação de sessão expirada, bloqueio de sessão ativa concorrente para o mesmo operador/Loja e encerramento idempotente auditado em `saas_master_audit_logs`. Integração em `MasterOperations.tsx` (aba Suporte) com seleção de Loja, contador regressivo, encerramento sob demanda e bloqueio fail-closed em caso de erro da RPC. Script dry-run `supabase/tests/test_master_support_sessions_rollback.sql` com rollback transacional completo. P0 de suporte homologado em DEV; P1 preparado no código/testes locais, SQL remoto NÃO aplicado. ADR-0038.

## Ferramenta de homologação suporte DEV — 28/10/2026

Build opcional VITE_SUPPORT_QA_ENABLED=true inclui support-qa.html com alvos DEV/atores/fixtures fixos; SDK conserva credenciais no navegador e exibe somente status HTTP/SQLSTATE/IDs de teste. Nenhuma autorização adicional; RPCs/RLS seguem fronteira confiável. Sessão real Master AAL2 validada. Relatório docs/V35_P0_SUPPORT_20261028.md.

## Entrada com MFA existente — 28/10/2026

ConnectedApp valida identidade e MfaGate verifica assurance antes do Workspace. TOTP existente usa challengeAndVerify e requer confirmação aal2. Sem enrollment, novo backend ou migration; RPCs mantêm autorização Master/AAL2. Recuperação de senha preservada. ADR-0037.

## Continuidade e mútuas — 21/10/2026

Finance→Mútuas por faixa usa RPCs66 e leitura RLS de mutual_batches/assignments/balances. Distribuição por número ou atribuição explícita de toda a faixa; alterar faixa invalida distribuição/prévia. Prévia verifica tenant, soma em centavos, vínculos e natureza/código reais, exige GERAR. Envio incerto conserva comando/chave; rejeição definitiva desbloqueia. Histórico paginado20, detalhes conferem cada cobrança. Sem pagamento ou alteração de classificação. Natureza neutra/repasse ainda depende de evolução contábil específica.

Auth preserva Workspace apenas na revalidação da mesma identidade validada; inert durante getUser/escopo, sem pular verificação ou manter acesso inválido. Lojas/Master são relidos sem desmontar seleção ainda autorizada. ADR-0035. Backend mútuas reutiliza lote/vínculos/charges com atribuições explícitas, classe contábil existente e fingerprint/idempotência, migration66 DEV, SQL A/B PASS; UI/HTTP pendentes. ADR-0036.

## Ágapes — 21/10/2026

Prévia/comando usam events/event_participants e charges(source_kind=event), categoria/classificação publicada, participantes ativos do tenant, locks compatíveis, fingerprint e idempotência. Gratuidade não cria dívida; cobranças canceladas conservam vínculos. UI consulta histórico e situação de participantes. Migration65 DEV, ADR-0034, SQL A/B rollback PASS; HTTP/UI reais pendentes.

## Revisão e histórico — 21/10/2026

Migration64 DEV conserva KEY SHARE de FKs com NO KEY UPDATE do integrante e ordena locks de cobranças como FIFO. SQL A/B PASS; probe paralelo do conector inconclusivo. ApprovalHistory consulta snapshots/decisões existentes por tenant, com paginação e validação de atores únicos; nenhuma escrita ou nova permissão. Multiaprovação com dois atores SQL rollback PASS; homologação browser não equivale a esse teste. Negociação HTTP/UI A/B aprovada. Ver docs/V35_EXECUTION_20261021.md.

## Negociação de débitos — 19/10/2026

Prévia/comando reutilizam tabelas de acordos existentes, cobranças replacement e ajustes imutáveis; somente saldo aberto é transferido, preservando pagamentos e caixa. Exigem charges.create+charges.adjust, locks, fingerprint e idempotência. Categoria/plano conservados; até24 parcelas com centavos exatos e datas ancoradas. UI com confirmação e recuperação de envio incerto, histórico e parcelas. ADR-0033; migrations62/63 DEV; SQL A/B rollback PASS. Homologação HTTP/UI real pendente.

## Recorrência institucional anual — 19/10/2026

Quatro RPCs anuais aditivas usam as tabelas institucionais existentes; funções mensais preservadas. O mês da primeira versão de preço fixa o aniversário, incluído no fingerprint, sem deslocamento por reajuste. Interface escolhe RPC por frequência e valida o mês anual. Mesmos controles de autorização, período, idempotência, aprovação e caixa. ADR-0032; migration61 DEV. SQL A/B rollback PASS, homologação real pendente. Evidências em docs/V35_EXECUTION_20261019_CONTINUED.md.

## Reajuste institucional futuro — 19/10/2026

RPC schedule_institutional_recurring_price versiona preços existentes com settings.manage, idempotência, locks e PT409. Bloqueia vigência com obrigações emitidas, sem reescrever fatos. UI exige prévia/REAJUSTAR e conserva chave em transporte incerto. ADR-0031; migration60 DEV. Evidências/limites em docs/V35_EXECUTION_20261019.md.

## Regressão concorrente mensal em correção — 2026-10-16

UI mensal A/B concluída e cleanup SQL saldo10/canceladas/regras inativas.
CI296 e297 SUCCESS: billing resolvido. Novo gate HTTP A falhou em chaves distintas:
replay mesma chave passou, um fato/auditoria por competência, mas outro pedido
timeout15s; não registrar PASS. TentativasA somente despesaNov2026–Jun2027
canceladas; sem recebimento/pagamento e saldo10. Deadlocks observados2.
Migration57/20261016215748 aplica NO KEY UPDATE na organização (3comandos);
58/20261016220039 usa PT409 para conflito de negócio, evitando retry infinito
PostgREST com40001 conforme fonte oficial. Não editar56/57 após aplicadas.
Helper cleanup agora usa chave única por execução e verifica regra inativa,
obrigação cancelada/integrity_ok/aberto0 e saldo10. Corrigido replay antigo de
cleanup que deixara regraA ativa; UI desativou e SQL confirmou inativa.
Gate final usa Jul/Ago2027, vazio preflight A/B, R$1 por operação. Próximo publicar
e executar com A atual. B depois depende login. Não repetirmeses comhistórico.
SQL rollback4positivos/56negativos PASS após58;294 testes/tipos/build PASS,
mais regressão PT409 e cleanup em25 testes focados PASS; preservação58 PASS.
Outros40001 históricos precisam auditoria antes de fechar Etapa2. ADR0030.

## Recorrência institucional mensal — 2026-10-16

InstitutionalMonthly reutiliza regras/versionamento institucionais existentes.
Migration56 adiciona quatro RPCs de cadastro, situação, prévia e geração.
Settings.manage controla cadastro/situação; institutional.manage controla emissão,
com identidade/assinatura aptas. Prévia determinística inclui fingerprint e data
ajustada ao último dia do mês. Geração trava organização/período/regra, confere
fingerprint e chave única regra/competência, cria obrigação e aprovação quando
exigida, sem movimentar caixa. Cancelamento não permite reemissão do mesmo mês.
Sem novas tabelas ou ampliação de grants/RLS. ADR-0029; somente DEV.

# CURRENT ARCHITECTURE

## Estorno institucional — 2026-10-15

InstitutionalOperations abre InstitutionalReversals, que consulta fatos/reversões
existentes sob RLS e chama reverse_tenant_institutional_movement. Comando exige
institutional.manage, identidade ativa e assinatura apta; transação/idempotência,
período travado, obrigações em ordem antes do fato, eventos append-only e auditoria.
Recusa conciliação ativa e alocação em obrigação cancelada. Guard adicional impede
conciliar fato institucional estornado, serializado pelo lock do fato. Migration55,
ADR-0028. Sem novas tabelas/grants de tabela/RLS; UI assinada em homologação.

## Homologação assinada opcional — 2026-10-14

Entrada Vite dev-qa.html incluída somente com VITE_DEV_QA_ENABLED=true e projeto
DEV exato; build normal permanece somente aplicação. Reutiliza cliente/auth SDK
existentes para gates HTTP sob sessão real, sem extração de credenciais, novos
grants ou migration. Fixtures QA isoladas autorizadas por proprietário; não muda
planos publicados das Lojas originais. Ver docs/V35_SIGNED_BROWSER_QA.md.

## Conciliação bancária DEV — 2026-10-14

BankReconciliation → parser local UTF-8 OFX/CSV → stage_tenant_bank_statement →
validate_tenant_bank_statement → match_tenant_bank_statement / reverse_tenant_bank_match.
Migration #54 reutiliza tabelas/RLS e triggers históricos; quatro comandos exigem
reconciliation.manage e usam replay/auditoria existentes. Ordem de lock: import,
linha, fato. Limite de transferência é separado por conta bancária. Nenhuma nova
tabela ou escrita de ledger. Consultas incompletas recusadas; arquivo bruto não
é enviado. ADR-0027 e relatório descrevem formatos, limites e evidências.

## Ciclo de orçamento por Loja — 2026-10-14

`BudgetManagement` → create_tenant_budget_draft / read_tenant_budget_detail /
set_tenant_budget_line / publish_tenant_budget (migration #53). Escrita exige
budgets.manage, leitura finance.read, server-side. Cada comando de edição/publicação
serializa pela linha budget_cycles e compara fingerprint do snapshot revisado;
replay usa idempotency_begin/complete e audit_logs existentes. Publicação revalida
fontes sob SHARE e aproveita triggers de imutabilidade histórica. Não adiciona
escrita direta, RLS, tabela ou cálculo de realizado. Orçamento × realizado continua
nas views existentes. Detalhes e recuperação em ADR-0006 e V35_BUDGET_LIFECYCLE.md.

## Consulta orçamentária — 2026-10-14

`BudgetReport` mantém views `security_invoker` e escopo Loja/ciclo/competência.
`budget-report.ts` recusa duplicatas, moeda não BRL e diferenças de centavos antes
dos totais. Percentual/barra representam somente itens consultados; ultrapassagem
de 100% é explícita e base zero não produz percentual. Nenhuma escrita orçamentária,
auth, grant ou RLS alterados. Wrangler fixado em 4.151.0 para corrigir dependência
transitiva de desenvolvimento. Evidências em `docs/V35_VERTICAL_DELIVERIES.md`.

## Busca autorizada do diretório Master — DEV 2026-10-10

`MasterConsole` envia filtros opcionais para `loadMasterTenants` (`master-console.ts`). Sem filtros preserva `list_platform_master_tenants`; com filtros chama `search_platform_master_tenants` migração #52, RPC SECURITY DEFINER/search_path vazio e `private.require_platform_staff('MASTER')`. Banco aplica a pesquisa e paginação determinística, restringe `status` a all/active/past_due, limita consulta textual e não retorna e-mail/telefone de contato (embora possa consultá-los para localizar a Loja). O diretório permanece separado da tesouraria da Loja; selecionar um cliente nunca autoriza impersonação ou escreve dados.


## Fluxo de caixa diário por tenant — DEV 2026-10-10

`DailyCashFlow` consome RPC `read_tenant_daily_cash_flow` (#51), exposta apenas a authenticated e protegida por `private.require_permission(org,'finance.read')`. A função `SECURITY DEFINER` com `search_path=''` agrupa em uma consulta do PostgreSQL os eventos operacionais reais do livro de contas, deixando de fora transferências internas e saldos de abertura, e calcula separadamente obrigações ainda abertas por vencimento (integrantes, receitas e despesas institucionais). O retorno tem 1 a 93 dias completos; frontend valida calendário, continuidade e invariantes de somas antes de exibir. Realizado não equivale a lucro contábil nem saldo de banco, e valores a receber por vencimento não equivalem a probabilidade de arrecadação.


## CSV de inadimplência — DEV 2026-10-10

`DelinquencyReport` dispara `loadDelinquencyExport` somente após clique e leitura tenant-scoped permitida. A rotina reusa a RPC `read_tenant_delinquency`, agrega até 1.000 linhas com validação e duplicata bloqueada, revalida o tenant para impedir download tardio depois de troca de Loja ou desmontagem. Serialização `createDelinquencyCsv` em memória no browser neutraliza prefixos perigosos de células, preserva decimal BRL em formato CSV pt-BR (`;` e vírgula) e limita campos a nome, situação, vencimento, saldos e créditos. Não há endpoint privilegiado ou banco novo; não há snapshot servidor para consistência entre múltiplas páginas. O arquivo fica sob responsabilidade de quem solicitou o download.


## Transferências entre contas financeiras — DEV 2026-10-10

`AccountTransfers` em Financeiro consome `loadTreasuryAccounts`, `loadAccountTransferPage` (lista tenant-scoped paginada), e RPCs #50 `register_tenant_account_transfer_idempotent`/`reverse_tenant_account_transfer_idempotent`. A autorização de escrita é `private.require_permission(organization_id,'institutional.manage')` + tenant habilitado. A operação grava dois lados simétricos via `financial_account_transfers` no ledger `v_financial_account_movements`, com reversões em `financial_account_transfer_reversals`; **não** grava receitas/despesas ou edita movimentos históricos. Saldo é derivado do banco e não de soma de páginas; controles de saldo, conta, competência, data, arredondamento e tenant estão no servidor. Bloqueio ordenado das duas contas serializa transferências entre contas, mas outros fluxos financeiros que não compartilham o lock e simultaneidade independente ainda precisam de teste/hardening antes de PROD.


## Master promoção com versão sucessora — DEV 2026-10-10

`MasterPromotions` seleciona série nova ou `latest_promotion_id` de uma série já publicada. A sucessão por `create_master_promotion_successor_idempotent` (migração #49) exige MASTER/MFA, valor/validade futura, serializa criação por `promotion_series_id`, bloqueia origem anterior obsoleta e preserva versão publicada. O rascunho sucessor não muda benefício/contrato já vigente. A publicação posterior pela RPC idempotente delega a `publish_saas_promotion_version` para encerrar a vigência antiga na fronteira correta, sem recalcular faturas.


## Parametrização de aprovação de despesas (DEV 2026-10-10)

`ApprovalPolicies` consulta `expense_approval_policies` exclusivamente por `organization_id` sob RLS `finance.read`. Escrita por RPCs #48 exige `approvals.manage` no PostgreSQL, chave idempotente e trilha em `audit_logs`. Política nova é draft, publication separada por confirmação `PUBLICAR`; ranges de políticas publicadas não podem se sobrepor (constraint no banco). `PayableApprovals` continua responsável pelos votos imutáveis de despesas e não é substituído pela parametrização. A configuração não reabre decisões passadas nem recalcula ledger.


## Master SaaS — publicação de ofertas (DEV 2026-10-10)

A plataforma usa `MasterPromotions` dentro de `MasterCommercialCatalog`, separado do ledger da Loja. Backend #47: RPCs `create_master_promotion_draft_idempotent`/`publish_master_promotion_draft_idempotent` exigem Master com MFA/AAL2, validam campos e status, bloqueiam repetição de key com hash diferente em `private.master_idempotency_keys`, delegam ao fluxo de versões `saas_promotions` preexistente e registram auditoria de plataforma. Publicação não resgata promoções nem altera invoices/subscriptions. Janelas de datas ISO convertidas a timestamptz; elegibilidade efetiva permanece regra do backend V35.


## Idempotência estrita dos novos rascunhos Master — DEV 2026-10-10

`MasterOnboarding` utiliza `create_master_onboarding_draft_idempotent(key,payload)` (migration #46) em vez da RPC legada diretamente. O wrapper exige MASTER/AAL2, valida campos no servidor, serializa `key` em transação, retorna ID salvo quando payload é exatamente igual e falha `22023` se key for reaproveitada com parâmetros divergentes ou draft saiu de estado editável. Ao chamar `save_saas_onboarding_draft` somente quando key é nova, evita evento de etapa duplicado em retries. A RPC legada permanece para compatibilidade e exige revisão de consumidores antes de release.


## Onboarding e panorama Cliente 360° Master — DEV 2026-10-10

`MasterConsole` inclui `MasterOnboarding` e `MasterClient360`, renderizados somente após a validação de `read_platform_master_overview`. O banco reforça limite MASTER/AAL2 independentemente de UI: `save_saas_onboarding_draft` e `provision_saas_onboarding_database` existentes; `read_master_client_360` novo (SQL #45) exige `private.require_platform_staff('MASTER')` e lê apenas agregados comerciais/faturamento SaaS/suporte do cliente indicado. Onboarding é duas ações separadas: salvar draft não provoca efeitos externos; provisionar exige draft completo, confirmação explícita e cria organização, assinatura e job de convite, **não envia nem confirma entrega do convite por si**. Evitar interpretação de fila de job como e-mail enviado; etapa assíncrona/consentimento ainda em aberto. Report AAL2-only, anon sem EXECUTE, consulta nunca inclui finanças privadas da Loja nem autenticação como cliente.


## Suporte Master com respostas autorizadas — 2026-10-10
`MasterSupportQueue` consome `v_saas_support_ticket_metrics` como view `security_invoker=true` e `saas_support_ticket_messages` com RLS, respeitando visibilidade customer/internal. Consulta Master requer perfil de plataforma + AAL2. A escrita em chamados tenant é feita exclusivamente por `reply_master_tenant_support_idempotent` (MFA Master, ID tenant, validação, idempotência), que reutiliza `reply_saas_support_ticket` e respectivos eventos de status. Ticket interno não pode receber resposta usando endpoint tenant. A navegação/ocultação de formulário não é controle de autorização; PostgreSQL verifica todos os pedidos. O restante do catálogo Master e diretório continua somente leitura.


## Etapa 2: recorrência, fluxo financeiro e Master read-only — 2026-10-09/10

**Cobrança recorrente:** `private.monthly_charge_candidates` resolve, por competência, preço versionado e `recurring_member_terms` (padrão, isenção, valor individual). `preview_monthly_charge_generation` calcula quantidade e fingerprint/condições antes de emitir; `generate_monthly_member_charges` exige `charges.create`, idempotência, bloqueio da Loja/regra/integrantes, mapping contábil publicado, período aberto e fingerprint idêntico. Lote `charge_batches` + fatos `charges` imutáveis, chaves únicas em banco. A tela `MonthlyChargeGeneration` não gera automaticamente.

**Correções/cancelamentos e períodos:** `ManualCharges` usa `create_manual_charge` e wrapper idempotente de cancelamento, preservando eventos `charge_cancellations` e reversões originais. `FinancialPeriods` consome estado derivado de `period_events` e wrappers idempotentes de `close_financial_period`/`reopen_financial_period`. `InstitutionalOperations` consome novas RPCs wrappers para cancelar saldo em aberto e corrigir obrigação mantendo a linha original e `institutional_..._corrections`. Correção verifica um snapshot JSONB exato do effective view **após bloquear o registro base**, retornando `40001` se desatualizado.

**Consultas:** `read_tenant_financial_dashboard` calcula 6 KPIs a partir de `v_charge_balances`, `v_institutional_*_effective` e `v_financial_account_movements`; `read_tenant_delinquency` separa atrasos e créditos não alocados com paginação servidor. `TreasuryBalances` mostra saldos derivados por conta e paginação; `BudgetReport` consulta exclusivamente orçamento vs realizado de linhas realmente cadastradas, não apresenta caixa projetado como fato. Consultas comerciais Master não recalculam saldos das Lojas.

**Master:** novos RPCs exclusivamente READ requerem `private.require_platform_staff('MASTER')`, que verifica usuário de plataforma ativo e AAL2/MFA. `Workspace` mostra link `Master SaaS` somente após uma validação positiva, mas o link **não concede acesso**; todo endpoint/ view valida no servidor. `MasterConsole` e `MasterCommercialCatalog` exibem diretório, KPIs e versões/ promoções históricas; ainda não há comandos operacionais de Master, sessão de suporte ou impersonação. Sem mudanças em auth.users/roles, RLS de tabelas, produção ou cobrança de provedores.


## Aprovação de despesas — fila e decisão idempotente (2026-10-09)

O frontend `PayableApprovals` consulta `v_payable_approval_state` tenant-scoped para itens pendentes e chama exclusivamente `decide_payable_approval_idempotent`; o servidor exige `approvals.review`, chave idempotente e motivo, delegando ao comando já auditado que registra o voto imutável por usuário. A situação agregada continua calculada no banco, separada da liquidação institucional. Limite fail-closed 150, ainda sem paginação/rotina Master. Migration DEV35.


## Ciclo institucional de obrigações e liquidação — 2026-10-09

O frontend `InstitutionalOperations` opera em abas contas a pagar e contas a receber por `organizationId` autenticado. A leitura usa as views financeiras efetivas `v_institutional_payable_effective` e `v_institutional_receivable_effective`, validando integridade e isolação de tenant; nenhuma consulta parcial é somada como saldo de caixa. Registros de obrigação são criados pelas RPCs existentes `create_institutional_payable`/`create_institutional_receivable` (idempotentes, com snapshot contábil), e liquidações por `register_institutional_payable_payment`/`register_institutional_receipt` (evento financeiro separado com alocação). A UI exige aprovação prévia para despesas `approved` ou `not_required`, além da autorização final do servidor. O valor alocado neste incremento é igual ao recebido/pago, permitindo pagamento parcial por evento; excessos permanecem bloqueados. Nenhum schema/migration novo nem alteração de fatos históricos.


## Pagamentos operacionais e DRE por competência — 2026-10-09

`Finance` inclui `MemberPayments` e `DreReport`. O frontend não executa UPDATE/DELETE de fatos; chama RPCs de pagamentos/alocações (idempotentes) e `reverse_member_payment_idempotent` (migração #33), que reaproveita os eventos de estorno existentes com permissão `payments.reverse`, reenvio idempotente e razão auditada. Leitura de saldo do integrante vem de `v_charge_balances`/`v_payment_balances`, com validação `integrity_ok`, escopo Loja/integrante e limites fail-closed para não tratar consulta parcial como completa. Pagamentos de integrantes e receitas institucionais não são equivalentes.

`read_tenant_dre` (migração #34) exige `reports.read` no servidor e retorna somente fatos de resultado contábil `v_dre_entries` agrupados por conta histórica e competência, sem considerar recebimento como nova receita. A UI apresenta valores assinados, até 12 competências e bloqueia dataset acima de 1500 linhas. Não implementa ainda orçamento vs realizado, DRE completa do piloto V35 nem classificação neutra/repasse. Nenhuma alteração de integridade contábil pré-existente.


## Coordenação de publicação por Loja (2026-10-09)

Migration DEV #32 define `private.guard_tenant_accounting_change()`, SECURITY DEFINER em schema não exposto e EXECUTE revogado aos roles web. Triggers `BEFORE INSERT/UPDATE/DELETE` em `financial_categories`, `financial_accounts`, `accounting_accounts`, `financial_category_account_mappings`, `financial_account_accounting_mappings` e `accounting_plans` obtêm `SELECT FOR UPDATE` na linha `organizations` da própria Loja antes da mutação. A publicação `publish_validated_accounting_plan` usa a mesma linha e o rascunho, revalida todas as condições e dispensa os cinco bloqueios de tabela `SHARE`. A RPC `set_draft_accounting_mapping` recebe ordem determinística Loja→plano. Nenhuma nova concessão de escrita nas tabelas, RLS mantida.

Categorias ativas só são introduzidas/ativadas (ou têm domínio alterado) quando todas as vigências publicadas cujo `valid_to` alcança a competência atual têm mapeamento analítico ativo e compatível. Contas financeiras seguem regra análoga para patrimonial; novas contas nascem inativas no backend e precisam de plano sucessor quando um publicado já não admite vínculo. As funções de mutação de contas/mapeamentos rejeitam destino publicado mesmo se `accounting_plan_id` mudar. Triggers estão presentes em seis tabelas. Histórico financeiro intocado. Mudanças pós-publicação exigem planejamento de novo ciclo, incluindo a janela temporal entre planos.

**Limite da evidência:** os cinco gates SQL com claims simuladas retornaram `ROLLBACK_PASS`. Tentativa de concorrência através do executor Supabase não assegurou sessões independentes e não comprovou bloqueio por tenant. Teste DB paralelo real e JWT HTTP precisam ser executados antes de produção.


## Publicação transacional contábil — 2026-10-09

A RPC `publish_validated_accounting_plan` confere `accounting.manage` e assinatura, recupera/chaveia a solicitação idempotente, trava organização e rascunho, valida vigência informada, protege transitoriamente 5 tabelas de categorias, contas e mapeamentos com SHARE lock e executa a pré-validação completa dentro da mesma transação. Quando pronta, utiliza a função interna V35 `publish_accounting_plan`, respeitando triggers de imutabilidade e constraint EXCLUDE contra sobreposição, e audita motivo e resultado. A UI exige confirmação explícita; readiness anterior nunca substitui validação servidor. EXECUTE de `publish_accounting_plan` foi revogado para authenticated, anon e PUBLIC. Migration31 só DEV. Locks SHARE são globais aos tenants e requerem teste de concorrência/latência; novos catálogos depois da publicação exigem controle separado de sucessão.

## Pré-publicação contábil em diagnóstico, 2026-10-09

O frontend `AccountingPrepublication` consulta `public.preview_accounting_plan_publication` somente por RPC; servidor exige `accounting.manage`, escopo e assinatura. Retorna snapshot JSON de impeditivos e contagens; painel exibe avisos, mas não habilita publicação. Inclui detecção recursiva de ciclos, naturezas/hierarquias indevidas e vigências sobrepostas aos planos publicados. RPC usa `SECURITY DEFINER` com search_path vazio, grants apenas authenticated, sem novos grants em tabelas nem mudanças RLS. Um resultado `ready=true` exige rechecagem sob lock no futuro comando de publicação; preview pode ficar obsoleto imediatamente após consulta. Banco DEV migration30, nenhuma postagem financeira nem atualização em published.


## Plano contábil V35 — rascunhos e mapeamentos (2026-10-08 Brasil)

`AccountingPlans.tsx` faz SELECT tenant-scoped via `accounting-plans.ts` de planos, modelo público ativo, contas e mapeamentos; valida organização/plano também no client como defesa em profundidade. RPC `create_tenant_accounting_draft` delega ao construtor V35 `create_accounting_plan` para gerar 91 códigos e hierarquia ou duplicar/blank, com idempotency wrapper, mês futuro e `accounting.manage`. RPC `set_draft_accounting_mapping` serializa no plano draft e verifica `expected_account_id`; exige natureza contábil adequada e trilha de auditoria. O esquema antigo impõe bloqueio de mudança no published e exclusão de vigências published sobrepostas, inclusive fora da UI. Não expor `publish_accounting_plan` na UI antes da cobertura de mapeamentos, revisão de 91 códigos e testes HTTP reais. Nenhuma atualização de ledger ou das tabelas históricas.


## Identidade da Loja versionada — 2026-10-08 Brasil

`TenantIdentity.tsx` consulta `organization_settings` por Loja com SELECT/RLS e expõe edição limitada por RPC `save_tenant_identity`; `settings.manage` antes de consultas e sem escrita direta do frontend. Atualização otimista por `updated_at`, inicialização serializada por lock em `organizations`, retry idempotente. Trigger próprio `private.bump_tenant_settings_updated_at` impede revisões com timestamp repetido em uma transação sem modificar o helper global; apenas informações cadastrais, sem valor financeiro. Auditoria não copia PII/PIX. Migrations27/28 DEV; sem deploy de produção.


## Catálogos de tesouraria — 2026-10-08 Brasil

`src/components/TreasuryCatalogs.tsx` integra a área Plano de Contas, usando `src/lib/treasury-catalogs.ts` para SELECT/RLS escopado em financial_accounts, funds e payment_methods. Mutação exclusivamente por RPCs SECURITY DEFINER `create_treasury_catalog_item` e `set_treasury_catalog_status`; require_permission(settings.manage), idempotência, auditoria, lock, validação/escopo, suspensão fail-closed, grants EXECUTE só authenticated. Estado inativo preserva referências e dados existentes; não atualiza ledger, não gera movimentação nem saldo. 26 migrations no DEV; produção inalterada. Limite UI 200 por catálogo e sem paginação global. `scripts/verify_dev_treasury_catalog.sql` é teste SQL com ROLLBACK, não HTTP real.


## Categorias e regras mensais — 2026-10-08

FinancialStructure.tsx conecta a área Plano de Contas → categorias/regras mensais. financial-structure.ts consulta categorias/regras por organization_id e preços somente dos IDs dessas regras, com abort/rejeição de escopo. Novas RPCs create_tenant_financial_category, create_tenant_monthly_rule e schedule_tenant_monthly_price usam settings.manage, idempotência/audit e search_path vazio, sem escrita direta/RLS alterada. Preço sucessor bloqueia regra, compara último UUID e encerra sua vigência em competência anterior; nunca altera unit_amount anterior ou charges/payments. Ver docs/V35_STAGE_2_IMPLEMENTATION.md e ADR0008.


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
Grau/cargo textual não substitui catálogo/cargo vigente. Mensalidade individual/isenção versionadas, criação de login, CPF, vínculos, cargos com vigência e paridade integral continuam pendentes; não concluir etapa2.

Migration gerada pela CLI2.119.0 e aplicada no DEV com versão20261008195936; fonte/hash no manifesto. Recuperação: forward-fix aditivo; se houver falha operacional, revogar EXECUTE da novaRPC e manter leituras/dados, sem apagar integrantes/ledger. Não aplicada produção.
DEV_MEMBER_PROFILE_COMMANDS_ROLLBACK_PASS antes e depois da aplicação: positivosA/B, retry, payload divergente, mass-assignment/date/name inválidos, estrangeiros, escrita direta, stale, VIEWER, suspensão e Master sem papeltenant. Claims simuladas/SQL, NÃO HTTP/JWT real novo. Zero integrantes temporários remanescentes; A/B ADMIN e assinaturasactive conferidos.
npm run check PASS: typecheck,36 testes frontend, build com chaveplaceholder; build não prova login/deploy. HTTP real novo, concorrência simultânea e homologação visual pendentes. CI do incremento de consulta880cc5a/run37834705645success; novaCI conferir após push.

Advisors pós-DDL:38 RPCs definer autenticadas (37 existentes + novaRPC intencional com require_permission),3 tabelas backend RLS sem policies e aviso preexistente de proteção contra senhas vazadas. Não declarar scanner zero nem modificar grants/RLS backend para remover avisos:
- [RPC autenticada definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Tabelas backend sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)


React 19 + Vite 6 + TypeScript, cliente supabase-js com chave publicável. Supabase PostgreSQL/Auth DEV. Cloudflare Worker corsys-tronco-digital-dev serve assets estáticos; não há servidor HTTP próprio ou segredo administrativo no browser. Consultas passam pela Data API/RLS; chamado usa RPC autorizada.

## Componentes

- src/auth: login, getUser, descarte de respostas antigas de identidade e logout local.
- src/lib/tenant-data.ts: organizações, até 200 integrantes, até 100 chamados, RPC create_saas_support_ticket.
- src/components/Workspace.tsx: seleção de Loja; recriação do painel por tenant.
- src/lib/finance-data.ts e components/Finance.tsx: consultas independentes a v_charge_balances, v_institutional_payable_effective e v_institutional_receivable_effective. Ordem por vencimento e ID, páginas de 25 com um registro adicional para detectar próxima página. Dados efetivos/em aberto vêm do backend; sem totais de página apresentados como saldo global. Retorno de tenant inesperado, integrity_ok inválido ou valor monetário inválido provoca erro explícito. Abort/recriação descartam resposta atrasada ao trocar tenant/tipo de consulta.
- src/styles.css: layout adaptativo; navegação móvel e tabela com scroll interno/foco por teclado. Celular real ainda não revisado.

## Fronteiras

RLS/RPCs são autorização; filtros no browser são defesa adicional. Nenhuma alteração de schema/permissão neste incremento. Nenhuma escrita financeira, Storage, billing provider, chamada IA ou e-mail integrada. Consulta vazia não demonstra total global; RLS pode restringir registros conforme o papel.

SDK persiste a sessão; getUser valida identidade. Chave sb_publishable é pública. Build exige URL HTTPS e configuração pública válidas; secrets, .env.local e .wrangler não versionados. CSP só autoriza conexão com o Supabase DEV. wrangler.dev.jsonc é exclusivo DEV.

## Validação e continuidade

CI foundation-checks: jobs static e frontend, permissions contents:read, actions por SHA, sem deploy/secrets pelo GitHub Actions. Cloudflare tem integração de build da branch DEV configurada pelo proprietário. Gate adicional scripts/check_v35_preservation.py verifica hashes/presença dos artefatos históricos; não avalia semântica SQL ou UI.

Requisitos canônicos e módulos pendentes: docs/V35_COVERAGE.md e os 29 ADRs originais. Estado/evidência de entrega: SESSION_HANDOFF.md. Produção depende de autorização posterior.

## Referência do piloto

HTML V34 operacional recebido em 2026-10-03. docs/V35_PILOT_PARITY.md reconcilia o mínimo do HTML com a V35; docs/V35_PILOT_INVENTORY.md lista todos os controles extraídos por DOM/AST. A referência em docs/pilot/ mantém código de produto e linhas originais, removendo somente tags externas de antivírus; não é servida no app. Gate verifica hashes/21 telas, sem provar runtime. Master/duas lojas/Cliente 360º devem ser homologados visualmente e por cliques; abertura local foi bloqueada no navegador desta revisão.

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.


## Etapa 1 iniciada — 2026-10-05 Brasil / 2026-10-06 UTC

Proprietário autorizou avançar pela sequência de oito etapas. docs/V35_DELIVERY_PLAN.md registra estado/evidência e pendências. Decisões comerciais em docs/adr/0005-commercial-launch-decisions.md e config/commercial-decisions.json: dois planos BRL 125/180 mensais, cobrança manual e futura Stripe preferencial; suporte interno/WhatsApp manual, automação futura; domínio pendente. Configuração registrada, catálogo/integrações ainda não ativados.

SQL de catálogo e isolamento reexecutado com sucesso. Novo scripts/verify_dev_subscription_and_staff.sql passou após corrigir fixture publicada sem timestamp: tolerância/suspensão/override, limites de staff/AAL e proteção do último Master; claims simuladas, helpers/triggers, rollback conferido sem dados temporários. Não equivale a HTTP/JWT/MFA reais ou comandos financeiros completos. dev-gate possui roteiro HTTP reforçado e exemplo dos UUIDs existentes, sem necessidade de chave administrativa. Oito testes locais passaram; roteiro HTTP autenticado ainda não executado por ausência das senhas em ambiente seguro. Não solicitar senhas/tokens pelo chat nem alterar credenciais existentes. Nenhuma migration, grant, schema, frontend, produção ou serviço pago alterado.


## Continuidade da etapa 1 — 2026-10-06 UTC

Ver docs/V35_STAGE_1_EVIDENCE.md. Invariantes financeiras e pós-V31 passaram. Novos roteiros verify_dev_financial_commands.sql e verify_dev_roles_and_support.sql passaram no DEV: RPCs nas duas lojas, idempotência sequencial/auditoria, leituras próprias/cruzadas, sobrealocação e IDs alheios, suspensão, perfis e suporte temporário/revogação/expiração. Claims simuladas; tudo revertido, zero fixtures temporárias conferidas. Oito testes locais PASS. Etapa 1 permanece em execução: JWT real, MFA real, matriz HTTP e concorrência simultânea ainda não comprovados. Nenhuma alteração de schema, grants, senhas, frontend, produção ou cobrança.


## Recuperação de senha DEV — 2026-10-07

Implementado Esqueci minha senha, solicitação resetPasswordForEmail com redirectTo da origem atual, tratamento PASSWORD_RECOVERY e formulário autenticado updateUser. SDK detectSessionInUrl=true; flag de recuperação é somente apresentação, identidade validada por getUser e RLS continua server-side. Formulário compara identidade antes de trocar senha, exige confirmação/12 caracteres, bloqueia duplicidade e limpa campos após tentativa; resposta de solicitação não confirma existência de conta. Recuperação mantém workspace oculto até retorno explícito ao login. Site URL/Redirect URLs DEV configurados conforme relato do proprietário, não conferidos via API. Reenvio e recuperação reais por e-mail dependem de homologação do proprietário; nenhum e-mail enviado pelo agente, nenhuma senha/token lido, nenhum grant ou schema alterado. Não declarar etapa 1 concluída. Ver docs/DEV_PASSWORD_RECOVERY.md.


## Smoke HTTP autenticado aprovado — 2026-10-07, 18:20 Brasil

Evidência: saída integral fornecida pelo proprietário, execução local Windows/Node
v24.20.0 na cópia da branch DEV. O agente não executou este comando com as credenciais;
a classificação é execução pelo proprietário com resultado PASS apresentado.
Nenhuma senha, token ou arquivo .env foi recebido.

Comando: npm run test:tenant-isolation.
Resultado:
PASS: real Auth identities, tenant reads/RPCs, tenant-to-Master denial and invalid JWT. Financial positive fixtures, MFA, suspension and concurrency remain separate gates.

Baseline HTTP aprovado: login/getUser dos dois UUIDs esperados, consultas próprias
positivas de organização/integrantes, consultas cruzadas explícitas ocultas,
views financeiras cruzadas, catálogo/configuração/staff Master ocultos,
RPC Master negada, chamado próprio criado/lido e chamado cruzado negado,
acesso anônimo restrito e JWT inválido rejeitado com HTTP 401.

Limites: views financeiras sem fatos próprios não comprovam isolamento financeiro
positivo por HTTP; os fatos SQL anteriores foram revertidos. Não aprova MFA real,
perfis/expiração/revogação/suspensão por HTTP, matriz completa de RPCs ou concorrência
simultânea. Etapa 1 continua EM EXECUÇÃO. A recuperação real por e-mail não foi
homologada: o proprietário encontrou a senha existente. Manter credenciais somente
no .env.dev privado local, sem commit/upload. Chamados legítimos do smoke permanecem
no DEV com prefixo RLS DEV TEST, conforme roteiro.


## Próximo gate preparado — 2026-10-07

Ver docs/DEV_FINANCIAL_HTTP_GATE.md. Estrutura financeira fictícia persistida nas duas lojas e plano DEV de valor zero com assinaturas active, sem cobrança, Auth/grants/schema alterados. Comandos SQL com claims simuladas despachados em paralelo: saldo disputado preservou uma alocação de 100 e crédito zero; mesma chave preservou uma cobrança/audit. Sobreposição exata não instrumentada; não equivale a HTTP real. Novo npm run test:financial-http preparado para credenciais privadas locais; 10 testes locais PASS e sintaxe PASS. Roteiro HTTP financeiro e MFA/suspensão/matriz ainda pendentes. Não apagar ledger nem repetir seed/roteiro após falha sem inspeção. Scripts antigos com precondição de zero planos/assinaturas agora bloqueiam por fixture alterada, esperado.


## Incremento DEV 2026-10-08 — configuração individual versionada

`recurring_member_terms` registra `effective_from`, `effective_to` inclusivo, `term_type` e `override_amount`. A nova RPC autenticada `public.transition_member_term` exige `settings.manage` e assinatura elegível, fecha uma linha aberta com lock e opcionalmente cria sucessor em única transação. Também suporta apenas encerrar o termo, retornando à regra geral. Preserva lançamentos existentes. O frontend `MemberConfiguration` chama a RPC com idempotency key e não recebe grants de escrita direta. Alteração apenas DEV, migração `20261008211155`. Segurança exercitada via SQL/claims simuladas A/B; HTTP/JWT real permanece obrigatório antes de homologar.

