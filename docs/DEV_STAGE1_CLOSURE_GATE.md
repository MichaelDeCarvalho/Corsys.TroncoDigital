# Etapa 1 — gates restantes e fechamento (2026-10-07 Brasil)

## Estado verdadeiro
Etapa 1 EM EXECUÇÃO. Não avançar para etapa 2 nem marcar concluída com CI ou claims simuladas.
Proprietário pediu continuidade até fechamento. Gates que exigem JWT/senha/OTP reais
necessitam participação local, não permissão nova. Não receber credenciais pelo chat.
HTTP já aprovado: baseline, financeiro positivo/cross/concurrency, suspensão/retomada,
lifecycle de estorno/cancelamento. Ver V35_STAGE_1_EVIDENCE.md.

## Preparação persistida autorizada
seed_dev_stage1_remaining.sql executado no DEV. Integrante separado DEV STAGE1 ISOLATED FIFO
por loja, plano DEV STAGE1 2027 plan válido somente 2027, três categorias e mapeamentos
member_receivable/institutional_revenue/institutional_expense; publicados sem sobrepor 2026.
Sem Auth/schema/grants/roles/status/billing alterados. remaining.fixture.json contém IDs
não secretos. Seed não deve ser repetido, precondição bloqueia reaplicação.
FIFO usa somente integrante novo; gate exige zero cobranças anteriores antes de escrever.

## Preparação verificada
- 12 testes unitários locais PASS, sintaxe de todos scripts PASS.
- DEV_REMAINING_COMMANDS_ROLLBACK_PASS: FIFO ordena duas cobranças 100, pagamento150
  aplica100/50; institucional100, pagamento/recebimento60 com alocação50, aberto50;
  fechamento bloqueia escrita55000 e reabertura aceita escrita. Claims simuladas/ROLLBACK.
- DEV_TENANT_COMMAND_CATALOG_DENIAL_PASS: 20 comandos de tenant por identidade,
  organização alheia42501. Catálogo capturado do schema real; argumentos não relacionados
  são null, portanto essa prova é de negação de organização e NÃO de toda regra/ID válido.
- DEV_INSTITUTIONAL_FOREIGN_ID_23503_ROLLBACK_PASS: IDs estrangeiros de conta institucional
  não aceitos nas alocações, usando contraparte/fatos reais de ambas fixtures. Rollback.
- DEV_PROFILE_TRANSITIONS_ROLLBACK_PASS: cinco mudanças de perfil e restauração
  da linha ADMIN original (incluindo created_at). Só transição SQL, não JWT real.

## Execução normal consolidada
Baixar branch atualizada em nova pasta, copiar .env.dev privado existente para dev-gate.
Não sobrescrever arquivo preenchido. cmd dev-gate: npm ci; npm run check (12 PASS);
set "SUPABASE_DEV_PROJECT_REF=szqkdekwhzxsoxorgvaz"; npm run test:stage1-remaining.
Testa 20 negações por identidade, FIFO concorrente sem dupla alocação, institucional
positivo/cross/misma chave divergente/audit, fechamento e reabertura nas duas lojas.
Cria fatos fictícios 2027 identificados DEV STAGE1 REMAINING UUID. Não modifica 2026.
FIFO faz duas requisições e pode auditar as duas tentativas: saldo/alocações não duplicam;
NÃO afirmar idempotência de eventos audit FIFO. Institucional exige UUID único/audit único.
Fechamento protegido por finally com reabertura antes de saída, inclusive em erro.
Se fechamento tiver erro de transporte (resultado incerto), processo for encerrado à força
ou reabertura falhar, conferir períodos/reabrir por SQL
DEV antes de continuar. Em FAIL informar tag/erro, não repetir ou apagar ledger.
O script encerra com MFA/staff/perfis/revogação OPEN; PASS não conclui etapa inteira.

