# ADR-0026 — Onboarding controlado e retomável

## Status
Aceito.

## Decisão
Onboarding comercial é um processo de cinco etapas com estado persistido: cadastro, plano/preço, tenant+roles, plano contábil e convite/ativação.

O banco registra `saas_onboarding_runs` e eventos de etapa. A criação/invite de usuário Auth permanece server-side; não existe chave administrativa no navegador.

## Consequência
Falhas podem ser retomadas/idempotentes e não deixam o cliente sem estado conhecido.
