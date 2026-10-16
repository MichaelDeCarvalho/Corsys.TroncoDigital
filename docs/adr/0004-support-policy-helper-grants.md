# ADR 0004 — Grants dos predicados privados de RLS

Aceito em DEV, 2026-10-02.

Teste com SET ROLE authenticated reproduziu permission denied for function is_tenant_user ao ler chamado próprio. O predicado privado verifica auth.uid e tabela de vínculos, mas authenticated não tinha EXECUTE. Grant limitado a authenticated permite que a policy funcione sem remover RLS. has_aal2 recebe o mesmo grant para views administrativas; ambos seguem proibidos para anon/PUBLIC. Migração posterior aplicada e nomes alinhados ao histórico. Testes positivos/negativos dos dois tenants passaram com rollback. Claims simuladas não verificam assinatura JWT, login ou MFA real.
