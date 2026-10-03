# V35 — revisão visual das sete gravações

Data: 2026-10-03, Brasil. Referência de escopo: [matriz de paridade](V35_PILOT_PARITY.md) e [inventário estático](V35_PILOT_INVENTORY.md).

## Resultado e alcance

As sete gravações são legíveis em resolução 1920×1032 e permitem revisar a composição desktop, campos visíveis, abertura de modais/drawers e alguns resultados das interações. Total aproximado: 8min38s. A revisão usa quadros periódicos e inspeção ampliada de cenas críticas; timestamps abaixo são aproximados e relativos a cada vídeo. Não é reprodução automatizada dos cliques, exame de todos os frames, transcrição do áudio ou homologação do aplicativo conectado ao backend.

O navegador da gravação identifica o arquivo **corsys-tesouraria-preview-v35-planos-ofertas.html**. O código-fonte previamente recebido/versionado é **V34 master operacional**. Há diferenças visíveis efetivas: a V35 gravada mostra filtros de vigência/status, exclusão segura e identidade editável no rascunho sucessor. A documentação V35 já prevê essas capacidades. O vídeo complementa o mínimo obrigatório, mas não permite extrair todo o código/opções/validações da V35. Receber o HTML V35 gravado para conciliar seu inventário sem remover a referência V34.

**Não declarar paridade total:** há evidência das seis áreas principais Master e de quatorze áreas principais da loja Aurora do Sul / André Administrador. Não foi encontrada evidência suficiente da view Financeiro dos Integrantes, de todas as quatro subabas da estrutura, das duas lojas com dados próprios ou do modo mobile. Lista de telas observadas não equivale a todos os seus campos/branches/ações homologados.

## Evidências por gravação

Identificadores V1–V7 correspondem ao horário no nome do arquivo. Os originais permanecem nos anexos; vídeos/screenshots com barra pessoal do navegador não foram incorporados ao repositório.

