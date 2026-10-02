# ADR-0022 — Versionamento de Planos SaaS e Promoções

## Status
Aceito.

## Decisão
Um Plano SaaS mantém identidade/nome estável. Preço e entitlements pertencem a versões. Versão publicada é imutável; alteração de preço/recursos cria nova versão. Múltiplas versões publicadas podem coexistir porque cada assinatura fica fixada à versão contratada; novas contratações usam a versão publicada efetiva mais recente.

Promoções não alteram o preço-base histórico do plano. São regras separadas com benefício, validade, duração, elegibilidade, limite de resgate e cumulatividade explícita.

## Consequência
“Profissional” pode continuar com o mesmo nome enquanto v1 e v2 têm preços/recursos diferentes. Clientes antigos permanecem na versão contratada até migração explícita/agendada.
