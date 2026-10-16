# ADR-0024 — Suporte Kanban e isolamento de tenant

## Status
Aceito.

## Decisão
Chamados possuem `organization_id`, mensagens e eventos de status. O cliente somente lê chamados/mensagens do próprio tenant; notas internas não são visíveis ao cliente.

Estados operacionais: Novo → Triagem → Em atendimento → Aguardando cliente → Resolvido → Encerrado, com reabertura auditada.

## Isolamento
O tenant não recebe componentes/rotas do Master no app real. Além da separação de layout/route, toda leitura é protegida por autorização server-side e RLS. Master não ganha acesso permanente ao financeiro do tenant.