| Vídeo | Trecho aproximado | Evidência visual | Resultado / limite |
|---|---|---|---|
| V1 00-36-58 | 00:00–00:18 | Painel Master, KPIs, clientes, novo cliente/onboarding | Etapa comercial legível; abrir/fechar, sem concluir onboarding |
| V1 | 00:20–00:32 | Cliente 360º de Aurora, navegação entre abas | Drawer legível; inspecionar todos os resultados contratuais em teste real |
| V1 | 00:35–00:40 | Sessão de suporte | Motivo/duração/escopo read_only visíveis; sessão real/expiração não demonstradas |
| V1 | 00:45–00:56 | Clientes, onboarding vazio | Alert de nome/número/responsável/contato administrativo obrigatório observado |
| V1 | 01:00–01:13 | Cliente 360º / suporte / auditoria | Abas e controles mostrados; registros demonstrativos |
| V1 | 01:16–01:30 | Assinaturas, cobrança manual | Cliente/competência/vencimento/valor/descrição; conclusão não evidenciada |
| V1 | 01:35–01:43 | Fatura e envio de cobrança | Detalhes e toast explícito de envio simulado; não entrega de e-mail real |
| V1 | 01:45–02:05 | Registrar pagamento e visão de cobrança | Data/valor/forma/referência; pagamento não comprovado no backend |
| V2 00-40-46 | 00:00–00:12 | Cobrança/política/automação | Cards e ações; não comprova execução de jobs/política salva |
| V2 | 00:13–00:25 | Planos e novo plano | Nome/código/preço/ciclo/trial/tolerância/usuários/vigência/entitlements |
| V2 | 00:28–00:35 | Versão Essencial publicada, histórico corrente/anterior | Estado visual e toast de publicação; contratos reais/snapshots ainda exigem teste |
| V2 | 00:37–00:40 | Excluir Premium | Texto limita a plano nunca publicado/vinculado; digitar EXCLUIR; diálogo cancelado |
| V2 | 00:43–00:49 | Rascunho Essencial v3 | Nome/código editáveis; nota preserva snapshot anterior; alinhado ao ADR-0026 V35 |
| V2 | 00:52–01:04 | Ofertas, desativação e nova oferta | Motivo, benefício/tipo/duração/ciclos/público/planos/limites/acumulação/datas |
| V2 | 01:13–01:22 | Operação, Kanban e Equipe/Segurança | Colunas e tabela de equipe/MFA; políticas reais não testadas |
| V2 | 01:25–01:38 | Responder SUP-104 | Alert “Digite a resposta” vazio; depois mensagem preenchida, toast e card em Aguardando cliente |
| V2 | 01:38–01:41 | Movimentação no Kanban | Card em outra coluna observado; persistência/restrições reais pendentes |
| V2 | 01:43–01:49 | Novo chamado interno | Assunto/categoria/prioridade/cliente opcional/responsável/descrição; não prova isolamento real |
| V2 | 01:52–02:14 | Configurações da Plataforma | Cards/termos e formulário extenso com rolagem; gravação não mostra salvar todos os grupos |
| V3 00-43-11 | 00:00–00:08 | Master → Aurora / André Administrador | Troca para superfície tenant; não demonstra segunda loja |
| V3 | 00:08–00:26 | Painel, Inadimplência, Contas a Pagar e atalhos de KPIs | Navegação e leitura; views reais/segurança pendentes |
| V4 00-44-49 | 00:00–00:09 | Caixa/Bancos, fundos, orçamento, conciliação | Saldos/linhas/status e importar OFX/CSV; sem arquivo importado |
| V4 | 00:10–00:25 | Fluxo de Caixa | Datas, cards, gráfico, resumo diário, maiores despesas, receitas×despesas e movimentos |
| V5 00-45-26 | 00:00–00:06 | Fluxo de Caixa / modos | Exibição desktop e gráfico; não prova todas as séries/filtros |
| V5 | 00:07–00:18 | Editar Contas a Pagar pendente/paga | Descrição/classificação/valor/competência/vencimento/status/conta; aviso de correção auditada em liquidado |
| V5 | 00:24–00:33 | Nova conta e busca contábil | Sugestões pesquisáveis, classificação, valor/datas/parcelado/conta/aprovação/comprovante; não finaliza lançamento |
| V5 | 00:42–00:49 | Contas a Receber / editar | Origem/classificação/descrição/previsto/recebido/datas/status e aviso de histórico |
| V5 | 00:49–00:50 | Integrantes | Tabela e filtros desktop |
| V6 00-46-22 | 00:00–00:28 | Integrantes e extrato Carlos | Período, saldo/crédito/último pagamento, débito/crédito/saldo acumulado, PDF/Excel/comunicações |
| V6 | 00:10–00:16 | Comunicação do extrato | Toast de envio simulado; não comprova e-mail/WhatsApp entregue ou arquivo exportado |
| V6 | 00:31–00:44 | Relatórios | Tipos, competência/datas e troca de conteúdo para exportação contábil; sem comprovar arquivos reais |
| V7 00-47-14 | 00:00–00:05 | Relatórios | Continuação desktop |
| V7 | 00:07–00:20 | DRE | Demonstrativo, competência, orçado×realizado e comparativo; exibição não comprova cálculo por mudança de mês |
| V7 | 00:22–00:34 | Plano de Contas / novo plano | Selecionado/vigente/vigência/91 linhas, duplicar ou vazio; botão de validação e toast sem sobreposição |
| V7 | 00:37–00:55 | Estrutura hierárquica | Códigos/descrições/classificação/status; grupos/analíticas/patrimônio e ações por linha |
| V7 | 00:55–01:01 | Nova conta / descarte | Linha de rascunho e confirmação “Descartar esta nova conta?”; depois removida da tela |
| V7 | 01:04–01:13 | Configurações DRE | Plano/regime/comparativo/resultado/patrimônio; cobertura e link à estrutura |
| V7 | 01:16–01:22 | Chamados da Loja | KPIs/lista/busca/status, metadados e abrir/responder; conversa própria completa não demonstrada |
| V7 | 01:25–01:35 | Cadastros, cargo e perfis | Cargo/status; perfil e quatro permissões; modais afirmam “Protótipo visual — não salva dados” |
| V7 | 01:37–01:53 | Configurações da Loja | Identidade/logo/assinatura/suporte/4 temas/governança/portal/notificações/importação/backup/auditoria/cargos |

