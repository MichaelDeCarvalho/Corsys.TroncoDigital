# 04 — Segurança manual que o smoke test não substitui

## Master/MFA
O papel Master na V35 exige AAL2. Esse teste deve usar MFA real:
- sessão AAL1: operação Master negada;
- sessão AAL2: somente operações autorizadas;
- SUPPORT não pode executar comando MASTER;
- BILLING não pode executar comando MASTER;
- último MASTER ativo não pode ser desativado/removido.

## IDOR/BOLA
Em cada RPC, alterar IDs por IDs pertencentes ao outro tenant e esperar negação.

## Suspensão
- active/trialing: escrita permitida;
- past_due dentro do grace: conforme política;
- após grace/suspended: novas escritas financeiras bloqueadas;
- leitura/exportação permanece conforme contrato/política.

## Views
Testar views financeiras/DRE diretamente com usuário Tenant A e Tenant B.
Nenhuma view pode vazar linhas do outro `organization_id`.

## Browser
Nunca colocar `SUPABASE_SECRET_KEY`/service-role no frontend, localStorage, source map ou bundle.