## Perfis e revogação real — mesma sessão/JWT
npm run test:profiles-live mantém client/JWT original, sem persistência/refresh automático.
Começa com B ADMIN e fatos positivos. Em cada WAIT, proprietário informa ao agente;
agente aplica script da fase DEV, confirma, somente então proprietário pressiona Enter.
1. profile_dev_b_treasurer.sql: ADMIN -> TREASURER; financeira positiva e limites Master/tenant.
2. profile_dev_b_viewer.sql: TREASURER -> VIEWER; leitura positiva e 20 negativas de escrita.
3. profile_dev_b_member.sql: só vínculo do integrante financeiro original B; somente seus
   fatos positivos acessíveis, nenhum peer/tenant estrangeiro, 20 negativas de escrita.
4. profile_dev_b_revoke.sql: remove vínculo; mesmo JWT continua autenticado, mas não lê
   integrantes/financeiro nem escreve20 comandos. É revogação de autorização, não de JWT Auth.
5. profile_dev_b_restore.sql: recoloca ADMIN exato e retoma leitura/escrita com MESMO JWT.
Restaurar ADMIN imediatamente em PASS/FAIL/cancelamento/encerramento forçado.
Scripts só aceitam usuário/org B conhecidos, sem staff/links estranhos, A preservado.
Nenhuma fase aplicada persistentemente nesta preparação. Ambos usuários continuam ADMIN.
Sessão que expire/renove faz o teste falhar, nunca contar token novo como revogação live PASS.

## Master/MFA — conta dedicada escolhida pelo proprietário
Seleção: michael.c.carvalho+corsys-dev-master@gmail.com. Não são os dois admins tenant.
Consulta Auth confirmou conta ainda não criada; staff_count=0. Nenhum fator/usuário criado
pelo agente. O conector disponível não oferece criação de Auth; não manipular auth.users
por insertSQL nem inventar tokens para contornar o fluxo oficial.

Proprietário cria usuário no painel DEV Authentication / Users, senha forte privada,
confirmação conforme criação de usuário de teste. Informar somente que criou, sem senha.
Agente confere UUID pelo e-mail e executa bind_dev_dedicated_master.sql, SOMENTE após
criação, com guard primeiro staff e ausência de roles/links tenant. Não executar seed
ou bind por tentativa; proteger último Master ativo conforme triggers do sistema.
Essa conta passa a ser Master DEV dedicado, não conta de produção. Não apagar/degradar
último Master nem desabilitar proteção para limpar fixtures. Support/Billing precisam
identidades apropriadas/cenários próprios; primeiro Master não pode ser trocado para
outros papéis deixando zero Master. Não considerar testes de Master prova desses papéis.

Depois preencher somente no .env.dev privado TEST_MASTER_USER_ID (UUID conferido) e
TEST_MASTER_PASSWORD (senha criada pelo proprietário). npm run test:master-mfa.
Pré-inscrição: getUser ID/email fixos, sessãoaal1, comando Master42501 e RLS de staff restrita ao próprio vínculo.
Inscreve TOTP somente nessa conta ou utiliza único TOTP verificado existente. QR gerado
como arquivo HTML local privado .mfa-local (ignorado no git), sem rede/scripts externos.
Abrir arquivo local e escanear autenticador; inserir código mascarado no terminal.
Nunca enviar QR/OTP/secret/token/env ao chat nem publicar HTML. Arquivo removido em finally;
se computador/processo for encerrado à força, excluir .mfa-local manualmente.
Fator novo não verificado recebe tentativa de limpeza; falha avisada sem repetir/criar mais.
Fator verificado permanece no autenticador/conta. Operações enrollment podem invalidar
outras sessões dessa conta dedicada; contas tenant não afetadas.
Depois challengeAndVerify: assuranceaal2/getUser, staff MASTER ativo/positivo, RPC
set_saas_plan_active no plano DEV fixo zero-price já ativo, mantendo active=true;
leitura direta da auditoria backend negada42501; operador confere separadamente um evento audit com tag e previous/new_active=true. Não ativa catálogo comercial/cobrança.
Isso ainda não comprova sessões Support/Billing/expiração/revogação da matriz inteira.
APIs oficiais consultadas 2026-10-08 UTC:
https://supabase.com/docs/reference/javascript/auth-mfa-enroll
https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify
https://supabase.com/docs/guides/auth/auth-mfa

