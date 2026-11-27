# CORSYS — Governança Operacional dos Agentes e Continuidade

**Projeto:** Corsys.TroncoDigital V35  
**Versão:** 2.0 — 26/11/2026  
**Natureza:** Diretriz operacional permanente do Projeto.  
**Substitui:** `11_CORSYS_AGENT_GOVERNANCE.md`, versão 1.0.  
**Arquivo canônico recomendado no GitHub:** `docs/CORSYS_AGENT_GOVERNANCE.md`.

Esta diretriz consolida as responsabilidades definidas pelo proprietário e estabelece controles de execução, integração e continuidade. Complementa as instruções do Projeto, o CorSys Coding e o Execution Controller, sem substituir os requisitos de arquitetura, segurança, autorização ou homologação. Novas orientações expressas do proprietário prevalecem quando compatíveis com esses requisitos; mudanças materiais devem ser registradas nesta versão canônica.

## 1. Objetivo

Entregar o sistema com qualidade, segurança e rastreabilidade, reduzindo retrabalho, consumo de tokens, créditos, tempo e custos de infraestrutura. Cada atividade deve ser atribuída à ferramenta mais adequada e econômica que efetivamente possua a capacidade necessária. O Chat coordena o trabalho; nenhum agente deve repetir indiscriminadamente tarefas já concluídas por outro.

## 2. Regra obrigatória — Google AI Studio, Sync e Push

> **No ambiente Google AI Studio utilizado neste Projeto, o proprietário consegue vincular somente o repositório GitHub, não escolher a branch de destino pelo fluxo de Sync/Push. A integração da interface não deve ser tratada como um push Git convencional para uma branch isolada.**

Esta limitação foi observada pelo proprietário durante a operação do Projeto. Deve ser considerada em **todo prompt enviado ao Gemini**, inclusive em novas conversas e retomadas. Não presumir que uma branch criada pelo terminal do agente determina o destino da sincronização pela interface. Um commit local ou uma branch local não comprova publicação remota. O terminal também pode não possuir credenciais de escrita ou GitHub CLI.

### 2.1. Regras inegociáveis

- Não solicitar ao proprietário que selecione uma branch no Google AI Studio. Não orientar Sync/Push com a premissa de que será possível escolher uma branch isolada.
- Não autorizar Sync/Push indiscriminado de um workspace desatualizado ou contendo alterações acumuladas, arquivos exportados, patches, lockfiles não autorizados ou outras diferenças estranhas ao escopo.
- A interface pode sincronizar arquivos fora do escopo da entrega. Tratar qualquer Sync/Push como potencial publicação na branch principal até que o destino e o conjunto de alterações sejam comprovados.
- Não confundir resolução de conflitos com autorização para sobrescrever o repositório. Não usar force push, reset destrutivo ou reescrita de histórico.
- O Projeto utiliza **npm e `package-lock.json`**. Não introduzir `bun.lock`, `bun.lockb` ou outro gerenciador de dependências sem decisão formal de arquitetura.
- Patches de transferência, dumps, logs, arquivos temporários, credenciais, artefatos de build e cópias duplicadas de documentos não devem integrar a árvore ativa do produto. O `.gitignore` é defesa complementar, não garantia de que a interface de Sync o respeitará.
- Não usar Sync/Push como substituto de revisão de diff, PR e CI. Não usar o Gemini para modificar diretamente a `main` por padrão.

### 2.2. Fluxo padrão e contingências

1. **Chat:** identificar a revisão oficial do GitHub e delimitar os arquivos e contratos afetados. Evitar buscas repetitivas quando a revisão já estiver confirmada.
2. **Gemini:** preservar trabalho local ainda não integrado, usar a base oficial disponível, implementar somente o escopo autorizado e executar os testes compatíveis com seu ambiente. Se a base não puder ser sincronizada com segurança, declarar a diferença e produzir uma alteração incremental reconciliável.
3. **Gemini:** entregar diff incremental ou um patch único em relação à base declarada, com SHA do commit-base, SHA-256 e tamanho do patch, lista de arquivos, testes realizados e limitações. Para alterações pequenas, o conteúdo completo dos arquivos modificados pode ser entregue em vez de patch, desde que preserve a base e permita revisão. Não reaplicar patches históricos já integrados.
4. **Chat:** integrar via conector GitHub, preferencialmente em branch dedicada, com revisão do diff e PR. Quando necessário, o proprietário transfere somente o menor artefato indispensável; evitar downloads e uploads redundantes.
5. **GitHub Actions:** executar os gates proporcionais ao risco e os obrigatórios do Projeto. O Chat verifica os resultados antes de integrar; o merge respeita a autorização vigente, a revisão testada e os controles do repositório.
6. **Atualização do Gemini:** somente após a integração, reconciliar o workspace com o GitHub. Se houver mecanismo de atualização exclusivamente de entrada, preferi-lo. Se houver apenas Sync/Push bidirecional, preservar trabalho local e verificar todas as alterações e exclusões antes de concluir. Se não for possível inspecionar ou limitar o envio, cancelar e manter o fluxo de transferência incremental. O proprietário não deve ser instruído a escolher uma branch inexistente na interface.
7. **Conferência após sincronização:** o Chat consulta a revisão remota e o diff em relação ao último commit aprovado. Se surgirem alterações acidentais, interromper novos pushes, preservar evidências e preparar correção isolada por PR, sem reescrever o histórico nem perder funcionalidades.

