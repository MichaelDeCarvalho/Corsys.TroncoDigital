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
