# SECURITY REGISTER

## Retomada — 2026-10-14

- Dependências (E2): audit inicial 3 high em Wrangler → Miniflare → sharp,
  GHSA-wq5f-xc86-pv6w. Atualização fixa Wrangler 4.151.0 removeu os avisos no audit.
  Não foi demonstrada exploração no aplicativo; ferramenta de desenvolvimento.
- Integridade de orçamento (E3, testes): bloqueadas duplicatas, moeda não BRL e
  inconsistência de centavo; nenhuma mudança de banco/permite escrita. Regressões
  frontend e SQL A/B com ROLLBACK positivas/negativas aprovadas no escopo declarado.
- RLS/views/grants: catálogo existente executado sem exceção; não equivale a
  autorização integral por HTTP/JWT. Novos fluxos A/B/MFA/concorrência em navegador
  e paridade desktop/mobile ainda não homologados nesta retomada.
- Rollback do incremento: reverter arquivos de UI/loader e ferramenta ao commit
  anterior, avaliando reintrodução do advisory; sem rollback de banco ou ledger.
- Ver `docs/V35_VERTICAL_DELIVERIES.md`. Nenhuma garantia de segurança absoluta,
  merge, produção ou novo provedor/custo autorizado por este registro.

## Incremento 29 — filtros privados de clientes SaaS (2026-10-10)

A pesquisa do diretório Master pode consultar dados comerciais e contatos de clientes, exigindo `private.require_platform_staff('MASTER')` (AAL2) na RPC `search_platform_master_tenants` antes das junções. Serviço usa search_path vazio, apenas EXECUTE authenticated, caps de tamanho de filtros (100 chars), status enum e paginação (até 50 linhas). Texto literal é comparado por `position(lower(...))`, não interpolado em SQL dinâmico ou convertido em wildcard `LIKE`; evita ampliação acidental por `%`/`_`. Os contatos podem ser critérios de busca mas não são expostos no retorno; não há dados financeiros dos integrantes. SQL `DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS` verificou Master AAL2, AAL1 negado, tenant AAL2 negado, anon negado e paginação. Tokens JWT reais em HTTP e volume massivo não avaliados; sem produção.


## Incremento 28 — fluxo de caixa consolidado, integridade e tenant (2026-10-10)

RPC DEV `read_tenant_daily_cash_flow(uuid,date,date)` usa SECURITY DEFINER/search_path vazio, EXECUTE somente authenticated, gate `finance.read` antes de consulta e validação de integridade financeira de todas as obrigações abertas. O SQL não devolve mais de 93 dias e agrega o livro sem paginação. Exclui transferências internas (entrada/saída simétrica) e abertura patrimonial dos valores operacionais, impedindo falso faturamento/fluxo e dupla contagem. Recebíveis por vencimento são estado atual, não reconstrução contábil histórica. Teste `DEV_DAILY_CASH_FLOW_ROLLBACK_PASS` com claims simuladas A/B negou IDOR, limite excedido e EXECUTE anon, reconciliou recebimentos de setembro e cobranças de integrantes com as views. Não avalia JWT HTTP reais, RLS independente ao longo de sessões, mobile/desktop ou volume 93 dias com dados massivos. Nenhum deploy produção.


## Incremento 27 — relatório CSV privado: LGPD e prevenção de CSV injection (2026-10-10)

O relatório de inadimplência contém nome e situação financeira por integrante (dado pessoal). Exportação ocorre somente após clique, por `read_tenant_delinquency` com `finance.read` no PostgreSQL; nenhuma chave service_role ou rota pública. O CSV não inclui CPF, e-mail, telefone ou credenciais. `createDelinquencyCsv` sanitiza controle/quebra de linha e prefixos Excel/LibreOffice `=`, `+`, `-`, `@` mesmo após normalização de compatibilidade Unicode, escapa aspas/delimitadores e inclui BOM UTF-8. Requisição completa limita 1.000 membros, verifica duplicidade e cancela após mudança de Loja, erro ou dados inconsistentes. Não gera arquivo parcial nem registra export no banco.

Riscos pendentes: arquivos gerados passam a existir fora da plataforma e devem ser protegidos pelo operador conforme política LGPD; exportação paginada não garante snapshot temporal transacional consistente se lançamentos mudarem durante múltiplas chamadas. Download real em navegadores, permissão HTTP/JWT assinada e geração formal PDF/XLSX não foram avaliados. Antes de release, considerar relatórios com snapshot de servidor, autorização/datalog de export quando justificável, canal seguro e trilha de acesso.


## Incremento 26 — contas de caixa/bancos e transferências (2026-10-10)

