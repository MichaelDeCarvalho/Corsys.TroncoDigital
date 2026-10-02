# ADR-0023 — Inadimplência, encargos, suspensão e acordos

## Status
Aceito.

## Decisão
Multa/juros não são constantes globais hardcoded. Uma política versionada define os encargos contratuais, tolerância, suspensão automática/manual, modo de suspensão e possibilidade de acordo.

Encargos aplicados à fatura são ajustes imutáveis. Acordos referenciam faturas existentes e não reescrevem os fatos originais.

## Segurança
Suspensão é aplicada server-side/database. Esconder botão no browser não é controle.

## Jurídico
Parâmetros exigem validação contratual/jurídica aplicável ao cliente; o sistema não presume uma taxa legal universal.
