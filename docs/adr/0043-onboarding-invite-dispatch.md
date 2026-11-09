# ADR 0043 — Despacho de convites de onboarding

O endpoint POST de Edge Function recebe apenas o identificador da execução (query `run_id`). O JWT do operador é validado pelo Supabase na RPC de autorização, que exige Master ativo e AAL2. A identidade retornada pelo banco segue para a RPC de claim, acessível apenas a service_role, que confirma o vínculo Master ativo e deriva destinatário e organização da execução persistida.

O claim usa lock da execução, lock transacional por e-mail normalizado e transição condicional de queued para running. Bloqueia conta Auth existente e reutilização de endereço reservado por outra execução. O job passa a ter uma tentativa antes de chamar Auth Admin. Estados com resultado desconhecido permanecem reservados inclusive após falha, timeout ou perda da gravação final. Isso evita reenvio automático ao custo de exigir reconciliação manual. A deduplicação vale para esta fila. Mudanças externas e simultâneas em Auth estão sujeitas ao contrato do próprio Auth.

Sucesso registra aceite do Auth e evento sanitizado. A execução continua em awaiting_invite até que vínculo, papel e termos tenham seu fluxo próprio. Resultado Auth ambíguo não autoriza reenviar, editar attempts ou conceder acesso. M01.02 precisa definir triagem, expiração operacional e reprocessamento somente quando houver evidência de ausência de efeito externo. M01.04 valida o redirect/template, a integração DEV e a entrega com destinatário autorizado. Até aprovação específica, a migration e a função ficam como código em revisão.

Referências oficiais: [Auth Admin Invite](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) e [Edge Function auth](https://supabase.com/docs/guides/functions/auth).
