# ADR-0025 — Configuração da Plataforma e MFA Master

## Status
Aceito.

## Decisão
Configurações da Corsys têm domínio próprio e tipado, sem secrets na UI. Master/Support/Billing exigem AAL2/MFA para privilégios do control plane.

Sessão de suporte é apenas `read_only` no MVP. O último MASTER ativo não pode ser desativado/removido.

## Consequência
Configuração comercial/fiscal/contatos pode ser administrada sem expor chaves de integração. Credenciais permanecem em environment/secret manager.
