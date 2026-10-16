# Arquitetura alvo SaaS — Corsys Tronco Digital

## Decisão

O produto passa a ser comercializado como SaaS multi-tenant por assinatura.

```text
Corsys / Master
      |
      +-- gestão comercial da plataforma
      |   +-- clientes
      |   +-- planos SaaS
      |   +-- assinaturas
      |   +-- faturas SaaS
      |   +-- pagamentos SaaS
      |   +-- suporte/auditoria
      |
      +-- Cliente / Loja A (organization_id A)
      |   +-- usuários
      |   +-- integrantes
      |   +-- financeiro
      |   +-- DRE
      |   +-- arquivos
      |
      +-- Cliente / Loja B (organization_id B)
          +-- dados totalmente isolados de A
```

## Dois planos de controle distintos

### Control plane — Corsys

Responsável por:
- cadastro comercial do cliente;
- plano contratado;
- assinatura;
- cobrança do uso do SaaS;
- pagamento da assinatura;
- ciclo de vida do cliente;
- suporte;
- auditoria Master;
- termos, privacidade e documentos fiscais da assinatura.

### Tenant plane — Loja

Responsável por:
- integrantes;
- mensalidades dos integrantes;
- contas a pagar/receber da Loja;
- caixa/bancos/fundos;
- conciliação;
- DRE;
- relatórios;
- usuários e permissões da própria Loja.

**Mensalidade do integrante e mensalidade do SaaS nunca compartilham a mesma entidade financeira.**

## Identidade e autorização

- `auth.users` permanece identidade global.
- `user_roles` continua definindo papéis dentro de uma Loja.
- `platform_staff` define funções globais da Corsys: `MASTER`, `SUPPORT`, `BILLING`.
- `MASTER` não é um papel de tenant.
- `organization_id` é o boundary obrigatório dos dados da Loja.
- suporte cross-tenant exige sessão explícita, temporária e auditada.
- suporte é read-only por padrão.

## Isolamento

Tenant A nunca pode obter dados do Tenant B alterando:
- URL;
- payload;
- `organization_id`;
- filtros;
- chamadas REST/RPC;
- código do navegador.

RLS + FKs compostas + autorização server-side são obrigatórias.

## Ciclo comercial

Estados previstos:

```text
trialing
  -> active
  -> past_due + grace period
  -> suspended
  -> active (regularização)
  -> canceled
```

Política proposta:
- `trialing/active`: leitura e escrita normais;
- `past_due` dentro da tolerância: leitura/escrita + aviso;
- `suspended`: leitura/exportação, sem novas escritas financeiras;
- `canceled`: retenção e exportação conforme política contratual/legal; exclusão não é automática.

## Billing SaaS

Fonte de verdade separada do financeiro das Lojas:

```text
Subscription
    |
    v
SaaS Invoice
    ^
    |
Payment Allocation
    ^
    |
SaaS Payment
```

Princípios:
- fatura != pagamento;
- pagamentos podem ser manuais ou provenientes de provider;
- webhook é idempotente;
- pagamento confirmado é fato imutável;
- correções usam estorno/void/reemissão;
- saldo da fatura é derivado;
- provider externo não é a única fonte de verdade operacional da Corsys.

## Planos e entitlements

Preço e limites ficam em `saas_plans` + `saas_plan_entitlements`.

Exemplos de entitlement:
- `max_admin_users`;
- `max_members`;
- `portal_member`;
- `bank_reconciliation`;
- `advanced_reports`;
- `priority_support`.

Entitlement deve ser validado server-side. UI escondida não é controle de plano.

## Suporte Master

Fluxo obrigatório:

```text
Master escolhe cliente
-> informa motivo
-> cria support_session com expiração
-> banner visível de suporte
-> acesso read-only permitido pelas policies
-> sessão termina/expira
-> audit log permanece
```

Não permitir bypass global permanente de RLS ao usuário Master no navegador.

## Navegador e mobile

Uma aplicação web responsiva:
- desktop/laptop: navegador;
- tablet: navegador;
- celular: navegador responsivo;
- PWA-ready para instalação quando desejado.

Não haverá escrita financeira offline no MVP.

Requisitos mobile:
- navegação adaptativa;
- tabelas com scroll interno/cartões quando necessário;
- áreas de toque adequadas;
- inputs compatíveis com teclado móvel;
- sem controles hover-only;
- autenticação e autorização iguais às do desktop.

## Billing provider

A arquitetura permanece provider-agnostic neste estágio.

O provider futuro deve suportar, conforme decisão comercial:
- PIX;
- boleto;
- cartão/recorrência;
- webhooks assinados;
- idempotência;
- conciliação;
- cancelamento/estorno;
- ambiente sandbox;
- documentação e disponibilidade para operação no Brasil.

A escolha do provider será um ADR separado após comparação com documentação oficial atual.

## Fiscal / LGPD

Prever:
- dados de faturamento separados dos dados financeiros internos do cliente;
- termos e política de privacidade versionados;
- aceite versionado;
- minimização de dados;
- retenção definida;
- exportação antes de cancelamento quando aplicável;
- documentos fiscais da assinatura separados do DRE/financeiro da Loja;
- acesso de suporte auditado.

Classificação tributária, retenção e emissão fiscal final devem ser confirmadas com responsável contábil/fiscal.
