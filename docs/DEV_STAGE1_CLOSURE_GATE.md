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
Pré-inscrição: getUser ID/email fixos, sessãoaal1, comando Master42501 e staff RLS oculto.
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
um evento audit com tag e previous/new_active=true. Não ativa catálogo comercial/cobrança.
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
