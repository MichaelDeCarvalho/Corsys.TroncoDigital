# Inventário rastreável do piloto — telas, campos e ações

Referência obrigatória de escopo, complementar à [matriz de paridade](V35_PILOT_PARITY.md) e à [documentação V35](V35_COVERAGE.md).

Fonte original: `corsys-tesouraria-preview-v35-planos-ofertas.html`; SHA-256 `8b22ee9738f9a5173b1941960ebe16be3c813d5f38a8a16557cf087418250a5b`; 559409 bytes. [Referência versionada](pilot/v35-planos-ofertas.reference.html) mantém os números de linha originais; foram removidas apenas duas tags externas injetadas pelo antivírus. Não é o aplicativo de produção.

Análise estática completa dos controles declarados nas 21 telas, superfícies compartilhadas e fragmentos extraídos do JavaScript. Não houve execução de scripts ou teste de cliques. Expressões dinâmicas aparecem como `__EXPR_n__`/`__EXPRESSION__`; opções geradas a partir de arrays devem ser homologadas no fluxo executado. Fragmentos repetidos e módulos anteriores foram preservados por rastreabilidade, não contados como telas ou campos únicos em runtime. Valores demonstrativos não são parâmetros fixos de produção.

Cada campo, opção, ação, tabela e aba abaixo pertence ao escopo mínimo. Seu aceite exige função real no backend, autorização, persistência quando aplicável e homologação nos contextos pertinentes. O estado da implementação consta na matriz; estar listado não significa estar implementado.

## Contextos

- `master`: Michael — Master SaaS
- `tenant1`: Loja Aurora do Sul nº 101 — Admin
- `tenant2`: Loja Fraternidade do Oriente nº 202 — Tesoureiro

## view-master — Painel Master SaaS

Fonte: linha 2893 · `view-master`.

**Áreas:** Painel Master SaaS; Ações que exigem atenção; Clientes; Boundary de segurança

**Indicadores / apresentação:** Prioridade operacional do Master; Visão rápida · status derivado da assinatura; Master ≠ Administrador da Loja

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-master-A001 | + Novo cliente | {"type": "button", "data-v34-onboarding": ""} |
| view-master-A002 | Cliente 360º | {"data-client360": "tenant1"} |
| view-master-A003 | Suporte | {"data-v32-support": "tenant1"} |
| view-master-A004 | Cliente 360º | {"data-client360": "tenant2"} |
| view-master-A005 | Suporte | {"data-v32-support": "tenant2"} |

### Tabelas / colunas

- masterClientTable: Cliente; Plano / versão; Mensalidade; Status; Próximo vencimento; Uso; Ações

### Regras e notas declaradas

- Regra definitiva: status comercial, billing e suporte pertencem ao control plane. Para consultar dados internos de uma Loja, o Master abre uma sessão temporária somente leitura, informa motivo e gera auditoria. Escrita financeira por suporte continua bloqueada.

## view-master-clientes — Clientes SaaS

Fonte: linha 2927 · `view-master-clientes`.

**Áreas:** Clientes SaaS; Onboarding controlado

**Indicadores / apresentação:** Provisionamento transacional e idempotente

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-master-clientes-F001 | Buscar cliente | input {"id": "masterClientSearch", "placeholder": "Nome, número, cidade ou contato"} | — |
| view-master-clientes-F002 | Status | select {"id": "masterClientStatus"} | Todos [all]; Ativo [active]; Em atraso [past_due] |
| view-master-clientes-F003 | Plano | select {"id": "masterClientPlan"} | Todos [all]; Profissional [None] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-master-clientes-A001 | + Novo cliente | {"type": "button", "data-v34-onboarding": ""} |
| view-master-clientes-A002 | Cliente 360º | {"data-client360": "tenant1"} |
| view-master-clientes-A003 | Suporte | {"data-v32-support": "tenant1"} |
| view-master-clientes-A004 | Cliente 360º | {"data-client360": "tenant2"} |
| view-master-clientes-A005 | Suporte | {"data-v32-support": "tenant2"} |
| view-master-clientes-A006 | Cadastro comercial | {"data-v34-onboarding-step": "commercial"} |
| view-master-clientes-A007 | Plano / preço | {"data-v34-onboarding-step": "plan"} |
| view-master-clientes-A008 | Tenant + roles | {"data-v34-onboarding-step": "tenant"} |
| view-master-clientes-A009 | Plano contábil inicial | {"data-v34-onboarding-step": "accounting"} |
| view-master-clientes-A010 | Convite / ativação | {"data-v34-onboarding-step": "invite"} |

### Tabelas / colunas

- masterClientsDetailTable: Cliente; Responsável; Plano; Status; Onboarding; Saúde; Ações

### Regras e notas declaradas

- Produção: falha no meio do onboarding não deixará tenant parcialmente provisionado sem estado conhecido. O processo terá execução e eventos persistidos, com retomada/idempotência.

## view-master-cobranca — Assinaturas e Cobrança

Fonte: linha 2952 · `view-master-cobranca`.

**Áreas:** Assinaturas e Cobrança; Automação de cobrança; Política de inadimplência; Acordos comerciais

**Indicadores / apresentação:** Jobs persistidos · retry seguro · idempotência; Contrato + conformidade · sem taxa legal universal hardcoded; Renegociação não reescreve a fatura original

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-master-cobranca-F001 | Cliente / fatura | input {"id": "billingSearch", "placeholder": "Buscar cliente ou número"} | — |
| view-master-cobranca-F002 | Status | select {"id": "billingStatus"} | Todos [all]; Pago [paid]; Parcial [partial]; Em atraso [overdue] |
| view-master-cobranca-F003 | Competência | input {"type": "month", "id": "billingCompetence", "value": "2026-09"} | — |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-master-cobranca-A001 | + Nova cobrança manual | {"type": "button", "data-v32-flow": "manual-invoice"} |
| view-master-cobranca-A002 | Detalhes | {"data-invoice-detail": ""} |
| view-master-cobranca-A003 | Registrar pagamento | {"data-v32-payment": ""} |
| view-master-cobranca-A004 | Detalhes | {"data-invoice-detail": ""} |
| view-master-cobranca-A005 | Enviar cobrança | {"data-demo-action": "send-billing"} |
| view-master-cobranca-A006 | Geração mensalAutomáticaCompetência, vencimento, retry e idempotência. | {"data-v33-automation": "invoice"} |
| view-master-cobranca-A007 | Régua de cobrançaProgramadaLembretes, tolerância, suspensão e reativação. | {"data-v34-automation": "dunning"} |
| view-master-cobranca-A008 | Encargos / acordosConfiguráveisMulta, juros, negociação e parcelamento. | {"data-v34-automation": "charges"} |
| view-master-cobranca-A009 | ProviderPendentePIX, boleto, cartão e webhooks após escolha do provider. | {"data-v33-automation": "provider"} |
| view-master-cobranca-A010 | Configurar política | {"type": "button", "data-v34-billing-policy": ""} |

### Tabelas / colunas

- saasInvoiceTable: Fatura; Cliente; Competência; Vencimento; Valor base; Encargos; Total atualizado; Pago; Saldo; Status; Ações

### Regras e notas declaradas

- Encargos são parametrizados conforme contrato e revisão jurídica. Se houver relação sujeita ao CDC, a plataforma deve respeitar os limites aplicáveis. Suspensão automática e manual são eventos auditáveis; por padrão, preserva-se leitura/exportação e bloqueiam-se novas gravações.

## view-master-planos — Planos SaaS

Fonte: linha 2993 · `view-master-planos`.

**Áreas:** Planos SaaS; Histórico de versões; Promoções e ofertas

**Indicadores / apresentação:** Vigência, preço, limites e estado; Publicadas preservam histórico; edição cria sucessora quando necessário

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-master-planos-F001 | Vigência a partir de | input {"id": "v35VersionFrom", "type": "date"} | — |
| view-master-planos-F002 | Vigência até | input {"id": "v35VersionTo", "type": "date"} | — |
| view-master-planos-F003 | Status | select {"id": "v35VersionStatus"} | Todos [all]; Rascunho [draft]; Vigente p/ novas contratações [current]; Publicada futura [future]; Histórica / contratos existentes [historical]; Plano desativado [inactive] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-master-planos-A001 | + Novo plano | {"type": "button", "data-v34-new-plan": ""} |
| view-master-planos-A002 | Limpar filtros | {"type": "button", "id": "v35ClearVersionFilters"} |
| view-master-planos-A003 | + Nova promoção / oferta | {"data-v34-new-promo": ""} |

### Tabelas / colunas

- v34PlanVersionsTable: Plano; Versão; Vigência; Preço; Usuários; Status; Ações

### Regras e notas declaradas

- Regra: versão publicada não é sobrescrita. Para subir ou baixar preço mantendo “Profissional”, crie uma nova versão do mesmo plano. Clientes existentes ficam fixados na versão contratada até migração explícita.
- Boa prática: desconto é separado do preço-base do plano. Promoção possui tipo, validade, duração, elegibilidade, limite de resgate e cumulatividade explícita.

## view-master-operacao — Operação / Suporte

Fonte: linha 3031 · `view-master-operacao`.

**Áreas:** Operação / Suporte

**Abas/modos:** Chamados; Saúde / Jobs; Sessões de suporte; Equipe e Segurança; Auditoria Master

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-master-operacao-A001 | Chamados | {"data-operation-tab": "tickets"} |
| view-master-operacao-A002 | Saúde / Jobs | {"data-operation-tab": "health"} |
| view-master-operacao-A003 | Sessões de suporte | {"data-operation-tab": "support"} |
| view-master-operacao-A004 | Equipe e Segurança | {"data-operation-tab": "team"} |
| view-master-operacao-A005 | Auditoria Master | {"data-operation-tab": "audit"} |
| view-master-operacao-A006 | + Novo chamado interno | {"data-v34-master-ticket": ""} |
| view-master-operacao-A007 | Revogar sessões | {"data-demo-action": "revoke-sessions"} |
| view-master-operacao-A008 | Cancelar convite | {} |
| view-master-operacao-A009 | Cancelar convite | {} |
| view-master-operacao-A010 | + Convidar equipe Corsys | {"data-v32-flow": "invite-staff"} |

### Tabelas / colunas

- Sem ID: Componente; Estado real; Último evento; Próxima ação
- Sem ID: Data; Operador; Cliente; Motivo; Escopo; Status
- Sem ID: Usuário; Função; MFA; Status; Ações
- Sem ID: Data/hora; Operador; Cliente; Ação; Resultado

### Regras e notas declaradas

- Escopo simplificado: no MVP existe somente sessão de suporte read_only. Granularidades adicionais só serão criadas quando tiverem autorização e testes específicos.

## view-master-config — Configurações da Plataforma

Fonte: linha 3049 · `view-master-config`.

**Áreas:** Configurações da Plataforma; Identidade / faturamento; Integrações; Regras comerciais padrão; Termos e Privacidade; Mapa de configurações editáveis; Identidade / fiscal; Regras comerciais; Cobrança / encargos; Comunicação; Termos / Privacidade

**Indicadores / apresentação:** Control plane; Status, nunca secrets; Podem ser sobrescritas de forma explícita por contrato; Trial padrão; Tolerância padrão; Retenção pós-cancelamento; Versionados por vigência; Todos os grupos abaixo abrem edição; secrets permanecem fora da UI

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-master-config-A001 | Editar configurações | {"data-v32-flow": "platform-settings"} |
| view-master-config-A002 | Revisar | {} |
| view-master-config-A003 | Revisar | {} |
| view-master-config-A004 | Revisar | {} |
| view-master-config-A005 | Identidade / fiscalNome, razão social, CNPJ, endereço, cidade/UF, CEP e contatos. | {"data-v33-config-section": "identity"} |
| view-master-config-A006 | Regras comerciaisTrial, vencimento, tolerância, suspensão, cancelamento e retenção. | {"data-v33-config-section": "commercial"} |
| view-master-config-A007 | Cobrança / encargosMulta, juros, régua, acordo, canais e prefixos de fatura. | {"data-v33-config-section": "billing"} |
| view-master-config-A008 | ComunicaçãoE-mail, WhatsApp, remetente, suporte e templates. | {"data-v33-config-section": "communications"} |
| view-master-config-A009 | Termos / PrivacidadeVersões vigentes, aceite e contatos de privacidade. | {"data-v33-config-section": "legal"} |
| view-master-config-A010 | IntegraçõesStatus de billing, e-mail e fiscal. Credenciais não são exibidas. | {"data-v33-config-section": "integrations"} |

### Tabelas / colunas

- Sem ID: Documento; Versão; Estado; Vigência; Ação

### Regras e notas declaradas

- Sem falsa prontidão: backup/restauração, RLS runtime, billing provider, fiscal e MFA permanecem explicitamente como pendentes até termos evidência em ambiente real.

## view-chamados — Chamados

Fonte: linha 3071 · `view-chamados`.

**Áreas:** Chamados

**Indicadores / apresentação:** Abra, acompanhe e consulte o histórico de suporte da sua Loja.; Abertos; Aguardando cliente; Resolvidos

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-chamados-F001 | Buscar chamado | input {"id": "v34TenantTicketSearch", "placeholder": "Número ou assunto"} | — |
| view-chamados-F002 | Status | select {"id": "v34TenantTicketStatus"} | Todos [all]; Abertos [open]; Aguardando cliente [waiting_client]; Resolvidos [resolved] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-chamados-A001 | + Abrir chamado | {"type": "button", "data-v34-tenant-new-ticket": ""} |

### Tabelas / colunas

- v34TenantTicketsTable: Chamado; Assunto; Abertura; Aberto por; Status; Tempo decorrido; Última atualização; Ação

### Regras e notas declaradas

- Chamados ainda em atendimento.
- Precisam de retorno da Loja.
- Histórico preservado.
- Isolamento: esta área deve retornar somente registros com o organization_id da sessão autenticada. O nome e os chamados de outras Lojas nunca são enviados ao cliente.

## view-dashboard — Painel Geral da Tesouraria

Fonte: linha 3092 · `view-dashboard`.

**Áreas:** Painel Geral da Tesouraria; Fluxo de Caixa — Receitas, Despesas e Saldo; Resumo diário; Ações rápidas

**Indicadores / apresentação:** Recebíveis, caixa e inadimplência separados para permitir leitura rápida e decisões seguras.; Total a receber; Vencido; Recebido no mês; Disponível em caixa; A pagar; Vencidas; Operações mais frequentes

**Abas/modos:** Consolidado; Receitas x Desp.; Saldo

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-dashboard-A001 | Total a receber R$ 32.450,00 Obrigações abertas dos integrantes. | {"data-jump": "integrantes"} |
| view-dashboard-A002 | Vencido R$ 11.840,00 23 integrantes possuem valores vencidos. | {"data-jump": "inadimplencia"} |
| view-dashboard-A003 | Disponível em caixa R$ 41.380,00 Saldo financeiro disponível. Não inclui recebíveis. | {"data-jump": "tesouraria"} |
| view-dashboard-A004 | A pagar R$ 9.840,00 Obrigações institucionais ainda não liquidadas. | {"data-jump": "contas-pagar"} |
| view-dashboard-A005 | Vencidas R$ 1.240,00 2 contas vencidas precisam de atenção. | {"data-jump": "contas-pagar"} |
| view-dashboard-A006 | ⛶ | {"data-expand-flow": "dashboardFlowChartCard", "title": "Expandir gráfico"} |
| view-dashboard-A007 | Consolidado | {"data-mode": "consolidado"} |
| view-dashboard-A008 | Receitas x Desp. | {"data-mode": "movimentos"} |
| view-dashboard-A009 | Saldo | {"data-mode": "saldo"} |
| view-dashboard-A010 | De01/10/2025 | {"id": "dashStartTrigger", "data-date-target": "dash-start"} |
| view-dashboard-A011 | Até07/09/2026 | {"id": "dashEndTrigger", "data-date-target": "dash-end"} |
| view-dashboard-A012 | De01/09/2026 | {"data-date-target": "activity-start"} |
| view-dashboard-A013 | Até07/09/2026 | {"data-date-target": "activity-end"} |
| view-dashboard-A014 | Registrar pagamentoPIX, dinheiro ou transferência. | {"data-modal": "payment"} |
| view-dashboard-A015 | Criar cobrançaLançamento avulso ou extraordinário. | {"data-modal": "charge"} |
| view-dashboard-A016 | Novo ÁgapeSelecione participantes e gere débitos. | {"data-modal": "event"} |
| view-dashboard-A017 | Gerar mensalidadesPrévia e confirmação do lote. | {"data-modal": "monthly"} |
| view-dashboard-A018 | Negociar dívidaReorganizar saldo em novas parcelas com histórico preservado. | {"data-modal": "negotiation"} |

