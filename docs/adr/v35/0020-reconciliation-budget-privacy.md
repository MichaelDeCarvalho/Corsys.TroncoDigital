# ADR-0020 — Conciliação, orçamento, importação e privacidade como domínios explícitos

## Status
Aceito.

## Decisão
Conciliação bancária, orçamento x realizado, orçamento por Fundo, importação e solicitações de privacidade possuem entidades próprias.

## Consequências
- Extrato bancário é confrontado com fatos internos; não substitui o financeiro.
- Orçado e realizado permanecem separados.
- Importação segue staging → validação → prévia → confirmação.
- Solicitações LGPD possuem histórico de eventos.
- Documentos financeiros são metadados de arquivos armazenados em Storage privado.