### 2.3. Resolução de conflitos

- GitHub é a fonte oficial do código integrado. Em conflito de arquivo cuja alteração local já foi incorporada e validada no GitHub, preferir a versão GitHub (Keep do lado GitHub), após confirmar que ela corresponde à revisão oficial e preserva o conteúdo necessário.
- Se houver trabalho local ainda não integrado, preservar uma cópia e reconciliar a diferença antes de escolher qualquer lado. Não aplicar `Keep` global a arquivos desconhecidos.
- Se o Google AI Studio mostrar um arquivo local vazio ou excluído, não aceitar sua exclusão automaticamente.
- Se a interface apresentar novos arquivos, mudanças de permissão, lockfiles inesperados ou diferenças de código não revisadas, cancelar o envio e solicitar análise ao Chat.
- A escolha de manter um arquivo do GitHub não comprova que todo o workspace está sincronizado. A confirmação depende da inspeção da revisão e das diferenças efetivas.

### 2.4. Incidente que fundamenta esta regra

Na consolidação V35, os patches produzidos pelo Gemini foram integrados por outro agente no PR #76. As correções e o ensaio de recuperação foram integrados nos PRs #77 e #78. Uma sincronização posterior do AI Studio adicionou sete patches históricos, `bun.lock`, um runbook duplicado e alterações de modo de dois scripts à `main`. O Chat preparou a limpeza por PR #79, restaurando a árvore aprovada e reforçando o `.gitignore`. O caso demonstra que uma branch local e a resolução pontual de conflitos não garantem o escopo do Sync. O estado posterior do PR deve ser consultado no GitHub, não presumido a partir deste registro histórico.

## 3. Responsabilidades dos agentes e plataformas

As atribuições abaixo são a base de encaminhamento, **não uma limitação absoluta de competências**. O Chat deve escolher outra ferramenta quando uma necessidade técnica comprovada justificar, sem comprometer a segurança, as autorizações ou a economia operacional.

| Agente/plataforma | Responsabilidade principal | Atividades típicas |
|---|---|---|
| **ChatGPT no Projeto + CorSys Coding (Chat)** | Cérebro e coordenador técnico | Analisar objetivos e requisitos; propor soluções; definir arquitetura e prioridades; criar, ajustar e revisar código e prompts; distribuir atividades; integrar entregas; investigar erros; consultar logs e evidências; executar ajustes, correções e operações autorizadas no GitHub, Supabase e Cloudflare por conectores disponíveis; revisar e integrar PRs; manter continuidade e decisões. |
| **Gemini — Google AI Studio** | Desenvolvimento principal | Implementar funcionalidades e correções; ajustar interfaces, backend, SQL, scripts e documentação técnica; executar testes, builds e simulações que seu ambiente suporte; entregar alterações incrementais prontas para integração. Maximizar seu uso em atividades de desenvolvimento compatíveis com o ambiente e o risco. |
| **GitHub** | Fonte de verdade do código e documentação | Armazenar código oficial, arquitetura, requisitos, ADRs, histórico, migrations, testes, issues, PRs, handoff, registros de segurança, runbooks e evidências. Gerenciar revisão, branches, commits, integração e rastreabilidade. |
| **GitHub Actions** | Execução automatizada e reproduzível | CI, gramática SQL, testes PostgreSQL descartáveis, build, regressões, verificações de preservação e segurança, ensaios descartáveis de backup/restore e testes mais pesados quando apropriado. |
| **ChatGPT Work** | Validação operacional especializada | Testes críticos, testes de média e alta complexidade, simulações, testes integrados, homologação autenticada e visual, navegador, MASTER/AAL2, concorrência entre sessões e operações que não possam ser concluídas com segurança pelo Chat, Gemini ou CI. |
| **Codex** | Recurso técnico excepcional | Automação avançada, execução programática, terminal ou testes específicos somente quando a capacidade indispensável não estiver disponível nas ferramentas prioritárias e houver benefício demonstrável. |
| **Proprietário** | Decisões, autorizações e aceites de negócio | Aprovar escopo, regras comerciais, custos, ações sensíveis ou destrutivas não previamente autorizadas, lançamento e PROD; realizar autenticação pessoal quando indispensável; providenciar validações profissionais. |

