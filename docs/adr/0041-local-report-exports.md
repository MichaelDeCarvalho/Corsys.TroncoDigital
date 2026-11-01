# ADR-0041 — Exportações locais dos relatórios consultados

Data: 01/11/2026. Status: aceita para implementação DEV.

## Contexto

Os botões PDF/XLSX de Relatórios apenas exibiam dependência de serviço externo. Os dados de posição, recebimentos, DRE e estrutura já são consultados sob autorização/RLS existentes. Não é necessário transmitir esses dados a um fornecedor de conversão para exportar o recorte consultado.

## Decisão

- XLSX é gerado localmente por `write-excel-file` 4.1.1, importado sob demanda, fixado no lockfile. Valores monetários são células numéricas; textos são células String explícitas, sem fórmulas.
- PDF usa a impressão nativa em documento separado, com texto via DOM/textContent, sem HTML de dados nem recursos remotos. O usuário escolhe salvar em PDF. Bloqueio de popup gera erro explícito.
- Arquivos incluem Loja, filtros, abrangência e data. Posição/recebimentos correspondem somente à página; DRE contém agregados da competência, não livro diário; plano contém estrutura consultada, limitada a 300 contas.
- Erros/integridade impedem exportação. Geração XLSX pendente é descartada após troca de Loja/filtros/aba. Downloads não criam cópia persistente no servidor. Credenciais não entram no arquivo.

## Limites

Não concede acesso adicional, não cria operações financeiras, não exporta toda a base nem implementa Diário/Razão ou portabilidade LGPD integral. Persistem o aceite em navegador real e a revisão das demais pendências V35. Arquivos baixados passam à guarda do usuário.

Fonte primária da biblioteca: https://github.com/catamphetamine/write-excel-file (consultada em 01/11/2026).