### Tabelas / colunas

- Sem ID: Data; Entradas; Saídas; Saldo

### Regras e notas declaradas

- Obrigações abertas dos integrantes.
- 23 integrantes possuem valores vencidos.
- Entradas efetivamente recebidas em setembro.
- Saldo financeiro disponível. Não inclui recebíveis.
- Obrigações institucionais ainda não liquidadas.
- 2 contas vencidas precisam de atenção.

## view-integrantes — Integrantes

Fonte: linha 3189 · `view-integrantes`.

**Áreas:** Integrantes

**Indicadores / apresentação:** Visão cadastral e financeira por período, com situação do cadastro e status financeiro separados.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-integrantes-F001 | Pesquisar por nome, telefone ou e-mail | input {"id": "memberSearch", "placeholder": "Pesquisar por nome, telefone ou e-mail"} | — |
| view-integrantes-F002 | Status financeiro | select {"id": "memberStatusFilter", "aria-label": "Status financeiro"} | Todos os status [all]; Em dia [Em dia]; Com saldo [Com saldo]; Parcial [Parcial]; Vencido [Vencido]; Com crédito [Com crédito]; Sem movimento [Sem movimento] |
| view-integrantes-F003 | Situação cadastral | select {"id": "memberSituationFilter", "aria-label": "Situação cadastral"} | Todas as situações [all]; Ativo [Ativo]; Afastado [Afastado]; Inativo [Inativo]; Desligado [Desligado] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-integrantes-A001 | De 01/09/2026 | {"data-date-target": "member-start"} |
| view-integrantes-A002 | Até 30/09/2026 | {"data-date-target": "member-end"} |
| view-integrantes-A003 | + Cadastrar integrante | {"data-modal": "member"} |
| view-integrantes-A004 | Carlos de Carvalho | {"data-member": "Carlos de Carvalho"} |
| view-integrantes-A005 | João Martins | {"data-member": "João Martins"} |
| view-integrantes-A006 | Pedro Henrique | {"data-member": "Pedro Henrique"} |
| view-integrantes-A007 | Marcos Vieira | {"data-member": "Marcos Vieira"} |

### Tabelas / colunas

- membersTable: Integrante; Situação; Status; Cargo; Mensalidade; Isento; Saldo do período; Crédito do período; Último pagamento; Contato

## view-financeiro — Financeiro dos Integrantes

Fonte: linha 3302 · `view-financeiro`.

**Áreas:** Financeiro dos Integrantes; Lançamentos recentes; Negociações de dívida

**Indicadores / apresentação:** Motor de cobranças, recorrências, pagamentos e alocações sem saldos manuais.; Mensalidades abertas; Mútuas; GLP; Ágapes + extras; Histórico preservado e parcelamento auditável

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-financeiro-F001 | Competência | select {"id": "financeCompetence", "aria-label": "Competência"} | Todas as competências [all]; Competência 09/2026 [2026-09]; Competência 08/2026 [2026-08]; Competência 07/2026 [2026-07]; Competência 06/2026 [2026-06] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-financeiro-A001 | De01/09/2026 | {"data-date-target": "finance-start"} |
| view-financeiro-A002 | Até30/09/2026 | {"data-date-target": "finance-end"} |
| view-financeiro-A003 | 1 sem. | {"data-days": "7"} |
| view-financeiro-A004 | 15 dias | {"data-days": "15"} |
| view-financeiro-A005 | Ver acordo | {"data-modal": "negotiation"} |

### Tabelas / colunas

- Sem ID: Data; Integrante; Categoria; Competência; Valor original; Pago; Aberto; Status
- Sem ID: Integrante; Saldo negociado; Condição; 1º vencimento; Status; Ação

### Regras e notas declaradas

- 123 competências pendentes.
- Lançamentos em aberto.
- Grande Loja do Paraná.
- Eventos e cobranças avulsas.
- Regra do sistema: uma negociação não apaga as cobranças originais. Ela cria um acordo vinculado aos débitos negociados e gera novas parcelas conforme condições aprovadas.

## view-inadimplencia — Inadimplência

Fonte: linha 3361 · `view-inadimplencia`.

**Áreas:** Inadimplência; Detalhamento; Tendência da inadimplência

**Indicadores / apresentação:** Priorize os débitos por faixa de atraso, valor e antiguidade. Clique em uma faixa para ver os integrantes.; Até 30 dias; 31–60 dias; 61–90 dias; Acima de 90 dias; Últimos 6 meses

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-inadimplencia-A001 | Até 30 diasR$ 3.260,008 integrantes | {"tabindex": "0", "data-delinquency-bucket": "up30"} |
| view-inadimplencia-A002 | 31–60 diasR$ 2.980,005 integrantes | {"tabindex": "0", "data-delinquency-bucket": "31-60"} |
| view-inadimplencia-A003 | 61–90 diasR$ 1.900,004 integrantes | {"tabindex": "0", "data-delinquency-bucket": "61-90"} |
| view-inadimplencia-A004 | Acima de 90 diasR$ 3.700,006 integrantes | {"tabindex": "0", "data-delinquency-bucket": "over90"} |

### Tabelas / colunas

- Sem ID: Integrante; Vencimento mais antigo; Dias em atraso; Categoria principal; Títulos; Valor vencido; Contato

### Regras e notas declaradas

- 8 integrantes
- 5 integrantes
- 4 integrantes
- 6 integrantes
- Indicador demonstrativo: percentual vencido sobre o total exigível no período.

## view-tesouraria — Caixa e Bancos

Fonte: linha 3430 · `view-tesouraria`.

**Áreas:** Caixa e Bancos; Fundos e orçamento; Conciliação bancária

**Indicadores / apresentação:** Onde o dinheiro está armazenado. Separado dos valores a receber.; Conta Bancária Principal; Conta PIX; Caixa; Finalidade, previsto e realizado; Comparação sistema x extrato; Saldo no sistema; Saldo no extrato; Diferença

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-tesouraria-F001 | Importar OFX/CSV | input {"id": "bankStatementInput", "type": "file", "accept": ".ofx,.csv,text/csv", "hidden": ""} | — |

### Tabelas / colunas

- Sem ID: Fundo; Orçamento; Realizado; Disponível; Execução
- Sem ID: Data; Descrição do extrato; Valor; Correspondência; Status

### Regras e notas declaradas

- Saldo derivado das movimentações.
- Entradas confirmadas.
- Dinheiro físico registrado.
- Conta Bancária Principal
- Arquivo importado em 07/09/2026
- 1 item requer conciliação

## view-fluxo-caixa — Fluxo de Caixa

Fonte: linha 3475 · `view-fluxo-caixa`.

**Áreas:** Fluxo de Caixa; Resumo diário; Maiores Despesas; Receitas × Despesas; Movimentação do período

**Indicadores / apresentação:** Entradas e saídas efetivas da Loja, separadas dos valores apenas previstos ou a receber.; Saldo inicial; Entradas realizadas; Saídas realizadas; Saldo atual; Realizado x previsto

**Abas/modos:** Consolidado; Projetado; Receitas x Desp.; Saldo

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-fluxo-caixa-F001 | cashFlowStart | input {"type": "date", "id": "cashFlowStart", "value": "2026-09-01"} | — |
| view-fluxo-caixa-F002 | cashFlowEnd | input {"type": "date", "id": "cashFlowEnd", "value": "2026-09-15"} | — |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-fluxo-caixa-A001 | ▣De01/09/2026 | {"data-date-target": "flow-start"} |
| view-fluxo-caixa-A002 | ▣Até30/09/2026 | {"data-date-target": "flow-end"} |
| view-fluxo-caixa-A003 | ⛶ | {"data-expand-flow": "cashFlowMainCard", "title": "Expandir gráfico"} |
| view-fluxo-caixa-A004 | Consolidado | {"data-mode": "consolidado"} |
| view-fluxo-caixa-A005 | Projetado | {"data-mode": "projetado"} |
| view-fluxo-caixa-A006 | Receitas x Desp. | {"data-mode": "movimentos"} |
| view-fluxo-caixa-A007 | Saldo | {"data-mode": "saldo"} |
| view-fluxo-caixa-A008 | Aplicar | {"id": "applyCashFlow"} |
| view-fluxo-caixa-A009 | ⛶ | {"data-expand-flow": "cashFlowExpenseCard", "title": "Expandir gráfico"} |

### Tabelas / colunas

- Sem ID: Dia; Receitas; Despesas; Saldo
- Sem ID: Data; Tipo; Descrição; Conta; Categoria; Entrada; Saída

### Regras e notas declaradas

- Posição em 01/09/2026.
- Recebimentos e receitas confirmadas.
- Pagamentos efetivamente realizados.
- Saldo derivado das movimentações.

## view-contas-pagar — Contas a Pagar

Fonte: linha 3533 · `view-contas-pagar`.

**Áreas:** Contas a Pagar

**Indicadores / apresentação:** Obrigações institucionais da Loja, fixas, variáveis, parceladas ou avulsas.; A pagar; Vencidas; Fixas no período; Variáveis no período

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-contas-pagar-F001 | payableTypeFilter | select {"id": "payableTypeFilter"} | Todos os tipos [all]; Fixa [Fixa]; Variável [Variável] |
| view-contas-pagar-F002 | payableStatusFilter | select {"id": "payableStatusFilter"} | Todos os status [all]; Pendente [Pendente]; Pago [Pago]; Vencido [Vencido] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-contas-pagar-A001 | De01/09/2026 | {"data-date-target": "payable-start"} |
| view-contas-pagar-A002 | Até30/09/2026 | {"data-date-target": "payable-end"} |
| view-contas-pagar-A003 | + Nova conta | {"data-modal": "payable"} |
| view-contas-pagar-A004 | Editar | {"type": "button", "data-edit-payable": ""} |
| view-contas-pagar-A005 | Editar | {"type": "button", "data-edit-payable": ""} |
| view-contas-pagar-A006 | Editar | {"type": "button", "data-edit-payable": ""} |
| view-contas-pagar-A007 | Editar | {"type": "button", "data-edit-payable": ""} |
| view-contas-pagar-A008 | Editar | {"type": "button", "data-edit-payable": ""} |
| view-contas-pagar-A009 | Editar | {"type": "button", "data-edit-payable": ""} |
| view-contas-pagar-A010 | Editar | {"type": "button", "data-edit-payable": ""} |

### Tabelas / colunas

- Sem ID: Descrição; Tipo; Competência; Vencimento; Valor; Aprovação; Status; Conta; Ações

### Regras e notas declaradas

- Obrigações ainda não liquidadas.
- 2 contas precisam de atenção.
- Obrigações fixas no período selecionado.
- Obrigações variáveis no período selecionado.

## view-contas-receber — Contas a Receber

Fonte: linha 3576 · `view-contas-receber`.

**Áreas:** Contas a Receber; Recebíveis previstos

**Indicadores / apresentação:** Visão consolidada dos recebíveis dos integrantes e de outras receitas institucionais previstas.; Integrantes; Receitas institucionais; Total previsto; Sem misturar com caixa

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-contas-receber-A001 | De01/09/2026 | {"data-date-target": "receivable-start"} |
| view-contas-receber-A002 | Até30/09/2026 | {"data-date-target": "receivable-end"} |
| view-contas-receber-A003 | + Nova receita | {"data-modal": "receivable"} |
| view-contas-receber-A004 | Editar | {"type": "button", "data-edit-receivable": ""} |
| view-contas-receber-A005 | Editar | {"type": "button", "data-edit-receivable": ""} |
| view-contas-receber-A006 | Editar | {"type": "button", "data-edit-receivable": ""} |
| view-contas-receber-A007 | Editar | {"type": "button", "data-edit-receivable": ""} |

### Tabelas / colunas

- Sem ID: Origem; Descrição; Classificação; Competência; Vencimento; Valor; Recebido; Status; Ações

### Regras e notas declaradas

- Cobranças abertas do núcleo de integrantes.
- Outras receitas previstas.
- Não representa dinheiro disponível em caixa.

## view-dre — DRE — Demonstração do Resultado

Fonte: linha 3614 · `view-dre`.

**Áreas:** DRE — Demonstração do Resultado; Demonstrativo; Orçado x realizado; Comparativo DRE

**Indicadores / apresentação:** Visão econômica por competência. Não substitui o fluxo de caixa e não deve confundir investimento patrimonial com despesa operacional.; Receitas operacionais; Custos; Despesas operacionais; Resultado do período; Plano vigente na competência: Plano de Contas Padrão · 01/01/2026–31/12/2026; Controle gerencial da competência; Mensal e anual

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-dre-F001 | dreCompetence | select {"id": "dreCompetence"} | Setembro/2026 [None]; Agosto/2026 [None]; Julho/2026 [None] |

### Tabelas / colunas

- Sem ID: Código; Conta; Set/2026; % Receita
- Sem ID: Grupo; Orçado; Realizado; Variação; Execução
- Sem ID: Indicador; Set/2026; Ago/2026; Variação mensal; Set/2025; Variação anual

### Regras e notas declaradas

- Reconhecidas na competência.
- Custos diretamente relacionados.
- Estrutura e administração.
- Após resultado financeiro.
- Critério recomendado: a DRE usa competência; fluxo de caixa usa entrada/saída efetiva. Aquisição de imóveis, bens e construção do templo ficam, por padrão, em grupo patrimonial fora do resultado operacional. A classificação contábil definitiva deve ser validada pelo contador da Loja.

## view-plano-contas — Plano de Contas e Estrutura Financeira

Fonte: linha 3683 · `view-plano-contas`.

**Áreas:** Plano de Contas e Estrutura Financeira; Plano de Contas; Novo Plano de Contas; Categorias e regras recorrentes; Contas financeiras e fundos; Formas de pagamento

**Indicadores / apresentação:** Centro único para classificação contábil e cadastros financeiros relacionados. Cada cadastro operacional mantém sua função própria, mas é vinculado ao plano quando houver impacto contábil.; Categoria financeira → Conta contábil; Regra recorrente → Categoria; Conta financeira → Conta patrimonial; Fixa/Variável → Conta contábil; Forma de pagamento; Fundo; Plano selecionado; Plano vigente hoje; Vigência; Linhas; Contas ativas

