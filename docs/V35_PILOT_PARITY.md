# V35 — escopo mínimo do piloto e matriz de paridade

## Estado operacional vigente — Lote 4 / COMANDO 08-A (2026-10-25)

### Matriz de Paridade — Dashboard e Relatórios Gerenciais (Lote 4)

1. **`view-dashboard` (Dashboard Gerencial)**:
   - **Status**: Implementado e testado.
   - **Descrição**: Integrados os 6 indicadores consolidados reais via RPC `read_tenant_financial_dashboard` (`receivables_open`, `receivables_overdue`, `received_this_month`, `cash_bank_balance`, `payables_open`, `payables_overdue`). Inclui atalhos para os módulos financeiros e widget de Fluxo de Caixa Diário via RPC `read_tenant_daily_cash_flow`.
   - **Limitações documentadas**: Gráficos de série temporal dinâmicos V35 pendentes sem dados fictícios.

2. **`view-relatorios` — A. Posição Financeira Geral**:
   - **Status**: Implementado e testado.
   - **Descrição**: Exibe os 6 KPIs globais consolidados do banco (sem somar linhas da página) e listagem paginada (amostra de até 25 registros por origem: obrigações institucionais, recebíveis institucionais e cobranças de integrantes) com validação de `integrity_ok`.
   - **Limitações documentadas**: Exportação CSV identifica a amostra da página. Totais históricos consolidados para períodos arbitrários customizados dependem de RPC agregadora por período.

3. **`view-relatorios` — B. Relatório de Recebimentos**:
   - **Status**: Implementado e testado.
   - **Descrição**: Exibe os fatos reais de recebimento cadastrados por data de pagamento (`v_payment_balances`), com data de pagamento real, valor recebido, valor alocado e crédito disponível. Exclui estornos (`is_reversed`).
   - **Limitações documentadas**: Exibição paginada. Resumos agregados históricos por modalidade dependem de RPC estendida.

4. **`view-relatorios` — C. Relatório de Inadimplência**:
   - **Status**: Implementado e testado.
   - **Descrição**: Integra a consulta `read_tenant_delinquency` com classificação estrita em 4 faixas de atraso (0–30, 31–60, 61–90, >90 dias) e download CSV completo.

5. **`view-relatorios` — D. Fechamento Mensal e DRE**:
   - **Status**: Implementado e testado.
   - **Descrição**: Filtro de competência contábil (`reportCompetence`) conectado à RPC `read_tenant_dre` e estado do período contábil (`loadPeriodState` / `financial_periods`). Tela estritamente consultiva.

6. **`view-relatorios` — E. Exportação Contábil**:
   - **Status**: Implementado e testado (Cadastro do Plano de Contas).
   - **Descrição**: Consulta ao cadastro do Plano de Contas (`accounting_plans` e `accounting_accounts`). Exportação CSV do catálogo de contas contábeis disponível.
   - **Dependente de backend**: Exportação do Diário e Razão com Lançamentos Contábeis Classificados mantida indisponível e documentada como dependência de microserviço contábil estendido no servidor.

7. **Exportações em PDF e XLSX**:
   - **Status**: Dependente de backend.
   - **Descrição**: Modal de notificação ativado informando a necessidade do microserviço estendido de relatórios no servidor e oferecendo o download em CSV para garantir a integridade.

## Estado operacional vigente — 2026-10-15

