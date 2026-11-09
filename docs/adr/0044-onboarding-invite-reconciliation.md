# ADR 0044 — Reconciliação conservadora de convites do onboarding (M01.02)

**Situação:** proposta para DEV, não implantada. **Data:** 09/11/2026.

## Contexto

A M01.01 cria uma reserva durável antes do Auth Admin `inviteUserByEmail`. Falha de rede ou de finalização pode ocorrer **depois** da emissão externa. A ausência do usuário em `auth.users` não comprova que o e-mail não tenha sido entregue. Portanto, retry automático ou zerar `attempts` pode duplicar convites e produzir inconsistência de identidade.

## Decisão

- Um claim `running` com `attempts=1`, `locked_at` ausente ou com pelo menos 15 minutos passa a `failed`/`invite_outcome_unknown` **somente** por RPC explícita de manutenção do Master com MFA AAL2. Essa transição jamais zera tentativas, reabre `queued` nem chama Auth Admin.
- Uma RPC Master/AAL2 lista até 50 jobs `running` ou `failed`/unknown, com vínculo tenant/run e indicadores mínimos. Retorna apenas um booleano de existência atual em Auth, sem e-mail, token, metadados ou credenciais.
- Uma RPC Master/AAL2 permite observações auditáveis e idempotentes (`review_pending`, `auth_checked`, `provider_checked`); nenhuma observação pode alterar o estado da fila ou liberar o destinatário. A mesma chave com anotação diferente é rejeitada.
- Toda transição usa lock de linha; histórico é append-only em `saas_onboarding_step_events` com payload sanitizado. `anon`, AAL1 e staff não-Master são negados. O fluxo da M01.01 e seu bloqueio de duplicidade permanecem intactos.
- O operador pode registrar uma análise, mas **não pode emitir de novo** enquanto não houver uma solução comprovável e aprovada para reconciliação externa. Verificação por provedor e eventual retry excepcional ficam bloqueados até haver um contrato verificável, sem inferir que ausência em Auth significa ausência de envio.

## Critérios de aceite

Testar em PostgreSQL descartável: migration reversível por rollback; grants e negações; caso positivo Master/AAL2; claim fresco preservado; claim antigo expira uma única vez; tentativas e reserva preservadas; contador/relatório coerente; observação idempotente e payload sanitizado; nenhuma criação de usuário, disparo Auth, acesso cross-tenant ou alteração do ledger. Revalidar DEV somente após autorização específica.

## Estado e limites

Há apenas implementação proposta e gates CI para essa microentrega. **Não** declarar homologação DEV, execução com JWT real, recuperação de mensagens, entrega de e-mail ou retry seguro operacional. A observação de Auth é uma fotografia, não prova de entrega. Beta e PROD permanecem bloqueados.