**Abas/modos:** Plano de Contas; Categorias e Regras; Contas e Fundos; Formas de Pagamento

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-plano-contas-F001 | Plano selecionado | select {"id": "accountPlanSelect"} | Plano de Contas Padrão [default] |
| view-plano-contas-F002 | Código | input {"type": "text", "value": "1", "aria-label": "Código"} | — |
| view-plano-contas-F003 | Descrição | input {"type": "text", "value": "RECEITAS", "aria-label": "Descrição"} | — |
| view-plano-contas-F004 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F005 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F006 | Código | input {"type": "text", "value": "1.01", "aria-label": "Código"} | — |
| view-plano-contas-F007 | Descrição | input {"type": "text", "value": "RECEITAS DE ANUIDADES", "aria-label": "Descrição"} | — |
| view-plano-contas-F008 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F009 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F010 | Código | input {"type": "text", "value": "1.01.001", "aria-label": "Código"} | — |
| view-plano-contas-F011 | Descrição | input {"type": "text", "value": "Capitação dos Obreiros", "aria-label": "Descrição"} | — |
| view-plano-contas-F012 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F013 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F014 | Código | input {"type": "text", "value": "1.02", "aria-label": "Código"} | — |
| view-plano-contas-F015 | Descrição | input {"type": "text", "value": "RECEITAS DE EMISSÃO DE PLACETS", "aria-label": "Descrição"} | — |
| view-plano-contas-F016 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F017 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F018 | Código | input {"type": "text", "value": "1.02.001", "aria-label": "Código"} | — |
| view-plano-contas-F019 | Descrição | input {"type": "text", "value": "Placets de Iniciação", "aria-label": "Descrição"} | — |
| view-plano-contas-F020 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F021 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F022 | Código | input {"type": "text", "value": "1.02.011", "aria-label": "Código"} | — |
| view-plano-contas-F023 | Descrição | input {"type": "text", "value": "Kit de Iniciação", "aria-label": "Descrição"} | — |
| view-plano-contas-F024 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F025 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F026 | Código | input {"type": "text", "value": "1.02.012", "aria-label": "Código"} | — |
| view-plano-contas-F027 | Descrição | input {"type": "text", "value": "Kit de Elevação", "aria-label": "Descrição"} | — |
| view-plano-contas-F028 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F029 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F030 | Código | input {"type": "text", "value": "1.02.013", "aria-label": "Código"} | — |
| view-plano-contas-F031 | Descrição | input {"type": "text", "value": "Kit de Exaltação", "aria-label": "Descrição"} | — |
| view-plano-contas-F032 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F033 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F034 | Código | input {"type": "text", "value": "1.02.014", "aria-label": "Código"} | — |
| view-plano-contas-F035 | Descrição | input {"type": "text", "value": "Kit de Regularização", "aria-label": "Descrição"} | — |
| view-plano-contas-F036 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F037 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F038 | Código | input {"type": "text", "value": "1.02.015", "aria-label": "Código"} | — |
| view-plano-contas-F039 | Descrição | input {"type": "text", "value": "Kit de Filiação", "aria-label": "Descrição"} | — |
| view-plano-contas-F040 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F041 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F042 | Código | input {"type": "text", "value": "1.03", "aria-label": "Código"} | — |
| view-plano-contas-F043 | Descrição | input {"type": "text", "value": "RECEITAS DE OBRAS LITÚRGICAS E LEIS", "aria-label": "Descrição"} | — |
| view-plano-contas-F044 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F045 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F046 | Código | input {"type": "text", "value": "1.03.003", "aria-label": "Código"} | — |
| view-plano-contas-F047 | Descrição | input {"type": "text", "value": "Constituição", "aria-label": "Descrição"} | — |
| view-plano-contas-F048 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F049 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F050 | Código | input {"type": "text", "value": "1.03.004", "aria-label": "Código"} | — |
| view-plano-contas-F051 | Descrição | input {"type": "text", "value": "Manual de Execução Ritualística", "aria-label": "Descrição"} | — |
| view-plano-contas-F052 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F053 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F054 | Código | input {"type": "text", "value": "1.03.005", "aria-label": "Código"} | — |
| view-plano-contas-F055 | Descrição | input {"type": "text", "value": "Regulamento Geral", "aria-label": "Descrição"} | — |
| view-plano-contas-F056 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F057 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F058 | Código | input {"type": "text", "value": "1.03.006", "aria-label": "Código"} | — |
| view-plano-contas-F059 | Descrição | input {"type": "text", "value": "Ritual de Aprendiz - REAA", "aria-label": "Descrição"} | — |
| view-plano-contas-F060 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F061 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F062 | Código | input {"type": "text", "value": "1.03.007", "aria-label": "Código"} | — |
| view-plano-contas-F063 | Descrição | input {"type": "text", "value": "Ritual de Companheiro - REAA", "aria-label": "Descrição"} | — |
| view-plano-contas-F064 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F065 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F066 | Código | input {"type": "text", "value": "1.03.008", "aria-label": "Código"} | — |
| view-plano-contas-F067 | Descrição | input {"type": "text", "value": "Ritual de Mestre", "aria-label": "Descrição"} | — |
| view-plano-contas-F068 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F069 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F070 | Código | input {"type": "text", "value": "1.03.010", "aria-label": "Código"} | — |
| view-plano-contas-F071 | Descrição | input {"type": "text", "value": "Ritual Especial", "aria-label": "Descrição"} | — |
| view-plano-contas-F072 | Sem rótulo explícito | select {"disabled": ""} | Não se aplica [None] |
| view-plano-contas-F073 | Ativa | input {"type": "checkbox", "checked": "", "aria-label": "Ativa"} | — |
| view-plano-contas-F074 | Nome do novo plano | input {"type": "text", "id": "newPlanName", "placeholder": "Ex.: Plano de Contas 2027"} | — |
| view-plano-contas-F075 | Vigência inicial | input {"type": "date", "id": "newPlanFrom", "value": "2027-01-01"} | — |
| view-plano-contas-F076 | Vigência final | input {"type": "date", "id": "newPlanTo", "value": "2027-12-31"} | — |
| view-plano-contas-F077 | Duplicar o plano atualCopia códigos, descrições e status das contas. | input {"type": "radio", "name": "newPlanSource", "value": "duplicate", "checked": ""} | — |
| view-plano-contas-F078 | Criar plano vazioInicia sem contas para montagem manual. | input {"type": "radio", "name": "newPlanSource", "value": "blank"} | — |
| view-plano-contas-F079 | Sem rótulo explícito | select {} | 1.01.001 — Capitação dos Obreiros [None] |
| view-plano-contas-F080 | Sem rótulo explícito | select {} | Conta contábil específica para Ágapes / eventos [None] |
| view-plano-contas-F081 | Sem rótulo explícito | select {} | 2.03.001 — GLP / obrigações institucionais [None] |
| view-plano-contas-F082 | Sem rótulo explícito | select {} | Definir conforme natureza real do repasse [None] |
| view-plano-contas-F083 | Sem rótulo explícito | select {} | 3.04.006 — Energia Elétrica [None] |
| view-plano-contas-F084 | Sem rótulo explícito | select {} | 3.04.001 — Despesas com Internet [None] |
| view-plano-contas-F085 | Sem rótulo explícito | select {} | 2.02.001 — Custo de Manutenção da Sede [None] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-plano-contas-A001 | Plano de Contas | {"data-structure-pane": "accounts"} |
| view-plano-contas-A002 | Categorias e Regras | {"data-structure-pane": "categories"} |
| view-plano-contas-A003 | Contas e Fundos | {"data-structure-pane": "cash"} |
| view-plano-contas-A004 | Formas de Pagamento | {"data-structure-pane": "payments"} |
| view-plano-contas-A005 | + Novo Plano de Contas | {"type": "button", "id": "createAccountPlan"} |
| view-plano-contas-A006 | Validar vigência | {"type": "button", "id": "setActiveAccountPlan"} |
| view-plano-contas-A007 | Salvar | {"type": "button"} |
| view-plano-contas-A008 | Desativar | {"type": "button"} |
| view-plano-contas-A009 | Excluir | {"type": "button"} |
| view-plano-contas-A010 | Salvar | {"type": "button"} |
| view-plano-contas-A011 | Desativar | {"type": "button"} |
| view-plano-contas-A012 | Excluir | {"type": "button"} |
| view-plano-contas-A013 | Salvar | {"type": "button"} |
| view-plano-contas-A014 | Desativar | {"type": "button"} |
| view-plano-contas-A015 | Excluir | {"type": "button"} |
| view-plano-contas-A016 | Salvar | {"type": "button"} |
| view-plano-contas-A017 | Desativar | {"type": "button"} |
| view-plano-contas-A018 | Excluir | {"type": "button"} |
| view-plano-contas-A019 | Salvar | {"type": "button"} |
| view-plano-contas-A020 | Desativar | {"type": "button"} |
| view-plano-contas-A021 | Excluir | {"type": "button"} |
| view-plano-contas-A022 | Salvar | {"type": "button"} |
| view-plano-contas-A023 | Desativar | {"type": "button"} |
| view-plano-contas-A024 | Excluir | {"type": "button"} |
| view-plano-contas-A025 | Salvar | {"type": "button"} |
| view-plano-contas-A026 | Desativar | {"type": "button"} |
| view-plano-contas-A027 | Excluir | {"type": "button"} |
| view-plano-contas-A028 | Salvar | {"type": "button"} |
| view-plano-contas-A029 | Desativar | {"type": "button"} |
| view-plano-contas-A030 | Excluir | {"type": "button"} |
| view-plano-contas-A031 | Salvar | {"type": "button"} |
| view-plano-contas-A032 | Desativar | {"type": "button"} |
| view-plano-contas-A033 | Excluir | {"type": "button"} |
| view-plano-contas-A034 | Salvar | {"type": "button"} |
| view-plano-contas-A035 | Desativar | {"type": "button"} |
| view-plano-contas-A036 | Excluir | {"type": "button"} |
| view-plano-contas-A037 | Salvar | {"type": "button"} |
| view-plano-contas-A038 | Desativar | {"type": "button"} |
| view-plano-contas-A039 | Excluir | {"type": "button"} |
| view-plano-contas-A040 | Salvar | {"type": "button"} |
| view-plano-contas-A041 | Desativar | {"type": "button"} |
| view-plano-contas-A042 | Excluir | {"type": "button"} |
| view-plano-contas-A043 | Salvar | {"type": "button"} |
| view-plano-contas-A044 | Desativar | {"type": "button"} |
| view-plano-contas-A045 | Excluir | {"type": "button"} |
| view-plano-contas-A046 | Salvar | {"type": "button"} |
| view-plano-contas-A047 | Desativar | {"type": "button"} |
| view-plano-contas-A048 | Excluir | {"type": "button"} |
| view-plano-contas-A049 | Salvar | {"type": "button"} |
| view-plano-contas-A050 | Desativar | {"type": "button"} |
| view-plano-contas-A051 | Excluir | {"type": "button"} |
| view-plano-contas-A052 | Salvar | {"type": "button"} |
| view-plano-contas-A053 | Desativar | {"type": "button"} |
| view-plano-contas-A054 | Excluir | {"type": "button"} |
| view-plano-contas-A055 | Salvar | {"type": "button"} |
| view-plano-contas-A056 | Desativar | {"type": "button"} |
| view-plano-contas-A057 | Excluir | {"type": "button"} |
| view-plano-contas-A058 | Salvar | {"type": "button"} |
| view-plano-contas-A059 | Desativar | {"type": "button"} |
| view-plano-contas-A060 | Excluir | {"type": "button"} |
| view-plano-contas-A061 | + Nova conta | {"type": "button", "id": "addAccountRow"} |
| view-plano-contas-A062 | Cancelar | {"type": "button", "id": "cancelNewPlan"} |
| view-plano-contas-A063 | Criar Plano | {"type": "button", "id": "confirmNewPlan"} |
| view-plano-contas-A064 | + Categoria | {"data-modal": "financialCategory"} |
| view-plano-contas-A065 | + Regra recorrente | {"data-modal": "recurringRule"} |
| view-plano-contas-A066 | + Conta financeira | {"data-modal": "financialAccount"} |
| view-plano-contas-A067 | + Fundo | {"data-modal": "fund"} |
| view-plano-contas-A068 | + Forma de pagamento | {"data-modal": "paymentMethod"} |

### Tabelas / colunas

- Sem ID: Código; Descrição; Classificação operacional; Ativo; Ações
- Sem ID: Categoria; Natureza; Conta contábil relacionada; Uso; Status
- Sem ID: Cadastro; Tipo; Relação contábil / gerencial; Observação
- Sem ID: Forma; Liquidação; Relação com o Plano de Contas; Status

### Regras e notas declaradas

- Padrão adotado: o Plano de Contas é a taxonomia contábil. Categorias financeiras apontam para contas de resultado; contas bancárias/caixa apontam para contas patrimoniais; regras recorrentes apontam para categorias. Formas de pagamento e fundos permanecem dimensões operacionais e não viram contas de DRE artificialmente.
- Regra de segurança: uma conta utilizada em histórico financeiro não deve ser apagada na aplicação real; ela será desativada. Exclusão será permitida somente para contas sem movimentos e sem dependências. Contas pai com subcontas também não podem ser excluídas diretamente.

## view-config-dre — Configurações DRE

Fonte: linha 3880 · `view-config-dre`.

**Áreas:** Configurações DRE; Critérios do demonstrativo; Cobertura do mapeamento; Como funciona o vínculo contábil; Boas práticas

**Indicadores / apresentação:** Define como a DRE será apresentada. O vínculo entre cadastros financeiros e contas contábeis fica centralizado em Plano de Contas.; Apresentação da DRE; Diagnóstico; Sem duplicidade de configuração; DRE ≠ fluxo de caixa; Competência; Patrimônio; Histórico

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-config-dre-F001 | Plano de Contas ativo | input {"id": "dreActivePlanLabel", "value": "Plano de Contas Padrão", "readonly": ""} | — |
| view-config-dre-F002 | Regime | select {} | Competência — recomendado [None] |
| view-config-dre-F003 | Comparativo | select {} | Período anterior [None]; Mesmo período do ano anterior [None]; Sem comparativo [None] |
| view-config-dre-F004 | Resultado financeiro | select {} | Exibir separado [None]; Incorporar ao resultado [None] |
| view-config-dre-F005 | Contas patrimoniais | select {} | Excluir do DRE [None]; Exibir em anexo [None] |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-config-dre-A001 | Abrir Plano de Contas | {"id": "goToFinancialStructure"} |

### Regras e notas declaradas

- Fluxo de classificação: lançamento financeiro → categoria → conta contábil. Para contas bancárias/caixa, o vínculo é patrimonial. Para fundos, o vínculo é gerencial. Formas de pagamento não possuem conta de DRE própria. Dessa forma, nenhuma categoria fica “esquecida” em uma lista manual dentro da DRE.

## view-relatorios — Relatórios

Fonte: linha 3926 · `view-relatorios`.

**Áreas:** Relatórios; Posição financeira geral

**Indicadores / apresentação:** Selecione um relatório. A visualização é atualizada imediatamente no painel abaixo.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-relatorios-F001 | Competência | input {"type": "month", "id": "reportCompetence", "value": "2026-09"} | — |
| view-relatorios-F002 | Período — início | input {"type": "date", "id": "reportStart", "value": "2026-09-01"} | — |
| view-relatorios-F003 | Período — fim | input {"type": "date", "id": "reportEnd", "value": "2026-09-30"} | — |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-relatorios-A001 | Posição financeira geral Saldo por integrante e composição. | {"type": "button", "data-report": "financial-position"} |
| view-relatorios-A002 | Recebimentos Pagamentos por período. | {"type": "button", "data-report": "receipts"} |
| view-relatorios-A003 | Inadimplência Faixas e antiguidade. | {"type": "button", "data-report": "delinquency"} |
| view-relatorios-A004 | Fechamento mensal Visão consolidada da competência. | {"type": "button", "data-report": "monthly-close"} |
| view-relatorios-A005 | Exportação para contabilidade Plano de Contas, competência e lançamentos classificados. | {"type": "button", "data-report": "accounting-export"} |
| view-relatorios-A006 | Gerar PDF | {"type": "button", "data-report-export": "pdf"} |
| view-relatorios-A007 | Exportar Excel | {"type": "button", "data-report-export": "excel"} |

### Tabelas / colunas

- Sem ID: Integrante; Aberto; Crédito; Posição líquida

## view-cadastros — Cadastros Administrativos

Fonte: linha 4007 · `view-cadastros`.

**Áreas:** Cadastros Administrativos

**Indicadores / apresentação:** Cadastros de pessoas, cargos e acesso. Estruturas financeiras foram centralizadas em Plano de Contas.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-cadastros-A001 | Cadastrar integranteNovo integrante, cargo, mensalidade e situação. | {"data-modal": "member"} |
| view-cadastros-A002 | CargosCadastre e mantenha os tipos de cargo da Loja. | {"data-modal": "cargo"} |
| view-cadastros-A003 | Perfis e permissõesAdministrador, Tesoureiro, Consulta e acesso futuro de integrante. | {"data-modal": "role"} |

### Regras e notas declaradas

- Centralização financeira: categorias, regras recorrentes, contas financeiras, fundos, formas de pagamento e tipos de contas agora são administrados em DRE → Plano de Contas, evitando cadastros duplicados e garantindo o relacionamento contábil correto.

## view-configuracoes — Configurações da Loja

Fonte: linha 4026 · `view-configuracoes`.

**Áreas:** Configurações da Loja; Identidade da Loja; Minha Assinatura; Suporte Corsys; Aparência; Tema do sistema; Governança financeira; Privacidade e LGPD; Importação e continuidade; Backup e restauração; Auditoria; Tipos de cargo