## Cobertura visual por tela do inventário

“Observada” significa composição visível em um ou mais quadros, não fluxo integral aprovado. Contexto tenant observado: Aurora / André. Para segunda Loja/Tesoureiro e mobile: pendente em todas as linhas.

| Tela | Evidência desktop | Extensão ainda necessária |
|---|---|---|
| view-master | V1 início | Todos os alertas/links/indicadores com consultas reais |
| view-master-clientes | V1 00:45 | Filtros, ambos os 360º, etapas 2–5 e onboarding concluído |
| view-master-cobranca | V1 01:16, V2 início | Política/automação/acordo/estorno/anulação, parciais e persistência |
| view-master-planos | V2 00:13–01:13 | Código HTML V35, filtros preenchidos, salvar/reativar/bloqueios e vínculos |
| view-master-operacao | V2 01:13–01:49 | Todas as cinco abas, chamados internos/tenant, SLA/AAL2 e sessões reais |
| view-master-config | V2 01:52 | Todos os grupos, fundo do modal e gravação/versionamento |
| view-dashboard | V3 | Datas, todos os modos e cinco formulários de ações rápidas |
| view-integrantes | V5 final, V6 | Cadastro/edição/isento/mensalidade individual, filtros e dados de outros integrantes |
| view-financeiro | Evidência insuficiente | Abrir tela, lançamentos, cobranças, pagamentos, mensalidades, ágape e negociação |
| view-inadimplencia | V3 | Todas as faixas/detalhamento e período |
| view-tesouraria | V4 | Importar, validar, vincular/desfazer conciliação, orçamento/fundos/movimentos |
| view-fluxo-caixa | V4/V5 | Séries/modos, datas, projeção e cálculos reais |
| view-contas-pagar | V3/V5 | Salvar, aprovar, liquidar, corrigir/estornar/cancelar e anexos privados |
| view-contas-receber | V5 | Novo recebível, parcial/total, alocação e correção |
| view-dre | V7 início | Competência alterada com resultado coerente, comparativos reais |
| view-plano-contas | V7 | Abas Categorias/Regras, Contas/Fundos, Formas; salvar/excluir/desativar com dependências |
| view-config-dre | V7 | Todas as opções, mapeamento e persistência/versionamento |
| view-relatorios | V6/V7 | Todos os cinco conteúdos, PDF/Excel abertos e filtros reais |
| view-cadastros | V7 | Cadastro de integrante completo e CRUD real de cargos/perfis |
| view-configuracoes | V7 final | Quatro temas aplicados, governança alterada/salva, LGPD/importação/backup/assinatura |
| view-chamados | V7 | Abrir/responder/reabrir e estados de conversa própria; isolamento |

## Ajustes de interface identificados

São recomendações de implementação, não alterações aplicadas nem vulnerabilidades comprovadas.

| ID | Evidência | Ajuste / aceite |
|---|---|---|
| VIS-01 | V1 detalhes da fatura; V6 drawer do integrante | Rolagem horizontal interna mesmo no desktop. Rever larguras/quebra monetária; preservar todas as colunas e permitir scroll previsível em telas pequenas |
| VIS-02 | V7 ~01:31 perfis/permissões | Checkboxes afastados dos textos em linhas altas. Agrupar checkbox e rótulo, área clicável coerente, foco e leitura por teclado |
| VIS-03 | V2 novo plano/oferta/resposta e V7 novo plano contábil | Textareas brancas e modais azuis destoam do tema Escuro Ouro. Padronizar tokens de tema sem perder contraste; testar todos os temas |
| VIS-04 | V1/V2 alerts de formulário vazio | Substituir alert genérico por erro junto ao campo, foco no primeiro inválido e mensagens específicas; manter a validação obrigatória no servidor |
| VIS-05 | V1 fatura de consulta com botão “Confirmar” | Dar nome à ação real: Fechar, Registrar pagamento, Salvar política etc.; não sugerir comando financeiro em simples consulta |
| VIS-06 | V2 formulário de configurações extenso | Garantir rodapé de ações acessível, rolagem do conteúdo independente, aviso de alterações e comportamento em viewport baixo/mobile |
| VIS-07 | Textos auxiliares cinza, botões/tabelas pequenos em várias telas | Medir contraste/tamanho e alvo de toque; não foi medido WCAG nesta revisão, nem homologado mobile |
| VIS-08 | V2 histórico de planos e edição de sucessor | Preservar nome/código editáveis no rascunho, snapshots anteriores, filtros e exclusão com confirmação/bloqueios. Não implementar a limitação V34 superada |