Transferências de saldo são execução sensível. Migration #50 cria duas RPCs SECURITY DEFINER (`search_path=''` e EXECUTE só authenticated) que validam `institutional.manage`, org tenant, contas financeiras ativas (estorno pode referenciar conta que posteriormente ficou inativa), saldo do livro até a data do lançamento, competência não fechada, moeda centesimal e motivo. A função usa `private.idempotency_begin/complete`, locks de contas por ID, eventos append-only e audit logs imutáveis. O livro `v_financial_account_movements` já representa quatro eventos (transfer_out/in, reversal_in/out) e preserva saldo global.

Evidência executada: `DEV_TRANSFER_GUARDS_ROLLBACK_PASS` rejeita auto-transferência, conta de outro tenant e estorno não existente; `anon` sem EXECUTE. **Não foi possível homologar cenário positivo** porque DEV A/B só têm uma conta ativa por Loja e tentativa de provisionar organização de teste em rollback foi bloqueada por segurança da ferramenta. Não contornar bloqueio e não declarar execução positivo; cross-user negative RBAC, JWT HTTP real, paralelismo interconexões e saldo de outros lançamentos concorrentes permanecem sem avaliação. Perigo residual: locking de transferências não necessariamente coordena pagamentos efetuados por comandos legados; checar saldo concorrente em homologação antes de habilitar PROD.


## Incremento 25 — sucessão controlada de ofertas (2026-10-10)

RPC DEV `create_master_promotion_successor_idempotent` é SECURITY DEFINER e restringe EXECUTE authenticated com `private.require_platform_staff('MASTER')` (AAL2) antes de leitura/escrita, hash do payload em `private.master_idempotency_keys`, advisory transaction lock por série para impedir versão concorrente de mesmo histórico, valida último publicado e datas futuras; registros published são preservados. Erro `40001` em predecessor obsoleto. Teste `DEV_MASTER_PROMOTION_SUCCESSOR_ROLLBACK_PASS` validou sucessão e fronteira de vigência dentro da transação de teste; não é substituto de teste de sessão simultânea independente ou HTTP com JWT assinado. APIs legadas do Master continuam disponíveis a usuários MASTER/AAL2: revisar/apagar acesso direto antes do release.


## Incremento 24 — proteção de políticas de aprovação por Loja (2026-10-10)

As RPCs `create_tenant_approval_policy_draft` e `publish_tenant_approval_policy_idempotent` têm `SECURITY DEFINER`, `search_path=''`, EXCECUTE apenas authenticated, `private.require_permission(org,'approvals.manage')` antes de ler/escrever. Validações exigem vigência futura sem sobreposição com política publicada, valor com duas casas e até 10 aprovadores, motivo obrigatório, key idempotente e auditoria. Constraint de exclusão GIST impede duas políticas simultaneamente publicadas na mesma Loja. Consulta sob RLS de `finance.read`, sem expor políticas de outra Loja. SQL A/B `DEV_APPROVAL_POLICY_LIFECYCLE_ROLLBACK_PASS`, ROLLBACK e anon EXECUTE negado. Testes JWT HTTP reais e sessões simultâneas não avaliados. Política `off` é funcionalidade autorizada de negócio e exige privilégio administrativo; não confiar em ocultar opção por CSS.


## Incremento 23 — ofertas SaaS MASTER (2026-10-10)

`create_master_promotion_draft_idempotent` valida descontos finitos (máximo 100% para benefício percentual), limites, datas futuras, escopo, combinação e duração. `publish_master_promotion_draft_idempotent` publica somente versão draft mediante MFA Master; ambas têm `search_path=''`, EXECUTE somente authenticated com `private.require_platform_staff('MASTER')`, controle de replay hash/payload por funcionário em tabela privada e audit trail. Teste `DEV_MASTER_PROMOTION_ROLLBACK_PASS` fez negativos Master AAL1, usuário tenant AAL2 e anon, não gerou dados permanentes. Como fluxo legado de promoções continua exposto ao papel MASTER (com AAL2), revisar consumidores antes de restringir/aposentar; HTTP JWT reais, concorrência, ativação/resgate e regras antifraude comerciais não avaliadas. PROD continua bloqueado.


## Incremento 22 — colisões de idempotência em onboarding Master (2026-10-10)

Identificado risco no `save_saas_onboarding_draft` preexistente: `INSERT ... ON CONFLICT (idempotency_key) DO UPDATE updated_at` não comparava payload original e emitia evento de etapa repetido. Remediação aditiva DEV #46: novo `create_master_onboarding_draft_idempotent(key,jsonb)` valida MASTER+AAL2, normaliza inputs, protege replay com `pg_advisory_xact_lock`, consulta a linha com `FOR UPDATE`, compara campos comerciais relevantes, rejeita colisão de payload por `22023`, devolve ID sem gravar segundo evento em replay. EXECUTE somente authenticated após verificação de cargo/MFA. SQL gate `DEV_MASTER_ONBOARDING_STRICT_REPLAY_ROLLBACK_PASS` confirmou uma linha/um evento, payload divergente negado e AAL1/tenant/anon negados. **Risco residual:** a RPC legada continua com EXECUTE autorizado a Master; mapear consumidores e revogar/depreciar com transição segura antes de PROD. A verificação SQL é por claims simuladas; JWT HTTP real e concorrência de duas conexões continuam NOT EVALUATED.