**Indicadores / apresentação:** Identidade institucional, dados cadastrais, comunicação e preferências.; Dados simulados para demonstração; Plano contratado pela Loja; Chamados visíveis somente para esta Loja; Preferência visual deste usuário; Escolha entre duas opções claras e duas escuras; Aprovação, portal e notificações; Minimização, acesso e retenção; Dados financeiros; Retenção operacional; Auditoria de acesso; Migração controlada, backup e restauração; Continuidade operacional; Backup do ambiente; Teste de restauração; Eventos críticos separados da remediação; Usados no cadastro de integrantes

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| view-configuracoes-F001 | Escolher arquivo | input {"type": "file", "id": "logoInput", "accept": "image/png,image/jpeg,image/svg+xml", "hidden": ""} | — |
| view-configuracoes-F002 | Nome da Loja | input {"value": "Loja Maçônica — Demonstração"} | — |
| view-configuracoes-F003 | Número | input {"value": "000"} | — |
| view-configuracoes-F004 | CNPJ | input {"value": "00.000.000/0001-00"} | — |
| view-configuracoes-F005 | Oriente | input {"value": "São José dos Pinhais"} | — |
| view-configuracoes-F006 | Endereço | input {"value": "Endereço demonstrativo"} | — |
| view-configuracoes-F007 | CEP | input {"value": "00000-000"} | — |
| view-configuracoes-F008 | Telefone | input {"value": "(41) 0000-0000"} | — |
| view-configuracoes-F009 | Potência / Obediência | input {"value": "Grande Loja do Paraná — GLP"} | — |
| view-configuracoes-F010 | Chave PIX | input {"value": "Dados simulados"} | — |
| view-configuracoes-F011 | E-mail | input {"value": "tesouraria@exemplo.org"} | — |
| view-configuracoes-F012 | Aprovação de despesas | select {"id": "approvalPolicy"} | Obrigatória acima de valor definido [threshold]; Obrigatória para todas [all]; Desativada [off] |
| view-configuracoes-F013 | Valor mínimo para exigir aprovação | input {"id": "approvalThreshold", "inputmode": "decimal", "value": "R$ 5.000,00", "placeholder": "R$ 0,00"} | — |
| view-configuracoes-F014 | Aprovadores mínimos | select {} | 1 Administrador [None]; 2 Administradores [None] |
| view-configuracoes-F015 | Portal do Integrante | select {} | Habilitado — consulta do próprio extrato [None]; Desabilitado [None] |
| view-configuracoes-F016 | Notificações | select {} | Sistema + e-mail [None]; Somente sistema [None] |
| view-configuracoes-F017 | Selecionar arquivo | input {"type": "file", "id": "financialImportInput", "accept": ".csv,.xlsx,.xls", "hidden": ""} | — |
| view-configuracoes-F018 | Novo cargo | input {"id": "newCargoInput", "placeholder": "Ex.: Venerável Mestre"} | — |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| view-configuracoes-A001 | Ver cobrança | {"type": "button", "id": "tenantBillingAction"} |
| view-configuracoes-A002 | Solicitar exportação | {"type": "button", "data-demo-action": "tenant-self-export"} |
| view-configuracoes-A003 | Meus chamados | {"data-v34-tenant-ticket-list": ""} |
| view-configuracoes-A004 | + Abrir chamado | {"data-v34-tenant-new-ticket": ""} |
| view-configuracoes-A005 | Claro Institucional Fundo branco com o azul atual #2B3A8B. CLARO | {"type": "button", "data-theme-choice": "light-institutional"} |
| view-configuracoes-A006 | Claro Suave Fundo #E0E0E0 com barra lateral, superior e destaques em #5B5B5B. CLARO | {"type": "button", "data-theme-choice": "light-soft"} |
| view-configuracoes-A007 | Escuro Azul Base #131a25 com superfícies azul-grafite. ESCURO | {"type": "button", "data-theme-choice": "dark-blue"} |
| view-configuracoes-A008 | Escuro Ouro Base #131a25 com detalhes dourados institucionais. ESCURO | {"type": "button", "data-theme-choice": "dark-gold"} |
| view-configuracoes-A009 | Exportar dados de um integrante | {"type": "button", "data-demo-action": "lgpd-export"} |
| view-configuracoes-A010 | Registrar solicitação de correção | {"type": "button", "data-demo-action": "lgpd-correct"} |
| view-configuracoes-A011 | Baixar modelo para preenchimento | {"type": "button", "id": "downloadImportTemplate"} |
| view-configuracoes-A012 | Registrar evidência de restauração | {"type": "button", "data-demo-action": "restore-test"} |
| view-configuracoes-A013 | Adicionar | {"id": "addCargoBtn", "type": "button"} |

### Tabelas / colunas

- Sem ID: Data/hora; Usuário; Ação; Recurso; Resultado

### Regras e notas declaradas

- Assinatura da plataforma: cobrança da Corsys é independente do financeiro interno desta Loja.
- Preferência por usuário: no protótipo o tema fica salvo neste navegador. Na aplicação real, a preferência será associada ao perfil do usuário e não afetará permissões ou dados financeiros.
- Regra: o portal do integrante terá acesso somente aos próprios dados financeiros; aprovação de despesa será validada no servidor e auditada.

## Superfícies compartilhadas — navegação, acesso, Cliente 360º, extrato e diálogos

Fonte: linha compartilhada · `SHARED`.

**Áreas:** Corsys; Corsys Tesouraria; Loja; Operação Master; Carlos de Carvalho; Extrato financeiro; Comunicações; Nova operação; Central de notificações; Operação

**Indicadores / apresentação:** —; Encerramento controlado; 0 lançamentos; Histórico por canal

**Abas/modos:** Visão geral; Assinatura; Cobranças; Uso e limites; Termos/LGPD; Suporte; Auditoria; Encerramento

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| SHARED-F001 | Simular acesso | select {"id": "accessContextSelect", "aria-label": "Simular acesso"} | Michael — Master SaaS [master]; Loja Aurora do Sul nº 101 — Admin [tenant1]; Loja Fraternidade do Oriente nº 202 — Tesoureiro [tenant2] |
| SHARED-F002 | Digite a data: 01/01/2026 | input {"id": "dateDirectInput", "inputmode": "numeric", "placeholder": "Digite a data: 01/01/2026"} | — |
| SHARED-F003 | Pesquisar ano, ex.: 2026 | input {"id": "pickerYearSearch", "inputmode": "numeric", "placeholder": "Pesquisar ano, ex.: 2026"} | — |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| SHARED-A001 | ◆Painel Master | {"data-view": "master"} |
| SHARED-A002 | ◇Clientes | {"data-view": "master-clientes"} |
| SHARED-A003 | ▤Assinaturas e Cobrança | {"data-view": "master-cobranca"} |
| SHARED-A004 | ▦Planos SaaS | {"data-view": "master-planos"} |
| SHARED-A005 | ◎Operação / Suporte | {"data-view": "master-operacao"} |
| SHARED-A006 | ⚙Config. da Plataforma | {"data-view": "master-config"} |
| SHARED-A007 | ◈Painel Geral | {"data-view": "dashboard"} |
| SHARED-A008 | ◇Integrantes | {"data-nav-id": "integrantes", "data-view": "integrantes"} |
| SHARED-A009 | ▣Financeiro | {"data-nav-id": "financeiro", "data-view": "financeiro"} |
| SHARED-A010 | △Inadimplência | {"data-nav-id": "inadimplencia", "data-view": "inadimplencia"} |
| SHARED-A011 | ▤Caixa e Bancos | {"data-nav-id": "tesouraria", "data-view": "tesouraria"} |
| SHARED-A012 | ≋Fluxo de Caixa | {"data-nav-id": "fluxo-caixa", "data-view": "fluxo-caixa"} |
| SHARED-A013 | ↓Contas a Pagar | {"data-nav-id": "contas-pagar", "data-view": "contas-pagar"} |
| SHARED-A014 | ↑Contas a Receber | {"data-nav-id": "contas-receber", "data-view": "contas-receber"} |
| SHARED-A015 | ▥Relatórios | {"data-nav-id": "relatorios", "data-view": "relatorios"} |
| SHARED-A016 | ◫DRE | {"data-nav-id": "dre", "data-view": "dre"} |
| SHARED-A017 | ☷Plano de Contas | {"data-nav-id": "plano-contas", "data-view": "plano-contas"} |
| SHARED-A018 | ⚙Configurações DRE | {"data-nav-id": "config-dre", "data-view": "config-dre"} |
| SHARED-A019 | ⌘Cadastros | {"data-nav-id": "cadastros", "data-view": "cadastros"} |
| SHARED-A020 | ⚙Configurações | {"data-nav-id": "configuracoes", "data-view": "configuracoes"} |
| SHARED-A021 | ◫Chamados | {"data-nav-id": "chamados", "data-view": "chamados"} |
| SHARED-A022 | ☰ | {"id": "mobileMenu"} |
| SHARED-A023 | ● | {"type": "button", "id": "notificationButton", "title": "Notificações"} |
| SHARED-A024 | Encerrar suporte | {"type": "button", "id": "leaveSupportMode"} |
| SHARED-A025 | ◆Master | {"data-view": "master"} |
| SHARED-A026 | ◇Clientes | {"data-view": "master-clientes"} |
| SHARED-A027 | ▤Cobrança | {"data-view": "master-cobranca"} |
| SHARED-A028 | ▦Planos | {"data-view": "master-planos"} |
| SHARED-A029 | •••Mais | {"type": "button", "id": "masterMoreBtn"} |
| SHARED-A030 | ◎ Operação / Suporte | {"data-view": "master-operacao"} |
| SHARED-A031 | ⚙ Config. da Plataforma | {"data-view": "master-config"} |
| SHARED-A032 | ◈Painel | {"data-view": "dashboard"} |
| SHARED-A033 | ◇Integrantes | {"data-view": "integrantes"} |
| SHARED-A034 | ▣Financeiro | {"data-view": "financeiro"} |
| SHARED-A035 | ≋Fluxo | {"data-view": "fluxo-caixa"} |
| SHARED-A036 | ◫DRE | {"data-view": "dre"} |
| SHARED-A037 | × | {"id": "closeClient360"} |
| SHARED-A038 | Visão geral | {"data-client-tab": "overview"} |
| SHARED-A039 | Assinatura | {"data-client-tab": "subscription"} |
| SHARED-A040 | Cobranças | {"data-client-tab": "billing"} |
| SHARED-A041 | Uso e limites | {"data-client-tab": "usage"} |
| SHARED-A042 | Termos/LGPD | {"data-client-tab": "terms"} |
| SHARED-A043 | Suporte | {"data-client-tab": "support"} |
| SHARED-A044 | Auditoria | {"data-client-tab": "audit"} |
| SHARED-A045 | Encerramento | {"data-client-tab": "offboarding"} |
| SHARED-A046 | Alterar plano | {"data-v32-plan-change": ""} |
| SHARED-A047 | Gerenciar ciclo | {"data-v32-lifecycle": ""} |
| SHARED-A048 | Abrir sessão read-only | {"id": "client360SupportBtn"} |
| SHARED-A049 | Solicitar exportação | {"data-demo-action": "tenant-export"} |
| SHARED-A050 | Agendar cancelamento | {"data-demo-action": "schedule-cancel"} |
| SHARED-A051 | Definir retenção | {"data-demo-action": "retention-policy"} |
| SHARED-A052 | × | {"id": "closeMasterDialog"} |
| SHARED-A053 | Cancelar | {"id": "cancelMasterDialog"} |
| SHARED-A054 | Confirmar | {"id": "confirmMasterDialog"} |
| SHARED-A055 | × | {"id": "closeDrawer"} |
| SHARED-A056 | Gerar PDF | {"id": "generateMemberPdf"} |
| SHARED-A057 | Exportar Excel | {"id": "exportMemberExcel"} |
| SHARED-A058 | Enviar e-mail | {"type": "button", "data-demo-action": "send-email"} |
| SHARED-A059 | Enviar WhatsApp | {"type": "button", "data-demo-action": "send-whatsapp"} |
| SHARED-A060 | × | {"id": "closeModal"} |
| SHARED-A061 | Cancelar | {"id": "cancelModal"} |
| SHARED-A062 | Confirmar | {"id": "confirmModal"} |
| SHARED-A063 | 2026 ▾ | {"id": "pickerYearToggle"} |
| SHARED-A064 | ↑ | {"id": "pickerPrevMonth", "title": "Mês anterior"} |
| SHARED-A065 | ↓ | {"id": "pickerNextMonth", "title": "Próximo mês"} |
| SHARED-A066 | Usar | {"id": "useDirectDate"} |
| SHARED-A067 | Limpar | {"id": "pickerClear"} |
| SHARED-A068 | Hoje | {"id": "pickerToday"} |
| SHARED-A069 | × | {"id": "v33DialogClose", "aria-label": "Fechar"} |
| SHARED-A070 | Cancelar | {"id": "v33DialogCancel"} |
| SHARED-A071 | Confirmar | {"id": "v33DialogConfirm"} |
| SHARED-A072 | × | {"id": "v34DialogClose", "aria-label": "Fechar"} |
| SHARED-A073 | Cancelar | {"id": "v34DialogCancel"} |
| SHARED-A074 | Confirmar | {"id": "v34DialogConfirm"} |

### Tabelas / colunas

- Sem ID: Plano / versão; Preço contratado; Fonte do status; Override de acesso; Ações
- Sem ID: Fatura; Competência; Valor; Status
- Sem ID: Recurso; Uso; Limite contratado
- Sem ID: Quando; Ação Master; Resultado
- Sem ID: Data; Lançamento; Competência; Qtd.; Valor unit.; Débito; Crédito; Saldo

### Regras e notas declaradas

- Assinatura em atraso. Este cliente está no período de tolerância até 12/09/2026. O acesso permanece disponível neste estágio; após a tolerância, gravações financeiras serão bloqueadas até regularização, mantendo consulta e exportação.
- Termos: a produção armazenará versão, hash e data de aceite. Os documentos jurídicos ainda estão em rascunho nesta fase.
- A sessão exige motivo, expira e não concede escrita financeira.
- Regra: exportação privada, retenção explícita e exclusão somente conforme política/contrato/LGPD. Nada é removido silenciosamente por inadimplência.
- Extrato detalhado: cada linha mostra competência, quantidade, valor unitário, débito, crédito e saldo acumulado.

## Fragmentos dinâmicos e versões históricas

DYN identifica um fragmento literal/template/concatenação localizado no AST, não uma janela única. Há fragmentos internos de linhas/opções e módulos sobrescritos por versões posteriores. Preservar a capacidade planejada; reconciliar a apresentação final sem transportar listeners duplicados ou cálculos demonstrativos para produção.

## DYN-001 — templates / payment / Registrar pagamento / body

Fonte: linha 4555 · `DYN-001`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-001-F001 | Integrante | select {} | Carlos de Carvalho [None]; João Martins [None]; Pedro Henrique [None]; Marcos Vieira [None] |
| DYN-001-F002 | Valor | input {"value": "R$ 1.000,00"} | — |
| DYN-001-F003 | Data | input {"type": "date", "value": "2026-09-04"} | — |
| DYN-001-F004 | Forma | select {} | PIX [None]; Dinheiro [None]; Transferência [None] |
| DYN-001-F005 | Conta | select {} | Conta Bancária Principal [None]; Conta PIX [None]; Caixa [None] |
| DYN-001-F006 | Alocação | select {} | FIFO — débitos mais antigos [None]; Escolher manualmente [None]; Deixar como crédito disponível [None] |

## DYN-002 — templates / charge / Criar cobrança / body

Fonte: linha 4567 · `DYN-002`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-002-F001 | Integrante(s) | select {} | Todos os integrantes ativos [None]; Carlos de Carvalho [None]; João Martins [None]; Pedro Henrique [None]; Marcos Vieira [None] |
| DYN-002-F002 | Categoria | select {} | Joia de Iniciação [None]; Obra [None]; Reforma [None]; Taxa extraordinária [None]; Outros [None] |
| DYN-002-F003 | Valor total | input {"value": "R$ 300,00"} | — |
| DYN-002-F004 | Competência | input {"value": "09/2026"} | — |
| DYN-002-F005 | Parcelado? | select {"id": "chargeInstallment"} | Não [no]; Sim [yes] |
| DYN-002-F006 | Quantidade de parcelas | input {"type": "number", "min": "2", "value": "3"} | — |
| DYN-002-F007 | Primeiro vencimento | input {"type": "date", "value": "2026-09-10"} | — |
| DYN-002-F008 | Descrição | input {"placeholder": "Descrição do lançamento"} | — |

### Regras e notas declaradas

- Em lote: ao selecionar “Todos os integrantes ativos”, o sistema mostrará uma prévia com quantidade, valor total e eventuais exceções antes da confirmação.

## DYN-003 — templates / event / Novo Ágape / body

Fonte: linha 4582 · `DYN-003`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-003-F001 | Data | input {"type": "date", "value": "2026-09-04"} | — |
| DYN-003-F002 | Valor padrão | input {"value": "R$ 30,00"} | — |
| DYN-003-F003 | Carlos de Carvalho | input {"type": "checkbox", "checked": ""} | — |
| DYN-003-F004 | João Martins | input {"type": "checkbox", "checked": ""} | — |
| DYN-003-F005 | Pedro Henrique | input {"type": "checkbox", "checked": ""} | — |
| DYN-003-F006 | Marcos Vieira | input {"type": "checkbox"} | — |

## DYN-004 — templates / monthly / Gerar mensalidades / body