## Critério de encerramento
Consolidar evidência contra versão testada e estados finais (ADMIN A/B, assinaturas active,
competências reabertas, nenhum suporte acessível após revogação, staff restrito por MFA).
Pendências críticas não podem ser reclassificadas como etapa2 para encerrar etapa1.
MFA/staff e sessões de suporte/perfis/revogação continuam necessários até prova real.
Recuperação operacional/produção ficam na etapa7; recuperação de acesso comprometida
ou falha que afete segurança deve ser tratada antes de operação.
Somente após cumprir gates críticos atualizar V35_DELIVERY_PLAN: etapa1 concluída e
etapa2 em execução, informando explicitamente ao proprietário a transição.


## HTTP restante aprovado pelo proprietário — 2026-10-08 UTC

Execução local Windows/Node v24.20.0 pelo proprietário na pasta de download (3), saída integral apresentada; nenhuma credencial recebida pelo agente. npm ci: zero vulnerabilidades no dev-gate; npm run check: 12 testes PASS. npm run test:stage1-remaining: Tenant A e Tenant B PASS. Tag: DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696.

Com JWT real nas duas lojas: 20 RPCs do catálogo negaram organização alheia; FIFO positivo ordenado e concorrente preservou alocações/saldos; financeiro institucional positivo/cruzado, idempotência, saldos e auditoria passaram; fechamento negou lançamento e reabertura permitiu escrita positiva. Saída confirmou competências reabertas. Fatos fictícios 2027 permanecem DEV; não repetir o gate de integrante limpo nem apagar ledger sem inspeção. O catálogo testa negação por organização, não toda combinação de parâmetros/IDs. Não comprova idempotência de eventos de auditoria FIFO.

Supera a pendência HTTP deste roteiro na preparação anterior. Perfis/revogação live ainda NÃO executados; próxima execução é test:profiles-live, aguardando WAIT antes de cada alteração SQL e restaurando ADMIN em erro/cancelamento. Nenhuma mudança persistente de papel aplicada nesta atualização. Master/MFA real, Support/Billing e ciclo de sessões/expiração/revogação permanecem OPEN. Consulta Auth nesta sessão não encontrou a conta dedicada escolhida. Etapa 1 permanece EM EXECUÇÃO; etapa 2 pendente. CI do código testado 28053c3: Foundation checks run 37713949588 success. Este incremento registra evidência, sem alterar código/schema/grants/produção/cobrança.


## Perfis e revogação live HTTP aprovados — 2026-10-07, 22:56 Brasil

Proprietário executou test:profiles-live no Windows/Node v24.20.0, mesma cópia (3) do código 28053c3. Tag DEV LIVE PROFILES ff496b1b-823d-4021-9fd5-d21b240f9a6c. ADMIN baseline e TREASURER financeiro positivo/limites Master e tenant PASS apresentados. VIEWER leituras próprias e 20 escritas negadas PASS apresentado. Chegada ao WAIT REVOKED LINK demonstra que as assertions anteriores de integrante vinculado passaram; chegada ao WAIT RESTORE ADMIN demonstra que as assertions de revogação passaram. Saída final apresentada: same JWT ADMIN restored; all original scopes and positive write restored PASS. Nenhuma credencial/token recebido pelo agente.

