## Atualização de execução — 25/11/2026

Aprovação permanece válida com as quatro ressalvas. PRs #68/#69 integrados; DRE Gerencial e editor Master entregues em código/testes. Migrations de identidade e aceite aplicadas somente DEV; cadastro real adiado ao final. Nenhuma limpeza/PROD. Estado técnico, versões, evidências e bloqueios em ../SESSION_HANDOFF.md e V35_MIGRATION_RECONCILIATION_DEV.md. O checkpoint inicial abaixo é histórico.

---

# CORSYS V35 — Aprovação consolidada e ressalvas vinculantes
Identificador: AC-V35-20261125-v1 — aprovação com ressalvas em 25/11/2026.  
Estado: **APROVADO_COM_RESSALVAS — EXECUÇÃO DEV AUTORIZADA**.  
Origem: resposta expressa do proprietário nesta conversa. A aprovação cobre o pacote A01–E08 abaixo, com as quatro alterações que prevalecem sobre a proposta original. Não autoriza produção nem publicação jurídica sem os gates profissionais previstos.

## Ressalvas aprovadas e efeito na execução

1. **DRE Gerencial:** a DRE do produto é uma visão gerencial de resultado por competência, para apoiar decisões da Loja. A apresentação deve usar “DRE Gerencial” em navegação, telas e arquivos exportados. A DRE contábil oficial é elaborada pelo contador. Preservar origem dos fatos, conciliação, cálculos, permissões e categorias; o novo título não converte caixa em competência nem autoriza inventar rubricas. B01 e a apresentação de B02/B05 ficam ajustados. Diário/Razão não foram excluídos pelo proprietário e conservam o escopo aprovado e gates próprios; a ressalva do DRE não será usada para expandir escrituração oficial.
2. **Sigilo:** abranger todo conteúdo e contexto inserido no sistema, inclusive dados cadastrais, vínculos, mensagens, documentos, financeiro, credenciais e metadados que possam revelar informações reservadas. Somente acesso autorizado, necessidade do serviço e obrigações legais aplicáveis, com mínimo necessário e auditoria. Sem promessa de sigilo absoluto contra obrigação legal, sem acesso especial por vínculo maçônico e sem uso comercial/treinamento de IA.
   - Cláusula a incorporar às minutas: “A prestadora e as pessoas autorizadas a operar ou dar suporte ao CorSys assumem dever de confidencialidade sobre todo conteúdo e informação a que tenham acesso no sistema. O uso e a divulgação ficam limitados à execução autorizada do serviço e às hipóteses legalmente exigíveis, com acesso mínimo, controles e rastreabilidade.”
   - Menção discreta autorizada, sem nome ou dado pessoal adicional: “Concebido por um integrante da Maçonaria, o CorSys valoriza a discrição e a preservação do sigilo.” A menção é institucional; não altera permissões nem substitui proteção técnica.
3. **Identificação da prestadora:** CNPJ e demais dados reais serão preenchidos apenas no final. Até lá, nulos/“Não informado”, sem dados fictícios apresentados como identidade real. O Master do SaaS deve poder cadastrar/editar esses campos com MFA, validação, controle de concorrência e auditoria, mantendo snapshots dos documentos/contratos já emitidos. A04 deixa de bloquear desenvolvimento/homologação técnica e permanece requisito para publicação jurídica e início comercial. A tela atual somente leitura é uma lacuna de implementação; não declarar editável antes de criar e homologar o fluxo.
4. **Entrada sem cadastros de homologação:** proprietário informa que não existem clientes comerciais. O resultado desejado é início da operação com base de clientes e fatos de negócio vazia. A preparação recomendada é PROD novo/isolado, sem copiar seeds, dumps ou fatos DEV; preservar evidências técnicas e controles de segurança fora do cadastro de clientes. Manter somente uma organização/conta de teste permanente no DEV, separada da operação real. Usuários de teste temporários necessários ao quórum são revogados ao fim do ensaio; conta Master operacional permanece separada e necessária. Nenhuma eliminação/reset é executada agora; manifesto de alvos e verificação de base limpa entram no gate final. A declaração “não temos clientes” não prova que todo registro existente possa ser apagado: conferir e delimitar antes de qualquer limpeza irreversível.

## Registro por decisão

| IDs | Estado | Regra final / ressalva |
|---|---|---|
| A01–A03 | APROVADO_COM_RESSALVAS | Minutas/aceite com sigilo reforçado; aprovação de direção, revisão profissional antes de uso real |
| A04 | APROVADO_COM_RESSALVAS | Cadastro real adiado ao final; edição Master/MFA obrigatória |
| B01 | APROVADO_COM_RESSALVAS | DRE exclusivamente gerencial na apresentação do produto; oficial pelo contador |
| B02–B03 | APROVADO_COM_CONDICAO | Integridade/classificação gerencial preservadas; validação profissional nos efeitos de escrituração |
| B04–B05 | APROVADO_COM_CONDICAO | Diário/Razão e plano versionado mantidos no pacote; sem promessa de livro oficial sem requisitos próprios |
| B06 | APROVADO | Casos financeiros faltantes com fixtures novas; regras vigentes preservadas |
| C01–C07 | APROVADO | Preços 125/180, 3/10 acessos, mês civil e demais condições da proposta; identidade real ao final |
| D01–D06 | APROVADO_COM_RESSALVAS | Desenvolvimento e testes liberados; direitos/retencão com gates profissionais; base inicial limpa e conta QA isolada |
| E01–E07 | APROVADO | Autonomia contínua no DEV dentro dos limites; inclui integrar PR apto e deploy automático DEV |
| E08 | APROVADO_COM_RESSALVAS | Preparar PROD isolado e sem sementes; implantação/limpeza final somente no gate produtivo |

A aprovação inclui o destino e limite de e-mails de teste de E05; não amplia isso a contatos obtidos do banco. Revisões de plataforma/tela são técnicas e não exigem novas decisões do proprietário se preservarem estas regras. Registrar BLOCKED e seguir trabalho independente quando faltar ferramenta/credencial.

## Checkpoint inicial do Lote 01
- PR #67 integrado por squash em `f9e1f56cb4ecc78ba454acfff5dbe7e28c561d96`, após CI da revisão `581ba2f` 3/3 PASS.
- PR #50 fechado como SUPERSEDIDO sem merge antigo: fixture e lockfile iguais à main; main já contém runner endurecido e teste de hardening. Evidências de restore histórico preservadas; M05 não promovida automaticamente.
- DNS do shell impede clone direto; cópia isolada reconstruída pelos blobs Git e hashes conferidos, sem tocar cópias antigas.
- Nenhum dado DEV apagado, nenhuma migration aplicada, nenhum PROD acessado neste checkpoint.
- Próximo trabalho executável: identificação gerencial da DRE e edição segura dos dados da prestadora; M06.02 permanece CONCLUIDO.

## Texto da aprovação recebida

> Aprovo, porém com algumas ressalvas:
> - O DRE deve ser um DRE Gerencial para não se confundir com um DRE contábil que deve ser feito pelo contador.
> - A parte jurídica sobre questões filosóficas deve ter descrito o sigilo sobre tudo que estiver no sistema; pode haver menção discreta de que o criador faz parte da Maçonaria e zela pelo sigilo.
> - CNPJ e outras informações do SaaS serão cadastrados somente no final; os campos devem ser editáveis pelo Master.
> - Não existem clientes; a operação deve começar sem cadastros de homologação, mantendo somente uma conta de teste para testes futuros e investigação de problemas.