Fonte: linha 4598 · `DYN-004`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-004-F001 | Competência | select {} | Janeiro/2026 [2026-01]; Fevereiro/2026 [2026-02]; Março/2026 [2026-03]; Abril/2026 [2026-04]; Maio/2026 [2026-05]; Junho/2026 [2026-06]; Julho/2026 [2026-07]; Agosto/2026 [2026-08]; Setembro/2026 [2026-09]; Outubro/2026 [2026-10]; Novembro/2026 [2026-11]; Dezembro/2026 [2026-12]; Janeiro/2027 [2027-01]; Fevereiro/2027 [2027-02]; Março/2027 [2027-03]; Abril/2027 [2027-04]; Maio/2027 [2027-05]; Junho/2027 [2027-06] |
| DYN-004-F002 | Valor geral vigente | input {"value": "R$ 150,00", "disabled": ""} | — |
| DYN-004-F003 | Grupo | select {} | Todos os integrantes ativos [None]; Selecionar integrantes [None] |

### Regras e notas declaradas

- Prévia: o sistema aplicará automaticamente isenções e valores individuais antes de gerar o lote.

## DYN-005 — templates / negotiation / Negociar dívida / body

Fonte: linha 4608 · `DYN-005`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-005-F001 | Integrante | select {"id": "negotiationMember"} | Carlos de Carvalho [Carlos de Carvalho]; Pedro Henrique [Pedro Henrique]; Marcos Vieira [Marcos Vieira]; João Martins [João Martins] |
| DYN-005-F002 | Saldo devedor atual | input {"id": "negotiationBalance", "value": "R$ 5.970,00", "disabled": ""} | — |
| DYN-005-F003 | Valor negociado | input {"id": "negotiatedAmount", "value": "R$ 5.970,00"} | — |
| DYN-005-F004 | Parcelado? | select {"id": "negotiationInstallment"} | Sim [yes]; Não [no] |
| DYN-005-F005 | Quantidade de parcelas | input {"id": "negotiationInstallmentQty", "type": "number", "min": "1", "value": "6"} | — |
| DYN-005-F006 | Primeiro vencimento | input {"type": "date", "value": "2026-09-10"} | — |
| DYN-005-F007 | Valor da parcela | input {"id": "negotiationInstallmentValue", "value": "R$ 995,00"} | — |
| DYN-005-F008 | Motivo / condições | input {"placeholder": "Ex.: acordo aprovado pela Tesouraria"} | — |

### Regras e notas declaradas

- Saldo dinâmico: ao trocar o integrante, o campo é atualizado com o saldo devedor daquele integrante.

## DYN-006 — templates / payable / Nova conta a pagar / body

Fonte: linha 4630 · `DYN-006`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-006-F001 | Buscar conta do Plano de Contas | input {"id": "payablePlanSearch", "autocomplete": "off", "placeholder": "Digite código ou parte da descrição. Ex.: energia, internet, 3.04", "aria-label": "Buscar conta do Plano de Contas", "aria-autocomplete": "list", "aria-expanded": "false"} | — |
| DYN-006-F002 | Tipo de conta | input {"type": "hidden", "id": "payablePlanAccount"} | — |
| DYN-006-F003 | Classificação | select {"id": "payableExpenseType", "disabled": ""} | Selecione uma conta []; Fixa [None]; Variável [None] |
| DYN-006-F004 | Valor | input {"value": "R$ 0,00"} | — |
| DYN-006-F005 | Competência | input {"value": "09/2026"} | — |
| DYN-006-F006 | Vencimento | input {"type": "date", "value": "2026-09-10"} | — |
| DYN-006-F007 | Parcelado? | select {} | Não [None]; Sim [None] |
| DYN-006-F008 | Conta financeira | select {} | Conta Bancária Principal [None]; Conta PIX [None]; Caixa [None] |
| DYN-006-F009 | Descrição / fornecedor | input {"placeholder": "Descrição da despesa"} | — |
| DYN-006-F010 | Aprovação | select {} | Automática conforme política [None]; Solicitar aprovação administrativa [None] |
| DYN-006-F011 | Comprovante / nota | input {"type": "file", "accept": ".pdf,image/*"} | — |

### Regras e notas declaradas

- Pesquise pelo código ou por qualquer parte da descrição. Fonte: Plano de Contas ativo.
- Preenchida automaticamente pelo Plano de Contas.

## DYN-007 — templates / receivable / Nova receita prevista / body

Fonte: linha 4672 · `DYN-007`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-007-F001 | Buscar conta do Plano de Contas | input {"id": "receivablePlanSearch", "autocomplete": "off", "placeholder": "Digite código ou parte da descrição. Ex.: capitação, placet, 1.03", "aria-label": "Buscar conta do Plano de Contas", "aria-autocomplete": "list", "aria-expanded": "false"} | — |
| DYN-007-F002 | Tipo de conta | input {"type": "hidden", "id": "receivablePlanAccount"} | — |
| DYN-007-F003 | Classificação | select {"id": "receivableEntryType", "disabled": ""} | Selecione uma conta []; Recorrente [None]; Avulsa [None] |
| DYN-007-F004 | Valor previsto | input {"value": "R$ 0,00"} | — |
| DYN-007-F005 | Competência | input {"value": "09/2026"} | — |
| DYN-007-F006 | Vencimento previsto | input {"type": "date", "value": "2026-09-20"} | — |
| DYN-007-F007 | Descrição | input {"placeholder": "Origem da receita prevista"} | — |

### Regras e notas declaradas

- Pesquise pelo código ou por qualquer parte da descrição. Fonte: Plano de Contas ativo.
- Preenchida automaticamente pelo Plano de Contas: Recorrente ou Avulsa.

## DYN-008 — templates / financialCategory / Cadastrar categoria financeira / body

Fonte: linha 4711 · `DYN-008`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-008-F001 | Nome | input {"placeholder": "Ex.: Mensalidade"} | — |
| DYN-008-F002 | Natureza | select {} | Receita / cobrança [None]; Despesa [None]; Neutra / repasse [None] |
| DYN-008-F003 | Status | select {} | Ativa [None]; Inativa [None] |
| DYN-008-F004 | Conta contábil DRE | select {} | Definir posteriormente [None]; 1.01.001 — Capitação dos Obreiros [None] |

## DYN-009 — templates / recurringRule / Cadastrar regra recorrente / body

Fonte: linha 4721 · `DYN-009`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-009-F001 | Descrição | input {"placeholder": "Ex.: Mensalidade padrão"} | — |
| DYN-009-F002 | Categoria | select {} | Mensalidade [None]; GLP [None]; Outra [None] |
| DYN-009-F003 | Valor | input {"value": "R$ 150,00"} | — |
| DYN-009-F004 | Vigência inicial | input {"type": "date", "value": "2026-01-01"} | — |
| DYN-009-F005 | Dia de vencimento | input {"type": "number", "min": "1", "max": "31", "value": "10"} | — |

## DYN-010 — templates / paymentMethod / Cadastrar forma de pagamento / body

Fonte: linha 4732 · `DYN-010`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-010-F001 | Descrição | input {"placeholder": "Ex.: PIX"} | — |
| DYN-010-F002 | Liquidação | select {} | Imediata [None]; Manual [None] |
| DYN-010-F003 | Status | select {} | Ativa [None]; Inativa [None] |

## DYN-011 — templates / financialAccount / Cadastrar conta financeira / body

Fonte: linha 4741 · `DYN-011`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-011-F001 | Nome | input {"placeholder": "Ex.: Conta Bancária Principal"} | — |
| DYN-011-F002 | Tipo | select {} | Conta bancária [None]; Caixa [None]; PIX [None] |
| DYN-011-F003 | Instituição | input {"placeholder": "Banco / instituição"} | — |
| DYN-011-F004 | Saldo inicial | input {"value": "R$ 0,00"} | — |
| DYN-011-F005 | Data do saldo inicial | input {"type": "date", "value": "2026-01-01"} | — |

## DYN-012 — templates / fund / Cadastrar fundo / body

Fonte: linha 4752 · `DYN-012`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-012-F001 | Nome do fundo | input {"placeholder": "Ex.: Fundo de Obras"} | — |
| DYN-012-F002 | Finalidade | input {"placeholder": "Objetivo do recurso"} | — |
| DYN-012-F003 | Status | select {} | Ativo [None]; Inativo [None] |

## DYN-013 — templates / role / Perfis e permissões / body

Fonte: linha 4761 · `DYN-013`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-013-F001 | Perfil | select {} | Administrador [None]; Tesoureiro [None]; Consulta [None]; Integrante [None] |
| DYN-013-F002 | Consultar financeiro | input {"type": "checkbox", "checked": ""} | — |
| DYN-013-F003 | Registrar pagamentos | input {"type": "checkbox", "checked": ""} | — |
| DYN-013-F004 | Reabrir período | input {"type": "checkbox"} | — |
| DYN-013-F005 | Administrar usuários | input {"type": "checkbox"} | — |

## DYN-014 — templates / cargo / Cadastrar tipo de cargo / body

Fonte: linha 4776 · `DYN-014`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-014-F001 | Nome do cargo | input {"placeholder": "Ex.: Hospitaleiro"} | — |
| DYN-014-F002 | Status | select {} | Ativo [None]; Inativo [None] |

### Regras e notas declaradas

- Uso: cargos cadastrados ficam disponíveis no cadastro do integrante.

## DYN-015 — templates / member / Cadastrar integrante / body

Fonte: linha 4785 · `DYN-015`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-015-F001 | Nome completo | input {"placeholder": "Nome completo"} | — |
| DYN-015-F002 | Nome preferencial | input {} | — |
| DYN-015-F003 | Situação | select {} | Ativo [None]; Afastado [None]; Inativo [None]; Desligado [None] |
| DYN-015-F004 | Cargo | select {"id": "memberCargo"} | Obreiro [None]; Venerável Mestre [None]; 1º Vigilante [None]; 2º Vigilante [None]; Orador [None]; Secretário [None]; Tesoureiro [None]; Mestre de Cerimônias [None] |
| DYN-015-F005 | WhatsApp | input {"placeholder": "(41) 99999-9999"} | — |
| DYN-015-F006 | E-mail | input {"placeholder": "email@exemplo.org"} | — |
| DYN-015-F007 | Isento de mensalidade? | select {"id": "memberExempt"} | Não [no]; Sim [yes] |
| DYN-015-F008 | Mensalidade individual | input {"value": "R$ 150,00"} | — |

### Regras e notas declaradas

- Regra: valor individual prevalece sobre a mensalidade geral vigente. Se o integrante estiver isento, nenhuma mensalidade será gerada enquanto a isenção estiver ativa.

## DYN-016 — renderYearList

Fonte: linha 4994 · `DYN-016`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-016-A001 | __EXPR_2__ | {"data-y": "__EXPR_1__"} |

## DYN-017 — renderMonthSelector

Fonte: linha 5003 · `DYN-017`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-017-A001 | __EXPR_2__ | {"data-m": "__EXPR_1__"} |

## DYN-018 — renderCalendar

Fonte: linha 5030 · `DYN-018`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-018-A001 | __EXPR_2__ | {"data-date": "__EXPR_1__"} |

## DYN-019 — renderCashFlowPanels

Fonte: linha 5484 · `DYN-019`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-020 — renderChartAccounts

Fonte: linha 5729 · `DYN-020`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-020-F001 | Código contábil | input {"value": "__EXPR_2__", "aria-label": "Código contábil"} | — |
| DYN-020-F002 | Descrição da conta | input {"value": "__EXPR_3__", "aria-label": "Descrição da conta"} | — |
| DYN-020-F003 | Usar conta | input {"type": "checkbox", "checked": "", "aria-label": "Usar conta"} | — |

## DYN-021 — inline

Fonte: linha 5764 · `DYN-021`.

**Áreas:** Tesouraria — Demonstrativo Financeiro

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Tabelas / colunas

- Sem ID: Data; Lançamento; Competência; Qtd.; Valor unit.; Débito; Crédito; Saldo

## DYN-022 — openSupport

Fonte: linha 6109 · `DYN-022`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-022-F001 | Motivo obrigatório | textarea {"id": "v32SupportReason", "placeholder": "Descreva o motivo do atendimento"} | — |
| DYN-022-F002 | Duração | select {"id": "v32SupportDuration"} | 30 minutos [30]; 60 minutos [60] |
| DYN-022-F003 | Escopo | input {"value": "Somente leitura", "disabled": ""} | — |

### Regras e notas declaradas

- A abertura será auditada. O suporte não recebe permissão de escrita financeira.

## DYN-023 — v32MasterClosureModule

Fonte: linha 6117 · `DYN-023`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-023-F001 | Nome da Loja | input {"id": "onboardName", "placeholder": "Loja ..."} | — |
| DYN-023-F002 | Número | input {"placeholder": "000"} | — |
| DYN-023-F003 | CNPJ | input {"placeholder": "00.000.000/0001-00"} | — |
| DYN-023-F004 | Plano / versão | select {} | Profissional v1 [None]; Essencial v1 [None] |
| DYN-023-F005 | Início | input {"type": "date", "value": "2026-09-09"} | — |
| DYN-023-F006 | Contato administrativo | input {"placeholder": "nome@cliente.com.br"} | — |

### Regras e notas declaradas

- A confirmação cria um run de onboarding; convite Auth e demais etapas terão estado persistido e retomável.

## DYN-024 — v32MasterClosureModule

Fonte: linha 6118 · `DYN-024`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-024-F001 | Cliente | select {} | Loja Aurora do Sul nº 101 [None]; Loja Fraternidade do Oriente nº 202 [None] |
| DYN-024-F002 | Competência | input {"type": "month", "value": "2026-10"} | — |
| DYN-024-F003 | Vencimento | input {"type": "date", "value": "2026-10-10"} | — |
| DYN-024-F004 | Valor | input {"value": "R$ 199,00"} | — |
| DYN-024-F005 | Descrição | input {"value": "Assinatura Corsys Tronco Digital"} | — |

## DYN-025 — v32MasterClosureModule

Fonte: linha 6119 · `DYN-025`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-025-F001 | Código | input {"placeholder": "novo_plano"} | — |
| DYN-025-F002 | Nome | input {"placeholder": "Novo Plano"} | — |
| DYN-025-F003 | Preço inicial | input {"value": "R$ 0,00"} | — |
| DYN-025-F004 | Vigência inicial | input {"type": "date"} | — |

## DYN-026 — v32MasterClosureModule

Fonte: linha 6120 · `DYN-026`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-026-F001 | E-mail | input {"type": "email", "placeholder": "usuario@corsys.com.br"} | — |
| DYN-026-F002 | Função | select {} | SUPPORT [None]; BILLING [None]; MASTER [None] |

### Regras e notas declaradas

- Convites e alterações de função serão auditados. Nenhum convite concede acesso a dados de tenant sem as regras correspondentes.

## DYN-027 — v32MasterClosureModule

Fonte: linha 6121 · `DYN-027`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-027-F001 | Nome comercial | input {"value": "Corsys Tronco Digital"} | — |
| DYN-027-F002 | Trial padrão (dias) | input {"type": "number", "value": "14"} | — |
| DYN-027-F003 | Tolerância padrão (dias) | input {"type": "number", "value": "7"} | — |
| DYN-027-F004 | Contato de suporte | input {"placeholder": "suporte@..."} | — |

## DYN-028 — v32MasterClosureModule

Fonte: linha 6123 · `DYN-028`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-028-F001 | Versão | input {"value": "v2", "disabled": ""} | — |
| DYN-028-F002 | Vigência inicial | input {"type": "date", "value": "2027-01-01"} | — |
| DYN-028-F003 | Preço | input {"value": "R$ 229,00"} | — |
| DYN-028-F004 | Limite de usuários | input {"type": "number", "value": "15"} | — |

### Regras e notas declaradas

- Clientes da v1 permanecem nela até uma migração contratual explícita.

## DYN-029 — v32MasterClosureModule

Fonte: linha 6124 · `DYN-029`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-029-F001 | Data | input {"id": "v32PayDate", "type": "date", "value": "2026-09-09"} | — |
| DYN-029-F002 | Valor recebido | input {"id": "v32PayAmount", "value": "__EXPR_0__"} | — |
| DYN-029-F003 | Forma | select {"id": "v32PayMethod"} | PIX [None]; Boleto [None]; Cartão [None]; Transferência [None] |
| DYN-029-F004 | Referência | input {"id": "v32PayRef", "placeholder": "Identificador opcional"} | — |

### Regras e notas declaradas

- Se o valor for menor que o saldo, a fatura ficará Parcial. Estorno/reversão serão eventos separados.

## DYN-030 — v32MasterClosureModule

