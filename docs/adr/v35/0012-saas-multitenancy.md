# ADR-0012 — SaaS multi-tenant por organização

- **Status:** accepted
- **Data:** 2026-09-07
- **Contexto:** o produto será comercializado por assinatura para múltiplas Lojas.
- **Problema:** garantir operação compartilhada sem mistura de dados entre clientes.
- **Decisão:** `organizations` passa a ser tenant explícito do SaaS. Toda entidade de negócio mantém `organization_id`, com RLS e FKs compostas. Camada comercial SaaS fica separada do financeiro interno da Loja.
- **Alternativas consideradas:** banco separado por cliente; schema separado por cliente; instância por cliente.
- **Consequências positivas:** operação centralizada, menor custo operacional, evolução única do produto, isolamento determinístico.
- **Trade-offs / riscos:** RLS e testes cross-tenant tornam-se controles críticos de segurança.
- **Impacto em segurança:** alto; toda rota/consulta precisa preservar tenant boundary.
- **Impacto em dados/migrations:** adiciona tabelas SaaS e reforça gates de escrita por status comercial.
- **Plano de rollout:** preparar schema, testar isolamento, provisionar tenants somente por fluxo controlado.
- **Rollback:** não converter dados de tenant em globais; migrations SaaS podem permanecer sem uso até ativação comercial.
