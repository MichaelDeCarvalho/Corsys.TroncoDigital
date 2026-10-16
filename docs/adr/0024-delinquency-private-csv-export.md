# ADR 0024 — Exportação de inadimplência por ação explícita e escopo tenant

Status: aprovado somente para DEV, 2026-10-10.

## Contexto
O piloto V35 exige relatórios exportáveis, mas o backend já expõe consulta paginada `read_tenant_delinquency` com autorização `finance.read` e validação de integridade. Exportar diretamente tudo em uma resposta aberta sem limite pode consumir recursos e expor informação pessoal desnecessária. Campos de nomes em CSV também podem conter fórmulas interpretáveis pelo Excel.

## Decisão
Adicionar exportação CSV de inadimplência apenas por clique explícito, reusando RPC autorizada, máximo de 1.000 posições, detecção de duplicatas, abortar com mudança de tenant e falhar fechado em qualquer página inválida. Gerar arquivo em memória no browser, com separador regional e proteção contra injeção de fórmulas; somente nome, situação, vencimento, posição e créditos sem alocação, nunca CPF/contato. Não armazenar cópia server-side nem abrir uma rota Master por conveniência.

## Evidência, tradeoffs e critérios futuros
Testes Vitest cobrem paginação, duplicatas, valores inválidos e sanitização. A paginação por offset não tem snapshot consistente sob mutação simultânea, por isso a interface avisa que o CSV não é comprovante de posição contábil imutável. XLSX/PDF e download cross-browser continuam pendentes. Antes de liberar PROD, executar QA navegador mobile/desktop e avaliar geração server-side transacional para relatórios oficiais, autorização e retenção conforme LGPD.