Fonte: linha 6125 · `DYN-030`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-030-A001 | Enviar cobrança | {"data-v33-send-invoice": ""} |
| DYN-030-A002 | Simular atraso | {"data-v33-late-preview": ""} |
| DYN-030-A003 | Criar acordo | {"data-v33-agreement": ""} |
| DYN-030-A004 | Reverter alocação / estorno | {"data-demo-action": "reverse-payment"} |
| DYN-030-A005 | Anular fatura | {"data-demo-action": "void-invoice"} |

### Tabelas / colunas

- Sem ID: Cliente; Competência; Valor original; Pago; Saldo; Estado derivado

## DYN-031 — v32MasterClosureModule

Fonte: linha 6143 · `DYN-031`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Tabelas / colunas

- Sem ID: Plano; Status; Próximo vencimento; Financeiro da Loja

## DYN-032 — v32MasterClosureModule

Fonte: linha 6143 · `DYN-032`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Regras e notas declaradas

- Regularização: na aplicação real este botão abrirá o meio seguro de pagamento do provider escolhido.

## DYN-033 — openEditModal

Fonte: linha 6301 · `DYN-033`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-033-F001 | Descrição / fornecedor | input {"id": "editPayDescription", "value": "__EXPR_0__"} | — |
| DYN-033-F002 | Classificação | select {"id": "editPayClassification"} | Fixa [None]; Variável [None] |
| DYN-033-F003 | Valor | input {"id": "editPayValue", "value": "__EXPR_3__"} | — |
| DYN-033-F004 | Competência | input {"id": "editPayCompetence", "value": "__EXPR_4__"} | — |
| DYN-033-F005 | Vencimento | input {"id": "editPayDue", "type": "date", "value": "__EXPR_5__"} | — |
| DYN-033-F006 | Status | select {"id": "editPayStatus"} | Pendente [None]; Vencido [None]; Pago [None] |
| DYN-033-F007 | Conta financeira | input {"id": "editPayFinancialAccount", "value": "__EXPR_9__"} | — |

### Regras e notas declaradas

- Histórico preservado: lançamentos já liquidados não serão sobrescritos diretamente no banco definitivo; a alteração será registrada como correção/estorno vinculada ao lançamento original.

## DYN-034 — openEditModal

Fonte: linha 6327 · `DYN-034`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-034-F001 | Origem | input {"id": "editRecvOrigin", "value": "__EXPR_0__"} | — |
| DYN-034-F002 | Classificação | select {"id": "editRecvClassification"} | Recorrente [None]; Avulsa [None] |
| DYN-034-F003 | Descrição | input {"id": "editRecvDescription", "value": "__EXPR_3__"} | — |
| DYN-034-F004 | Valor previsto | input {"id": "editRecvValue", "value": "__EXPR_4__"} | — |
| DYN-034-F005 | Valor recebido | input {"id": "editRecvReceived", "value": "__EXPR_5__"} | — |
| DYN-034-F006 | Competência | input {"id": "editRecvCompetence", "value": "__EXPR_6__"} | — |
| DYN-034-F007 | Vencimento | input {"id": "editRecvDue", "type": "date", "value": "__EXPR_7__"} | — |
| DYN-034-F008 | Status | select {"id": "editRecvStatus"} | Pendente [None]; Parcial [None]; Recebido [None] |

### Regras e notas declaradas

- Histórico preservado: se já houver recebimento, o banco definitivo registrará correção vinculada ao fato original em vez de reescrever o histórico.

## DYN-035 — mountAccountSearch / renderResults

Fonte: linha 6798 · `DYN-035`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-036 — mountAccountSearch / renderResults

Fonte: linha 6805 · `DYN-036`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-036-A001 | __EXPRESSION____EXPRESSION____EXPRESSION__ | {"type": "button", "data-account-id": "__EXPRESSION__"} |

## DYN-037 — mountAccountSearch / renderResults

Fonte: linha 6805 · `DYN-037`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-038 — render

Fonte: linha 7416 · `DYN-038`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-038-F001 | Código da conta | input {"type": "text", "value": "__EXPRESSION__", "aria-label": "Código da conta"} | — |
| DYN-038-F002 | Descrição da conta | input {"type": "text", "value": "__EXPRESSION__", "aria-label": "Descrição da conta"} | — |
| DYN-038-F003 | Classificação operacional | select {"aria-label": "Classificação operacional"} | Não se aplica [Não se aplica] |
| DYN-038-F004 | __EXPRESSION__ | input {"type": "checkbox", "aria-label": "__EXPRESSION__"} | — |

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-038-A001 | Salvar | {"type": "button", "data-action": "save"} |
| DYN-038-A002 | __EXPRESSION__ | {"type": "button", "data-action": "toggle"} |
| DYN-038-A003 | Excluir | {"type": "button", "data-action": "delete"} |

## DYN-039 — render

Fonte: linha 7417 · `DYN-039`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-040 — render

Fonte: linha 7418 · `DYN-040`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-041 — render

Fonte: linha 7420 · `DYN-041`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-041-F001 | Sem rótulo explícito | select {} | — |

## DYN-042 — render

Fonte: linha 7431 · `DYN-042`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-042-F001 | Sem rótulo explícito | input {"type": "checkbox"} | — |

## DYN-043 — render

Fonte: linha 7433 · `DYN-043`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-044 — render

Fonte: linha 7434 · `DYN-044`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-044-A001 | Salvar | {"type": "button", "data-action": "save"} |

## DYN-045 — render

Fonte: linha 7435 · `DYN-045`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-045-A001 | Sem texto | {"type": "button", "data-action": "toggle"} |

## DYN-046 — render

Fonte: linha 7436 · `DYN-046`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-046-A001 | Excluir | {"type": "button", "data-action": "delete"} |

## DYN-047 — renderReport / metrics

Fonte: linha 7821 · `DYN-047`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-048 — renderReport / metrics

Fonte: linha 7821 · `DYN-048`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-049 — renderReport

Fonte: linha 7836 · `DYN-049`.

**Áreas:** __EXPRESSION__

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-049-A001 | Gerar PDF | {"type": "button", "data-report-export": "pdf"} |
| DYN-049-A002 | Exportar Excel | {"type": "button", "data-report-export": "excel"} |

### Tabelas / colunas

- Sem ID: 

## DYN-050 — renderReport

Fonte: linha 7836 · `DYN-050`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-051 — renderReport

Fonte: linha 7837 · `DYN-051`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-052 — renderReport

Fonte: linha 7838 · `DYN-052`.

**Áreas:** 

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-053 — renderReport

Fonte: linha 7840 · `DYN-053`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-054 — renderReport

Fonte: linha 7842 · `DYN-054`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-055 — renderReport

Fonte: linha 7843 · `DYN-055`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-055-A001 | Gerar PDF | {"type": "button", "data-report-export": "pdf"} |

## DYN-056 — renderReport

Fonte: linha 7844 · `DYN-056`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-056-A001 | Exportar Excel | {"type": "button", "data-report-export": "excel"} |

## DYN-057 — renderReport

Fonte: linha 7847 · `DYN-057`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-058 — renderReport

Fonte: linha 7848 · `DYN-058`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Tabelas / colunas

- Sem ID: 

## DYN-059 — v33MasterOperationalModule

Fonte: linha 8013 · `DYN-059`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-059-A001 | Abrir onboarding completo nesta etapa | {"data-v33-open-full-onboarding": ""} |

### Regras e notas declaradas

- __EXPR_0____EXPR_1__

## DYN-060 — v33MasterOperationalModule

Fonte: linha 8033 · `DYN-060`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-060-F001 | Execução | select {} | Automática [None]; Manual assistida [None] |
| DYN-060-F002 | Antecedência da geração | input {"type": "number", "value": "5"} | — |
| DYN-060-F003 | Dia de vencimento padrão | input {"type": "number", "value": "10"} | — |
| DYN-060-F004 | Retry máximo | input {"type": "number", "value": "5"} | — |

## DYN-061 — v33MasterOperationalModule

Fonte: linha 8040 · `DYN-061`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Regras e notas declaradas

- Estado: provider ainda não escolhido. Na integração real validaremos PIX, boleto, cartão, assinatura de webhook, retry, estorno, sandbox, taxas e operação no Brasil.

## DYN-062 — openBillingPolicy

Fonte: linha 8046 · `DYN-062`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-062-F001 | Multa de mora (%) | input {"id": "v33Fine", "inputmode": "decimal", "value": "__EXPR_0__"} | — |
| DYN-062-F002 | Juros simples ao mês (%) | input {"id": "v33Interest", "inputmode": "decimal", "value": "__EXPR_1__"} | — |
| DYN-062-F003 | Tolerância após vencimento (dias) | input {"id": "v33Grace", "type": "number", "min": "0", "value": "__EXPR_2__"} | — |
| DYN-062-F004 | Suspensão automática | select {"id": "v33AutoSuspend"} | Ativada [yes]; Desativada [no] |
| DYN-062-F005 | Quando suspender | select {"id": "v33SuspendWhen"} | Após terminar a tolerância [after_grace]; Somente manual [manual] |
| DYN-062-F006 | Modo de suspensão | select {"id": "v33SuspendMode"} | Bloquear novas gravações; manter leitura/exportação [block_writes]; Bloqueio total somente por decisão excepcional [full] |
| DYN-062-F007 | Acordos comerciais | select {"id": "v33Agreements"} | Permitidos [yes]; Desativados [no] |
| DYN-062-F008 | Capitalização | input {"value": "Juros simples (padrão demonstrativo)", "disabled": ""} | — |
| DYN-062-F009 | Referência contratual / observação | textarea {"placeholder": "Cláusula contratual, política aprovada ou orientação jurídica"} | — |

### Regras e notas declaradas

- A cobrança definitiva deve aplicar a política vigente da assinatura e registrar snapshot dos encargos. Alterar a política futura não reescreve faturas vencidas.

## DYN-063 — createPlanCard

Fonte: linha 8070 · `DYN-063`.

**Áreas:** __EXPR_0__

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-063-A001 | Editar rascunho | {"data-v33-edit-draft-plan": ""} |

### Regras e notas declaradas

- Rascunho ainda não afeta nenhum cliente.

## DYN-064 — v33MasterOperationalModule

Fonte: linha 8084 · `DYN-064`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-064-F001 | Nome do plano | input {"id": "v33PlanName", "placeholder": "Ex.: Corporativo"} | — |
| DYN-064-F002 | Código interno | input {"id": "v33PlanCode", "placeholder": "corporativo"} | — |
| DYN-064-F003 | Preço inicial | input {"id": "v33PlanPrice", "value": "R$ 0,00"} | — |
| DYN-064-F004 | Vigência inicial | input {"id": "v33PlanStart", "type": "date", "value": "2026-10-01"} | — |
| DYN-064-F005 | Limite de usuários | input {"type": "number", "value": "10"} | — |
| DYN-064-F006 | Estado | input {"value": "Rascunho", "disabled": ""} | — |

## DYN-065 — v33MasterOperationalModule

Fonte: linha 8103 · `DYN-065`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-065-F001 | Plano | input {"value": "__EXPR_0__", "disabled": ""} | — |
| DYN-065-F002 | Nova versão | input {"value": "v2", "disabled": ""} | — |
| DYN-065-F003 | Novo preço | input {"id": "v33VersionPrice", "value": "R$ __EXPR_1__"} | — |
| DYN-065-F004 | Vigência inicial | input {"id": "v33VersionStart", "type": "date", "value": "2027-01-01"} | — |
| DYN-065-F005 | Limite de usuários | input {"id": "v33VersionUsers", "type": "number", "value": "15"} | — |
| DYN-065-F006 | Publicação | select {"id": "v33VersionPublish"} | Salvar rascunho [draft]; Publicar para novas contratações [published] |

### Regras e notas declaradas

- Clientes vinculados à v1 permanecem na v1. Migrar um cliente para v2 é uma ação contratual separada e pode ser agendada.

## DYN-066 — v33MasterOperationalModule

Fonte: linha 8121 · `DYN-066`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-066-F001 | Nome | input {"id": "v33DraftName", "value": "__EXPR_0__"} | — |
| DYN-066-F002 | Preço | input {"id": "v33DraftPrice", "value": "__EXPR_1__"} | — |
| DYN-066-F003 | Limite de usuários | input {"type": "number", "value": "10"} | — |

## DYN-067 — v33MasterOperationalModule

Fonte: linha 8130 · `DYN-067`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-067-F001 | Nome | input {"id": "v33PromoName", "placeholder": "Ex.: Lançamento 2027"} | — |
| DYN-067-F002 | Código promocional | input {"id": "v33PromoCode", "placeholder": "LANCAMENTO27"} | — |
| DYN-067-F003 | Tipo | select {"id": "v33PromoType"} | Percentual [percent]; Valor fixo [fixed]; Preço promocional / trial pago [trial] |
| DYN-067-F004 | Valor | input {"id": "v33PromoValue", "value": "20"} | — |
| DYN-067-F005 | Duração | select {"id": "v33PromoDuration"} | Uma cobrança [once]; N ciclos [cycles]; Até uma data [date_range] |
| DYN-067-F006 | Número de ciclos | input {"id": "v33PromoCycles", "type": "number", "value": "3"} | — |
| DYN-067-F007 | Plano elegível | select {} | Todos [None]; Essencial [None]; Profissional [None]; Premium [None] |
| DYN-067-F008 | Público | select {} | Novos clientes [None]; Clientes selecionados [None]; Todos elegíveis [None] |
| DYN-067-F009 | Limite de resgates | input {"type": "number", "value": "100"} | — |
| DYN-067-F010 | Cumulativa | select {} | Não [None]; Sim, somente com regras compatíveis [None] |
| DYN-067-F011 | Início | input {"type": "date", "value": "2026-10-01"} | — |
| DYN-067-F012 | Fim | input {"type": "date", "value": "2026-12-31"} | — |

## DYN-068 — v33MasterOperationalModule

Fonte: linha 8154 · `DYN-068`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-068-F001 | Plano / versão destino | select {"id": "v33ClientPlan"} | Profissional v2 [None]; Essencial v1 [None]; Premium v1 [None] |
| DYN-068-F002 | Data efetiva | input {"id": "v33ClientPlanDate", "type": "date", "value": "2027-01-01"} | — |
| DYN-068-F003 | Pró-rata | select {} | Não aplicar; próxima competência [None]; Aplicar ajuste proporcional [None] |
| DYN-068-F004 | Motivo | input {"id": "v33ClientPlanReason", "placeholder": "Renovação / upgrade / renegociação"} | — |

## DYN-069 — v33MasterOperationalModule

Fonte: linha 8168 · `DYN-069`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-069-F001 | Ação | select {"id": "v33LifecycleAction"} | Suspender manualmente [suspend]; Reativar acesso [reactivate]; Agendar cancelamento [schedule_cancel]; Cancelar agora [cancel_now] |
| DYN-069-F002 | Data efetiva | input {"id": "v33LifecycleDate", "type": "date", "value": "2026-09-15"} | — |
| DYN-069-F003 | Após suspensão | select {} | Bloquear escrita; manter leitura/exportação [None]; Bloqueio total excepcional [None] |
| DYN-069-F004 | Motivo obrigatório | textarea {"id": "v33LifecycleReason", "placeholder": "Informe o motivo"} | — |

## DYN-070 — v33MasterOperationalModule

Fonte: linha 8189 · `DYN-070`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-070-F001 | Escopo | select {} | Todos os dados exportáveis da Loja [None]; Financeiro [None]; Cadastros [None] |
| DYN-070-F002 | Formato | select {} | ZIP estruturado [None]; CSV/JSON [None] |
| DYN-070-F003 | Motivo | input {"placeholder": "Solicitação do cliente / encerramento"} | — |

## DYN-071 — v33MasterOperationalModule

Fonte: linha 8190 · `DYN-071`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-071-F001 | Data de cancelamento | input {"id": "v33CancelDate", "type": "date", "value": "2026-10-01"} | — |
| DYN-071-F002 | Faturar até | select {} | Fim do período contratado [None]; Data efetiva [None] |
| DYN-071-F003 | Motivo | textarea {} | — |

## DYN-072 — v33MasterOperationalModule

Fonte: linha 8191 · `DYN-072`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-072-F001 | Retenção operacional (dias) | input {"id": "v33RetentionDays", "type": "number", "value": "90"} | — |
| DYN-072-F002 | Após o prazo | select {} | Avaliar elegibilidade para exclusão [None]; Legal hold / preservar [None] |
| DYN-072-F003 | Base/justificativa | textarea {} | — |

## DYN-073 — v33MasterOperationalModule