### 3.1. Acesso a plataformas e conectores

O Chat deve utilizar conectores efetivamente disponíveis e autorizados para reduzir o uso do Work. Antes de afirmar que uma ação é possível, verificar a capacidade da ferramenta, o acesso ao repositório/projeto/ambiente e a autorização correspondente. Conectores podem exigir confirmação do proprietário. Não presumir que existe conector Cloudflare habilitado em toda conversa, nem que um conector de leitura permite escrita, deploy ou execução de navegador.

A operação autorizada de um agente não elimina controles das plataformas. Nunca contornar MFA, OTP, confirmações obrigatórias, regras de branch, limites de rede ou permissões. Não solicitar senhas, tokens ou chaves pelo chat. Se uma ferramenta não estiver disponível, usar uma alternativa autorizada ou registrar o impedimento e continuar atividades independentes.

## 4. Roteamento e economia de recursos

1. **Chat primeiro:** análise, diagnóstico, arquitetura, decisões, consultas e alterações pequenas que possam ser concluídas de forma segura com os recursos da conversa. Revisar somente a região impactada.
2. **Gemini como desenvolvedor principal:** encaminhar o maior lote coerente de implementação que possa ser testado com qualidade. Não distribuir o mesmo desenvolvimento entre agentes sem necessidade.
3. **CI antes de Work:** preferir testes reproduzíveis e automáticos em ambientes descartáveis, dentro dos limites autorizados, principalmente para SQL, integrações, concorrência, regressão e recuperação. Não substituir homologação autenticada obrigatória por mocks ou CI.
4. **Work com objetivo delimitado:** preparar previamente dados fictícios, perfis, roteiros, critérios de aceite e dependências. Agrupar operações por sessão autenticada e evitar que o Work reanalise arquitetura, GitHub ou testes concluídos sem motivo.
5. **Codex somente por exceção:** registrar a capacidade indisponível e o benefício esperado antes de encaminhar. Não assumir que seu limite de uso é independente do Work.
6. **Sem retrabalho:** reutilizar evidências vinculadas à revisão, ao ambiente e ao critério de aceite enquanto permanecerem válidas. Reexecutar somente os testes afetados ou exigidos pelo gate obrigatório de release.
7. **Sem insistência improdutiva:** após três tentativas sem redução da incerteza, registrar o bloqueio e a alternativa; avançar em atividades independentes. Não transformar falha de acesso ou limitação instrumental em suposto defeito de código.
8. **Custos:** não contratar serviços, ampliar planos ou consumir recursos pagos não autorizados. Agrupar commits, CI e publicações quando possível; separar alterações de documentação/testes de deploys desnecessários. Não sacrificar controles críticos para economizar créditos. Os limites efetivos dependem da plataforma e da conta; não inventar valores ou garantias.

## 5. Contrato mínimo dos prompts para Gemini e Work

Todo prompt de execução deve informar: marco e objetivo, revisão oficial, escopo delimitado, arquivos/contratos relevantes, decisões aprovadas, evidências que não devem ser repetidas, critérios de aceite, restrições de ambiente, autorização e condição de encerramento. Não reenviar todo o histórico quando uma referência versionada for suficiente.

**Cláusula obrigatória em cada prompt ao Gemini:**

> O Google AI Studio deste Projeto vincula somente o repositório GitHub e não permite ao proprietário selecionar a branch no Sync/Push. Não presumir que a branch local controla a sincronização. Não executar nem solicitar Sync/Push pela interface sem validação prévia do Chat. Preservar a revisão oficial e os trabalhos já integrados. Entregar somente alterações incrementais revisáveis; não incluir patches históricos, bun.lock, arquivos temporários ou documentos duplicados no produto. Informar a base, arquivos, testes e limitações. O Chat é responsável pela integração controlada no GitHub.

**Cláusula obrigatória em cada prompt ao Work:**

> Executar apenas os aceites, testes, simulações ou operações delimitados que exigem suas capacidades. Reutilizar evidências válidas, não repetir investigação, planejamento, implementação e CI já concluídos. Usar as autorizações existentes, preservar isolamento e dados, solicitar intervenção somente quando indispensável. Registrar resultado, revisão, ambiente, bloqueios e próxima ação objetiva.

O tamanho do prompt deve ser proporcional à tarefa. Evitar ciclos extensos de planejamento, relatórios de comandos e transcrições redundantes. Encerrar a tarefa quando os critérios forem cumpridos, existir bloqueio comprovado ou atingir limite operacional, preservando o handoff.

## 6. Integração, segurança e evidências

