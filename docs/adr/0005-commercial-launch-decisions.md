# ADR-0005 — decisões comerciais de lançamento

Status: accepted (direção comercial); integração operacional pendente.
Data: 2026-10-05 Brasil.
Fonte: confirmação expressa do proprietário nesta conversa.

- Domínio ainda não definido/contratado; usar preview DEV existente durante desenvolvimento.
- Dois planos mensais BRL: R$ 125,00 e R$ 180,00. Valores exatos em centavos 12500/18000 em config/commercial-decisions.json. Plano 1/Plano 2 são rótulos provisórios. Recursos/quotas por plano ainda não definidos; não reduzir a V35 nem inventar limitações.
- Cobrança inicial manual. Stripe é a opção preferencial futura, ainda não integrada/contratada. Preservar modelo provider-agnostic, billing_provider e IDs externos existentes, sem alterar faturas históricas.
- Integração futura: correlacionar IDs externos/internos, webhooks autenticados/deduplicados/idempotentes, retries rastreáveis e chaves server-side. Consultar documentação oficial vigente antes de implementar métodos/produtos ou prometer meios de pagamento. Nenhuma chave Stripe necessária nesta etapa.
- Suporte inicial no sistema e WhatsApp manual. Número comercial não informado. Chamado interno permanece registro do atendimento; mensagens externas não são importadas automaticamente.
- Preparar automação WhatsApp futura com correlação chamado/organização, autoria, entrega/erro e deduplicação. Fornecedor/API, credenciais e automação não escolhidos/ativos. Sem mensagens, convites ou cobranças externas nesta etapa.
- Cobrança SaaS separada do financeiro das lojas; preservar preços publicados, snapshots e contratos versionados.
- Apresentar qualquer custo antes; produção depende de aprovação posterior. Nenhum serviço pago ou automação ativado por esta decisão.

Esta decisão não publica planos no catálogo nem cria assinaturas/cobranças. Publicação pelo fluxo Master autorizado após definição de entitlements e homologação. O catálogo deve oferecer exatamente dois planos comerciais ativos, mantendo históricos e versões necessários.
