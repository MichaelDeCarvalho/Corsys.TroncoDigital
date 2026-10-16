# Análise profissional — transição do Corsys Tronco Digital para SaaS

## Conclusão

A arquitetura financeira já construída pode ser preservada. A mudança correta é adicionar uma camada de **control plane SaaS** sobre o sistema das Lojas, sem transformar o Master em um usuário comum de todas as organizações.

## O que muda obrigatoriamente

1. `organizations` deixa de ser apenas preparação futura e passa a ser o tenant oficial.
2. todo dado de negócio de uma Loja permanece scoped por `organization_id`.
3. papel `MASTER` é global e separado de `ADMIN/TREASURER/VIEWER/MEMBER`.
4. billing da Corsys é um núcleo financeiro próprio e nunca reutiliza cobranças/pagamentos de integrantes.
5. status comercial do tenant passa a controlar escrita no sistema.
6. suporte cross-tenant exige sessão temporária, motivo e auditoria.
7. planos SaaS e entitlements são validados server-side.
8. webhooks do provider de cobrança exigem assinatura, idempotência e deduplicação.
9. cancelamento exige política de retenção/exportação; não apagar o cliente imediatamente.
10. navegador desktop e mobile usam a mesma aplicação web e o mesmo backend/RLS.

## Billing da plataforma

Estrutura proposta:

```text
saas_plans
    |
saas_subscriptions
    |
saas_invoices ---- saas_invoice_voids
    ^
    |
saas_payment_allocations
    ^
    |
saas_payments ---- saas_payment_reversals
```

Isso permite:
- cobrança mensal/anual;
- pagamento manual;
- integração futura com PIX/boleto/cartão;
- pagamentos parciais ou adiantados;
- estorno;
- reconciliação;
- saldo derivado e auditável.

## Estados comerciais

### Trialing
Acesso normal durante avaliação/onboarding.

### Active
Acesso normal.

### Past due
Atraso dentro da tolerância. Mostrar aviso, mas não bloquear imediatamente.

### Suspended
Bloquear novas gravações financeiras. Preservar leitura/exportação segundo contrato e política de retenção.

### Canceled
Sem novas operações; retenção/exportação/deleção seguem política formal e obrigações aplicáveis.

## Master

O Master gerencia:
- clientes;
- onboarding;
- planos;
- preços;
- assinatura;
- faturas do SaaS;
- pagamentos do SaaS;
- situação comercial;
- termos/privacidade;
- operação de suporte;
- auditoria Master;
- emissão fiscal/integração fiscal futura.

O Master **não** deve possuir automaticamente role ADMIN em cada Loja.

## Provider de cobrança

Não foi escolhido nesta etapa.

A escolha deve ser feita posteriormente por ADR, comparando documentação oficial atual e requisitos brasileiros. A camada criada é provider-agnostic para evitar lock-in prematuro.

Critérios mínimos:
- PIX;
- boleto;
- cartão/recorrência se desejado;
- webhook assinado;
- idempotência;
- sandbox;
- estorno/cancelamento;
- conciliação;
- operação no Brasil;
- custos compatíveis.

## Mobile

Direção definida: **responsive web app / PWA-ready**.

Vantagens:
- uma única base de código;
- mesma autorização e RLS;
- mesma lógica financeira;
- navegador em desktop, tablet e celular;
- instalação como PWA pode ser habilitada posteriormente.

Não permitir escrita financeira offline no MVP.

## Exigências adicionais antes da comercialização

- política de privacidade;
- termos de uso;
- processo de aceite versionado;
- DPA quando aplicável;
- política de retenção e deleção;
- backup e restauração testados;
- suporte e incidente;
- observabilidade;
- limites/quotas por plano;
- cobrança e emissão fiscal alinhadas com contador;
- testes cross-tenant obrigatórios;
- MFA para Master e perfis administrativos sensíveis;
- proteção/rate limiting de endpoints sensíveis;
- segregação de environments;
- nenhum preview apontando para produção com secrets privilegiados.

## Sequência revisada

1. validar/congelar V31 como UX de referência;
2. consolidar modelo PostgreSQL completo incluindo funcionalidades V20–V31;
3. revisar migrations 001–007 em PostgreSQL/Supabase real;
4. testes de isolamento cross-tenant e subscription gate;
5. implementar Auth/RBAC/RLS e onboarding SaaS;
6. implementar Master real;
7. implementar financeiro da Loja;
8. escolher e integrar billing provider;
9. implementar webhooks/idempotência/conciliação SaaS;
10. relatórios/importação/backup/observabilidade;
11. testes mobile/browser e PWA-ready;
12. produção controlada com clientes piloto.
