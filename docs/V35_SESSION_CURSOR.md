## Evidência M01.03 e gate de homologação

PR #31, revisão 302b4c9: job onboarding do GitHub Actions 42683699415 aprovado. Gate M01.03 em PostgreSQL 17 descartável confirmou rollback do DDL, negação anônima e de identidade diferente/não confirmada, finalização restrita e atômica, recusa de consentimento ausente e versão/hash inválidos, serialização de duas sessões e um único perfil/recibo/evento na Loja correta.

Homologação: aprovar a versão e o hash do documento oficial e definir a origem do conteúdo para exibição. Preparar a tela de aceite e o retorno do Auth. Após aprovação específica, aplicar a migration M01.03 somente no Supabase DEV e publicar a função compatível. Conferir permissões e ausência de vínculo antes do aceite. Em M01.04, com destinatário autorizado separadamente, validar o retorno Auth, o aceite real, a Loja/perfil, o recibo/auditoria e o replay com JWT real.

## V35 M01.03 — vínculo e aceite

M01.03 preparada sobre main 625a516a (PR #30). O Auth fornece o UUID ao finalizar o despacho. A RPC de aceite exige esse UUID autenticado, e-mail confirmado, perfil de sistema da própria Loja e, quando exigido, consentimento explícito à versão publicada vigente e ao hash. Vínculo, recibo, conclusão e auditoria são atômicos. Execuções antigas sem prova de identidade permanecem sem vínculo. Três testes locais do handler passaram. Gate PostgreSQL descartável incluído no CI. Ativação DEV aguarda aprovação.

## Estado vigente — M01.02 aplicada e verificada no DEV (09/11/2026)

- **Autorização:** proprietário aprovou aplicação da migration M01.02 e testes **somente** no Supabase DEV `szqkdekwhzxsoxorgvaz`, sem convites/PROD. A aplicação ocorreu após PR #28 e #29 integrados, `main=b39da8b732c583da8fb809e06c23268211180202`.
- **Migration:** `v35_onboarding_invite_reconciliation` aplicada em DEV; versão real Supabase `20261109190747`; arquivo versionado renomeado, **sem alterar SQL**, para `supabase/migrations/20261109190747_v35_onboarding_invite_reconciliation.sql`. Não executar novamente sob versão antiga.
- **Read-back:** três RPCs presentes; `anon` EXECUTE negado e `authenticated` EXECUTE concedido com autorização interna Master/AAL2; SECURITY DEFINER com `search_path` vazio verificado. Antes e depois: **0 jobs, 0 eventos e 0 runs sintéticas** persistidos.
- **Gates DEV:** Master/AAL2 com claims SQL simuladas PASS; Master/AAL1 e não-Master/AAL2 negados nas três RPCs; testes rollback com reservas fictícias PASS (claim stale/fresco, expiração uma vez, tentativas e reserva preservadas, observação idempotente/rejeição de alteração, auditoria sanitizada). Não foi utilizado JWT HTTP real.
- **Limite de escopo:** nenhum e-mail, convite, Auth Admin, retry nem deploy de Edge Function M01.02. A existência de usuário Auth **não comprova entrega**. Sem evidência externa de ausência de efeito, reenvio segue fail-closed; não classificar a M01.02 inteira como CONCLUIDO devido à parte de retry/reconciliação externa.
- **Próxima tarefa de código:** M01.03 — vínculo explícito do usuário, papel mínimo e aceite de termos, reconciliando código atual antes de implementar. M01.04 continua sem autorização para enviar convite de teste; runtime Edge/JWT real não homologado. Fazer Work apenas quando necessário e mediante prompt do usuário.

---

## M01.02 — código integrado, ainda NÃO ativado (09/11/2026)

- PR #28 integrado na `main` em `bf326254fba3e7a66a2f02137fa1e5c6da818461`, checks `static`, `frontend` e `onboarding` PASS na revisão `4474b658`.
- Migration de reconciliação `supabase/migrations/20261109220000_v35_onboarding_invite_reconciliation.sql` **somente versionada no GitHub**: não aplicada no DEV/PROD e não alterou a Edge Function M01.01.
- O código adiciona consulta Master/AAL2, expiração em quarentena e observação idempotente. Expiração preserva tentativas e reservas; **não há retry/reenvio** de resultados desconhecidos. Pendente autorização específica para aplicar no DEV e teste com JWT real, sem envio.
- A M01.02 está `INTEGRADO`, não `CONCLUIDO`/`HOMOLOGADO_DEV`. A retomada deve priorizar revisão do estado real, aplicação autorizada e gate de read-back/negativas, ou avançar para M01.03 sem ativar nada.
- M01.04 (envio de convite de teste com destinatário autorizado) continua bloqueada por aprovação separada. Nenhum convite foi disparado neste ciclo.

---

## Em execução — M01.02, 09/11/2026 (sem ativação)

- **Base:** main `04f99e97521a2841bc2d628277ff791724bc0c93` após PR #27; branch `feat/v35-m0102-invite-reconciliation`. Confirmar commits atuais ao retomar.
- **Escopo desta branch:** migration proposta `20261109220000_v35_onboarding_invite_reconciliation.sql` adicionando RPCs Master/AAL2 para consulta limitada, expiração de claims antigos sem liberar reserva e observação auditável idempotente; ADR-0044 e testes PostgreSQL descartável. Não altera fluxo M01.01 nem sua função implantada.
- **Risco crítico:** `auth.users` não comprova entrega de e-mail nem a ausência de efeito externo. **Nenhum retry automático ou manual foi autorizado/implementado.** Claims `running` vencidos passam a `failed/invite_outcome_unknown` mantendo `attempts=1`; destino continua reservado.
- **Status:** código em revisão, **migration M01.02 não aplicada no DEV**, nenhum deploy, nenhum JWT real e nenhum convite enviado. Revisar CI da branch/PR antes de qualquer merge; autorização específica antes de ativar novas RPCs no DEV.
- **Próximo:** concluir CI + revisão do PR; definir gate de ativação DEV separado e M01.03 (vínculo/papel/termos) sem repetição de testes M01.01. M01.04 somente com autorização de destinatário de teste.

---

## Estado operacional vigente — 09/11/2026: M01.01 ativação técnica DEV

- **Código:** PR #26 integrado à main no commit `b32692dc1b1bd94713c23d0760ff4965001a8ee0`; CI #424 static/frontend/onboarding PASS na revisão `7a7ee9f`. Verificar nova HEAD antes de iniciar outro trabalho.
- **Banco:** migration `v35_onboarding_invite_consumer` **aplicada somente** no Supabase DEV szqkdekwhzxsoxorgvaz, versão de registro `20261109184607`. Três RPCs presentes e grants read-back conferidos: `authorize_onboarding_invite_dispatch` EXECUTE authenticated (sujeito a Master/AAL2), `claim_onboarding_invite` e `finish_onboarding_invite` somente service_role; anon/authenticated sem EXECUTE nas duas funções privilegiadas.
- **Edge Function:** `onboarding-invite` publicada somente no mesmo DEV, ACTIVE v1, `verify_jwt=true`, dois arquivos de código confirmados em leitura independente. Nenhum JWT real foi usado nem convite enviado. Não inferir runtime/SMTP/destinatário verificados a partir de deploy READY.
- **Higiene de migrations:** ferramenta Supabase registrou versão `20261109184607`; arquivo SQL de código renomeado para `supabase/migrations/20261109184607_v35_onboarding_invite_consumer.sql` (conteúdo preservado), evitando nova versão fictícia `20261109000000`. SQL aplicado foi o corpo sem delimitadores externos BEGIN/COMMIT.
- **Próxima execução:** M01.02 pode seguir para desenho/testes de expiração/reconciliação sem envio real. M01.04 precisa autorização **separada** para homologação JWT Master/AAL2 real e um convite com destinatário previamente autorizado, após verificar endpoint/configuração. M01.01 permanece sem aceite end-to-end até esse gate.
- **Restrições:** nenhuma migração ou chamada Auth em PROD; nenhuma senha, JWT, e-mail de convite ou operação de usuário executada. Nenhum job `onboarding_invite` existia no DEV no read-back após migration.

---

# V35 — CURSOR DE RETOMADA (ler primeiro em toda nova conversa)

> **Política aprovada:** terminar integralmente a V35 antes de liberar Beta. Este arquivo é o resumo operacional curto. Histórico antigo permanece em `SESSION_HANDOFF.md`; backlog rastreável em [V35_EXECUTION_BOARD.md](V35_EXECUTION_BOARD.md).

## Snapshot verificável na criação deste controle

- Main verificada por fetch em 09/11/2026: 639ef08a46493ad0b6bc963920f0271959e59253 (PR #25). Branch feat/v35-m01-invite-consumer criada desta revisão com árvore limpa.
- Supabase DEV autorizado: `szqkdekwhzxsoxorgvaz`; Worker DEV `corsys-tronco-digital-dev`.
- Histórico: PRs #15–#24 integrados conforme registros. Não reexecutar homologações por mera mudança de conversa.
- SMTP DEV configurado pelo proprietário (via Supabase Auth/Resend); painel aceitou **um e-mail de recuperação**. Isso **não comprova** recebimento no destino nem envio de convites.
- `MasterOnboarding.tsx` e RPC `provision_saas_onboarding_database`: organização e assinatura criadas, job `onboarding_invite` enfileirado; **consumidor e entrega real ainda não implementados/observados** na evidência existente.

## Posição de execução

- **Macro ativa:** M01 — Onboarding, identidades e convites.
- **Micro ativa:** M01.01 — Revisar contratos reais e implementar consumidor autorizado de `onboarding_invite`, integrando M01.02 apenas se dependência técnica inseparável; documentar limites sem marcar etapa inteira como concluída.
- **Próximo ato técnico:** revisar a M01.01 e executar a M01.02 para expiração e reconciliação. A ativação DEV exige aprovação específica.
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
- M01.01 em revisão: consumidor e migration preparados; 3 testes locais do handler aprovados. Teste PostgreSQL real, ativação e homologação DEV pendentes.

## Evidência M01.01 no PR #26

PR #26, revisão 0278175, CI #423, job onboarding aprovado. PostgreSQL 17 descartável confirmou presença das RPCs antes do ROLLBACK e ausência após ele, com os delimitadores da migration excluídos. O gate usa tabelas, helpers e triggers extraídos das migrations e claims Auth simuladas. Passaram Master/AAL2, negações anon/AAL1/não-Master, RPCs de fila restritas a service_role, concorrência observada entre sessões PostgreSQL, deduplicação, conta existente, replay, ator da reserva na finalização, resultado incerto e auditoria sanitizada. Três testes Node do handler passaram no mesmo job. Runtime Edge, JWT real e envio DEV ficam para o gate de ativação.