Transcrição normalizada de ortografia, sem mudança de sentido. O texto original da mensagem permanece a origem da autorização.

---

## Proposta-base aprovada, sujeita às ressalvas acima

O conteúdo abaixo preserva a versão apresentada para aprovação. Onde divergir, prevalecem as ressalvas e o registro por ID acima. Menções históricas a “aguardando aprovação” são do estágio de proposta e estão superadas.

# CORSYS TRONCO DIGITAL V35 — Aprovação consolidada de fechamento
Versão da proposta: AC-V35-20261125-v1  
Data: 25/11/2026 — America/Sao_Paulo  
Estado: **PROPOSTA — AGUARDANDO APROVAÇÃO DO PROPRIETÁRIO**  
Este documento não registra aprovações ainda não recebidas, não publica termos, não altera contratos e não autoriza PROD.

## 1. Como aprovar uma única vez

Aprovação sugerida:
> Aprovo AC-V35-20261125-v1, decisões A01–A04, B01–B06, C01–C07, D01–D06 e E01–E08, incluindo as regras propostas e os anexos, com as condicionantes jurídicas/contábeis descritas. Autorizo a execução contínua no DEV dentro desses limites. Alterações: [nenhuma ou IDs e nova regra]. Dados operacionais: [campos do item A04].

Aprovar os itens profissionais significa aprovar a direção e autorizar implementação/testes fictícios. **Não equivale a parecer jurídico, assinatura de contador ou aprovação para usar dados reais.** A revisão profissional é um gate de evidência, não uma nova autorização técnica do proprietário. Se o profissional exigir mudança material de preço, obrigação, finalidade, retenção ou reconhecimento contábil, somente essa mudança volta para decisão. Ajustes redacionais sem mudança de efeito são versionados e documentados.

Depois da resposta, registrar por ID: regra final, estado APROVADO/APROVADO_COM_CONDICAO/REJEITADO, origem da aprovação, data/hora, commit e limites. Manter este mesmo documento como registro canônico; cursor/handoff apenas o referenciam. Não transformar silêncio, aprovação de CI ou este arquivo em autorização.

## 2. Base preservada e diferenças verificadas

- Main: `62a6ba87bd30b85bee4f6aa640b25bd3b02aae90`, conferida nesta rodada.
- PR #67: aberto, rascunho, `581ba2fc5caf78a2fc84edb2f837611417493204`, static/onboarding/frontend SUCCESS. Evidência anterior: 629 testes, incluindo conciliação 12/12. Ainda não integrado.
- PR #50: aberto, rascunho, `ecf4b3efdee588cfb417a270032ba03af38ca31e`, três checks SUCCESS. Existe evidência de restore descartável e registro documental de hardening 9/9. A leitura efetiva do runner nessa HEAD ainda encontrou impressão de SOURCE_CONN/RESTORE_CONN e ausência das guardas de hardening. Portanto o PR NÃO está apto a merge só por CI verde: portar/corrigir essas proteções e comprová-las antes de integrar.
- M06.02 CONCLUIDO, preservando paginação visual além da primeira página NOT EVALUATED e risco residual de deadlock 40P01. Não reabrir automaticamente.
- Timezone DEV aplicada como `20261115184137`; Grupo A HTTP read-only 5/5 PASS. Não reaplicar nem repetir sem mudança invalidante.
- M01.03: arquivo `20261109233000_v35_onboarding_acceptance.sql` ainda registrado como pendente. Conferir histórico remoto imediatamente antes da eventual aplicação autorizada.
- Preços R$125/R$180, cobrança manual, suporte interno/WhatsApp manual, npm, arquitetura React/TypeScript/Vite/Supabase/Cloudflare e exclusão de repasse neutro já decididos. Não são submetidos novamente.
- A emissão atual exige preço contratual unívoco cobrindo mês completo (ADR-0039). A proposta C02 respeita essa fronteira.

| Macro | Estado efetivo | Dependências para encerramento |
|---|---|---|
| M00 | CONCLUIDO | Manutenção do registro de execução; sem reconstrução |
| M01 | PARCIAL / gates pendentes | A01–A04; jornada real de convite/aceite; E05/E06 |
| M02 | EM_EXECUCAO | Aceites financeiros específicos e testes faltantes; B06/E04 |
| M03 | BLOQUEADO_DECISAO_CONTABIL / implementação parcial | B01–B05 e validação profissional; Diário/Razão completos |
| M04 | PARCIAL_HOMOLOGADO_DEV | C01–C07; faturamento, contrato e sessões de suporte |
| M05 | PARCIAL / decisões e gates pendentes | D01–D06; recuperação, privacidade e integração segura #50 |
| M06 | EM_EXECUCAO | M06.01/M06.03; M06.02 preservada CONCLUIDO |
| M07 | BLOQUEADO_PARA_IMPLANTACAO | Preparação E08; gate final PROD e aceites M00–M06 |

## A — Termos e onboarding

### A01 — Conteúdo dos Termos de Uso
**Aprovar:** a minuta completa do Anexo I, incorporando as condições C01–C07.
- **Recomendação e justificativa:** licença por Loja, responsabilidades claras, preços/contrato versionados, dados do cliente preservados, cancelamento/exportação e suporte definidos. Evita contrato desconectado do produto.
- **Impactos/riscos:** texto vinculante e possível incidência de normas obrigatórias conforme o caso. Exige revisão jurídica antes de publicação para clientes reais; não impor renúncia ampla de direitos nem exclusão genérica de responsabilidade.
- **Regra proposta:** “Adotar o Anexo I como minuta v1.0.0, vinculada ao quadro comercial deste documento. Publicar somente após preenchimento de A04, revisão jurídica registrada e comprovação de que o texto corresponde ao comportamento entregue.”

### A02 — Política de Privacidade e tratamento por instrução da Loja
**Aprovar:** minuta do Anexo II e regras D01–D06.
- **Recomendação e justificativa:** distinguir a Loja, que decide finalidades de seus cadastros/finanças, da prestadora, que trata esses dados por instrução; a prestadora responde separadamente por cadastro comercial, segurança e faturamento próprios.
- **Impactos/riscos:** a vinculação a organização filosófica pode revelar dado sensível. Classificação e base do art. 11 precisam análise jurídica concreta; aceite do administrador não é consentimento de todos os integrantes. Suboperadores e transferências internacionais devem ser documentados antes do uso real.
- **Regra proposta:** “Sem venda de dados, publicidade comportamental ou uso do conteúdo de Lojas para treinar IA. Tratamento mínimo, acessos auditados, finalidade e base por categoria. Registrar instruções e obrigações de operador no Anexo II; revisar juridicamente o tratamento sensível e as transferências antes do uso real.”

### A03 — Versão, vigência e mecanismo de aceite
**Aprovar:** início de validade por publicação prospectiva, sem retroatividade.
- **Recomendação e justificativa:** documentos v1.0.0; vigência no instante de publicação autorizado após revisão; versão/hash/identidade/Loja/timestamp no recibo. É compatível com o aceite já implementado.
- **Impactos/riscos:** texto, metadados ou hash ausentes/divergentes bloqueiam ativação. Nova finalidade que exija consentimento não pode ser aprovada apenas por atualização dos Termos.
- **Regra proposta:** “Exibir integralmente os documentos; checkbox de aceite contratual inicialmente desmarcado e ciência de privacidade distinta. Ativar a Loja somente após identidade confirmada, vínculo elegível e aceite válido. Alteração material exige nova versão e aceite conforme o efeito; negativa preserva exportação e suporte seguro. Guardar UTC na auditoria e exibir data local. Nenhum termo fictício será publicado como vigente para cliente real.”

### A04 — Jornada e dados do responsável
**Aprovar:** onboarding assistido pelo Master, sem cadastro comercial público automático.
- **Recomendação e justificativa:** conservar cinco passos: cadastro, plano/preço, Loja/perfil mínimo, plano contábil aprovado, convite/ativação; uma conta inicial de administrador legítimo, sem acesso Master para o cliente.
- **Impactos/riscos:** faltam dados cadastrais da prestadora e contato público; não podem ser inventados. Identidade empresarial não se confunde com marca.
- **Regra proposta:** “Provisionamento retomável e idempotente; convite só após pré-condições. Primeiro acesso não dispensa aceite. Credenciais pessoais, MFA e senhas não serão criados ou alterados em nome do cliente. Para uso real, preencher razão social/nome legal, CNPJ ou identificação aplicável, endereço, e-mail de suporte/financeiro/privacidade e representante contratante. Enquanto faltarem, testar apenas com identificação fictícia explícita no DEV.”

**Dados a fornecer uma única vez, se ainda não documentados:** identificação legal da prestadora; contato público de suporte/privacidade e WhatsApp; responsável operacional; profissional jurídico/contábil ou forma de registrar seus pareceres. Não enviar senha, chave, token ou certificado. Domínio definitivo pode ser informado no gate de produção, sem impedir DEV.

## B — Contabilidade e financeiro

### B01 — Regime e apresentação da DRE
**Aprovar:** competência para resultado, caixa para movimentos, sem misturar as duas visões.
- **Recomendação e justificativa:** receita/despesa no fato gerador validado, recebimento/pagamento apenas liquidam saldos. Para entidades sem fins lucrativos, apresentar também a nomenclatura superávit/déficit sem retirar a tela DRE.
- **Impactos/riscos:** o plano e a realidade de cada Loja exigem validação do contador; o sistema não gera conformidade fiscal apenas por mostrar relatório.
- **Regra proposta:** “DRE: Receitas Brutas → (-) Deduções → Receitas Líquidas → (-) Custos → Resultado Bruto → (-) Despesas Operacionais → Resultado Operacional → (+/-) Resultado Financeiro → Superávit/Déficit. Rubricas sem movimentos válidos mostram zero; movimento sem mapeamento bloqueia o relatório integral, sem classificação por descrição.”

### B02 — Receita, deduções e eventos de correção
**Aprovar:** mapeamento explícito por conta analítica, versão do plano e competência.
- **Recomendação e justificativa:** mensalidade/contribuição própria reconhecida conforme exigibilidade/competência aprovada; doações e receitas institucionais por natureza e condições. Isenção definida antes da geração reduz a obrigação a nascer; não cria receita/dedução fictícia.
- **Impactos/riscos:** estorno de recebimento não desfaz automaticamente receita; descontos, cancelamentos, abatimentos e devoluções podem ter natureza distinta. Mútuas/ágapes precisam conta vinculada ao fato, sem presumir natureza pelo nome. Repasse neutro continua excluído.
- **Regra proposta:** “Usar o Anexo III como matriz proposta. Contador valida o mapeamento de cada tipo de evento e exceção. Se não houver classificação aprovada, manter rascunho e impedir contabilização real/integral, sem apagar o fato operacional.”

### B03 — Competência, fechamento e retificação
**Aprovar:** períodos mensais; correções rastreáveis e sem edição retroativa silenciosa.
- **Recomendação e justificativa:** competência original preservada; correção em período aberto por evento compensatório. Reabrir período fechado somente por papel autorizado, motivo e trilha.
- **Impactos/riscos:** ajustes de exercícios anteriores podem exigir tratamento específico, que deve constar do mapeamento profissional. Não automatizar ajuste no mês atual quando a regra contábil exigir retificação anterior.
- **Regra proposta:** “Sem posting em período fechado. Quando necessária retificação, usar o procedimento de reabertura existente e nova versão/reemissão de relatório identificada; preservar documentos antes emitidos. Exceção de exercício anterior exige regra profissional registrada. Fuso da Loja define data civil; auditoria conserva timestamps UTC.”

### B04 — Diário, Razão e saldos de abertura
**Aprovar:** partidas dobradas canônicas server-side e cobertura completa dos eventos do Anexo III.
- **Recomendação e justificativa:** saldo de caixa e projeção de resultado isolados não constituem um Diário. Evento, contas, competência, valores e origem devem ser conciliáveis em centavos.
- **Impactos/riscos:** é incremento relevante de banco; depende de matriz profissional. Não completar abertura ou histórico inventando contrapartida “diversos”. Legado sem documentação permanece non-posting e destacado.
- **Regra proposta:** “Por evento/Loja/moeda: débitos = créditos; partidas imutáveis, reversões compensatórias, chave idempotente e referência ao fato. Diário cronológico e Razão por conta, com abertura, movimentos e saldo. Demonstrar cobertura do universo do período; lacuna impede selo de relatório integral. Backfill de dados reais e balanço de abertura real ficam fora da autorização DEV.”

### B05 — Plano contábil publicado e exportações
**Aprovar:** modelo inicial validado pelo contador e versões prospectivas por Loja.
- **Recomendação e justificativa:** reaproveitar rascunho/validação/publicação já existentes; impedir alteração de conta usada em histórico. Exportação é reprodução do mesmo universo consultado, não amostra da primeira página.
- **Impactos/riscos:** mudança de mapeamento não reclassifica passado automaticamente; emissão fiscal, SPED e assinatura digital de livros não estão implicitamente incluídos.
- **Regra proposta:** “Plano publicado imutável; sucessor com vigência explícita e mapeamentos testados. PDF/XLSX integrais para Diário/Razão/DRE com Loja, período, versão, filtros, totalizadores e contagens; exportação paginada completa. Também CSV/JSON na portabilidade. Nenhum arquivo será anunciado como livro fiscal autenticado sem requisitos específicos.”

### B06 — Políticas operacionais ainda sem aceite completo
**Aprovar:** validação dos parâmetros já configurados por Loja; testes de casos faltantes.
- **Recomendação e justificativa:** preservar política vigente, precedência já implementada de valores individuais, isenções, quórum e FIFO; não impor novos valores comerciais às Lojas.
- **Impactos/riscos:** pagamentos, estornos e negociação de fatos existentes não podem ser usados como fixture. Acordo deve preservar origem e não duplicar principal.
- **Regra proposta:** “Homologar com dados novos e fictícios: isenção integral/parcial, valor individual versus regra geral, geração mensal idempotente, dois aprovadores distintos com pagamento bloqueado até quórum, correção/estorno, acordo versus FIFO e relatórios conciliados. FIFO segue ordenação determinística já definida no projeto. Regras operacionais válidas permanecem; divergência material nova volta apenas com o caso concreto.”

**Validação profissional de B01–B05:** aprovar direção nesta rodada permite desenvolver motor e testes descartáveis. Antes de uso real e conclusão de M03, registrar parecer de contador sobre plano, competências, matriz do Anexo III, saldos de abertura, deduções e nomenclaturas. A aprovação do proprietário não substitui esse parecer.

## C — Comercial e administração SaaS

### C01 — Recursos e limites dos planos
**Aprovar:** diferenciação por número de usuários, com módulos da Loja completos nos dois planos.
- **Recomendação e justificativa:** Plano 125: 1 Loja e até 3 usuários ativos; Plano 180: 1 Loja e até 10 usuários ativos. Evita retirar funções obrigatórias da V35 e é simples de vender/administrar.
- **Impactos/riscos:** todos os usuários humanos com acesso à Loja contam, inclusive perfis vinculados de integrante quando houver login. Cadastro de integrante sem login não consome usuário. Funcionários Master/SUPPORT não são usuários da Loja. Contagem server-side; atingir limite bloqueia nova concessão, não apaga dados nem desativa usuários silenciosamente.
- **Regra proposta:** “R$125/mês: 3 acessos; R$180/mês: 10 acessos; mesmos módulos da Loja, relatórios e suporte de C06; sem limite comercial adicional de integrantes cadastrados. Capacidade e upload técnico permanecem limitados e transparentes; não prometer armazenamento ilimitado. Planos acima de 10 acessos exigem futura decisão, sem novo plano nesta V35.”

### C02 — Início, ciclo e primeiro faturamento
**Aprovar:** mês civil completo, evitando prorrata e alteração da regra contratual existente.
- **Recomendação e justificativa:** do aceite à virada do mês seguinte, avaliação sem cobrança; primeiro período pago começa no dia 1 do mês seguinte. Preço contratual válido para o mês inteiro; vencimento dia 10.
- **Impactos/riscos:** pode haver até aproximadamente um mês de avaliação sem receita. O término não comprova venda: ativação paga exige contratação expressa já registrada no onboarding. Não retroagir contrato ao início do mês.
- **Regra proposta:** “Avisar no aceite a data exata do primeiro ciclo pago e o valor. Avaliação termina antes dessa data; sem contratação confirmada, encerrar avaliação sem gerar fatura. Renovação mensal até cancelamento. Primeira fatura e subsequentes emitidas manualmente; preço deriva do contrato versionado, sem valor arbitrário no browser. Caso o cliente aceite no dia 1, seu primeiro ciclo pago ainda começa no mês seguinte, mantendo uma regra única.”

### C03 — Atraso, tolerância, suspensão e reativação
**Aprovar:** vencimento dia 10, tolerância de 7 dias corridos após a data efetiva de vencimento e suspensão somente de escrita.
- **Recomendação e justificativa:** preservar leitura/exportação, evitar perda de dados e separar saldo financeiro de restrição de acesso.
- **Impactos/riscos:** tratamento de vencimento em dia não útil e eventual comunicação exigem revisão contratual. Não presumir calendário de feriados completo. Evitar suspensão antes de confirmação do vencimento e saldo.
- **Regra proposta:** “Na V35, operador confirma vencimento efetivo e aplica suspensão manual após tolerância, com motivo/auditoria e revalidação server-side. Durante atraso dentro da tolerância, acesso normal e aviso. Suspenso: consulta/exportação e suporte seguro permanecem, novas gravações bloqueadas. Reativar por operador autorizado após pagamento integral validado ou acordo explícito. Sem multa/juros por padrão (0%); descontos/acordos somente por evento autorizado. Mecanismos de política configurável permanecem, sem ativação automática nesta versão comercial inicial.”

### C04 — Faturamento, pagamentos e obrigações fiscais
**Aprovar:** confirmação de recebimentos pelo operador, com segregação do financeiro das Lojas.
- **Recomendação e justificativa:** boleto/PIX/gateway não são necessários para faturamento interno manual. Comprovante sozinho não comprova crédito.
- **Impactos/riscos:** documento interno não substitui NFS-e/obrigação fiscal da prestadora. Exige contador definir a emissão fiscal externa pertinente, sem contratar integração automaticamente.
- **Regra proposta:** “Operador confere recebimento na conta da prestadora e registra pagamento, inclusive parcial, referência e alocação. Estorno/anulação são novos eventos. Preço, saldo e duplicidade validados no servidor. Meio e dados bancários reais serão informados fora de logs/repos; não movimentar dinheiro por automação. Emitir documento fiscal por processo externo validado pelo contador quando exigível, mantendo referência; integração fiscal permanece evolução futura.”

### C05 — Troca de plano, reajuste e cancelamento
**Aprovar:** efeitos no próximo mês completo, sem fidelidade ou multa de cancelamento inicial.
- **Recomendação e justificativa:** preserva snapshots e contrato de competência integral; reduz disputas e necessidade de prorrata.
- **Impactos/riscos:** downgrade pode exceder assentos; cliente precisa indicar quais acessos desativar. Direitos legais de desistência/restituição e falhas de prestação prevalecem sobre regra comercial.
- **Regra proposta:** “Upgrade/downgrade solicitado entra no próximo dia 1, com contrato prospectivo e ciência explícita. Sem reajuste automático ou migração silenciosa de clientes. Cancelamento programado ao fim do mês pago; interrompe renovações, preserva dívida já constituída e abre janela de exportação de D01. Cancelamento imediato por incidente/direito aplicável é tratado com justificativa e ajustes compensatórios, sem apagar histórico. Não cobrar meses futuros nem impor renúncia a direitos obrigatórios.”

### C06 — Suporte, sessões temporárias e atendimento
**Aprovar:** segunda a sexta, 9h–18h, horário de Brasília, exceto feriados aplicáveis.
- **Recomendação e justificativa:** primeira resposta em até 1 dia útil como meta operacional para ambos os planos; mesmo canal e prioridade por gravidade, sem promessa 24x7.
- **Impactos/riscos:** prazo de solução depende da causa. Meta não é SLA financeiro garantido; incidente crítico demanda escalonamento assim que detectado.
- **Regra proposta:** “Chamado no sistema é registro oficial; WhatsApp manual é canal auxiliar, sem envio de senha/OTP. Suporte a dados da Loja apenas em sessão read_only, motivo, escopo, banner, expiração de até 15 minutos e auditoria; nenhuma promoção do Master a administrador tenant. Operador autorizado registra intervenções; tickets internos continuam invisíveis à Loja. Não oferecer prioridade paga ou suporte exclusivo não previsto.”

### C07 — Publicação comercial, ofertas, identidade e domínio
**Aprovar:** catálogo inicial com exatamente dois planos comerciais ativos e nenhuma promoção nova automática.
- **Recomendação e justificativa:** versões publicadas e contratos preservados; evitar campanha/desconto não validado. Usar ambiente DEV atual até preparação final.
- **Impactos/riscos:** alterações comerciais devem ter vigência futura e não atingir assinaturas existentes. Domínio e cadastro legal ainda precisam dados reais antes do lançamento.
- **Regra proposta:** “Criar e testar planos comerciais em DEV, sem alterar o plano legado DEV de valor zero nem contratos existentes. Publicação de teste apenas em catálogo/tenant fictícios isolados. Publicação comercial PROD fica no gate final; não comprar domínio ou contratar serviço. Manter funcionalidades de promoções da V35, testadas com ofertas fictícias, mas iniciar operação sem promoção ativa. Usar identificação legal de A04; nenhum nome empresarial/CNPJ/domínio será inventado.”

## D — Privacidade e recuperação

### D01 — Retenção e janela após cancelamento
**Aprovar:** tabela de temporalidade por finalidade, com janela operacional de exportação de 90 dias.
- **Recomendação e justificativa:** separar janela de acesso, guarda de livros e ciclo de backups. Proposta contratual: cinco anos como piso de guarda dos fatos financeiros/contábeis necessários, prorrogável pela obrigação específica/preservação legal validada profissionalmente.
- **Impactos/riscos:** cinco anos não é prazo universal da LGPD nem licença para guardar todo cadastro. Pseudônimo e vínculo filosófico ainda podem ser dados pessoais/sensíveis.
- **Regra proposta:** “Após cancelamento: 90 dias de exportação autenticada sem novas operações financeiras; depois arquivar com acesso restrito. Guardar somente categorias necessárias ao dever documentado; contatos, preferências e anexos dispensáveis serão removidos/anonimizados conforme decisão do controlador. Registros financeiros mínimos: piso contratual proposto de 5 anos contado do encerramento do exercício relacionado, sujeito a prazo maior e parecer. Logs de acesso necessários: 6 meses como proposta inicial sujeita ao enquadramento legal; demais logs operacionais: 90 dias. Não executar eliminação automática de dados reais com esta aprovação.”

### D02 — Portabilidade e direitos dos titulares
**Aprovar:** exportação integral por Loja em formato aberto, com escopo por perfil.
- **Recomendação e justificativa:** CSV/JSON + dicionário, anexos elegíveis, contagens e totais; PDF/XLSX para relatórios. Exportação do titular não equivale ao banco de toda a Loja.
- **Impactos/riscos:** incluir dados de terceiros sem necessidade causa exposição. Links privados devem expirar; não enviar arquivos financeiros pelo WhatsApp.
- **Regra proposta:** “Administrador autorizado solicita exportação da própria Loja; titular recebe seus próprios dados após validação de identidade e análise do controlador. Sem secrets, dados de outra Loja ou tickets internos Master. Downloads autenticados, expiração e trilha; atender direitos segundo o prazo legal aplicável. Meta interna de triagem: 2 dias úteis; não adotar um prazo único para todos os direitos. Testar completude e capacidade de reuso, sem anunciar restauração automática por upload.”

### D03 — Anonimização e eliminação
**Aprovar:** fluxo com pedido, verificação de fundamento/retenção e execução auditada.
- **Recomendação e justificativa:** desativar acesso, minimizar identificadores e preservar apenas o vínculo estritamente necessário a fatos retidos. Não excluir linhas de ledger para atender um pedido.
- **Impactos/riscos:** trocar nome por UUID não é anonimização se a pessoa puder ser reidentificada; base sem obrigação de guarda deve ser eliminada quando aplicável.
- **Regra proposta:** “Retenção por obrigação será justificada por categoria. Quando houver anonimização, avaliar reidentificação por tabelas, descrições, anexos, logs e combinações de dados; quando reversível, classificar como pseudonimização, mantendo proteção. Eliminação definitiva de dados reais e irreversível de terceiros exigirá uma ordem específica do controlador e confirmação pertinente; a autorização consolidada cobre implementar e testar o fluxo apenas com dados fictícios.”

### D04 — Backup, restauração e objetivos de recuperação
**Aprovar:** RPO de até 24 horas e RTO de até 8 horas como metas de prontidão a comprovar, não garantias já prestadas.
- **Recomendação e justificativa:** cópia diária criptografada fora da base principal, retenção rotativa de até 35 dias, controle de acesso separado e teste de restore em ambiente isolado. Cobrir banco, objetos privados e configuração necessária à recuperação.
- **Impactos/riscos:** capacidades/custo da infraestrutura precisam medição; plano gratuito pode não cumprir as metas. Backup não substitui retenção legal do registro canônico. Exclusão deve propagar quando backups expirarem, sem ressuscitar dados após restore.
- **Regra proposta:** “Preparar/testar com dados fictícios e recursos sem custo novo. Comprovar restore, reconciliação e isolamento A/B, inclusive recuperação por tenant sem sobrescrever outras Lojas. Nunca restaurar dump por cima de DEV/PROD existente. Se a infraestrutura atual não atingir RPO/RTO, apresentar custo e alternativa no gate final; não declarar M05 concluída nem prometer essas metas antes da prova. Restore de dado real continua fora desta autorização.”

### D05 — Recuperação de acesso e segurança de contas
**Aprovar:** fluxo oficial de e-mail e recuperação privilegiada com dupla evidência.
- **Recomendação e justificativa:** reset por link expirável; resposta não revela existência da conta; recuperação de Master/MFA exige identidade do responsável e trilha, sem bypass permanente.
- **Impactos/riscos:** alteração de senha/fator pessoal depende de atuação do titular. Canal alternativo não pode ser uma mensagem informal suficiente para assumir conta.
- **Regra proposta:** “Homologar com contas próprias de teste; verificar expiração, reutilização, sessão e acesso correto à Loja. Nenhuma senha/token/secret no chat ou log. Para conta privilegiada, verificar autoridade, revogar acesso comprometido quando autorizado e exigir novo fator pelo titular. Não trocar credenciais existentes para facilitar teste. Sem identidade comprovada, bloquear recuperação manual.”

### D06 — Monitoramento e resposta a incidentes
**Aprovar:** monitoramento técnico mínimo e política de escalonamento.
- **Recomendação e justificativa:** acompanhar disponibilidade, erros de autenticação/autorização, falhas de jobs, backups e restauração; alertas sem conteúdo financeiro ou identificação sensível em mensagens.
- **Impactos/riscos:** comunicação legal cabe ao controlador/representante; não é ação autônoma de engenharia. Detecção não significa que já existe monitoramento contínuo funcionando.
- **Regra proposta:** “Instrumentar logs minimizados e alertas técnicos; objetivo de checagem de disponibilidade a cada 5 minutos onde suportado sem novo custo. Michael é responsável operacional inicial; canal é informado em A04. Comunicar incidente relevante ao responsável e à Loja sem demora injustificada, com meta interna de até 24 horas da ciência; profissional responsável avalia prazo/regra de comunicação à autoridade e titulares. Preservar registro de incidente por pelo menos 5 anos quando aplicável. Não enviar comunicação externa, admitir responsabilidade ou expor dados automaticamente. Sem canal/operador habilitado, prontidão operacional permanece pendente.”

## E — Autorizações técnicas e operacionais

### E01 — Branches, commits, PRs, documentação e aprovação persistente
**Aprovar:** autonomia para alterações necessárias à V35, com rastreabilidade.
- **Recomendação e justificativa:** trabalhar por lotes coerentes; atualizar este documento, contexto, ADRs pertinentes, arquitetura, segurança, handoff, cursor e quadro conforme impacto, sem duplicar relatórios.
- **Impactos/riscos:** trabalho local de outras sessões deve ser preservado. Não reescrever histórico ou descartar alterações do proprietário.
- **Texto proposto:** “Autorizo criar branches/commits/PRs, ajustar frontend/backend e testes, corrigir regressões e manter controles, exclusivamente para concluir a V35. Registrar aprovações por ID e prosseguir sem novas confirmações técnicas dentro deste pacote. Alteração de escopo, custo ou dados reais não está incluída. Decisões técnicas compatíveis cabem à engenharia.”

### E02 — Integração dos PRs #67, #50 e pendências antigas
**Aprovar:** merge condicionado a diff revisado, base conciliada e CI aprovado.
- **Recomendação e justificativa:** #67 pode seguir após conferir seu estado final; #50 requer corrigir o hardening ausente no runner efetivo e reconciliar lockfile contra a main, evitando regressão das dependências atuais. PR antigo aberto não significa trabalho faltante.
- **Impactos/riscos:** merge em main pode acionar build/deploy automático DEV. Não integrar lockfile antigo cegamente; não promover banco por mero merge.
- **Texto proposto:** “Autorizo integrar #67 e #50 e PRs necessários ao fechamento quando o diff estiver coerente, CI obrigatório PASS, segurança e preservação conferidas; incluir o build/deploy DEV automático decorrente. Adaptar #50 à base atual antes de integrar. Nos PRs antigos, preservar evidências e encerrar como supersedidos somente quando equivalência de código/decisão for demonstrada. Não fazer merge em lote às cegas nem incluir PROD.”

### E03 — Migrations exclusivamente DEV
**Aprovar:** migrations aditivas necessárias a M01/M03/M05 e correções delimitadas.
- **Recomendação e justificativa:** testar em PostgreSQL descartável, registrar revisão/hash e aplicar uma a uma no DEV conhecido.
- **Impactos/riscos:** migrations afetam esquema global de DEV; preservar fatos existentes. Qualquer transformação que possa alterar dados reais/existentes além do escopo autorizado bloqueia aplicação até delimitação específica.
- **Texto proposto:** “Autorizo elaborar, revisar, testar e aplicar migrations necessárias apenas no Supabase DEV szqkdekwhzxsoxorgvaz, incluindo M01.03 se ainda ausente. Exigir preflight, histórico remoto, teste descartável, privilégios mínimos, read-back e recuperação. Preservar 66 baselines e nove divergências de timestamp documentadas; não reaplicar SQL conhecido nem renomear arquivo histórico. Proibidos db reset, db push indiscriminado, migration repair e destruição/backfill de dados existentes sem nova decisão específica. PROFISSIONAL: só aplicar regras contábeis reais após parecer exigido em B.”

### E04 — Dados fictícios, cenários financeiros e sessões DEV
**Aprovar:** criar e alterar somente fixtures novas e identificadas.
- **Recomendação e justificativa:** usar tenants novos QA_CLOSURE_*, nunca as Lojas existentes como recipiente indiscriminado. Manifesto registra UUIDs, dados, ações e destino de cada fixture.
- **Impactos/riscos:** cenários precisam simular faturas, pagamentos, cancelamentos e suspensão sem movimentação de dinheiro. Alguns fatos devem ser preservados por imutabilidade.
- **Texto proposto:** “Autorizo criar tenants e identidades fictícias isoladas no DEV, atribuir/revogar apenas seus papéis, criar contratos/ofertas/faturas/pagamentos simulados e exercitar correções, estornos, acordos, aprovações, fechamento, suspensão/reativação e sessões read_only. Nenhuma conta bancária/provider real será acionada. Auditar tudo; limpar rascunhos elegíveis e encerrar sessões/roles temporários no finally; preservar ledger/audit imutáveis e marcá-los como teste. Nenhuma edição/exclusão de registro existente anterior ao manifesto. Se faltar capacidade de recuperar/encerrar fixture, não iniciar cenário.”

### E05 — E-mail de teste e identidades autorizadas
**Aprovar:** destino fechado para convites/reset e criação de acessos apenas de teste.
- **Recomendação e justificativa:** usar endereço de controle do proprietário: michael.c.carvalho+corsys-v35-qa@gmail.com, proposto como alias de teste, sujeito à confirmação de que ele controla o recebimento.
- **Impactos/riscos:** envia mensagem externa e concede acesso ao tenant fictício. Não enviar a clientes, integrantes ou endereços obtidos do banco.
- **Texto proposto:** “Autorizo até 10 e-mails transacionais de convite/recuperação por rodada de fechamento, somente ao alias de teste acima, usando o emissor DEV já configurado e tenants fictícios. Aprovação deste item confirma que controlo o destino; se eu indicar outro, registrar exatamente esse endereço antes do envio. Engenharia não acessa minha caixa postal ou OTP; eu confirmo recebimento e faço passos de senha/MFA quando necessários. Exceder o limite ou trocar destino requer autorização específica. Sem marketing/cobranças a terceiros nem serviço novo.”

### E06 — Testes automatizados, navegador e deploy DEV
**Aprovar:** execução e publicação DEV dentro dos limites anteriores.
- **Recomendação e justificativa:** usar automatizados para regras; navegador para autenticação, interação/visual e integrações que realmente dependam dele. Não condicionar toda a macroetapa a uma ferramenta indisponível.
- **Impactos/riscos:** limites da ferramenta não podem ser confundidos com PASS. Interceptação de resposta de teste não prova banco real. Operações de UI podem exigir intervenção pessoal por política da ferramenta.
- **Texto proposto:** “Autorizo testes locais/CI/descartáveis, homologação no navegador com sessão legitimamente autorizada, injeção de falhas somente em ambiente/cliente de teste, build e deploy do Worker corsys-tronco-digital-dev e Edge Functions do mesmo Supabase DEV. Preservar rollback e inspecionar versão/estado após deploy. Sem segredo no frontend, sem bypass de MFA/RLS, sem senha/fator criado por agente para pessoa real. Se a ferramenta exigir confirmação no momento ou ação do titular, interromper apenas esse passo e continuar tarefas independentes. Não repetir gates válidos sem motivo técnico.”

### E07 — Limite de custos, automações e integrações
**Aprovar:** orçamento incremental zero nesta fase; nenhum novo fornecedor.
- **Recomendação e justificativa:** aproveitar infraestrutura existente sem contratar gateway, plano pago, domínio ou serviço de monitoramento.
- **Impactos/riscos:** uso atual pode ter cobrança variável ou limite de franquia. Não garantir custo zero de consumo; verificar orçamento/limites antes de cargas, backups e jobs.
- **Texto proposto:** “Autorizo uso moderado dos recursos existentes dentro das franquias verificadas e sem aumento deliberado de cobrança. Nenhuma contratação, upgrade pago, compra, e-mail em massa ou publicação pública extra. Configuração de jobs técnicos DEV limitada a fixtures, com frequência e desligamento documentados; nenhuma automação Stripe/WhatsApp. Se a capacidade necessária exceder o que existe sem gasto novo, apresentar alternativa/custo no gate final ou solicitar apenas essa decisão se bloquear trabalho anterior.”

