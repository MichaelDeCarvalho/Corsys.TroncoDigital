# 0037 — Confirmação TOTP existente na entrada

Data: 28/10/2026. Escopo: frontend DEV, continuidade do P0 de suporte.

## Evidência e decisão

O login por senha de uma conta MASTER com TOTP verificado gerou sessão aal1. O frontend não oferecia challenge, impedindo acesso às RPCs Master que corretamente exigem aal2. Introduzir MfaGate após identidade validada e antes do Workspace: consultar assurance, solicitar código de fator TOTP já verificado quando nextLevel=aal2 e currentLevel!=aal2, usar challengeAndVerify e confirmar aal2 antes de prosseguir.

Nenhum enrollment, reset de fator, segredo, mudança de perfil, RLS ou migration. RPCs continuam como fronteira de autorização determinística; o gate é apresentação. Recuperação de senha mantém seu caminho atual. Sessões sem fator e sessões aal2 preservam entrada normal, sujeitas à autorização do servidor. Falha na verificação mantém dados ocultos, oferece retry ou saída local. Outros tipos de fator não implementados permanecem bloqueados nesta interface.

## Validação e limites

30 testes focados de gate/App/recuperação e typecheck/build PASS. Validação real do código depende do usuário no navegador; não coletar OTP no chat. Homologação P0 HTTP de suporte continua pendente. Não ampliar permissões nem simular AAL2 para contornar o gate.

Referências oficiais consultadas: https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel e https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify.