Fonte: linha 8223 · `DYN-073`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-073-F001 | Valor máximo | input {"value": "__EXPR_0__", "disabled": ""} | — |
| DYN-073-F002 | Valor a reverter | input {"id": "v33ReverseAmount", "value": "__EXPR_1__"} | — |
| DYN-073-F003 | Motivo obrigatório | textarea {"id": "v33ReverseReason"} | — |

## DYN-074 — v33MasterOperationalModule

Fonte: linha 8236 · `DYN-074`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-074-F001 | Motivo obrigatório | textarea {"id": "v33VoidReason"} | — |

## DYN-075 — v33MasterOperationalModule

Fonte: linha 8253 · `DYN-075`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Tabelas / colunas

- Sem ID: Saldo base; Dias em atraso (demo); Multa configurada; Juros simples configurados; Total demonstrativo

### Regras e notas declaradas

- Não é parecer jurídico nem regra legal universal. O sistema definitivo aplicará apenas a política contratual validada para o cliente/período.

## DYN-076 — v33MasterOperationalModule

Fonte: linha 8274 · `DYN-076`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-076-F001 | Saldo atual | input {"value": "__EXPR_0__", "disabled": ""} | — |
| DYN-076-F002 | Valor negociado | input {"id": "v33AgreementValue", "value": "__EXPR_1__"} | — |
| DYN-076-F003 | Entrada | input {"id": "v33AgreementDown", "value": "R$ 0,00"} | — |
| DYN-076-F004 | Parcelas | input {"id": "v33AgreementInstallments", "type": "number", "min": "1", "value": "3"} | — |
| DYN-076-F005 | Primeiro vencimento | input {"id": "v33AgreementFirstDue", "type": "date", "value": "2026-10-10"} | — |
| DYN-076-F006 | Encargos vencidos | select {"id": "v33AgreementCharges"} | Manter conforme política [None]; Conceder desconto explícito [None]; Remover somente mediante autorização [None] |
| DYN-076-F007 | Justificativa / condições | textarea {} | — |

## DYN-077 — rebuildTicketButtons

Fonte: linha 8297 · `DYN-077`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-077-A001 | Abrir / responder | {"data-v33-ticket-open": ""} |

## DYN-078 — rebuildTicketButtons

Fonte: linha 8299 · `DYN-078`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-078-A001 | Reabrir | {"data-v33-ticket-reopen": ""} |

## DYN-079 — rebuildTicketButtons

Fonte: linha 8301 · `DYN-079`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-079-A001 | Voltar | {"data-v33-ticket-prev": ""} |

## DYN-080 — rebuildTicketButtons

Fonte: linha 8302 · `DYN-080`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-080-A001 | Avançar | {"data-v33-ticket-next": ""} |

## DYN-081 — messages

Fonte: linha 8332 · `DYN-081`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-082 — v33MasterOperationalModule

Fonte: linha 8335 · `DYN-082`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-082-F001 | Responder ao cliente | textarea {"id": "v33TicketReply", "placeholder": "Digite a resposta"} | — |
| DYN-082-F002 | Após responder | select {"id": "v33TicketAfterReply"} | Mover para Aguardando cliente [waiting_client]; Manter Em atendimento [working]; Marcar Resolvido [resolved] |

## DYN-083 — v33MasterOperationalModule

Fonte: linha 8335 · `DYN-083`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-084 — v33MasterOperationalModule

Fonte: linha 8346 · `DYN-084`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-084-F001 | Categoria | select {} | Financeiro [None]; Relatórios [None]; Acesso [None]; Configuração [None]; Outro [None] |
| DYN-084-F002 | Prioridade | select {"id": "v33TicketPriority"} | Média [medium]; Baixa [low]; Alta [high] |
| DYN-084-F003 | Assunto | input {"id": "v33TicketSubject", "placeholder": "Descreva resumidamente"} | — |
| DYN-084-F004 | Descrição | textarea {"id": "v33TicketDescription"} | — |

## DYN-085 — v33MasterOperationalModule

Fonte: linha 8359 · `DYN-085`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Tabelas / colunas

- Sem ID: Chamado; Assunto; Status; Última atualização

## DYN-086 — platformSettingsBody

Fonte: linha 8364 · `DYN-086`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-086-F001 | Nome comercial | input {"id": "v33PlatformTradeName", "value": "Corsys Tronco Digital"} | — |
| DYN-086-F002 | Razão social | input {"placeholder": "A definir"} | — |
| DYN-086-F003 | CNPJ | input {"placeholder": "00.000.000/0001-00"} | — |
| DYN-086-F004 | CEP | input {"placeholder": "00000-000"} | — |
| DYN-086-F005 | Endereço | input {"placeholder": "Rua, número, complemento"} | — |
| DYN-086-F006 | Cidade | input {"placeholder": "Cidade"} | — |
| DYN-086-F007 | UF | input {"maxlength": "2", "placeholder": "PR"} | — |
| DYN-086-F008 | Contato financeiro | input {"type": "email", "placeholder": "financeiro@corsys..."} | — |
| DYN-086-F009 | Contato de suporte | input {"type": "email", "placeholder": "suporte@corsys..."} | — |
| DYN-086-F010 | WhatsApp de suporte | input {"placeholder": "+55 ..."} | — |
| DYN-086-F011 | Trial padrão (dias) | input {"id": "v33PlatformTrial", "type": "number", "value": "14"} | — |
| DYN-086-F012 | Tolerância padrão (dias) | input {"id": "v33PlatformGrace", "type": "number", "value": "__EXPR_0__"} | — |
| DYN-086-F013 | Retenção pós-cancelamento (dias) | input {"type": "number", "value": "90"} | — |
| DYN-086-F014 | Multa padrão (%) | input {"value": "__EXPR_1__"} | — |
| DYN-086-F015 | Juros padrão ao mês (%) | input {"value": "__EXPR_2__"} | — |
| DYN-086-F016 | Suspensão automática | select {} | Após tolerância [None]; Desativada [None] |
| DYN-086-F017 | Prefixo das faturas | input {"value": "CORSYS"} | — |
| DYN-086-F018 | Dia de vencimento padrão | input {"type": "number", "value": "10"} | — |
| DYN-086-F019 | Canal primário de cobrança | select {} | E-mail [None]; WhatsApp [None]; E-mail + WhatsApp [None] |
| DYN-086-F020 | Termos vigentes | select {} | Termos v1 — publicados [None] |
| DYN-086-F021 | Privacidade vigente | select {} | Privacidade v1 — publicada [None] |
| DYN-086-F022 | Provider de cobrança | input {"value": "Não escolhido", "disabled": ""} | — |
| DYN-086-F023 | E-mail transacional | input {"value": "Não integrado", "disabled": ""} | — |
| DYN-086-F024 | NFS-e / fiscal | input {"value": "Pendente de definição", "disabled": ""} | — |

### Regras e notas declaradas

- Secrets, tokens e chaves não são exibidos nem armazenados nesta tela. Integrações mostram somente configuração não sensível e estado.

## DYN-087 — v33MasterOperationalModule

Fonte: linha 8451 · `DYN-087`.

**Áreas:** __EXPR_0__

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-088 — v33MasterOperationalModule

Fonte: linha 8493 · `DYN-088`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-089 — v33MasterOperationalModule

Fonte: linha 8509 · `DYN-089`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-089-A001 | Abrir / responder | {"data-v33-ticket-open": ""} |
| DYN-089-A002 | Avançar | {"data-v33-ticket-next": ""} |

## DYN-090 — renderPlans

Fonte: linha 8651 · `DYN-090`.

**Áreas:** __EXPR_0__

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-090-A001 | __EXPR_10__ | {"data-v35-toggle-plan": "__EXPR_9__"} |
| DYN-090-A002 | Excluir plano | {"data-v35-delete-plan": "__EXPR_11__"} |

### Regras e notas declaradas

- __EXPR_13__

## DYN-091 — renderPlans

Fonte: linha 8657 · `DYN-091`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-091-A001 | Editar rascunho | {"data-v34-edit-plan": "__EXPR_0__", "data-v": "__EXPR_1__"} |
| DYN-091-A002 | Publicar | {"data-v34-publish-plan": "__EXPR_2__", "data-v": "__EXPR_3__"} |

## DYN-092 — renderPlans

Fonte: linha 8658 · `DYN-092`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-092-A001 | Alterar preço / recursos (nova versão) | {"data-v34-new-version": "__EXPR_0__"} |

## DYN-093 — renderPlans

Fonte: linha 8663 · `DYN-093`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-094 — renderPlans

Fonte: linha 8673 · `DYN-094`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-095 — renderPlans

Fonte: linha 8673 · `DYN-095`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-095-A001 | Editar | {"data-v34-edit-plan": "__EXPR_0__", "data-v": "__EXPR_1__"} |
| DYN-095-A002 | Publicar | {"data-v34-publish-plan": "__EXPR_2__", "data-v": "__EXPR_3__"} |

## DYN-096 — renderPlans

Fonte: linha 8673 · `DYN-096`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-096-A001 | Criar sucessora | {"data-v34-new-version": "__EXPR_0__"} |

## DYN-097 — planEditorBody

Fonte: linha 8702 · `DYN-097`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-097-F001 | Nome do plano | input {"id": "v34PlanName", "value": "__EXPR_0__"} | — |
| DYN-097-F002 | Código interno | input {"id": "v34PlanCode", "value": "__EXPR_1__"} | — |
| DYN-097-F003 | Preço | input {"id": "v34PlanPrice", "value": "__EXPR_2__"} | — |
| DYN-097-F004 | Cobrança | select {"id": "v34PlanBilling"} | Mensal [monthly]; Anual [yearly] |
| DYN-097-F005 | Trial (dias) | input {"id": "v34PlanTrial", "type": "number", "min": "0", "value": "__EXPR_5__"} | — |
| DYN-097-F006 | Tolerância (dias) | input {"id": "v34PlanGrace", "type": "number", "min": "0", "value": "__EXPR_6__"} | — |
| DYN-097-F007 | Limite de usuários | input {"id": "v34PlanUsers", "type": "number", "min": "1", "value": "__EXPR_7__"} | — |
| DYN-097-F008 | Vigência inicial | input {"id": "v34PlanValidFrom", "type": "date", "value": "__EXPR_8__"} | — |
| DYN-097-F009 | Recursos / entitlements (um por linha) | textarea {"id": "v34PlanFeatures"} |  · texto inicial: __EXPR_9__ |

### Regras e notas declaradas

- __EXPR_10__

## DYN-098 — publish-plan / body

Fonte: linha 8769 · `DYN-098`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-099 — plan-state / body

Fonte: linha 8788 · `DYN-099`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-099-F001 | Motivo | textarea {"id": "v35PlanStateReason", "placeholder": "Informe o motivo"} | — |

## DYN-100 — plan-delete / body

Fonte: linha 8798 · `DYN-100`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-100-F001 | Digite EXCLUIR para confirmar | input {"id": "v35DeletePlanConfirm"} | — |

## DYN-101 — renderPromos

Fonte: linha 8828 · `DYN-101`.

**Áreas:** __EXPR_0__

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-101-A001 | Editar promoção | {"data-v34-edit-promo": "__EXPR_10__"} |
| DYN-101-A002 | __EXPR_13__ | {"data-v35-toggle-promo": "__EXPR_12__"} |
| DYN-101-A003 | Excluir | {"data-v35-delete-promo": "__EXPR_14__"} |

## DYN-102 — renderPromos

Fonte: linha 8834 · `DYN-102`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-102-A001 | Publicar | {"data-v34-publish-promo": "__EXPR_0__"} |

## DYN-103 — renderPromos

Fonte: linha 8838 · `DYN-103`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-104 — promoEditorBody

Fonte: linha 8844 · `DYN-104`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-104-F001 | Nome | input {"id": "v34PromoName", "value": "__EXPR_1__"} | — |
| DYN-104-F002 | Código | input {"id": "v34PromoCode", "value": "__EXPR_2__"} | — |
| DYN-104-F003 | Tipo | select {"id": "v34PromoType"} | Percentual [percent]; Valor fixo [fixed]; Preço promocional [trial_price] |
| DYN-104-F004 | Benefício | input {"id": "v34PromoValue", "value": "__EXPR_6__"} | — |
| DYN-104-F005 | Duração | select {"id": "v34PromoDuration"} | Uma cobrança [once]; N ciclos [cycles]; Por período [date_range] |
| DYN-104-F006 | Ciclos | input {"id": "v34PromoCycles", "type": "number", "min": "1", "value": "__EXPR_10__"} | — |
| DYN-104-F007 | Plano elegível | select {"id": "v34PromoPlan"} | Todos [None] |
| DYN-104-F008 | Público | select {"id": "v34PromoAudience"} | Novos clientes [new_customers]; Clientes selecionados [selected_customers]; Todos elegíveis [all_eligible] |
| DYN-104-F009 | Limite de resgates | input {"id": "v34PromoMax", "type": "number", "min": "1", "value": "__EXPR_15__"} | — |
| DYN-104-F010 | Cumulativa | select {"id": "v34PromoStack"} | Não [no]; Sim [yes] |
| DYN-104-F011 | Início | input {"id": "v34PromoStart", "type": "date", "value": "__EXPR_18__"} | — |
| DYN-104-F012 | Fim | input {"id": "v34PromoEnd", "type": "date", "value": "__EXPR_19__"} | — |

## DYN-105 — promoEditorBody

Fonte: linha 8844 · `DYN-105`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-106 — publish-promo / body

Fonte: linha 8884 · `DYN-106`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-107 — promo-state / body

Fonte: linha 8893 · `DYN-107`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-107-F001 | Motivo | textarea {"id": "v35PromoStateReason"} | — |

## DYN-108 — promo-delete / body

Fonte: linha 8903 · `DYN-108`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-108-F001 | Digite EXCLUIR para confirmar | input {"id": "v35DeletePromoConfirm"} | — |

## DYN-109 — wizardBody / progress

Fonte: linha 8924 · `DYN-109`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-110 — wizardBody / progress

Fonte: linha 8924 · `DYN-110`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-110-A001 | __EXPR_2__. __EXPR_3__ | {"type": "button", "data-v34-wizard-jump": "__EXPR_0__"} |

## DYN-111 — wizardBody

Fonte: linha 8926 · `DYN-111`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-111-F001 | Nome da Loja / cliente | input {"id": "obName", "value": "__EXPR_0__", "placeholder": "Loja ..."} | — |
| DYN-111-F002 | Número | input {"id": "obNumber", "value": "__EXPR_1__", "placeholder": "000"} | — |
| DYN-111-F003 | CNPJ | input {"id": "obTax", "value": "__EXPR_2__", "placeholder": "00.000.000/0001-00"} | — |
| DYN-111-F004 | Cidade | input {"id": "obCity", "value": "__EXPR_3__"} | — |
| DYN-111-F005 | UF | input {"id": "obState", "maxlength": "2", "value": "__EXPR_4__"} | — |
| DYN-111-F006 | Telefone | input {"id": "obPhone", "value": "__EXPR_5__"} | — |
| DYN-111-F007 | Responsável | input {"id": "obAdminName", "value": "__EXPR_6__"} | — |
| DYN-111-F008 | Contato administrativo | input {"id": "obAdminEmail", "type": "email", "value": "__EXPR_7__"} | — |
| DYN-111-F009 | Contato financeiro | input {"id": "obBillingEmail", "type": "email", "value": "__EXPR_8__"} | — |

## DYN-112 — wizardBody

Fonte: linha 8937 · `DYN-112`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-112-F001 | Plano / versão publicada | select {"id": "obPlan"} | Selecione... [] |
| DYN-112-F002 | Preço contratado | input {"id": "obContractPrice", "value": "__EXPR_1__", "placeholder": "Preenchido pelo plano; pode haver negociação explícita"} | — |
| DYN-112-F003 | Início da assinatura | input {"id": "obStart", "type": "date", "value": "__EXPR_2__"} | — |
| DYN-112-F004 | Trial (dias) | input {"id": "obTrial", "type": "number", "min": "0", "value": "__EXPR_3__"} | — |

### Regras e notas declaradas

- Todos os planos publicados aparecem aqui. Planos em rascunho só entram após publicação. Preço contratual fica histórico e não muda silenciosamente.

## DYN-113 — wizardBody

Fonte: linha 8944 · `DYN-113`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-113-F001 | Slug do tenant | input {"id": "obSlug", "value": "__EXPR_0__", "placeholder": "gerado-do-nome"} | — |
| DYN-113-F002 | Role inicial | select {"id": "obRole"} | Administrador [ADMIN]; Tesoureiro [TREASURER] |
| DYN-113-F003 | Isolamento | input {"value": "organization_id + RLS + autorização server-side", "disabled": ""} | — |