## Pendências para encerrar a revisão do piloto

1. RESOLVIDO: HTML V35 recebido, inventariado e preservado; V34 permanece histórico.
2. AMOSTRA RECEBIDA: V9 mostra Ricardo na segunda Loja com o mesmo layout e aviso de assinatura em atraso. Falta verificar permissões/bloqueios reais; não exigir gravação duplicada de todas as telas. Gravação visual não substitui JWT/RLS negativo.
3. Registrar mobile e os quatro temas aplicados; conferir menus, foco, campos/modais, gráficos e scroll.
4. Complementar Financeiro dos Integrantes, três subabas restantes da estrutura, cadastro de integrante e cinco ações rápidas; onboarding etapas 2–5; mudanças/ciclo do Cliente 360º.
5. Homologar resultados de salvar/confirmar/gerar/importar/exportar, bloqueios de exclusão com histórico, correções, suporte temporário e contratos. Uma gravação cancelada ou toast “simulado” não comprova conclusão real.
6. Executar a mesma matriz no aplicativo React/Supabase DEV com dados persistidos e autorização real. Não promover protótipo local a aplicativo final por aparência.

A revisão das gravações recebidas está registrada. A homologação integral visual/funcional das duas lojas, do Master, do mobile e do sistema real permanece aberta. Nenhuma funcionalidade ou requisito foi removido por falta de gravação.

## Complemento — V8/V9 e fonte V35 recebida

Agora são nove vídeos, 613,45 segundos (aproximadamente 10min13s). Os dois novos têm 1920×1020; revisão por quadros a cada três segundos e detalhes selecionados, sem revisão de cada frame, áudio, execução do app ou prova de persistência. Fonte V35 recebida e conciliada em V35_PILOT_RECONCILIATION.md. Pendências anteriores de recebimento/segunda amostra visual foram resolvidas; os limites funcionais continuam.

| Vídeo / trecho | Observado | Limite |
|---|---|---|
| V8 01-05-44, 00:10–00:16 | Busca CAR mostra Carlos; L mostra Carlos/Marcos; limpar recupera quatro linhas e totais | Implementar filtros reais; dados demonstrativos |
| V8 00:20–00:42 | Extratos Carlos e Marcos, períodos e saldos distintos; Marcos tem mensalidade 150 e mútuas 9×50=450, saldo 600 | Botões de PDF/Excel visíveis; arquivo exportado não inspecionado |
| V8 00:47–00:56 | Seleção de faixas até 30, 31–60 e acima de 90 dias altera detalhes e destaque | Não afirmar todas as faixas executadas; validar cálculo real por posição |
| V9 01-07-00, 00:00–00:10 | Ricardo/Tesoureiro, Fraternidade do Oriente, mesmo dashboard; aviso de atraso/tolerância | Não prova bloqueio de escrita; revisar quebra de valores monetários nos cards |
| V9 00:12–00:39 | Inadimplência, Fluxo de Caixa, Integrantes, Relatórios/Fechamento mensal, DRE e Configurações DRE | Navegação e conteúdo visíveis; sem gravações reais ou tela mobile |

A segunda loja usa o mesmo template, conforme proprietário. Comparar estados/papéis e isolamento no app real, sem repetir o inventário de layout por loja. Financeiro dos Integrantes continua sem evidência visual suficiente de seus fluxos; seu código/funções e requisitos permanecem preservados.
