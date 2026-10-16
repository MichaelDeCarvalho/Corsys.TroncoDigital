# ADR 0026 — Diretório Master com filtragem sob o controle de acesso do banco

Status: DEV only, 2026-10-10.

## Problema
O painel Master previa busca por cliente, número, cidade, contato, status e plano, mas a API `list_platform_master_tenants` só paginava por nome. Buscar carregando o universo de clientes no frontend violaria minimização de dados e poderia gerar resultados incompletos com caps de páginas.

## Decisão
Criar RPC `search_platform_master_tenants` apenas para MASTER/AAL2. Aplicar filtros no SQL sem SQL dinâmico, texto como substring literal e paginação determinística. Retornar somente metadados comerciais já previstos para o diretório; campos privados de contato podem participar da busca, mas não são retornados. Preservar a RPC `list_platform_master_tenants` para chamadas sem filtros. UI contém filtros controlados por ações Aplicar/Limpar, não muda sessão, tenant, assinatura ou contrato.

## Teste e limites
Gate DEV `DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS` testa A/B por número, status, paginação, AAL1/tenant/anon negados, erro em entrada inválida. Não demonstra teste de navegador real, busca em massa ou fidelidade final dos controles HTML (plano ainda digitado). Não autoriza deploy produção.

