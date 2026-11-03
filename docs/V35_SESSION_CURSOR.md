# V35 — CURSOR DE RETOMADA (ler primeiro em toda nova conversa)

> **Política aprovada:** terminar integralmente a V35 antes de liberar Beta. Este arquivo é o resumo operacional curto. Histórico antigo permanece em `SESSION_HANDOFF.md`; backlog rastreável em [V35_EXECUTION_BOARD.md](V35_EXECUTION_BOARD.md).

## Snapshot verificável na criação deste controle

- Inspeção GitHub em 03/11/2026: `origin/main` apontava para `e72cbe424c7238a758037c542eb473f5837042f2` (PR #24 integrado). **Revalidar** esse HEAD; não presumir que permaneceu atual.
- Supabase DEV autorizado: `szqkdekwhzxsoxorgvaz`; Worker DEV `corsys-tronco-digital-dev`.
- Histórico: PRs #15–#24 integrados conforme registros. Não reexecutar homologações por mera mudança de conversa.
- SMTP DEV configurado pelo proprietário (via Supabase Auth/Resend); painel aceitou **um e-mail de recuperação**. Isso **não comprova** recebimento no destino nem envio de convites.
- `MasterOnboarding.tsx` e RPC `provision_saas_onboarding_database`: organização e assinatura criadas, job `onboarding_invite` enfileirado; **consumidor e entrega real ainda não implementados/observados** na evidência existente.

## Posição de execução

- **Macro ativa:** M01 — Onboarding, identidades e convites.
- **Micro ativa:** M01.01 — Revisar contratos reais e implementar consumidor autorizado de `onboarding_invite`, integrando M01.02 apenas se dependência técnica inseparável; documentar limites sem marcar etapa inteira como concluída.
- **Próximo ato técnico:** confrontar migrations `saas_jobs`/`saas_onboarding_runs`, RPCs e Auth/role/termos com código na HEAD atual; desenhar claim/lease idempotente, tratamento de e-mails existentes, retry e resultado ambíguo; preparar migration + Edge Function + testes focados + ADR/handoff, em branch/PR.
- **Bloqueio de ativação:** novas capacidades de acesso/segurança **não** são ativadas sem aprovação específica. Não ler, criar, alterar ou solicitar secrets pelo chat; credenciais permanecem no navegador.
- **Não confundir:** `queued` ≠ convite enviado; aceite do Auth SMTP ≠ entregue na caixa postal; usuário convidado ≠ papel concedido/termos aceitos; CI aprovado ≠ homologação real.

## Startup seguro (sem recapitular todas as conversas)

1. Na cópia local: `git status --short --branch`, `git remote -v`, `git fetch origin`; conciliar trabalho local antes de `git pull --ff-only`. Nunca descartar notas locais ou fazer `reset --hard`.
2. Ler, nesta ordem curta: `AGENTS.md`, este cursor, `docs/V35_EXECUTION_BOARD.md`; consultar `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, `SESSION_HANDOFF.md` e documentos/arquivos do ID ativo apenas na medida necessária.
3. Conferir se outro Work/branch/PR já implementou o ID ativo; não duplicar.
4. Executar apenas a próxima microentrega, testes impactados e registro de resultado; atualizar este cursor com a **revisão real**, estado da CI/DEV, bloqueio e próximo ID antes de encerrar.
5. Ao mudar de conversa, usar: “Continue Corsys.TroncoDigital V35. Leia AGENTS.md e docs/V35_SESSION_CURSOR.md, confirme Git/PR, execute a microentrega ativa indicada em docs/V35_EXECUTION_BOARD.md. Não repita gates aprovados, preserve sources/, segredos e PROD. Atualize cursor/handoff no PR.”

## Registro de execução do cursor

- Criado como documentação de governança em branch, ainda **não** como implementação da microentrega M01.01.
- Última verificação de deploy do PR #24 não é inferida do merge. Próxima execução deve conferir apenas se necessário ao ID ativo.
