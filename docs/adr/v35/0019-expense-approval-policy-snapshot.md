# ADR-0019 — Aprovação de despesas por política versionada

## Status
Aceito.

## Decisão
A política de aprovação é versionada por vigência e possui:
- `off`, `all` ou `threshold`;
- valor limite digitável quando aplicável;
- número mínimo de aprovadores.

A despesa captura snapshot da política vigente. Correções relevantes também capturam novo snapshot.

## Consequências
Alterar o limite no futuro não altera a exigência histórica de despesas já postadas. Liquidação que exige aprovação falha de forma fechada até que a exigência seja atendida.
