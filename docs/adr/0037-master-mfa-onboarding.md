# ADR-0037 — Entrada Master com configuração e verificação MFA

Data: 28/10/2026. Estado: proposta implementada em branch DEV, sem publicação.

## Problema
Workspace verificava a disponibilidade Master exclusivamente por RPC que exige AAL2. Um Master novo em AAL1 não via o console nem um caminho para configurar seu autenticador.

## Decisão
Adicionar MasterMfaGate antes de Workspace, após getUser e fora do fluxo de recuperação de senha. Consultar somente user_id da identidade validada em platform_staff. A política SELECT self já existente foi conferida no DEV; não ampliar grants/RLS. Esse vínculo escolhe a apresentação, nunca autoriza dados Master.

Master em AAL1 deve configurar TOTP por clique explícito ou verificar um fator já confirmado. Usar APIs documentadas do Supabase: listFactors, enroll, challengeAndVerify e getAuthenticatorAssuranceLevel. Exigir AAL2 e sucesso da RPC read_platform_master_overview antes de continuar. Workspace e backend mantêm seus próprios controles.

QR nunca é HTML inline, download, log ou persistência; código fica apenas no formulário e é limpo após tentativa. Nenhuma senha, token ou secret é solicitado ao agente. Recomeçar configuração incompleta remove apenas fatores TOTP unverified com nome CorSys Master, após clique explícito e nova listagem. Fatores verificados e de outros aplicativos são preservados.

## Consequências e riscos
Masters precisam de MFA também antes de abrir o Workspace. Usuários tenant conservam o fluxo atual. Erros de consulta não são tratados como autorização; identidade divergente e resultados tardios falham fechados. Remontagem ou recarga perde o QR; usuário pode iniciar novamente a configuração incompleta. Não há recuperação/remoção de fator verificado nesta mudança.

Testes automatizados usam dados sintéticos e não provam MFA real. CI executa tipos, testes, build e validação sem upload. Publicação DEV isolada e confirmação manual do QR/OTP permanecem gates posteriores. Sem produção ou tráfego principal alterados.

## Referências
- https://supabase.com/docs/guides/auth/auth-mfa/totp
- https://supabase.com/docs/reference/javascript/auth-mfa-enroll
- https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify
