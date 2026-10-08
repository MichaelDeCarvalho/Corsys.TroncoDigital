# V35 — sequência autorizada até operação

Autorização: proprietário em 2026-10-05 Brasil. Executar oito etapas incrementalmente, preservando HTML V35, documentação, ADRs e inventário. Etapa iniciada não equivale a concluída. DEV/preview já autorizados; custos apresentados antes; produção depende de aprovação final.

| Etapa | Objetivo | Estado | Evidência de conclusão necessária |
|---|---|---|---|
| 1 | Autorização real, isolamento e comandos seguros | Em execução | JWT positivo/negativo, MFA real, perfis, suporte temporário, suspensão, invariantes e concorrência |
| 2 | Integrantes, parâmetros e estrutura financeira | Pendente | Cadastro e configuração persistidos, validação e regras vigentes |
| 3 | Cobranças, pagamentos, contas e aprovações | Pendente | Comandos transacionais, saldos e trilhas consistentes |
| 4 | Caixa, conciliação, orçamento, DRE e relatórios | Pendente | Cálculos conferidos, importação/exportação e fechamento real |
| 5 | Master, onboarding, planos, billing e suporte | Pendente | Ciclos completos e limite Master/tenant comprovado |
| 6 | Integrações, mobile e regressão | Pendente | Fluxos e arquivos reais; temas/dispositivos; integrações conforme escopo |
| 7 | Produção, recuperação e implantação assistida | Pendente | Ambiente separado, recuperação testada, custos e documentos definidos |
| 8 | Aprovação e entrada em operação | Pendente; aprovação posterior | Sistema homologado apresentado e piloto assistido |

## Etapa 1 — execução desta sessão

- Projeto DEV ativo e HEAD 5b5a6e2 conferidos; sem alteração de produção ou usuários Auth.
- Catálogo de segurança aprovado: RLS, views security_invoker, negação de funções definer a anon e grants dos helpers.
- verify_dev_role_isolation.sql reexecutado: leituras próprias positivas e cruzadas ocultas; chamado próprio criado/lido, RPC cruzada negada, Master oculto. Claims simuladas, escrita revertida.
- Novo verify_dev_subscription_and_staff.sql aprovado: active/trialing e tolerância permitem permission helper; atraso vencido/suspended/canceled e override bloqueiam; leitura permanece; staff AAL1 negado, AAL2 simulado e role correta aceitos, Support/Billing negados como Master; último Master protegido. Helpers/triggers, não cadeia de RPC financeira nem MFA real.
- Setup inicial do teste falhou na constraint da versão publicada sem published_at; fixture corrigida, sem mudança de schema, execução posterior aprovada.
- Após rollback: zero planos temporários, vínculos staff temporários e assinaturas temporárias remanescentes.
- Roteiro HTTP reforçado: identidade getUser, IDs distintos/alvo DEV fixo, consultas explícitas cruzadas, views, comando Master negado e JWT inválido. Exemplo de fixtures existentes elimina necessidade de chave administrativa/criação de usuários.
- Oito testes locais passaram. Testam o roteiro e seus falsos positivos; não são execução HTTP autenticada.

## Pendências da etapa 1

1. Baseline npm run test:tenant-isolation CONCLUÍDO pelo proprietário em 2026-10-07: PASS informado; ver atualização abaixo. Demais gates HTTP continuam pendentes.
2. Criar fatos financeiros fictícios por comandos autorizados e validar leituras positivas/negativas; views vazias não são prova positiva.
3. Exercitar perfis Tesoureiro/Consulta/Integrante, vínculo próprio e revogação real.
4. Exercitar Master/Support/Billing com MFA real, sessões de suporte, expiração/revogação e isolamento.
5. Exercitar suspensão/retomada por RPC/HTTP com JWT real.
6. Testar comandos financeiros, duplicidade, sobrealocação, concorrência, fechamento e imutabilidade nas duas lojas.

Não liberar comandos financeiros ao cliente com gates críticos abertos. Desenvolvimento/testes DEV podem continuar sem promover cenários não avaliados a aprovação.

Decisões comerciais: config/commercial-decisions.json e docs/adr/0005-commercial-launch-decisions.md. Interface e ADRs financeiras continuam em vigor, inclusive layout único das lojas.


## Continuidade da etapa 1 — 2026-10-06 UTC