### Regras e notas declaradas

- O tenant e as roles serão provisionados de forma transacional/idempotente. Nenhum cliente compartilha layout autenticado, rotas Master ou dados com outro tenant.

## DYN-114 — wizardBody

Fonte: linha 8950 · `DYN-114`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-114-F001 | Plano contábil inicial | select {"id": "obAccounting"} | Plano padrão Corsys — 91 contas [default]; Iniciar vazio [blank] |
| DYN-114-F002 | Vigência | input {"value": "__EXPR_2__", "disabled": ""} | — |
| DYN-114-F003 | Estado inicial | input {"value": "Rascunho para revisão da Loja", "disabled": ""} | — |

### Regras e notas declaradas

- O Plano de Contas da Loja continua isolado do catálogo SaaS. Publicação contábil segue suas próprias regras de vigência.

## DYN-115 — wizardBody

Fonte: linha 8958 · `DYN-115`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-115-F001 | E-mail do convite inicial | input {"id": "obInvite", "type": "email", "value": "__EXPR_0__"} | — |
| DYN-115-F002 | Registrar aceite dos Termos/Privacidade no fluxo de ativação | input {"id": "obTerms", "type": "checkbox"} | — |

## DYN-116 — wizardBody

Fonte: linha 8970 · `DYN-116`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-116-A001 | ← Voltar | {"type": "button", "data-v34-wizard-prev": ""} |
| DYN-116-A002 | __EXPR_1__ | {"type": "button", "data-v34-wizard-next": ""} |

## DYN-117 — wizardBody

Fonte: linha 8970 · `DYN-117`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-117-A001 | ← Voltar | {"type": "button", "data-v34-wizard-prev": ""} |
| DYN-117-A002 | __EXPR_1__ | {"type": "button", "data-v34-wizard-next": ""} |

## DYN-118 — addClientFromOnboarding

Fonte: linha 9012 · `DYN-118`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-118-A001 | Cliente 360º | {"data-v34-client360": "__EXPR_6__"} |

## DYN-119 — addClientFromOnboarding

Fonte: linha 9017 · `DYN-119`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-119-A001 | Cliente 360º | {"data-v34-client360": "__EXPR_7__"} |

## DYN-120 — new-client-360 / body

Fonte: linha 9047 · `DYN-120`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Tabelas / colunas

- Sem ID: Plano; Preço contratado; Responsável; Contato; Tenant; Início

## DYN-121 — openLatePolicy / Política de atraso e suspensão / late-policy / body

Fonte: linha 9092 · `DYN-121`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-121-F001 | Multa (%) | input {"id": "v34Fine", "value": "__EXPR_0__"} | — |
| DYN-121-F002 | Juros simples ao mês (%) | input {"id": "v34Interest", "value": "__EXPR_1__"} | — |
| DYN-121-F003 | Tolerância (dias) | input {"id": "v34Grace", "type": "number", "min": "0", "value": "__EXPR_2__"} | — |
| DYN-121-F004 | Suspensão automática | select {"id": "v34AutoSuspend"} | Ativada [yes]; Manual [no] |
| DYN-121-F005 | Modo | select {"id": "v34SuspendMode"} | Bloquear gravações; manter leitura/exportação [block_writes]; Bloqueio total excepcional [full_exceptional] |

## DYN-122 — renderSupportBoard

Fonte: linha 9139 · `DYN-122`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-123 — renderSupportBoard

Fonte: linha 9139 · `DYN-123`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-123-A001 | Abrir / responder | {"data-v34-ticket-open": "__EXPR_12__"} |

## DYN-124 — renderSupportBoard

Fonte: linha 9144 · `DYN-124`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-124-A001 | Voltar | {"data-v34-ticket-prev": "__EXPR_0__"} |

## DYN-125 — renderSupportBoard

Fonte: linha 9144 · `DYN-125`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-125-A001 | Avançar | {"data-v34-ticket-next": "__EXPR_0__"} |

## DYN-126 — renderSupportBoard

Fonte: linha 9144 · `DYN-126`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-126-A001 | Reabrir | {"data-v34-ticket-reopen": "__EXPR_0__"} |

## DYN-127 — renderTenantTickets

Fonte: linha 9157 · `DYN-127`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

### Ações

| ID de requisito | Ação | Vínculo / atributos |
|---|---|---|
| DYN-127-A001 | Abrir / responder | {"data-v34-tenant-open-ticket": "__EXPR_9__"} |

## DYN-128 — openTicket / msgs

Fonte: linha 9172 · `DYN-128`.

Nenhum input/select/textarea declarado neste bloco; seletores por botões constam nas ações.

## DYN-129 — openTicket / ticket / body

Fonte: linha 9173 · `DYN-129`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-129-F001 | __EXPR_1__ | textarea {"id": "v34TicketReply"} | — |

## DYN-130 — openTicket / ticket / body

Fonte: linha 9173 · `DYN-130`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-130-F001 | Após responder | select {"id": "v34TicketNextStatus"} | — |

## DYN-131 — Novo chamado interno / internal-ticket / body

Fonte: linha 9184 · `DYN-131`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-131-F001 | Assunto | input {"id": "v34InternalSubject"} | — |
| DYN-131-F002 | Categoria | select {"id": "v34InternalCategory"} | Operação [None]; Billing [None]; Infraestrutura [None]; Segurança [None]; Produto [None] |
| DYN-131-F003 | Prioridade | select {"id": "v34InternalPriority"} | Média [medium]; Baixa [low]; Alta [high] |
| DYN-131-F004 | Cliente relacionado (opcional) | select {"id": "v34InternalOrg"} | Plataforma / sem cliente []; __EXPR_0__ [tenant1]; __EXPR_1__ [tenant2] |
| DYN-131-F005 | Responsável inicial | select {"id": "v34InternalAssignee"} | Michael — Master SaaS [None]; Fila Support [None]; Fila Billing [None] |
| DYN-131-F006 | Descrição | textarea {"id": "v34InternalDesc"} | — |

## DYN-132 — openTenantNewTicket / Abrir chamado / tenant-new-ticket / body

Fonte: linha 9207 · `DYN-132`.

### Campos

| ID de requisito | Campo | Tipo e atributos | Opções declaradas |
|---|---|---|---|
| DYN-132-F001 | Assunto | input {"id": "v34TenantSubject"} | — |
| DYN-132-F002 | Categoria | select {"id": "v34TenantCategory"} | Financeiro [finance]; Relatórios [reports]; Acesso [access]; Configuração [configuration]; Assinatura/Cobrança [billing]; Outro [other] |
| DYN-132-F003 | Prioridade | select {"id": "v34TenantPriority"} | Média [medium]; Baixa [low]; Alta [high] |
| DYN-132-F004 | Descrição | textarea {"id": "v34TenantDesc"} | — |

## Índice das funções

| Função | Linha | Módulo |
|---|---|---|
| showView | 4409 | inline |
| parseBRL | 4498 | inline |
| brl | 4501 | inline |
| openDrawer | 4505 | inline |
| closeDrawer | 4535 | inline |
| openModal | 4800 | inline |
| closeModal | 4858 | inline |
| showToast | 4878 | inline |
| isoToBR | 4911 | inline |
| parseBRDate | 4916 | inline |
| shiftMonth | 4927 | inline |
| targetValue | 4931 | inline |
| setTargetValue | 4943 | inline |
| refreshDateLabels | 4955 | inline |
| openDatePicker | 4971 | inline |
| closeDatePicker | 4984 | inline |
| renderYearList | 4989 | inline |
| renderMonthSelector | 5001 | inline |
| renderCalendar | 5009 | inline |
| renderDatePicker | 5035 | inline |
| enforcePair | 5043 | inline |
| applyPickedDate | 5059 | inline |
| renderDashboardDailySummary | 5073 | inline |
| useDirectDate | 5107 | inline |
| flowSeries | 5163 | inline |
| filterFlow | 5167 | inline |
| renderFlowSvg | 5168 | inline |
| renderDashboardFlow | 5371 | inline |
| dateSeed | 5375 | inline |
| addIsoDays | 5379 | inline |
| enumerateDates | 5385 | inline |
| flowLabel | 5390 | inline |
| actualForDate | 5394 | inline |
| projectedForDate | 5402 | inline |
| buildFlowRange | 5409 | inline |
| flowOpeningBalance | 5415 | inline |
| expensesForRange | 5416 | inline |
| rebuildFlowRange | 5427 | inline |
| renderFlowMovementTable | 5446 | inline |
| renderCashFlow | 5462 | inline |
| renderCashFlowPanels | 5469 | inline |
| filterFinancialLaunches | 5547 | inline |
| filterPayables | 5568 | inline |
| filterReceivables | 5590 | inline |
| saveNavPreference | 5635 | inline |
| loadNavPreference | 5642 | inline |
| renderChartAccounts | 5723 | inline |
| setUserLabel | 5888 | saasMasterStandaloneModule |
| setContext | 5896 | saasMasterStandaloneModule |
| escapeHtml | 5969 | saasMasterStandaloneModule |
| brMoney | 5978 | saasMasterStandaloneModule |
| refreshSaasBilling | 5984 | saasMasterStandaloneModule |
| toast | 6062 | v32MasterClosureModule |
| esc | 6063 | v32MasterClosureModule |
| parseMoney | 6064 | v32MasterClosureModule |
| updateChrome | 6066 | v32MasterClosureModule |
| filterClients | 6087 | v32MasterClosureModule |
| filterBilling | 6090 | v32MasterClosureModule |
| openClient360 | 6094 | v32MasterClosureModule |
| closeClient360 | 6095 | v32MasterClosureModule |
| openDialog | 6105 | v32MasterClosureModule |
| closeDialog | 6106 | v32MasterClosureModule |
| openSupport | 6109 | v32MasterClosureModule |
| refreshBilling | 6141 | v32MasterClosureModule |
| parseMoney | 6158 | v29CorrectionsModule |
| brDate | 6166 | v29CorrectionsModule |
| isoFromBR | 6172 | v29CorrectionsModule |
| refreshApprovalPolicy | 6184 | v29CorrectionsModule |
| openEditModal | 6272 | v29CorrectionsModule |
| escapeAttr | 6347 | v29CorrectionsModule |
| competenceBR | 6465 | v29CorrectionsModule |
| activeReportType | 6471 | v29CorrectionsModule |
| syncPeriodFromCompetence | 6475 | v29CorrectionsModule |
| refreshReportContext | 6487 | v29CorrectionsModule |
| applyTheme | 6585 | themeStandaloneModule |
| refreshPayables | 6636 | institutionalTablesStandaloneModule |
| refreshReceivables | 6673 | institutionalTablesStandaloneModule |
| refreshAll | 6698 | institutionalTablesStandaloneModule |
| activeAccounts | 6706 | institutionalTablesStandaloneModule |
| planName | 6712 | institutionalTablesStandaloneModule |
| isRevenue | 6718 | institutionalTablesStandaloneModule |
| isExpense | 6722 | institutionalTablesStandaloneModule |
| normalize | 6727 | institutionalTablesStandaloneModule |
| escapeHtml | 6735 | institutionalTablesStandaloneModule |
| mountAccountSearch | 6744 | institutionalTablesStandaloneModule |
| renderBucket | 6993 | delinquencyStandaloneModule |
| brMoney | 7067 | membersStandaloneModule |
| parseMoney | 7071 | membersStandaloneModule |
| statementDateToIso | 7076 | membersStandaloneModule |
| isoToBRLocal | 7083 | membersStandaloneModule |
| filteredStatement | 7089 | membersStandaloneModule |
| statusClass | 7097 | membersStandaloneModule |
| periodData | 7105 | membersStandaloneModule |
| renderRow | 7151 | membersStandaloneModule |
| applyFilters | 7173 | membersStandaloneModule |
| refresh | 7206 | membersStandaloneModule |
| renderDrawer | 7219 | membersStandaloneModule |
| defaultExpenseType | 7290 | planStandaloneModule |
| esc | 7338 | planStandaloneModule |
| plan | 7347 | planStandaloneModule |
| hasChildren | 7351 | planStandaloneModule |
| hasActiveChildren | 7357 | planStandaloneModule |
| state | 7363 | planStandaloneModule |
| syncPlanSelect | 7372 | planStandaloneModule |
| updateSummary | 7380 | planStandaloneModule |
| rowClass | 7398 | planStandaloneModule |
| render | 7407 | planStandaloneModule |
| findAccount | 7444 | planStandaloneModule |
| readRow | 7448 | planStandaloneModule |
| saveRow | 7481 | planStandaloneModule |
| toggleAccount | 7502 | planStandaloneModule |
| deleteAccount | 7512 | planStandaloneModule |
| closeNewPlan | 7610 | planStandaloneModule |
| renderReport | 7811 | reportsStandaloneModule |
| refreshV33Billing | 7933 | v33MasterOperationalModule |
| openDialog | 7955 | v33MasterOperationalModule |
| closeDialog | 7965 | v33MasterOperationalModule |
| enforceTenantSurface | 7975 | v33MasterOperationalModule |
| openBillingPolicy | 8044 | v33MasterOperationalModule |
| createPlanCard | 8066 | v33MasterOperationalModule |
| invoiceRowFromDialogButton | 8196 | v33MasterOperationalModule |
| updateCounts | 8287 | v33MasterOperationalModule |
| rebuildTicketButtons | 8293 | v33MasterOperationalModule |
| moveTicket | 8305 | v33MasterOperationalModule |
| platformSettingsBody | 8363 | v33MasterOperationalModule |
| toast | 8563 | v34OperationalFixesModule |
| openDialog | 8569 | v34OperationalFixesModule |
| closeDialog | 8579 | v34OperationalFixesModule |
| currentPublishedVersion | 8605 | v34OperationalFixesModule |
| versionStatus | 8610 | v34OperationalFixesModule |
| canDeletePlan | 8618 | v34OperationalFixesModule |
| applyVersionFilters | 8623 | v34OperationalFixesModule |
| renderPlans | 8640 | v34OperationalFixesModule |
| syncPlanFilters | 8680 | v34OperationalFixesModule |
| allPublishedVersionOptions | 8688 | v34OperationalFixesModule |
| planEditorBody | 8697 | v34OperationalFixesModule |
| readPlanEditor | 8715 | v34OperationalFixesModule |
| validatePlanInput | 8728 | v34OperationalFixesModule |
| canDeletePromotion | 8814 | v34OperationalFixesModule |
| renderPromos | 8819 | v34OperationalFixesModule |
| promoEditorBody | 8842 | v34OperationalFixesModule |
| readPromo | 8860 | v34OperationalFixesModule |
| openPromoEditor | 8863 | v34OperationalFixesModule |
| newOnboarding | 8915 | v34OperationalFixesModule |
| planOptionHtml | 8918 | v34OperationalFixesModule |
| wizardBody | 8922 | v34OperationalFixesModule |
| saveWizardStep | 8972 | v34OperationalFixesModule |
| refreshWizardDialog | 8992 | v34OperationalFixesModule |
| openOnboarding | 8998 | v34OperationalFixesModule |
| addClientFromOnboarding | 9003 | v34OperationalFixesModule |
| round2 | 9063 | v34OperationalFixesModule |
| daysBetween | 9064 | v34OperationalFixesModule |
| recalcBillingCharges | 9065 | v34OperationalFixesModule |
| openLatePolicy | 9091 | v34OperationalFixesModule |
| elapsed | 9128 | v34OperationalFixesModule |
| ticketClient | 9134 | v34OperationalFixesModule |
| renderSupportBoard | 9135 | v34OperationalFixesModule |
| renderTenantTickets | 9149 | v34OperationalFixesModule |
| moveTicket | 9163 | v34OperationalFixesModule |
| openTicket | 9171 | v34OperationalFixesModule |
| openTenantNewTicket | 9204 | v34OperationalFixesModule |

## Limites da verificação

As duas lojas usam o mesmo conjunto de 15 telas no HTML. Contexto, assinatura e chamados têm variações explícitas; tabelas financeiras demonstrativas compartilhadas não comprovam isolamento. Validar ambas as lojas com dados próprios, papéis reais, sessões independentes e requisições negativas. A cópia de referência não deve ser servida na pasta pública do app nem usada como prova de RLS.

Desktop/mobile, temas, foco/teclado, abertura/fechamento de drawers/modais, sobreposição de listeners e todos os resultados dos cliques permanecem pendentes de homologação visual e funcional. O navegador disponível bloqueou localhost e protocolo file; nenhuma alternativa de execução foi usada.
