# ADR-0052 — Envio de convite pela jornada Master

Data: 25/11/2026. Estado: aceito no escopo DEV autorizado AC-V35-20261125-v1.

O provisionamento real colocou o job na fila, porém a tela não oferecia disparo. Acrescentar uma ação explícita para execuções awaiting_invite/invite, usando o SDK existente e JWT da sessão sem exposição de token. A Edge mantém autorização Master/AAL2 e claim/lease/idempotência existentes. CORS permite somente a origem HTTPS configurada; preflight não executa o comando. Uma resposta incerta exige reconciliação, sem retry automático. Sucesso significa aceitação pelo serviço, sem afirmar entrega.

Nenhum DDL, alteração de permissões, JWT desativado ou credencial nova. Documento QA é simulação não contratual de 48 horas somente DEV; nenhum termo real foi aprovado como oficial. Evidências e IDs da fixture estão no SESSION_HANDOFF.md. Validar UI/servidor, CI e publicação antes do envio real. Rollback: retirar a ação UI e restaurar a Edge anterior; conservar fila, identidade, recibos e auditoria para reconciliação. Não reenviar em rollback.