Ver docs/V35_STAGE_1_EVIDENCE.md. Invariantes financeiras e pós-V31 passaram. Novos roteiros verify_dev_financial_commands.sql e verify_dev_roles_and_support.sql passaram no DEV: RPCs nas duas lojas, idempotência sequencial/auditoria, leituras próprias/cruzadas, sobrealocação e IDs alheios, suspensão, perfis e suporte temporário/revogação/expiração. Claims simuladas; tudo revertido, zero fixtures temporárias conferidas. Oito testes locais PASS. Etapa 1 permanece em execução: JWT real, MFA real, matriz HTTP e concorrência simultânea ainda não comprovados. Nenhuma alteração de schema, grants, senhas, frontend, produção ou cobrança.


## Smoke HTTP autenticado aprovado — 2026-10-07, 18:20 Brasil

Evidência: saída integral fornecida pelo proprietário, execução local Windows/Node
v24.20.0 na cópia da branch DEV. O agente não executou este comando com as credenciais;
a classificação é execução pelo proprietário com resultado PASS apresentado.
Nenhuma senha, token ou arquivo .env foi recebido.

Comando: npm run test:tenant-isolation.
Resultado:
PASS: real Auth identities, tenant reads/RPCs, tenant-to-Master denial and invalid JWT. Financial positive fixtures, MFA, suspension and concurrency remain separate gates.

Baseline HTTP aprovado: login/getUser dos dois UUIDs esperados, consultas próprias
positivas de organização/integrantes, consultas cruzadas explícitas ocultas,
views financeiras cruzadas, catálogo/configuração/staff Master ocultos,
RPC Master negada, chamado próprio criado/lido e chamado cruzado negado,
acesso anônimo restrito e JWT inválido rejeitado com HTTP 401.

Limites: views financeiras sem fatos próprios não comprovam isolamento financeiro
positivo por HTTP; os fatos SQL anteriores foram revertidos. Não aprova MFA real,
perfis/expiração/revogação/suspensão por HTTP, matriz completa de RPCs ou concorrência
simultânea. Etapa 1 continua EM EXECUÇÃO. A recuperação real por e-mail não foi
homologada: o proprietário encontrou a senha existente. Manter credenciais somente
no .env.dev privado local, sem commit/upload. Chamados legítimos do smoke permanecem
no DEV com prefixo RLS DEV TEST, conforme roteiro.


## Próximo gate preparado — 2026-10-07

Ver docs/DEV_FINANCIAL_HTTP_GATE.md. Estrutura financeira fictícia persistida nas duas lojas e plano DEV de valor zero com assinaturas active, sem cobrança, Auth/grants/schema alterados. Comandos SQL com claims simuladas despachados em paralelo: saldo disputado preservou uma alocação de 100 e crédito zero; mesma chave preservou uma cobrança/audit. Sobreposição exata não instrumentada; não equivale a HTTP real. Novo npm run test:financial-http preparado para credenciais privadas locais; 10 testes locais PASS e sintaxe PASS. Roteiro HTTP financeiro e MFA/suspensão/matriz ainda pendentes. Não apagar ledger nem repetir seed/roteiro após falha sem inspeção. Scripts antigos com precondição de zero planos/assinaturas agora bloqueiam por fixture alterada, esperado.


## Pacote restante da etapa 1 preparado — 2026-10-07 Brasil / 2026-10-08 UTC

Proprietário determinou continuar até fechar etapa1; não declarar encerrada enquanto gates reais pendentes. Ver docs/DEV_STAGE1_CLOSURE_GATE.md. Persistidas somente fixtures DEV isoladas para FIFO e plano/mapeamentos 2027, sem sobreposição/alteração de fatos 2026. SQL rollback PASS: FIFO/institucional/fechamento, 20 comandos cross-org por identidade, FK institucional23503 e cinco transições de perfil/restauração. 12 testes locais/sintaxe PASS. Preparados test:stage1-remaining, test:profiles-live (JWT original sem refresh durante fases) e test:master-mfa (QR local privado, OTP mascarado, AAL1 negativo/AAL2 positivo). Todos novos HTTP/TOTP ainda NÃO EXECUTADOS pelo proprietário. Ambas assinaturas active, papéis ADMIN originais preservados e nenhum vínculo/staff/fator temporário aplicado. Conta dedicada escolhida via pergunta pelo proprietário: michael.c.carvalho+corsys-dev-master@gmail.com; consulta Auth ainda não encontrou usuário, staff_count=0. Proprietário precisa criá-la no painel e manter senha local; conector não oferece criação Auth. Não inserir Auth por SQL nem fabricar tokens. Bind primeiro Master só após identidade criada/conferida, proteção do último Master permanece. Support/Billing/sessões/expiração/revogação e critérios críticos remanescentes continuam obrigatórios, não cobertos por Master sozinho. Mudanças não promovem etapa2, não alteram produção/cobrança/grants/schema/frontend. Conferir CI contra novo commit. Pendências reais dependem de execução/OTP do proprietário, não de autorização nova.