Agente aplicou cinco transições SQL DEV guardadas somente B, entre os WAITs do mesmo processo: TREASURER, VIEWER, vínculo único, remoção do vínculo e ADMIN original. getUser e comparação do token original sem refresh sustentam revogação da autorização com JWT ainda válido, NÃO invalidação de sessão Auth. Consulta SQL final conferiu A/B ADMIN, zero member_user_links e created_at original 2026-10-02 22:58:27.201308+00. Janela de perfis ENCERRADA; restauração persistida antes da confirmação HTTP final. Dois pagamentos fictícios 1 permanecem DEV, não apagar ledger nem repetir teste sem necessidade.

Gates tenant de perfis/vínculo/revogação deste roteiro concluídos. Master/MFA, staff Support/Billing, suporte temporário/expiração/revogação e ciclo de sessões Auth continuam separados e OPEN. Consulta Auth atual não encontrou michael.c.carvalho+corsys-dev-master@gmail.com; próximo passo é criação oficial da conta dedicada no painel pelo proprietário, senha privada local, seguida de conferência e bind guardado. Etapa 1 segue EM EXECUÇÃO, etapa 2 pendente. Nenhum schema/grant/produção/cobrança alterado.


## Master DEV dedicado vinculado — 2026-10-07, 23:04 Brasil

Proprietário confirmou criação oficial da conta no painel. Consulta Auth conferiu michael.c.carvalho+corsys-dev-master@gmail.com, UUID 71e27b4c-f0ba-46f7-832f-4faf29e8603d, email confirmado em 2026-10-08 02:04:16.172606+00. Executado bind_dev_dedicated_master.sql com guards: sem roles/links tenant, nenhum staff anterior, plano DEV fixo zero-price presente. Retorno conferiu MASTER active=true. Primeiro Master DEV ativo; preservar proteção do último Master. Contas tenant não promovidas. Nenhuma senha/token recebida, nenhum fator inscrito pelo agente. HTTP Master/AAL1/TOTP/AAL2 ainda PENDENTE do proprietário; próximo comando test:master-mfa com UUID e senha somente em .env.dev privado. Etapa1 aberta, sem produção/cobrança/schema/grants alterados.


## Correção do contrato AAL1 no teste Master — 2026-10-07, 23:11 Brasil

Primeira execução Master pelo proprietário interrompeu em AAL1 staff RLS: private rows exposed (1 != 0), antes de enrollment. Login/UUID/AAL1 e RPC privilegiada negada42501 já passaram pelas assertions anteriores. Inspeção da política real platform_staff_select_self_or_master confirmou SELECT user_id=auth.uid() OR private.is_platform_staff('MASTER'); helpers privilegiados exigem AAL2. A leitura do próprio vínculo em AAL1 é permitida pela política existente; a expectativa zero-row do teste estava errada. Corrigido test:master-mfa para consultar o escopo staff inteiro e exigir exatamente a própria linha MASTER ativa (UUID conferido), mantendo a negação42501 da RPC em AAL1 e a prova TOTP/AAL2/RPC/audit positiva posterior. Não alterar RLS/grants/helpers para satisfazer teste incorreto. 12 testes locais e sintaxe PASS; reexecução HTTP/MFA ainda pendente. Nenhum fator criado pela tentativa que falhou. Não classificar MFA como PASS.


## MFA Master comprovado; expectativa de leitura da auditoria corrigida — 2026-10-07, 23:26 Brasil

Execução local do proprietário alcançou a consulta de auditoria após passar enrollment/challengeAndVerify real, currentLevel=aal2, getUser UUID conferido, vínculo MASTER ativo positivo, plano fixo price0 já active=true e RPC set_saas_plan_active retornando UUID esperado. Interrompeu por42501 permission denied for table saas_master_audit_logs; roteiro integral encerrou com FAIL e NÃO deve ser descrito como saída final PASS. Etapas anteriores comprovadas pelo ponto de falha, mais inventário administrativo factor_type=totp/status=verified. Nenhum secret/OTP/QR/token recebido pelo agente.