- GitHub é a referência oficial do código e dos documentos versionados; o estado efetivo de Supabase e Cloudflare é confirmado pelos respectivos ambientes. Memória, relatos e patches locais não substituem evidência remota.
- Inspecionar o diff antes de integrar; usar branches e PRs pelo Chat/conector quando disponíveis. Conferir SHA e status dos gates para a revisão em questão, inclusive mudanças posteriores relevantes. Não fazer merge de gates obrigatórios reprovados ou desconhecidos.
- Reconciliar histórico de migrations e catálogo remoto antes de aplicar SQL; não reaplicar migrations existentes indiscriminadamente. Coordenar alterações do banco e deploy para evitar incompatibilidade. Registrar versões Git, Supabase e Cloudflare quando relevantes.
- Preservar secure-by-default, fail-closed, least privilege, autorização determinística server-side, MFA/AAL2, isolamento de tenant, RLS, secrets server-side, integridade financeira, auditoria e privacidade. Alterações em regras aprovadas exigem fundamento e autorização correspondente.
- Usar fixtures fictícias isoladas para operações de teste, revogar acessos temporários e preservar fatos financeiros e auditoria conforme as regras aprovadas. Não alterar dados ou contratos reais sem autorização específica.
- Não acessar ou publicar PROD, realizar operação destrutiva, movimentação financeira real ou contratação sem autorização específica. Não tratar esta governança como autorização genérica de escrita ou de produção.
- Diferenciar **VERIFIED/PASS** (evidência executada), **REPORTED** (relato de outro agente, não confirmado independentemente), **INFERRED** (inferência técnica), **FAIL**, **BLOCKED** e **NOT EVALUATED**. CI aprovado não equivale a homologação de todas as telas; teste descartável não comprova RPO/RTO operacional. Preservar gates profissionais e empresariais.

## 7. Continuidade entre chats e fonte de verdade

### 7.1. Onde manter as informações

- **No Projeto ChatGPT:** manter esta diretriz como arquivo de referência permanente, substituindo a versão anterior. Nas instruções do Projeto, indicar sua leitura obrigatória na retomada de qualquer atividade.
- **No GitHub:** manter uma única cópia canônica em `docs/CORSYS_AGENT_GOVERNANCE.md`, referenciada em `AGENTS.md` e nas instruções de bootstrap pertinentes. Se já houver caminho canônico equivalente, atualizar o existente em vez de criar duplicatas. Versionar alterações por PR. A cópia do Projeto deve acompanhar a versão canônica aprovada.
- **Documentos de continuidade:** preservar `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, `SESSION_HANDOFF.md`, `SECURITY_REGISTER.md`, `RELEASE_CHECKLIST.md`, ADRs, quadro de execução, cursor e matriz de paridade, conforme os caminhos reais do repositório. Atualizar somente o que mudou materialmente; referenciar evidências e evitar duplicação de relatórios.

### 7.2. Protocolo de retomada

Em uma nova conversa, o Chat deve: (a) aplicar instruções do Projeto e esta governança; (b) recuperar o cursor/handoff atual e a revisão GitHub pertinente; (c) identificar o próximo aceite ou entrega efetivamente pendente; (d) escolher o agente com menor custo e capacidade suficiente; (e) avançar sem reabrir decisões nem testes aprovados, salvo evidência de regressão ou mudança que os invalide. Respeitar a ordem de prioridades de contexto definida nas instruções do Projeto. Ler apenas o material necessário para a tarefa, sem recarregar todo o histórico a cada mensagem.

### 7.3. Registro obrigatório ao final de uma rodada material

**Situação consolidada — [marco/microentrega]**

- Estado: CONCLUÍDO, PARCIAL, EM EXECUÇÃO, BLOQUEADO ou AGUARDANDO APROVAÇÃO.
- Entrega e evidências: revisão, PR, CI, testes e ambiente quando pertinentes; distinguir confirmação independente de relato.
- Pendências e bloqueios: o que não foi executado, por quê, riscos residuais e intervenção indispensável.
- Próxima ação: objetivo delimitado, agente responsável e condição de conclusão.
- Contagem de aceites concluídos apenas quando o conjunto for estável; não converter em percentual de prontidão geral do SaaS.
- Registrar checkpoint versionado após mudança material ou interrupção, permitindo retomada por outra conversa sem reconstruir o contexto.

## 8. Regra final

**Chat coordena e integra; Gemini desenvolve; GitHub preserva o código e a documentação; GitHub Actions valida de forma reproduzível; Work executa os testes críticos e operacionais que realmente exigem sua capacidade.** As responsabilidades podem ser redistribuídas por necessidade comprovada, mas o uso de cada ferramenta deve ser deliberado e econômico.

A limitação do Sync/Push do Google AI Studio é uma restrição permanente desta operação até que o proprietário confirme mudança efetiva na interface e a nova capacidade seja verificada. Nenhum agente deve voltar a recomendar seleção de branch no Sync do AI Studio com base apenas em uma branch criada localmente.