### E08 — Preparação PROD e único gate final
**Aprovar:** preparar todos os artefatos produtivos; não criar ou alterar ambiente produtivo real agora.
- **Recomendação e justificativa:** IaC/configurações com referências a secrets, checklist, sequência de migrations, backup/restore/rollback, orçamento e ensaio em ambiente descartável.
- **Impactos/riscos:** preparação não equivale a produção pronta nem permissão de ativar cliente. Deploy automático de main autorizado em E02/E06 é DEV.
- **Texto proposto:** “Autorizo preparar infraestrutura, configurações e plano de release PROD em código e documentação, sem aplicar em PROD, mexer DNS real, cadastrar segredos reais, importar dados de cliente ou iniciar cobrança. Encerrar M00–M06 com evidência e apresentar um único gate final com versão candidata, custos, domínio, identidade da prestadora, pareceres, migrations, recovery e riscos. Só após aprovação final executar criação/configuração produtiva e implantação autorizadas. Segredos são inseridos por canal seguro pelo titular/operador autorizado, nunca em documento/chat.”

## Anexo I — Minuta dos Termos de Uso v1.0.0

Estado: minuta para revisão jurídica. Campos de A04 são obrigatórios antes da publicação. Os IDs deste pacote definem condições propostas, não contratos vigentes.

1. **Partes e objeto.** A prestadora identificada em A04 fornece à Loja contratante acesso ao CorSys Tronco Digital V35 para gestão administrativa, financeira e contábil pelos módulos contratados. O representante da Loja declara poderes para contratar e administrar seus usuários. A ferramenta não substitui responsabilidade de profissionais habilitados nem presta serviço bancário.
2. **Plano e contratação.** Uma assinatura corresponde a uma Loja e à versão comercial identificada no aceite. Aplicam-se valores e acessos de C01, ciclo de C02 e vencimento informado. A interface deve mostrar valor, primeiro ciclo pago e condições antes da contratação. Dados da contratação permanecem acessíveis.
3. **Ativação e usuários.** Ativação exige identidade confirmada e aceite explícito. Cada usuário usa conta individual; compartilhamento de senha é vedado. A Loja concede e revoga acessos sob sua responsabilidade; não pode acessar outra Loja ou a administração da plataforma. MFA segue as regras de segurança aplicáveis ao papel.
4. **Serviço e dados.** Os cadastros, documentos e fatos financeiros são da esfera da Loja; a prestadora os trata para executar o serviço, observadas a Política e as instruções legítimas. São vedados dados ilícitos, exploração de falhas, credenciais compartilhadas e conteúdo dispensável à finalidade.
5. **Cobrança e recebimento.** Faturamento é manual e separado do caixa da Loja. Documento interno de cobrança não é documento fiscal. Pagamentos parciais reduzem saldo na proporção confirmada; estornos, créditos e ajustes mantêm trilha. Sem débito bancário automático ou encargos não contratados.
6. **Inadimplência.** Aplicam-se tolerância e limites de C03. Suspensão por inadimplência restringe gravações, preservando consulta/exportação e contato seguro, salvo restrição necessária de segurança ou obrigação legal. Regularização é conferida e auditada. Nenhum pagamento ou suspensão apaga o histórico.
7. **Alterações e cancelamento.** C05 rege efeitos prospectivos e cancelamento sem fidelidade inicial. Pedido é registrado, com data de efeito e último ciclo devido. Regras legais obrigatórias de desistência, restituição ou reparação não são afastadas. A versão contratada não muda silenciosamente.
8. **Suporte e manutenção.** C06 define canais e metas. Manutenções programadas serão informadas quando possível. Não se promete disponibilidade ininterrupta ou prazo universal de solução. Metas de backup/recuperação só serão oferecidas após ensaio e declaração da capacidade operacional.
9. **Responsabilidades.** Prestadora deve aplicar os controles e procedimentos que efetivamente entrega; Loja deve manter contatos, permissões, origem lícita e instruções corretas. Falhas e prejuízos são analisados conforme causa, deveres e legislação aplicável. Não há exclusão geral de responsabilidade, autorização para alterar fatos reais sem ordem ou obrigação de sigilo que impeça exercício de direitos.
10. **Encerramento, privacidade e histórico.** D01–D03 regem exportação e retenção mínima necessária. Retenção legal não autoriza uso comercial adicional. Solicitações do titular/Loja seguem canal identificado, verificação de autoridade e decisão fundamentada.
11. **Vigência e prova.** Efeito no instante de publicação e aceite segundo A03; recibo identifica versão, hash, usuário, Loja e timestamp. Alteração material exige procedimento de nova versão. O presente texto só será exibido como vigente depois do gate jurídico e preenchimento dos dados obrigatórios.
12. **Conflitos.** Buscar primeiro solução administrativa pelo canal de suporte, sem impedir medidas e direitos previstos em lei. Jurisdição competente é a legalmente aplicável ao caso; não impor foro exclusivo desfavorável por padrão.

## Anexo II — Minuta de Privacidade e instruções de tratamento v1.0.0

1. **Quem trata.** Loja controla finalidades de seus cadastros e fatos internos; prestadora atua como operadora nesses tratamentos segundo instruções documentadas. Para conta comercial, faturamento próprio, segurança e obrigações próprias, a prestadora define os tratamentos correspondentes. Identificação e contato constam de A04. A atribuição concreta de papéis será revisada juridicamente.
2. **Quais dados e por quê.** Identificação/contato necessários, vínculo e perfil, cobranças, pagamentos, documentos financeiros autorizados, mensagens de suporte e registros mínimos de segurança para operar, prestar suporte, cumprir obrigações e demonstrar integridade. Não coletar saúde, biometria, documentos ou detalhes filosóficos além dos requisitos necessários. A associação à Loja pode revelar dado sensível; finalidade e fundamento do art. 11 serão documentados por tratamento antes de uso real.
3. **Bases e escolhas.** Contratação, obrigação legal e demais fundamentos só são usados quando cabíveis à categoria/finalidade. Consentimento, quando necessário, é específico e destacado; não está presumido pelo aceite do administrador. Marketing e treinamento de IA com conteúdo da Loja não integram o serviço.
4. **Compartilhamento.** Somente pessoas autorizadas e fornecedores necessários ao serviço. Reaproveitar Supabase, Cloudflare e o emissor de e-mail já contratado/configurado; inventariar o fornecedor efetivo, região, finalidade, proteção e suboperadores antes de PROD. A lista não cria licença para enviar dados a um fornecedor novo. Transferências internacionais dependem do mecanismo juridicamente adequado e informação transparente.
5. **Segurança e acesso.** Isolamento por Loja, autorização server-side, MFA privilegiado, secrets protegidos, auditoria e suporte temporário somente leitura. Chamado interno e dados de outras Lojas não são compartilhados com o tenant. Não incluir senhas/OTP em tickets ou exportações.
6. **Guarda e fim.** Aplicar tabela D01 por finalidade; janela contratual de exportação não substitui prazo legal. Minimizar/arquivar apenas o necessário, eliminar o dispensável quando aplicável e honrar bloqueios de preservação legal fundamentados. Backups rotativos expiram e restaurações respeitam pedidos anteriores.
7. **Direitos.** Canal de A04 recebe pedidos de informação, acesso, correção, portabilidade e demais direitos aplicáveis. Validar identidade de forma proporcional, não pedir documento excessivo. Loja e prestadora cooperam conforme papéis; resposta fundamenta eventual retenção/restrição e observa o prazo aplicável, sem custo indevido ao titular.
8. **Instruções de operador.** Prestadora trata sob instrução lícita e delimitada; mantém confidencialidade, auxilia a Loja nos direitos/incidentes e limita subcontratação aos fornecedores informados. Instrução incompatível com lei/segurança é suspensa e escalada com justificativa. Não acessar dados internos sem atribuição/sessão legítima.
9. **Incidentes.** D06 define a resposta; prestadora fornece informações necessárias à Loja e preserva evidências. Comunicações à autoridade/titulares são realizadas pelo responsável competente quando cabíveis, não pelo agente automaticamente.
10. **Versões e contato.** Mudanças são informadas com efeito e data; finalidade ou fundamento novo recebe análise própria. Política, instruções, recibos e contatos reais ficam acessíveis. Nenhum preenchimento fictício será publicado como identidade real.