Inspeção de contrato: tabela saas_master_audit_logs RLS=true, sem policies e sem SELECT authenticated, backend-only. Não adicionar grant/policy para satisfazer expectativa errada. Consulta administrativa encontrou exatamente um evento saas_plan.reactivate/resource_type saas_plan/recurso7c71fda8-13b9-4bd4-999a-7df06937666d, actor71e27b4c-f0ba-46f7-832f-4faf29e8603d, reason DEV MASTER MFA fb5a5b74-00b4-45c8-9a6b-0565c2b69f56, previous_active=true e new_active=true. Evidência combinada: MFA/AAL1 negativo/AAL2 positivo/RPC e auditoria backend comprovados nesta execução; saída integral corrigida ainda não executada. Sem cobrança comercial ativada.

Roteiro corrigido exige42501 para leitura direta backend-audit e informa que operador precisa conferir evento único pela tag; não converte qualquer erro em PASS nem declara auditoria positiva via HTTP. 12 testes/sintaxe locais PASS. Não repetir cadastro TOTP: fator verificado permanece para próximas autenticações. Reexecução desnecessária desta operação comprovada; futura execução corrigida reutiliza fator. Support/Billing, suporte temporário/expiração/revogação e ciclo Auth permanecem OPEN, etapa1 em execução, etapa2 pendente.


## Staff live HTTP/MFA aprovado — 2026-10-07, 23:51 Brasil

Proprietário executou test:staff-live na cópia Windows (4), com saída final PASS apresentada. Tag DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738. SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno e mensagem, janela Aread_only/B oculto/20writes por loja negados, expiração por datas passadas, reabertura positiva, encerramento/revogação, Billing assinaturas positivas/limites financeiro-Support-Master, inactive e cleanup, logout global e refresh anterior rejeitado por código Auth/status esperado PASS. Mesmo JWT preservado durante as mudanças SQL; não equivale a invalidação criptográfica imediata do accessJWT em logout. Ticket fictício e TOTP verificado permanecem, credenciais não recebidas.

Agente aplicou sete transições guardadas entre WAITs. SQL final: A/B ADMIN próprios, tenant_links0, duas subscriptionsactive, somente Master dedicado active, zero janelas suporte abertas, auth.sessions staff0; fatores Master/staff TOTP verified. Janela temporária ENCERRADA, cleanupRequired=false. CI pacote37718586263success. Gates de perfis/MFA/staff/suporte/refresh concluídos no escopo executado. Revisão do critério histórico IDOR por recurso em cada RPC ainda identifica casos de configuração/aprovação e views financeiras/DRE a conferir; não encerrar etapa1 nem promover etapa2 antes de completar essa matriz. Autorização cross-org20RPCs não substitui own-org/foreign-resource-ID. Sem produção/custos/grants/schema alterados.


## Matriz final recursos/views preparada — 2026-10-07, após staff PASS

Ver docs/DEV_FINAL_AUTHORIZATION_GATE.md. Staff/MFA/expiração/revogação/refresh concluídos. Revisão mantém etapa1 aberta pela pendência explícita de IDs elegíveis estrangeiros com own organization e views diretas/DRE. Novo test:authorization-final preparado: oito negativas por loja para plano/source/policy/request/payable/receivable, 28views (dez com fatos próprios financeiros/DRE obrigatórios), positivos de duplicação própria/policy2030off/decisão manual/audit. Duas policies draft2030off e duas solicitações MANUAIS fictícias seedadas sobre payables DEV100; não altera valores originais/current policy nem afirma fluxo automático completo de aprovação. SQL verify_dev_final_authorization.sql passou com claims simuladas/ROLLBACK; 12 testes locais/sintaxe PASS. HTTP real do novo roteiro ainda PENDENTE. Preparar pacote dev-gate público sem .env real/node_modules/QR para owner; não repetir gates já aprovados. Após PASS revisar estado final e critérios antes de encerrar1/promover2. Sem produção/custos/Auth/grants/schema.
