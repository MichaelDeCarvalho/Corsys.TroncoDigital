# DEV — Support/Billing e revogação

Etapa 1 aberta. HTTP novo ainda não executado; nenhuma mudança persistente nesta preparação.

## Identidade
Terceira conta: michael.c.carvalho+corsys-dev-staff@gmail.com, criada oficialmente pelo proprietário no painel. Conferir UUID/email confirmado antes de bind_dev_dedicated_staff.sql. Não promover admins tenant ou degradar o único Master. Guard exige zero roles/links/sessões da nova conta e Master dedicado ativo. Credenciais somente em .env.dev: TEST_STAFF_USER_ID e TEST_STAFF_PASSWORD. Executar npm run test:staff-live na cópia atualizada após npm ci/check.

TOTP real segue QR local privado/OTP mascarado; reaproveita único fator verificado. Não transmitir QR/secret/OTP/env/tokens. finally remove HTML, tenta limpar fator novo não verificado; encerramento forçado exige excluir .mfa-local manualmente. Fator verificado permanece.

## Fases — processo aberto, mesmo JWT AAL2
- SUPPORT AAL1: próprio vínculo permitido; dados tenant/tickets ocultos; RPC interna/Master/20 writes por loja negados42501.
- TOTP/AAL2: positivo ticket interno/mensagem internal_note; sem janela, dados A/B ocultos. Ticket fictício permanece DEV com tag UUID.
- WAIT GRANT A: staff_dev_grant_a.sql cria uma janela read_only A15min; fatos A positivos, B oculto, todos writes tenant/Master negados.
- WAIT EXPIRE A: staff_dev_expire_a.sql altera datas para intervalo passado consistente; mesmo JWT perde dados. Prova predicado de expiração, não espera natural15min.
- WAIT REOPEN A: staff_dev_reopen_a.sql prolonga janela expirada; positivo A novamente.
- WAIT REVOKE A: staff_dev_revoke_a.sql encerra janela; mesma sessão perde dados.
- WAIT BILLING: staff_dev_billing.sql muda só conta dedicada; subscriptions A/B positivas/active, financeiro tenant/tickets ocultos, Master/reply tenant negados.
- WAIT INACTIVE: staff_dev_inactive.sql desativa staff; vínculo próprio visível, subscriptions ocultas, RPC interna negada.
- WAIT CLEANUP: staff_dev_cleanup.sql encerra janelas da fixture e remove SUPPORT/BILLING; nunca MASTER. Confere ausência de staff/dados.
- Logout global só conta dedicada e tentativa refresh token anterior somente em memória: erro Auth exato/status400 ou401 obrigatório; rede não PASS. JWT de acesso já emitido pode continuar criptograficamente válido até exp; remoção de papel/vínculo nega dados via RLS imediatamente.

Operador aplica SQL somente depois de WAIT e confirma antes de Enter. Erro/cancelamento exige cleanup imediato. Expiração/troca de JWT falha o gate; não contar relogin como revogação live. Guard rejeita repetir bind/grant com fixtures existentes; inspecionar antes de repetir. Sessão encerrada/ticket fictício permanecem, sem apagar auditoria/ledger.

## Preparação verificada
12 testes locais/sintaxe PASS. Transições completas testadas em ROLLBACK usando B com papel removido só dentro da transação: DEV_STAFF_TRANSITIONS_ROLLBACK_PASS. Não é JWT/MFA/HTTP. A/B ADMIN e Master preservados; nenhuma janela nova aberta. Conferir CI do commit.

Fontes: https://supabase.com/docs/guides/auth/signout e https://supabase.com/docs/guides/auth/sessions. Não declarar invalidação imediata de JWT em logout. Revisar matriz/evidências antes de fechar etapa1. Sem produção/custos/schema/grants/policies alterados.