## Master onboarding e Cliente360 — 2026-10-10

`MasterOnboarding` utiliza SELECT sob RLS Master/Billing somente depois do gate frontend MASTER AAL2; a segurança verdadeira dos comandos está em `private.require_platform_staff('MASTER')` nas RPCs. Form exige plano publicado, datas compatíveis, ADMIN inicial, dados válidos e confirmação humana distinta para provisionar. O backend existente cria organização e assinatura, retorna mesma Loja se repetido pelo mesmo run e enfileira um job de convite. Teste rollback confirma exatamente uma organização, assinatura e job, mas não testa disparo/entrega de e-mail nem fluxo externo de aceite. Risco pendente: a RPC `save_saas_onboarding_draft` reutiliza `idempotency_key` para conflito mas não valida hash de payload divergente; frontend repete o payload, porém proteger reuso externo com payload diferente é melhoria de servidor requerida antes de PROD.

`read_master_client_360` (#45) é somente leitura com SECURITY DEFINER/search_path vazio, EXECUTE negado anon e concedido authenticated, permissão MASTER/AAL2 antes de seleção, agregado de tickets somente `ticket_scope='tenant'` e valida `integrity_ok` do faturamento. SQL Master AAL2 positivo, Master AAL1 e tenant AAL2 negativos e anon negado, ROLLBACK PASS. Não prova HTTP/JWT realmente assinados, MFA em navegador ou isolamento em múltiplas sessões. Sem produção.


## Incremento 20 — isolamento do suporte Master (2026-10-10)
Nova função `reply_master_tenant_support_idempotent` (SECURITY DEFINER, `search_path=''`, EXECUTE somente `authenticated`) exige `private.require_platform_staff('MASTER')` (MFA/AAL2), escopo organization + `ticket_scope='tenant'` e lock antes de delegar a `reply_saas_support_ticket`. Registra resultado pela mesma chave de idempotência após incerteza de rede, impedindo segundo evento por replay; payload diferente retorna erro. O frontend diferencia notas internas de mensagens visíveis ao cliente, sem expor comando de resposta nos chamados internos. Views/ tabelas RLS permanecem origem de autorização de leitura. Testes `DEV_MASTER_SUPPORT_RLS_ROLLBACK_PASS` e `DEV_MASTER_SUPPORT_REPLY_ROLLBACK_PASS` com claims simuladas MASTER AAL2, AAL1, tenant AAL2 e anon. JWT HTTP real, concorrência independente e fluxo de suporte temporário read_only NÃO avaliados. Nenhum segredo/API provider foi incluído.


## Incrementos 15–19 — revisão de superfícies de autorização, 2026-10-09/10

Superfícies novas SQL SECURITY DEFINER `search_path=''` e acesso EXECUTE exclusivo ao papel `authenticated` (revoke anon/public): `preview_monthly_charge_generation`/`generate_monthly_member_charges` (perm. `charges.create`), `cancel_member_charge_idempotent` (`charges.cancel`), `close_financial_period_idempotent`/`reopen_financial_period_idempotent` (perms próprias), `read_tenant_financial_dashboard`/`read_tenant_delinquency` (`finance.read`), `cancel_tenant_institutional_obligation_idempotent`/`correct_tenant_institutional_obligation_idempotent` (`institutional.manage`), `read_platform_master_overview`/`list_platform_master_tenants` (`private.require_platform_staff('MASTER')` com AAL2). `private.monthly_charge_candidates` não é executável externamente. Consultas comercial Master existentes continuam com filtro `private.has_aal2`/ `private.is_platform_staff`.

Gates SQL em duas Lojas e MASTER com `set_config('request.jwt.claims',...)` + `SET LOCAL ROLE authenticated` simulam claims, exercitam allow/deny, idempotência, ledger/reversões, histórico de preços, ledger financeiro e não alteram fatos após ROLLBACK. **Não equivalem a assinaturas JWT HTTP reais** ou a validação do fluxo MFA em navegador. Falta concorrência real multiconexão, auditoria completa de `SECURITY DEFINER`, dependências de views/security_invoker, acessos MASTER/BILLING/SUPPORT reais, identidade e onboarding, rate limiting, limites e paginação escaláveis. A função antiga cancel/correct ainda acessível a papéis autorizados e sem chave idempotente; revisar consumidores antes de bloqueios.

Mudanças são aditivas no Supabase **DEV**, sem tokens/provider/configs novos. Possível contenção: REVOKE EXECUTE das RPCs novas (sem apagar fatos financeiros) e suspender navegação frontend; fazer forward-fix versionado. Não usar migration DOWN destrutiva. Publicação PROD bloqueada.


## Aprovações com replay seguro — 2026-10-09

`decide_payable_approval_idempotent` SECURITY DEFINER/empty search_path, EXECUTE concedido apenas a authenticated, exige `approvals.review` e assinatura elegível antes de executar `private.idempotency_begin`. Valida request id, decisão e motivo, reutiliza `decide_payable_approval` (bloqueio da solicitação, auditoria e constraint de voto único por ator). RLS da view `v_payable_approval_state` e filtro de organização mantidos. SQL A/B simulando claims com transação revertida PASS; sem teste JWT HTTP real nem múltiplos aprovadores em sessões simultâneas. O RPC legado segue exposto a usuários com `approvals.review` mas rejeita voto duplicado pela constraint; consumidores anteriores precisam de revisão antes de revogar acesso. Nenhum deploy produção.


## Operações financeiras institucionais no frontend — 2026-10-09

`InstitutionalOperations` reutiliza apenas quatro RPCs de backend com `institutional.manage` e idempotência server-side, sem ampliar EXECUTE/grants/RLS de tabelas e sem armazenar chaves financeiras no navegador. A leitura de obrigações consulta views efetivas sob filtro `organization_id` e falha fechada para `integrity_ok=false`, tenant inesperado ou mais de 150 registros. O cliente oculta liquidação de obrigação pendente de aprovação, porém isso **não substitui validação do banco**. A cobrança institucional não é pagamento de integrante nem assinatura SaaS. SQL de criação, pagamento e recebimento parcial em A/B com `ROLLBACK` PASS, incluindo teste de ID estrangeiro. Faltam HTTP/JWT real, múltiplas sessões simultâneas, fluxos de aprovação/correção/cancelamento do piloto e paridade visual desktop/mobile.


## Incremento 12 — pagamentos e DRE, 2026-10-09

Duas RPC `SECURITY DEFINER` adicionais, exclusivamente `authenticated`, `search_path=''`, sem novos grants em tabelas. `reverse_member_payment_idempotent` exige `payments.reverse`, competência mensal, motivo e chave idempotente; utiliza `private.idempotency_begin/complete` e invoca a `reverse_payment` original sob a mesma transação (que também exige permissão e registra evento/auditoria). `read_tenant_dre` exige `reports.read` antes de agregar `v_dre_entries` tenant-scoped, limita 12 competências, exclui patrimonial/caixa e não expõe linhas de outra organização. Anon sem EXECUTE nas duas funções. Nenhum segredo/configuração nova no frontend.

Os gates SQL A/B simulando claims, reversão/rollback e reconciliação DRE passaram. Porém **JWT HTTP com token assinado, concorrência independente e fronteira de volume/RLS real ainda não avaliados**. `reverse_payment` original segue RPC publicamente alcançável para autenticados com permissão; sua duplicidade é bloqueada por eventos, mas seu protocolo não tem mesma chave idempotente; revisar consumidores antes de produção. Reforçar que a tela só valida números como defesa em profundidade: autorização/limites monetários precisam permanecer no PostgreSQL.


## Incremento 11 — exclusão mútua por tenant e cobertura de cadastros (2026-10-09)

Controles críticos de escrita contábil passaram a usar `organizations FOR UPDATE` por tenant nos seis triggers `private.guard_tenant_accounting_change()` em vez de `LOCK TABLE SHARE` global na publicação. Trigger em schema `private`, SECURITY DEFINER e sem EXECUTE em `PUBLIC`/`anon`/`authenticated`; mudança do `organization_id` é rejeitada. O RPC de mapeamento trava tenant antes de plano, reduzindo inversão de locks. Configurações com destino publicado são rejeitadas na inserção/mutação independentemente de RPC. Nova categoria ativa sem mapeamento analítico compatível em **todos** os planos publicados vigentes/futuros aplicáveis falha `23514`; conta financeira ativa sem mapeamento patrimonial também falha. Conta nova começa inativa e auditoria reflete `active=false`.

**Limites/riscos:** o lock da Loja agora é um ponto de serialização intencional; seu tempo de espera, requisições simultâneas, timeout, recuperação de deadlock e comportamento de assinaturas HTTP reais ainda NÃO foram testados em sessões independentes. Simulação via executor SQL retornou `same-tenant lock unexpectedly free`; sem evidência de sobreposição da janela crítica, o resultado não prova falha nem sucesso do locking. Triggers de linha não cobrem `TRUNCATE` por administrador privilegiado; DDL/credenciais privilegiadas não são o fluxo SaaS. Catálogos publicados existentes podem ser incompletos (legado DEV), o que bloqueia ativação de novos cadastros até criação de planos sucessores. Revisar fluxos antigos que esperavam conta nova ativa. Lints existentes de SECURITY DEFINER e outros seguem pendentes de análise de superfície de ataque.


## Riscos de publicação contábil — 2026-10-09

A implementação DEV usa `public.publish_validated_accounting_plan` SECURITY DEFINER exposta intencionalmente só a `authenticated`, exigindo `private.require_permission('accounting.manage')` e validação de assinatura antes da operação. `anon` e PUBLIC sem EXECUTE. O endpoint legado `publish_accounting_plan(uuid,uuid)` perdeu EXECUTE API para impedir contornar validações de hierarquia, natureza e vigência. A wrapper refaz diagnóstico sob lock e usa a constraint PostgreSQL de exclusão temporal do plano published. Idempotência evita publicação duplicada após timeouts, retorno divergente não é sucesso no frontend e eventos de auditoria incluem motivo. SQL/claims A/B rollback PASS, HTTP/JWT real e concorrência independente **não avaliados**.

**Risco operacional:** Locks `SHARE` nos catálogos/contas/mapeamentos atingem todas as Lojas, não apenas o tenant corrente. Publicação é pouco frequente, mas pode bloquear escrita de outras organizações ou provocar deadlock/timeout; testar sob múltiplas sessões antes de liberar PROD. **Risco funcional:** adicionar categoria ativa depois da publicação pode criar ausência de mapeamento no plano já imutável; faltam controles de sucessão de catálogo/competência. **Compatibilidade:** consumidores de API que chamassem `publish_accounting_plan` diretamente passam a receber permission denied. Não houve revisão de consumidores externos. Seguir fail-closed e bloquear produção.

## RPC de diagnóstico pré-publicação — 2026-10-09

`preview_accounting_plan_publication` adicionada em `public` como SECURITY DEFINER sem `search_path`, com require_permission('accounting.manage') antes de consulta; `anon` sem EXECUTE, sem concessão de escrita em tabelas. Faz apenas SELECT e não retorna dados de outras Lojas. A classificação `ready` é um snapshot orientativo, **não é uma capacidade ou autorização para publicar**: revogação de papel, novas categorias, inativação de contas ou publicação concorrente podem invalidar resultado. Publicação deve revalidar todos os predicados atomicamente sob lock, não confiar no frontend ou preview armazenado. Gate SQL A/B simulando autenticação, ausência/invalidade de vínculos, ciclos, vigências, RLS, roles, assinatura suspensa e não alteração de ledger PASS com ROLLBACK. HTTPS/JWT real e concorrência de conexões independentes não avaliados; manter linter SECURITY DEFINER como observação não resolvida.


## Incremento 8 — RPCs de plano contábil draft, 2026-10-08 Brasil

Duas RPC SECURITY DEFINER autenticadas novas em `public`, com `accounting.manage`, assinatura verificada por `private.require_permission`, `search_path` vazio, `anon` sem EXECUTE. Criação de plano restringe início a competência futura e reutiliza `create_accounting_plan` (não impede o uso do endpoint legado por quem já possua accounting.manage); idempotência e motivo auditado. Mapeamento exige tenant e draft com `FOR UPDATE`, associação FK dentro da mesma Loja/plano, tipo analítico ativo, natureza compatível, controle otimista via conta esperada e trilha de auditoria. Trigger legado torna planos publicados imutáveis. Testes SQL em duas Lojas: A/B positivos/negativos, RLS, suspensão, roles, anon, imutabilidade e invariantes financeiros PASS com ROLLBACK. Auditoria de segurança integral, JWT HTTP e concorrência simultânea permanecem não avaliados. Adicionadas duas funções definer ao inventário de risco, sem novos grants em tabelas.


## Identidade/PIX da Loja — 2026-10-08 Brasil

`save_tenant_identity` é uma RPC SECURITY DEFINER limitada a authenticated com `private.require_permission(settings.manage)`, valida tamanho/formatos, preserva propriedades não autorizadas, usa lock por organização e `expected_updated_at`. Para auditoria, não registra telefone, e-mail, PIX ou endereço. Retry com mesma chave/payload e conflito `40001`; após erro de transporte UI bloqueia e exige reenvio idempotente. Versão monotônica via trigger exclusivo corrige vulnerabilidade de lost update com `now()` fixo. SQL rollback A/B confirmou grants, roles e suspensão; HTTP/JWT real e concorrência em conexões simultâneas ainda não avaliados. Chave PIX armazenada em configuração não constitui processamento de pagamento.


## Incremento de tesouraria — 2026-10-08 Brasil

Duas RPCs SECURITY DEFINER autenticadas adicionais exigem `private.require_permission(p_organization_id,'settings.manage')` antes de acessar tabelas e validam organização/estado. Concessões nas tabelas continuam SELECT apenas para authenticated; nenhuma policy RLS ou tabela alterada. create usa `pg_advisory_xact_lock` e impede duplicação case-insensitive; status usa `FOR UPDATE` e `expected_active`. ID estrangeiro é 23503 após forward-fix: `EXECUTE ... INTO` não define `FOUND`, portanto usar `v_old is null` sobre coluna NOT NULL. Auditoria grava tipo/nome/status, sem copiar identificações bancárias. Campos com valores de conta permanecem protegidos pelas RLS existentes.

Teste SQL DEV A/B com rollback: ações permitidas, negativas de outros tenants e cargos, suspended, anon, stale, input, escrita direta e preservação do ledger: PASS. HTTP/JWT real, testes de corrida simultânea, RLS E2E, revisão mobile e avaliação integral de advisors não executados nesta entrega. A nova superfície aumenta o número de functions definer; manter auditoria e revisão de privileges antes de produção.


## RPCs de catálogo/preço — 2026-10-08

Três novas RPCs definer intencionais sob settings.manage/require_permission (ADMIN no catálogo atual), assinatura ativa e IDs próprios; anon semEXECUTE, tabelas sem novos grants, RLS preservada. Nomes duplicados normalizados protegidos por advisory lock; preço finito/positivo/decimal limitado numeric(14,2). Preço sucessor usa lock da regra e UUID esperado; conflito40001, IDs estrangeiros23503. Nenhuma edição direta de valor histórico, category.default_behavior ou fatos financeiros.
SQL rollback A/B positivo/negativo, auditoria/retry, TREASURER, suspensão e leitura cruzada PASS; não equivale a HTTP/JWT real nem concorrência simultânea. UI mantém mesmo payload/chave quando resultado ambíguo e exige atualização em conflito. Advisors43RPC autenticadas definer (40anteriores+3),3backendsem policies e aviso de senha vazada preexistente. Documentar controles em vez de abrir grants/RLS para reduzir avisos.


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


## Estado atual — 2026-10-08 Brasil

Etapa 1 CONCLUÍDA no DEV; etapa 2 EM EXECUÇÃO, começando pela conciliação de integrantes, parâmetros e estrutura financeira com o piloto V35. Evidência consolidada e limites: [V35_STAGE_1_CLOSURE_REPORT.md](docs/V35_STAGE_1_CLOSURE_REPORT.md).
Último HTTP: DEV FINAL AUTHORIZATION 09fcfa34-48ad-4c19-ac60-b2c173b2648b, PASS nas duas lojas; 28 views e oito negativas adicionais por recurso em cada loja. Estados finais e saldos conferidos administrativamente. CI do código f467d8e6: run 37720733935 success.
Produção/release comercial continuam bloqueados pelo escopo restante V35, homologação, recuperação e aprovação. Os registros datados abaixo são históricos; suas pendências da etapa 1 são superadas somente no escopo discriminado no relatório, sem converter cenários não avaliados em PASS.


> Nunca registrar secrets reais.

## Findings

| ID | Data | Categoria | Severidade | Status | Componente | Evidência | Mitigação |
|---|---|---|---|---|---|---|---|
| SEC-001 | 2026-10-02 | Cobertura | média | aberto | repositório | Código da aplicação ausente; controles não podem ser auditados | Versionar código real e executar revisão de auth, autorização, dados, entradas, secrets e deploy |
| SEC-002 | 2026-10-02 | CI/CD | informativa | aberto | GitHub | Nenhum workflow observado na revisão inspecionada | Definir checks somente após identificar stack e comandos reais |

## Controles críticos

| Controle | Default esperado | Evidência | Última revisão |
|---|---|---|---|
| Autenticação | fail-closed | NÃO AVALIADO | 2026-10-02 |
| Autorização | deny / least privilege | NÃO AVALIADO | 2026-10-02 |
| Isolamento de tenant | obrigatório quando multi-tenant | NÃO AVALIADO | 2026-10-02 |
| RLS | isolamento quando aplicável | NÃO AVALIADO | 2026-10-02 |
| Secrets | server-side | NÃO AVALIADO | 2026-10-02 |
| Webhooks | autenticados/verificados | NÃO AVALIADO | 2026-10-02 |
| CI/CD | least privilege | NÃO AVALIADO | 2026-10-02 |

## Exceções aceitas

Nenhuma exceção aceita registrada.

## Auditorias

| Data | Escopo | Tipo | Resultado | Limitações |
|---|---|---|---|---|
| 2026-10-02 | repositório GitHub | diagnóstico inicial ECC | NÃO AVALIADO para segurança do produto | somente README disponível; sem código/configuração do produto |

## Regra

Ausência de finding não significa ausência de vulnerabilidade. Scanners, buscas textuais e checklists são sinais; autorização, isolamento, persistência e comportamento devem ser testados no sistema real.


## Atualização V35 — 2026-10-02

| ID | Severidade | Estado | Evidência / ação |
|---|---|---|---|
| SEC-003 | média funcional | aplicada; teste de papéis pendente | Views V35 chamam helpers privados com EXECUTE revogado; forward fix concede execução a authenticated e verifica staff/AAL2 internamente, com filtro administrativo nas views |
| SEC-004 | alta para release | aberto | Catálogo RLS e invariantes financeiras SQL aprovados; JWT/RLS comportamental, MFA e concorrência pendentes; gate bloqueia release/UI financeira integrada |
| SEC-005 | preventiva | verificado somente local | Kit de fixture exige projeto DEV exato e identidades distintas; 4 testes locais aprovados |

SEC-001 evolui: fundação SQL incorporada; estrutura inicial frontend existe na branch herdada; backend HTTP e integrações continuam pendentes. SEC-002 evolui: CI estática adicionada na branch, resultado remoto pendente. Não foi realizada auditoria completa de segurança nesta etapa.

| SEC-006 | preventiva | mitigado em DEV | Grants explícitos do Supabase permitiam anon executar funções definer; revogados em migration, advisor confirma ausência desse finding |

## Supabase DEV verificado — 2026-10-02
Projeto existente `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, região sa-east-1, plano Free, ACTIVE_HEALTHY. Usuário autorizou preparo DEV, migrations, dados fictícios e desenvolvimento com preview; cobranças devem ser apresentadas antes e produção depende de aprovação posterior. Nenhum projeto/branch pago criado.

19 migrations aplicadas. Histórico e nomes locais alinhados às versões atribuídas pelo conector; mapa e hashes de execução em `docs/engineering/v35-dev-runtime-manifest.json`. O manifesto da fonte conserva hashes originais históricos. As migrations 009 e 014 receberam correções antes da primeira aplicação bem-sucedida: chaves das tabelas de cancelamento e ordem de colunas da view de faturas. Migration posterior remove execução anônima de funções SECURITY DEFINER e restringe defaults de novos grants.

VERIFICADO: 138 tabelas públicas, todas com RLS; catálogo de views/helpers; invariantes financeiras com dados fictícios transacionais e rollback; pós-V31; quatro testes locais do guard DEV. Teste financeiro atualizado para publicar o plano contábil exigido pela V35. Advisor não aponta funções definer executáveis por anon. Permanecem 37 avisos de RPCs autenticadas (autorização interna requer teste comportamental) e três tabelas backend sem policies (negação por padrão).

NÃO AVALIADO: login/JWT real, isolamento entre tenants com usuários reais, MFA/AAL2, concorrência/idempotência, configuração Auth cloud, build do frontend herdado, preview Cloudflare e produção. Dados fictícios do teste financeiro foram revertidos; usuários Auth e fixtures persistentes ainda não criados. Credencial administrativa Auth de DEV e dois usuários de teste devem ser provisionados em ambiente seguro; nunca colar secrets no chat ou commitá-los. Configuração TOML local não comprova configuração cloud.

## Auth e isolamento SQL — 2026-10-02
Dois usuários criados pelo usuário no painel Auth, e-mails confirmados, vinculados como ADMIN somente às respectivas Lojas DEV. Nenhuma senha acessada ou alterada. Seed de vínculo parametrizado por UUID em dev-gate/bind-existing-auth-users.sql.

19 migrations aplicadas; nova support_policy_helper_permissions corrige falta de EXECUTE para authenticated em private.is_tenant_user(uuid), usado pelo RLS de chamados, e private.has_aal2(), usado pelas views administrativas. anon/PUBLIC continuam sem EXECUTE. Falha original reproduzida com papel authenticated; após correção, teste de leitura/escrita legítima e negação cruzada aprovado em ambos os tenants.

VERIFICADO: scripts/verify_dev_role_isolation.sql (SET ROLE authenticated/anon + claims simuladas): organizações/integrantes próprios visíveis, outros ocultos; chamado próprio criado e lido; criação cruzada negada com 42501; configuração/staff/catálogos administrativos ocultos; helper administrativo bloqueado em AAL1; anônimo sem linhas. Escritas do teste revertidas. Catálogo de permissões aprovado.

NÃO AVALIADO: login com senha, assinatura JWT e HTTP/Data API, MFA real, concorrência/idempotência e suspensão. SET ROLE/claims simuladas não substituem autenticação real. Próximo: testes de sessão real em ambiente seguro e aplicação/preview; nenhum secret deve ser colado no chat. Cloudflare e produção ainda pendentes.
 
## Advisor Auth observado — 2026-10-02
Aviso auth_leaked_password_protection: proteção contra senhas vazadas desabilitada no Auth cloud. Não significa que as senhas de teste estejam comprometidas. Remediação e eventual dependência de plano/custo devem ser verificadas antes de ativar; nenhum upgrade autorizado ou executado. Permanecem 37 avisos de RPCs definer autenticadas e três tabelas backend sem policies.

## Incremento frontend DEV

SEC-007: respostas atrasadas de auth/tenant e logout testados com client simulado; validação de configuração rejeita secrets e URL insegura. RLS real via JWT ainda pendente. Session persistente e CSP requerem revisão no preview.
SEC-008: RPC de suporte sem idempotência; UI impede envio simultâneo e orienta atualizar lista em erro ambíguo. Não declarar exatamente uma vez.
SEC-009: auditoria npm inicial encontrou undici/miniflare na ferramenta Wrangler; atualizar Wrangler para correção e registrar resultado audit após instalação. Nenhum secret novo no repo.

SEC-009 remediado: Wrangler 4.147.0 instalado e lockfile atualizado; npm audit retornou zero vulnerabilidades (não substitui revisão de segurança).


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


## Pacote restante da etapa 1 preparado — 2026-10-07 Brasil / 2026-10-08 UTC

Proprietário determinou continuar até fechar etapa1; não declarar encerrada enquanto gates reais pendentes. Ver docs/DEV_STAGE1_CLOSURE_GATE.md. Persistidas somente fixtures DEV isoladas para FIFO e plano/mapeamentos 2027, sem sobreposição/alteração de fatos 2026. SQL rollback PASS: FIFO/institucional/fechamento, 20 comandos cross-org por identidade, FK institucional23503 e cinco transições de perfil/restauração. 12 testes locais/sintaxe PASS. Preparados test:stage1-remaining, test:profiles-live (JWT original sem refresh durante fases) e test:master-mfa (QR local privado, OTP mascarado, AAL1 negativo/AAL2 positivo). Todos novos HTTP/TOTP ainda NÃO EXECUTADOS pelo proprietário. Ambas assinaturas active, papéis ADMIN originais preservados e nenhum vínculo/staff/fator temporário aplicado. Conta dedicada escolhida via pergunta pelo proprietário: michael.c.carvalho+corsys-dev-master@gmail.com; consulta Auth ainda não encontrou usuário, staff_count=0. Proprietário precisa criá-la no painel e manter senha local; conector não oferece criação Auth. Não inserir Auth por SQL nem fabricar tokens. Bind primeiro Master só após identidade criada/conferida, proteção do último Master permanece. Support/Billing/sessões/expiração/revogação e critérios críticos remanescentes continuam obrigatórios, não cobertos por Master sozinho. Mudanças não promovem etapa2, não alteram produção/cobrança/grants/schema/frontend. Conferir CI contra novo commit. Pendências reais dependem de execução/OTP do proprietário, não de autorização nova.


## Staff live HTTP/MFA aprovado — 2026-10-07, 23:51 Brasil

Proprietário executou test:staff-live na cópia Windows (4), com saída final PASS apresentada. Tag DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738. SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno e mensagem, janela Aread_only/B oculto/20writes por loja negados, expiração por datas passadas, reabertura positiva, encerramento/revogação, Billing assinaturas positivas/limites financeiro-Support-Master, inactive e cleanup, logout global e refresh anterior rejeitado por código Auth/status esperado PASS. Mesmo JWT preservado durante as mudanças SQL; não equivale a invalidação criptográfica imediata do accessJWT em logout. Ticket fictício e TOTP verificado permanecem, credenciais não recebidas.

Agente aplicou sete transições guardadas entre WAITs. SQL final: A/B ADMIN próprios, tenant_links0, duas subscriptionsactive, somente Master dedicado active, zero janelas suporte abertas, auth.sessions staff0; fatores Master/staff TOTP verified. Janela temporária ENCERRADA, cleanupRequired=false. CI pacote37718586263success. Gates de perfis/MFA/staff/suporte/refresh concluídos no escopo executado. Revisão do critério histórico IDOR por recurso em cada RPC ainda identifica casos de configuração/aprovação e views financeiras/DRE a conferir; não encerrar etapa1 nem promover etapa2 antes de completar essa matriz. Autorização cross-org20RPCs não substitui own-org/foreign-resource-ID. Sem produção/custos/grants/schema alterados.


## Registro — 2026-10-08 (DEV)

Nova função `public.transition_member_term` (SECURITY DEFINER autenticada): uso restrito por `private.require_permission(settings.manage)`, `search_path` vazio, `anon` sem EXECUTE, e verificações SQL negativas A/B, TREASURER, VIEWER e assinatura suspensa em transações revertidas. Operação atômica e auditada; valores e datas são validados no servidor. A presença de SECURITY DEFINER demanda revisão contínua, não indica auditoria integral. HTTP/JWT e concorrência simultânea ainda **não avaliados**.

