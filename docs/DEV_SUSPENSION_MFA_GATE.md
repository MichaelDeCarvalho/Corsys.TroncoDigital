# DEV — suspensão, retomada e preparação MFA (2026-10-07)

## Estado e limites
HTTP financeiro anterior aprovado pelo proprietário com tag DEV HTTP 428ce717-21fa-41cc-a7b5-47512ef83bfe.
Novo HTTP de suspensão/retomada e diagnóstico MFA preparado, NÃO executado com logins pelo agente.
As duas assinaturas permanecem active. Nenhum fator Auth, papel staff ou senha alterado.
Sem DDL/grants, cobrança, produção ou mudança de layout. Etapa 1 permanece aberta.

## Execução local inicial
Baixar branch atualizada em nova pasta. Copiar .env.dev privado existente para dev-gate.
No cmd da nova dev-gate: npm ci; npm run check (10 PASS).
Se a configuração anterior do project ref existia apenas no terminal, corrigir a linha
SUPABASE_DEV_PROJECT_REF=szqkdekwhzxsoxorgvaz no arquivo, salvar, ou repetir set no novo cmd.
Não copiar .env.example sobre configuração preenchida. Nunca enviar arquivo/senha/token.
Executar npm run check:mfa-posture. Saída INFO é inventário, nunca aprovação de MFA.
Métodos oficiais consultados em 2026-10-07:
https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel
https://supabase.com/docs/reference/javascript/auth-mfa-listfactors
https://supabase.com/docs/guides/auth/auth-mfa
Somente getUser, assurance e listFactors: não enroll/challenge/verify/unenroll.
Mostra nível atual/próximo e quantidade de fatores verificados, sem IDs/segredos/QR/tokens.
MFA real exige fluxo de inscrição/desafio, JWT AAL2, negação AAL1 e operação staff
privilegiada positiva, além de ciclo/expiração/revogação. Contas tenant não são staff;
não promover automaticamente nenhum dos dois usuários a Master para testar.

## Janela de suspensão DEV B
Apenas quando puder concluir a sequência e a restauração na mesma sessão.
Pode ser coordenada pelo agente com SQL DEV ou executada pelo proprietário:
1. Abrir https://supabase.com/dashboard/project/szqkdekwhzxsoxorgvaz/sql/new.
2. Colar TODO scripts/suspend_dev_tenant_b_http.sql e executar Run.
   Só aceita assinatura zero-price DEV conhecida B active, grace null e override none;
   A deve permanecer active. Exibir B suspended e A active. Se erro, parar, não bypass.
3. No cmd dev-gate executar npm run test:suspension-http e guardar saída.
4. Independentemente de PASS/FAIL, executar TODO scripts/restore_dev_tenant_b_http.sql
   no MESMO SQL Editor DEV. Confirmar A active e B active antes de terminar.
   Restore só aceita B suspended; se já active, conferir e não forçar guard.
5. Executar npm run test:restoration-http. Cria pagamento fictício 1 na B, sem cobrança real.
6. Enviar somente outputs e tags. Se restauração falhar, comunicar imediatamente;
   não continuar com testes nem alterar dados/ledger para contornar bloqueio.

## Escopo do roteiro
Antes de probes: JWT/getUser UUID exato de ambos, assinatura A active, B suspended,
override B none, views próprias de pagamento/cobrança conhecidas positivas e integridade.
Antes de CADA RPC repete precondição suspended. Nenhum probe em modo ativo.
42501 EXATO exigido em create_manual_charge, register_payment,
allocate_payment_to_charge, allocate_payment_fifo, cancel_charge e reverse_payment.
Depois saldos próprios iguais e nenhuma cobrança/pagamento criado com tag dessa fase.
São tentativas sequenciais de autorização, não prova de concorrência/todos os estados.
Fatos fixos confirmados por consulta SQL do run anterior; roteiro não inventa IDs vazios.
No modo restored, assinaturas A/B active e novo register_payment positivo: available=1,
integrity=true, organização própria. Não aprova demais RPCs positivas de reversão/cancelamento.
Se estado mudar durante probes, roteiro falha; executar restore e inspecionar tag antes de repetir.

## Evidências executadas nesta preparação
10 testes unitários existentes PASS e node --check de todos os roteiros.
Transições SQL suspend/restore com verificações tenant_write_allowed e require_permission
executadas dentro de uma única transação com ROLLBACK:
DEV_SUSPENSION_TRANSITIONS_ROLLBACK_PASS. São claims simuladas, não JWT real.
Primeira verificação usou permissão inexistente payments.register e falhou com 42501;
transação revertida e ambas active conferidas. Corrigida para payments.create, aprovada.
Nenhuma alteração persistente de assinatura feita nesta preparação.