## Anexo III — Matriz contábil proposta para validação profissional

Contas abaixo são funções contábeis, não códigos definitivos. Conta analítica, natureza específica, competência, documento e eventuais tributos são validados pelo contador por Loja/plano. Não transformar esta matriz em posting de dados reais sem essa validação. Caso sem regra não recebe contrapartida inventada.

| Evento | Débito proposto | Crédito proposto | Controle e efeito |
|---|---|---|---|
| Mensalidade/contribuição própria exigível | Contribuições a receber | Receita de contribuições da competência | Reconhecer apenas fato gerador aprovado; isenção prévia não gera obrigação fictícia |
| Receita institucional própria a prazo | Recebíveis institucionais | Receita analítica apropriada | Segregar por natureza/competência |
| Doação sem condição a cumprir | Caixa/Bancos ou recebível elegível | Receita de doação apropriada | Elegibilidade do recebível e restrições dependem do documento; doação condicional exige regra própria |
| Recebimento de título já reconhecido | Caixa/Bancos | Recebível correspondente | Sem segunda receita; ratear principal/encargos por regra aprovada |
| Adiantamento/crédito sem título alocado | Caixa/Bancos | Adiantamentos/créditos a identificar de integrantes | Valor em passivo até alocação, sem receita automática |
| Alocação de adiantamento a título | Adiantamentos/créditos de integrantes | Recebível correspondente | Sem nova entrada de caixa |
| Despesa/custo incorrido | Despesa/custo ou ativo adequado | Obrigações a pagar | Destinação patrimonial não pode ser inferida como despesa |
| Pagamento de obrigação | Obrigações a pagar | Caixa/Bancos | Pagamento parcial baixa somente a parcela |
| Transferência entre contas | Conta financeira de destino | Conta financeira de origem | Sem efeito na DRE; mesmo fato, duas pernas |
| Tarifa/encargo bancário | Despesa financeira | Caixa/Bancos ou obrigação específica | Competência e fonte comprovadas |
| Juros/multa próprios efetivamente reconhecidos | Recebível apropriado | Receita financeira apropriada | Separar do principal; sem reconhecimento arbitrário de valor incobrável |
| Desconto/abatimento sobre título | Dedução de receita ou despesa financeira conforme regra | Recebível | Classificação depende da natureza; não usar sinal/descrição |
| Cancelamento de título reconhecido | Reversão de receita/ajuste de período aprovado | Recebível ou obrigação de restituir se já liquidado | Separar cancelamento do título e saída efetiva de caixa |
| Estorno de recebimento | Recebível ou passivo correspondente reaberto | Caixa/Bancos | Inversão do efeito efetivo, sem apagar pagamento original |
| Estorno de pagamento | Caixa/Bancos | Obrigação reaberta | Originais preservados; conciliar com devolução bancária |
| Mútuas, ágapes e lotes | Conforme natureza aprovada do evento | Conforme obrigação/receita própria aprovada | Não classificar pelo nome nem criar repasse neutro |
| Acordo/parcelamento | Recebíveis do acordo, quando cabível | Recebíveis originais reclassificados | Não duplicar principal; novas receitas só para encargos aprovados |
| Abertura patrimonial documentada | Ativos de abertura | Passivos e patrimônio social de abertura | Importar somente balanço validado; sem contrapartida genérica |
| Estorno/retificação contábil | Inversão ou compensação da partida elegível | Inversão ou compensação correspondente | Motivo, período, vínculo à origem e trilha |
| Reembolso/devolução | Recebível/passivo/conta de ajuste conforme origem | Caixa/Bancos ou conta revertida | Não pressupor despesa negativa; evitar dupla reversão |
| Fechamento/apuração | Contas de resultado e conta de apuração conforme plano | Contas de resultado/patrimônio social conforme plano | Procedimento de encerramento precisa regra do contador, sem dupla contagem |

Invariantes: soma de débitos e créditos igual em centavos por evento/Loja/moeda; competência/plano imutáveis no fato; replay não duplica; estorno compensa; sem cruzamento A/B; relatório demonstra reconciliação com origem e universo do período. Não apresentar certificado de conformidade fiscal ou substituir assinatura profissional.

## 3. Referências e limites da fundamentação

Fontes consultadas em 25/11/2026:
- LGPD, especialmente categorias sensíveis, art. 11, direitos e término/conservação: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- Marco Civil da Internet, enquadramento de registros de acesso: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- ANPD, comunicação de incidentes e Resolução 15/2024: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
- ANPD, registro de incidentes: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca
- CFC, catálogo oficial ITG 2000 (R1) e ITG 2002 (R1): https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/normas-especificas/

Base legal não é parecer sobre cada contrato/Loja. Prazos comerciais, assentos, janela de 90 dias e objetivos RPO/RTO são **propostas deste documento**, não exigências universais da lei nem capacidades já comprovadas. Referências do CFC identificam as normas pertinentes; o enquadramento e o plano serão validados pelo contador.

Fontes do projeto: PROJECT_CONTEXT.md, CURRENT_ARCHITECTURE.md, SESSION_HANDOFF.md, V35_EXECUTION_BOARD.md, V35_SESSION_CURSOR.md, V35_SCREEN_PARITY_MATRIX.md, RELEASE_CHECKLIST.md, ADR-0005, ADR-0039, ADRs V35 0020/0023/0026, issue #43, PRs #50/#67 e V35_MIGRATION_RECONCILIATION_DEV.md, lidos nesta continuidade. Pendências históricas supersedidas não foram reabertas.

## 4. Estado para retomada

- Macroetapa: fase inicial de decisão para fechamento M01–M07.
- Lote: preparação de aprovação consolidada; nenhum lote de execução liberado por este documento ainda.
- Entrega: 31 decisões numeradas (4 A + 6 B + 7 C + 6 D + 8 E), duas minutas e matriz contábil.
- Bloqueios reais: resposta do proprietário; dados de A04; pareceres jurídico/contábil para uso real; capacidades/credenciais e custos a verificar nas operações concretas.
- Próxima ação após aprovação: registrar regras aceitas neste arquivo e referenciar no cursor/handoff; executar o Lote 01 e tarefas independentes autorizadas, sem pedir autorização técnica novamente.
- Ferramentas: escolher a que execute a tarefa com evidência; Gemini quando apropriado à implementação, Work para operação autenticada, sem duplicar trabalho. Interceptação de navegador ausente não comprova falha do produto; usar ambiente de teste compatível para o gate.
- PRODUÇÃO: permanece fora da autorização até o gate final.