Consultar [plano consolidado](V35_VERTICAL_DELIVERIES.md#estado-consolidado-vigente--2026-10-15)
e [QA assinado A/B](V35_SIGNED_BROWSER_QA.md). Transferência/estorno UI A/B,
importação normalizada OFX A/CSV B e testes HTTP cruzados/concorrentes descritos
nesses relatórios foram homologados. As marcações antigas de ausência dessas
jornadas abaixo são históricas. Não equivalem a aceite integral das telas;
campos, ações e requisitos do inventário permanecem no escopo.

## Atualização incremental — filtro de clientes Master (DEV 2026-10-10)

Para `view-master-clientes`, existe agora filtro server-side de nome/número/cidade/contato, situação da assinatura e plano em `MasterConsole`, migração #52 `search_platform_master_tenants`, com autorização MASTER/AAL2, sem carga global no browser. `view-master-clientes-F001` busca parcialmente coberta; `F002` status all/active/past_due implementado; `F003` plano utiliza campo textual em vez de `select` de versões catalogadas, ainda NÃO equivalente ao controle original. Diretório não substitui ações específicas “Novo cliente”, “Cliente 360º”, “Cadastro comercial”, “Plano/preço”, “Tenant + roles”, “Plano contábil inicial”, “Convite/ativação” do piloto; permanecem workflows de homologação separada.


## Atualização incremental — fluxo de caixa e tesouraria (DEV 2026-10-10)

**Este bloco é evidência de implementação posterior à matriz estática inicial, não altera nem apaga os requisitos do HTML original.** Para `view-fluxo-caixa` e `view-dashboard`, foi implementada RPC `read_tenant_daily_cash_flow` (migração DEV #51) e UI Financeiro > Fluxo de caixa com 1–93 dias, resumos e linhas diárias do realizado operacional e projeção de obrigações abertas. Não mistura transferências internas/abertura com faturamento. Gate SQL A/B `DEV_DAILY_CASH_FLOW_ROLLBACK_PASS`. **Paridade ainda pendente:** gráficos de série, saldos inicial e final ajustados, fluxo projetado com critério de probabilidade, comparações/período conforme DOM, layout do HTML V35 e QA mobile/desktop. Para `view-tesouraria`, `AccountTransfers` e reversão foram codados na migração #50, mas a transferência positiva real segue sem ensaio com duas contas ativas e não está homologada. Para `view-relatorios`, CSV privado de inadimplência existe com limite 1.000, mas PDF/XLSX continuam pendentes.


## Compromisso e fontes

Todo recurso planejado no HTML entregue pelo proprietário integra o escopo mínimo, junto com a documentação V35. Entrega incremental não autoriza retirar telas, abas, campos, opções, ações ou regras. Cada incremento deve citar os IDs do [inventário detalhado](V35_PILOT_INVENTORY.md), demonstrar o comportamento correspondente e manter as pendências visíveis. Não concluir um módulo somente porque seu menu existe.

Arquivo recebido: `corsys-tesouraria-preview-v34-master-operacional.html`, 546.526 bytes, SHA-256 `3ac07e762c42805851b90a916b10dd71c98ae6891aeb5404372ef964af8503fc`. O nome e os módulos finais identificam V34. A documentação V35 complementa e evolui esse piloto; o arquivo não reduz o escopo V35. [Referência versionada](pilot/v34-master-operacional.reference.html): apenas duas tags externas injetadas pelo antivírus foram removidas, preservando HTML/CSS/JS de produto e numeração de linhas. O original recebido permanece intacto.

Levantamento estático: 21 telas (6 Master + 15 cliente), 129 ocorrências de campos nas telas, 3 nas superfícies compartilhadas e 297 em 126 fragmentos dinâmicos/históricos. Não são 429 campos únicos: existem repetições, linhas de contas, branches e versões sucessivas. O inventário registra cada ocorrência, opções, atributos, ações, colunas, notas, abas e 157 funções / 170 pontos de registro de eventos.

O navegador bloqueou abertura local; não foram executados scripts, cliques ou homologação visual. A análise de DOM/AST é uma referência de requisitos e evidência estática, não prova de fluxo funcionando. A revisão desktop/mobile e a validação de todas as ações continuam obrigatórias.

## Contextos das duas lojas

| Contexto do HTML | Identidade / papel | Variação explícita | Aceite obrigatório |
|---|---|---|---|
| master | Michael — Master SaaS | Control plane global; entrada inicial | AAL2/MFA, equipe autorizada, auditoria, nenhum papel tenant concedendo Master |
| tenant1 | Aurora do Sul nº 101 / André — Administrador | Assinatura active, chamados próprios | 15 telas conforme permissões; dados próprios; ações administrativas autorizadas |
| tenant2 | Fraternidade do Oriente nº 202 / Ricardo — Tesoureiro | Assinatura past_due; aviso comercial e chamados próprios | Mesmo conjunto de telas com autorização por papel, atraso/tolerância/suspensão reais; impedir acesso à outra Loja |

As duas lojas reutilizam as mesmas views no HTML; o seletor muda modo, identidade, situação da assinatura e o filtro explícito de chamados. Os dados financeiros demonstrativos compartilhados não provam isolamento. Não copiar esse seletor como autorização em produção: tenant é derivado do usuário autenticado e validado pelo servidor/RLS. As lojas demonstrativas do HTML não são automaticamente as organizações TENANT A/B do DEV; não renomear ou migrar dados por inferência.

## Master SaaS — cobertura por tela

“Base V35” indica documentação/schema/RPC disponíveis, não cenário real homologado. Nesta revisão nenhuma migration ou função de banco foi modificada. O frontend DEV ainda não possui o control plane Master.

| ID / tela | Mínimo preservado | Base V35 | Estado frontend / aceite restante |
|---|---|---|---|
| view-master / Painel | Indicadores globais, alertas, clientes, Cliente 360º, acesso de suporte, novo cliente e limites de acesso | ADR-0012/13/14/25 | Pendente; indicadores por consultas autorizadas, auditoria e AAL2 |
| view-master-clientes | Busca, status, plano; contatos; assinatura; 360º; onboarding em cinco etapas | ADR-0021/26 controlled | Pendente; criação transacional/idempotente, retomada, convites e confirmação final |
| view-master-cobranca | Cliente/fatura, status, competência; base/encargos/atualizado/pago/saldo; gerar/enviar/receber/reverter/anular; acordos; régua; provider | ADR-0013/23/28 | Pendente; eventos reais, política por vigência, duplicidade/replay e saldo derivado |
| view-master-planos | Catálogo, rascunho/edição/publicação/sucessora, preço/recursos, histórico/vigência; promoções e ofertas | ADR-0022/26 safe lifecycle | Pendente; incluir também filtros/status/ativação/desativação/exclusão segura previstos na V35 |
| view-master-operacao | 5 abas: Chamados, Saúde/Jobs, Sessões de suporte, Equipe/Segurança, Auditoria; Kanban, chamados internos, conversas e metadados | ADR-0014/24/25/27 | Pendente; métricas de primeira resposta/SLA, mudança/reabertura, expiração/revogação e isolamento |
| view-master-config | Identidade/fiscal, comercial, cobrança, comunicação, termos/privacidade e integrações; revisão de documentos | ADR-0025/21/23 | Pendente; settings tipadas/versionadas, estados reais e segredos ausentes da interface |

Cliente 360º tem **8 abas**: visão geral, assinatura, cobranças, uso/limites, termos/LGPD, suporte, auditoria e encerramento. Preservar plano/versão/preço histórico, mudanças imediatas/agendadas e pró-rata explícito; lifecycle com motivo/data; exportação, cancelamento e retenção sem remoção silenciosa. Drawer de suporte exige motivo, duração e escopo read_only. O backend deve validar sessão temporária, organização, AAL2 e expiração em cada acesso.

Onboarding: (1) comercial: nome/número/CNPJ/cidade/UF/telefone/responsável/e-mails; (2) plano publicado/versão/preço/início/trial; (3) slug/role/isolamento; (4) plano contábil padrão ou vazio/vigência/rascunho; (5) convite/aceite/ativação e resumo. O checkbox demonstrativo de aceite não equivale a aceite pelo cliente; registrar ator, documento/versão e data no fluxo real. Não criar usuários ou enviar convite pelo browser cliente com privilégios administrativos.

## Lojas — cobertura por tela

Todas as linhas se aplicam a **ambas** as lojas, com dados independentes e diferenças de permissões/situação contratual. “Consulta parcial” não significa paridade integral.

| ID / tela | Mínimo preservado | Base V35 | Estado frontend / aceite restante |
|---|---|---|---|
| view-dashboard / Painel | 6 KPIs: total a receber, vencido, recebido no mês, disponível em caixa, a pagar e vencidas; datas, fluxo consolidado/receitas×despesas/saldo, resumo diário e ações rápidas | ADR-0001/02/05/17 | Pendente; indicadores reais, filtros comuns e nenhuma soma parcial apresentada como saldo total |
| view-integrantes | Busca nome/telefone/e-mail, situação cadastral e financeira, período, cadastro e extrato lateral | members/links/offices; ADR-0002/07 | Busca/listagem parcial; CRUD completo, filtros e drawer pendentes |
| view-financeiro | Cobranças, mensalidades, ágape, pagamento/alocação, competência, lançamentos e negociação | ADR-0003/04/06/07/08/10 | Consulta paginada com filtros reais de competência e intervalo de vencimento aplicados no banco; diferenciação estrita de competência/vencimento/liquidação; sub-módulos integrados; histórico e extrato detalhado pendentes |
| view-inadimplencia | Detalhamento por integrante e tendência | ADR-0001/02/04 | Consulta paginada com cálculo determinístico de dias em atraso por data de referência da live RPC, faixas (up30, 31-60, 61-90, over90), indicação de página atual e transparência quanto ao uso do vencimento mais antigo por integrante |
| view-tesouraria | Contas/caixa/bancos, fundos/orçamento e conciliação OFX/CSV | ADR-0005/17/20 | Integrada com saldos reais, transferências internas sem dupla contagem, orçamento/fundos e fluxo de conciliação OFX/CSV com validação, confirmação no servidor e desfazimento |
| view-fluxo-caixa | Datas, consolidado/projetado/receitas×despesas/saldo; resumo diário; maiores despesas; movimentação | ADR-0001/05/17/20 | Integrada com visualizações diferenciadas por modo (consolidado, projetado, movimentos e aviso de dependência de conciliação para saldos acumulados), mantendo integridade do realizado/projetado |
| view-contas-pagar | Período/tipo/status; cadastro, edição/correção, aprovação e liquidação | ADR-0017/18/19 | Integrada com consulta paginada e filtros aplicados no banco por tipo (fixed/variable), situação (pending/paid/overdue), competência e período. Indicador de obrigações ajustado para página atual sem falsos totais globais |
| view-contas-receber | Período, receitas previstas, cadastro, correção, recebimento parcial/total | ADR-0005/17/18 | Integrada com apresentação separada de cobranças de integrantes (v_charge_balances) e títulos institucionais a receber (v_institutional_receivable_effective) com paginações e origens independentes quando selecionada "Todas as origens" |
| view-dre | Competência, demonstrativo, orçado×realizado e comparativo | ADR-0001/16/20 | Integrada com demonstrativo por competência contábil real (receitas, custos, despesas operacionais e resultado), comparação com orçamento e separação estrita do fluxo de caixa |
| view-plano-contas | 4 abas: plano, categorias/regras, contas/fundos, formas de pagamento; 91 linhas padrão, novo plano duplicado/vazio, vigência, edição/status/exclusão | ADR-0007/16/20 | Pendente; hierarquia, dependências, histórico e publicação no backend |
| view-config-dre | Plano vigente, regime, comparativo, resultado financeiro, patrimônio/anexo, cobertura do mapeamento e link à estrutura | ADR-0016/20 | Pendente; mapeamento central e versões sem recalcular indevidamente o passado |
| view-relatorios | 5 tipos: posição geral, recebimentos, inadimplência, fechamento mensal, exportação contábil; competência/datas; PDF/Excel | ADR-0001/09/11/20 | Pendente; geração real privada, filtros aplicados, fechamento/reabertura e legado non-posting |
| view-cadastros | Integrantes, tipos de cargo, perfis/permissões | ADR-0012/14; roles/offices | Pendente; CRUD e permissões reais no servidor |
| view-configuracoes | Logo/identidade/contatos/PIX, assinatura, suporte, temas, governança, portal, notificações, LGPD, importação, backup/auditoria/cargos | ADR-0013/15/19/20/25 | Pendente; importação controlada, privacidade, decisões auditadas e evidência de restauração |
| view-chamados | KPIs próprios, busca/status, abrir/responder, categoria/prioridade/descrição, abertura/autor/tempo/atualização/status | ADR-0024/27 | Abertura/listagem próprias parciais; conversas, métricas, filtros completos e reabertura pendentes |

## Regras mínimas e reconciliação

1. Cadastro de integrante mantém nome completo/preferencial, situação, cargo, WhatsApp, e-mail, isenção e mensalidade individual. Isenção impede geração; valor individual vigente prevalece sobre geral. Recorrência por competência é idempotente e versionada.
2. Cobrança mantém categoria, valor, competência, parcelamento, primeira data e descrição; geração em lote mostra quantidade, total e exceções. Ágape preserva data, valor padrão e seleção de participantes.
3. Pagamento mantém integrante, valor/data, forma/conta e alocação FIFO/manual/crédito; não confundir cobrança, pagamento, alocação e crédito disponível. Extrato mantém débito/crédito e saldo do período sem sobrescrever posição global.
4. Negociação mantém dívida original referenciada, valor negociado, parcelas, vencimentos, condições e histórico. Cálculo de parcelas deve ajustar centavos e validar entrada/total no backend; a divisão Number do piloto é demonstrativa.
5. Contas a pagar/receber mantêm competência, vencimento, classificação, descrição, conta financeira e comprovantes quando previstos. Corrigir fato postado exige evento/estorno vinculado; campos de status/recebido do modal de demonstração não autorizam alteração direta de fato ou saldo.
6. Aprovação admite todas/acima do limite/desativada e aprovadores mínimos. O protótipo usa comparação `valor >= limite`, embora o rótulo diga “acima”; homologar igualdade com o contrato V35 antes de publicar. Preservar snapshot da política, decisões autorizadas e auditoria; não recalcular retroativamente pendências ao editar política.
7. Plano contábil mantém os 91 códigos/descrições padrão (na referência), grupos/subgrupos/analíticas e classificação. Receita Recorrente/Avulsa; despesa Fixa/Variável; grupos/patrimônio “Não se aplica”. Heurísticas por descrição no HTML são sugestões iniciais, nunca substituem configuração persistida.
8. Código único por plano; pai não é desativado com filhas ativas; exclusão bloqueada com filhas, movimentos ou dependências. Conta histórica é desativada. Novo plano pode duplicar ou iniciar vazio; vigência não se sobrepõe. O botão “Validar vigência” não substitui publicação versionada prevista na V35.
9. Categoria aponta à conta contábil; recorrência à categoria; banco/caixa à conta patrimonial; fundo à finalidade gerencial. Forma de pagamento/fundo não inventa linha de DRE. DRE usa competência; fluxo de caixa usa liquidação; projeção não vira fato realizado.
10. Importação mantém modelo CSV com 11 colunas: tipo_registro, integrante_ou_origem, descricao, codigo_conta, competencia, vencimento, valor, classificacao, conta_financeira, forma_pagamento, observacao. CSV/Excel e OFX/CSV passam por staging, validação, prévia, confirmação e idempotência. Selecionar arquivo não é importar com sucesso.
11. Relatórios mantêm cinco tipos, sincronização competência/período, vazio explícito, PDF/Excel e identidade/logo. Conteúdo deve vir das views centrais, com autorização e artefatos privados. Exportações simuladas/toasts não satisfazem o aceite.
12. Planos SaaS mantêm preço, mensal/anual, trial/tolerância, usuários, vigência e entitlements. Rascunho é editável; publicação preserva snapshot; sucessora não migra cliente automaticamente. **V35 supera o bloqueio de nome/código da V34**: todo rascunho pode editar identidade, versões anteriores permanecem intactas (ADR-0026 safe lifecycle).
13. Planos/ofertas têm ativação/desativação, filtros e histórico V35. Excluir somente sem publicação/uso/vínculos; desativação preserva contratos. Promoção mantém tipo, benefício, ciclos/duração, público, planos, limite, acumulação e datas. Não perder opção histórica “até uma data” apenas porque formulário posterior apresenta menos opções; modelar as capacidades de vigência/duração documentadas e homologar a interface consolidada.
14. Billing mantém base, multa, juros, total atualizado, pago, saldo e status derivados. Política configurável por contrato/vigência, sem tratar percentuais/datas/preços exemplares como constantes. Suspensão normal bloqueia gravações e mantém leitura/exportação; exceção total exige decisão expressa/auditada. Fatura SaaS nunca entra no financeiro da Loja.
15. Recebimento/reversão/alocação são eventos separados; motivo é obrigatório; anulação não apaga documento e respeita pagamentos/alocações ativos. Acordo referencia original, entrada/parcelas/encargos/condições e versões.
16. Kanban mantém Novo, Triagem, Em atendimento, Aguardando cliente, Resolvido; avançar/voltar/reabrir e mensagens com autoria/data. Chamado interno nunca aparece para cliente, mesmo vinculado à sua Loja. Resposta do cliente a resolvido reabre conforme política; primeira resposta/SLA são métricas reais do backend, não o contador de tempo do browser.
17. Suporte cross-tenant é temporário/read_only/motivado/auditado; sair encerra/revoga efetivamente sessão. Esconder botões/CSS e prompt de motivo não comprovam essa segurança.
18. Temas: light-institutional, light-soft, dark-blue e dark-gold; menu desktop/mobile, preferência de ordem, calendário com busca de ano/digitação e datas coerentes permanecem no escopo. Preferências por usuário não concedem permissões. Confirmar legibilidade, foco e scroll sem ocultar campos em mobile.
19. Portal do integrante vê somente próprio extrato; Admin/Tesoureiro/Consulta/Integrante têm autorização efetiva. Perfis Master/Support/Billing são separados. Convites/revogação/MFA, proteção do último Master e estados de integrações devem ser reais.
20. LGPD mantém exportação/correção, minimização, acesso auditado, retenção explícita e encerramento controlado. Backup/restauração exigem evidências reais; não converter avisos “pendente” em sucesso por aparência.

Os atributos completos e opções de **cada campo** estão no inventário; esta lista explica invariantes, sem substituir os dicionários V35. União aditiva das capacidades é o padrão. Diferença incompatível sem decisão existente permanece questão explícita de homologação, nunca é removida silenciosamente.

## Como impedir perda nas próximas entregas

- Antes de implementar: selecionar tela/IDs de campos e ações; vincular dicionário/ADR/RPC; identificar cenários tenant1/tenant2 e Master aplicáveis.
- Durante: implementar estado vazio/loading/erro, validação, autorização, persistência, retorno e auditoria. Não transportar dados mock ou handlers sucessivos como backend real.
- No aceite: comprovar cada campo/opção e ação; testar dados próprios/cruzados, papel permitido/negado, AAL2/suspensão quando aplicável, histórico/idempotência/concorrência; homologar desktop/mobile.
- Concluir somente com evidências rastreáveis. Pendência continua no backlog; alteração incompatível exige decisão do proprietário registrada.

O gate `scripts/check_v35_preservation.py` verifica referências V35 e a integridade/presença da referência HTML, do inventário e das 21 telas. Não verifica execução, acessibilidade, efeitos de cliques, semântica de SQL ou paridade do app. Gates funcionais e de segurança permanecem obrigatórios.

## Próxima sequência de desenvolvimento

1. Validar permissões/JWT, AAL2, suspensão e invariantes transacionais no DEV antes de liberar comandos financeiros.
2. Completar integrantes, cargos/perfis, mensalidades/isenções e parametrizações com os campos inventariados.
3. Entregar pagamentos/cobranças/negociações e contas institucionais/ aprovações, preservando eventos históricos.
4. Completar plano contábil, caixa/fundos, conciliação, DRE/orçamento/relatórios/importação.
5. Implementar Master, clientes/onboarding, catálogo/ofertas, billing, operação/SLA/configurações; pode avançar em incrementos independentes quando autorização e contratos estiverem definidos.
6. Homologar todos os contextos e itens de inventário antes de produção. Não ativar cobrança/provider/plano pago sem apresentar custo ao proprietário.

## Evidência visual recebida

[Revisão de sete vídeos](V35_PILOT_VIDEO_REVIEW.md): seis áreas Master e quatorze áreas da Loja Aurora/André observadas parcialmente no desktop. HTML gravado identifica V35 planos/ofertas, diferente da fonte V34 recebida; capacidades adicionais confirmam requisitos V35. Receber esse HTML para conciliação campo a campo. Segunda Loja, mobile, temas aplicados, Financeiro dos Integrantes e fluxos completos permanecem pendentes. O inventário estático não foi substituído e nenhuma simulação foi marcada como comando de backend verificado.

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.