## HTTP restante aprovado pelo proprietário — 2026-10-08 UTC

Execução local Windows/Node v24.20.0 pelo proprietário na pasta de download (3), saída integral apresentada; nenhuma credencial recebida pelo agente. npm ci: zero vulnerabilidades no dev-gate; npm run check: 12 testes PASS. npm run test:stage1-remaining: Tenant A e Tenant B PASS. Tag: DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696.

Com JWT real nas duas lojas: 20 RPCs do catálogo negaram organização alheia; FIFO positivo ordenado e concorrente preservou alocações/saldos; financeiro institucional positivo/cruzado, idempotência, saldos e auditoria passaram; fechamento negou lançamento e reabertura permitiu escrita positiva. Saída confirmou competências reabertas. Fatos fictícios 2027 permanecem DEV; não repetir o gate de integrante limpo nem apagar ledger sem inspeção. O catálogo testa negação por organização, não toda combinação de parâmetros/IDs. Não comprova idempotência de eventos de auditoria FIFO.

Supera a pendência HTTP deste roteiro na preparação anterior. Perfis/revogação live ainda NÃO executados; próxima execução é test:profiles-live, aguardando WAIT antes de cada alteração SQL e restaurando ADMIN em erro/cancelamento. Nenhuma mudança persistente de papel aplicada nesta atualização. Master/MFA real, Support/Billing e ciclo de sessões/expiração/revogação permanecem OPEN. Consulta Auth nesta sessão não encontrou a conta dedicada escolhida. Etapa 1 permanece EM EXECUÇÃO; etapa 2 pendente. CI do código testado 28053c3: Foundation checks run 37713949588 success. Este incremento registra evidência, sem alterar código/schema/grants/produção/cobrança.


## Perfis e revogação live HTTP aprovados — 2026-10-07, 22:56 Brasil

Proprietário executou test:profiles-live no Windows/Node v24.20.0, mesma cópia (3) do código 28053c3. Tag DEV LIVE PROFILES ff496b1b-823d-4021-9fd5-d21b240f9a6c. ADMIN baseline e TREASURER financeiro positivo/limites Master e tenant PASS apresentados. VIEWER leituras próprias e 20 escritas negadas PASS apresentado. Chegada ao WAIT REVOKED LINK demonstra que as assertions anteriores de integrante vinculado passaram; chegada ao WAIT RESTORE ADMIN demonstra que as assertions de revogação passaram. Saída final apresentada: same JWT ADMIN restored; all original scopes and positive write restored PASS. Nenhuma credencial/token recebido pelo agente.

Agente aplicou cinco transições SQL DEV guardadas somente B, entre os WAITs do mesmo processo: TREASURER, VIEWER, vínculo único, remoção do vínculo e ADMIN original. getUser e comparação do token original sem refresh sustentam revogação da autorização com JWT ainda válido, NÃO invalidação de sessão Auth. Consulta SQL final conferiu A/B ADMIN, zero member_user_links e created_at original 2026-10-02 22:58:27.201308+00. Janela de perfis ENCERRADA; restauração persistida antes da confirmação HTTP final. Dois pagamentos fictícios 1 permanecem DEV, não apagar ledger nem repetir teste sem necessidade.

Gates tenant de perfis/vínculo/revogação deste roteiro concluídos. Master/MFA, staff Support/Billing, suporte temporário/expiração/revogação e ciclo de sessões Auth continuam separados e OPEN. Consulta Auth atual não encontrou michael.c.carvalho+corsys-dev-master@gmail.com; próximo passo é criação oficial da conta dedicada no painel pelo proprietário, senha privada local, seguida de conferência e bind guardado. Etapa 1 segue EM EXECUÇÃO, etapa 2 pendente. Nenhum schema/grant/produção/cobrança alterado.
