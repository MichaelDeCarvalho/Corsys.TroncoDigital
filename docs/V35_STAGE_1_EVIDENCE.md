# Etapa 1 — evidência de validação DEV
Data: 2026-10-06 UTC. Projeto: szqkdekwhzxsoxorgvaz.
Estado: EM EXECUÇÃO. Não liberar produção nem comandos financeiros ao cliente.

## Resultados executados
| Verificação | Resultado | Limite |
|---|---|---|
| Invariantes financeiras | FINANCIAL_INVARIANTS_PASS | Inserts/triggers no banco, não HTTP |
| Integridade pós-V31 | POST_V31_INVARIANTS_PASS | Leitura de consistência, não concorrência |
| Comandos financeiros nas duas lojas | DEV_FINANCIAL_RPC_PASS | Claims simuladas; repetição sequencial |
| Tesoureiro, Consulta e Integrante | DEV_ROLES_SUPPORT_PASS | Permissões/RLS no banco; sem login desses perfis |
| Suporte temporário | DEV_ROLES_SUPPORT_PASS | AAL simulado; sessão ativa, expirada, encerrada e staff inativo |
| Guard/assertions do roteiro HTTP | 8 testes locais PASS | Smoke autenticado aprovado posteriormente pelo proprietário; ver atualização |

Comandos testados: create_manual_charge, register_payment e allocate_payment_to_charge.
Na mesma chave/payload retornam o mesmo UUID, sem duplicar as três entradas de auditoria.
Payload diferente na mesma chave rejeitado com 22023; sobrealocação com 23514;
organização alheia com 42501 e integrante de outra organização com 23503.
Leitura financeira própria positiva confirma aberto=0, crédito=50 e posição=-50.
Na segunda passagem há fatos financeiros da primeira loja, e suas views permanecem ocultas.
Suspended, canceled e past_due vencido bloqueiam register_payment, preservando leitura.
Retomada por HTTP e toda a matriz de RPCs continuam pendentes.

Tesoureiro mantém permissões financeiras e não administra usuários. Consulta não escreve.
Integrante com vínculo enxerga somente seu registro; revogar vínculo remove acesso.
Suporte sem papel tenant exige AAL2 simulado e sessão read_only da organização correta.
Expiração, encerramento e staff inativo removem acesso; suporte não registra pagamento.

Tudo executado em transações com ROLLBACK. Conferência posterior: zero integrantes,
planos, staff ou sessões temporárias dos novos roteiros. Não alteradas senhas, schema,
grants, frontend, produção ou integrações pagas.

## Bloqueios para aprovação
1. JWT/login real das duas contas: executar dev-gate com credenciais preenchidas
   em ambiente seguro; não enviar senhas nem tokens pelo chat.
2. MFA real de staff Master/Support/Billing e troca/expiração de sessão.
3. Repetir perfis, revogação e suspensão pela API com JWT real.
4. Duas requisições simultâneas, tanto para mesma chave quanto disputa de saldo.
   Repetição sequencial NÃO é prova de concorrência.
5. Completar negativos de IDs em todas as RPCs, views e operações da matriz V35.

O painel Supabase nesta sessão de navegador está na página de login. A existência
de conexão SQL não proporciona uma sessão Auth dos usuários. Não pedir senha em
chat, trocar senhas ou fabricar tokens para contornar o bloqueio.

## Reexecução
Scripts SQL neste diretório de scripts, restritos às fixtures DEV conhecidas:
- verify_dev_financial_commands.sql
- verify_dev_roles_and_support.sql
As precondições interrompem a execução se configuração das fixtures mudar.
A revisão humana do projeto DEV continua necessária antes de executar.

Smoke HTTP existente: seguir dev-gate/README.md, seção de usuários já criados.
Esse smoke não encerra todos os bloqueios acima, mesmo se aprovado.



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


## HTTP financeiro aprovado pelo proprietário — 2026-10-07, 18:51 Brasil

Execução Windows/Node v24.20.0 pelo proprietário; saída PASS apresentada no chat, não executada pelo agente com credenciais. npm ci: 0 vulnerabilidades no dev-gate; npm run check: 10 testes PASS. npm run test:financial-http: Tenant A e Tenant B PASS; HTTP/JWT real, views próprias positivas/cruzadas ocultas, auditoria, idempotência com requisições simultâneas e disputa de alocação aprovados no escopo do roteiro. Tag: DEV HTTP 428ce717-21fa-41cc-a7b5-47512ef83bfe. Fatos fictícios permanecem no DEV; não repetir sem necessidade nem apagar ledger. Tentativas anteriores pararam antes de escritas por dependência ausente, project ref e identidade inesperada; configuração corrigida localmente, nenhuma senha/token recebido. CI Foundation checks do código c39de3a: run 37690001216 success. Não é teste de carga em escala nem cobertura de todas as RPCs. Etapa 1 continua aberta: MFA real, suspensão/revogação/perfis por HTTP, recuperação por e-mail e matriz restante. Produção e merge não aprovados.


## Gate suspensão/retomada preparado — 2026-10-07, após PASS financeiro HTTP

Ver docs/DEV_SUSPENSION_MFA_GATE.md. Roteiros test:suspension-http (seis RPCs/42501, leitura própria positiva e saldos preservados) e test:restoration-http (write positivo de pagamento fictício 1) preparados. SQL fixo suspend/restore somente assinatura DEV zero-price B, mantendo A active; transições/helpers validados em transação revertida: DEV_SUSPENSION_TRANSITIONS_ROLLBACK_PASS, claims simuladas. As duas lojas continuam active; não iniciar janela sem conseguir restaurar. 10 testes locais PASS e sintaxe PASS; HTTP das novas fases ainda pendente. check:mfa-posture só inventário INFO com getUser/assurance/listFactors, sem cadastrar fator nem alterar Auth; não é MFA PASS. MFA real e staff positivo, sessão/revogação/perfis/matriz completa continuam abertos. Nenhuma alteração persistente de status, schema, grants, layout, senha, cobrança ou produção. Código/docs devem ter CI conferida após push.


## Suspensão HTTP aprovada e janela encerrada — 2026-10-07, 21:54 Brasil

Proprietário executou npm run test:suspension-http com logins/JWT reais. Seis negativas 42501 PASS: create_manual_charge, register_payment, allocate_payment_to_charge, allocate_payment_fifo, cancel_charge, reverse_payment. Próprias views financeiras positivas e saldos preservados; A active. Tag DEV SUSPENSION 7cb919d9-81de-402a-b708-9404af5c5e3c. Saída apresentada pelo proprietário; agente não recebeu credenciais nem executou HTTP autenticado.

JANELA ENCERRADA: imediatamente após saída, agente executou scripts/restore_dev_tenant_b_http.sql no projeto DEV e consulta confirmou A active e B active. Isto supera o registro anterior de B suspended. Pendente npm run test:restoration-http para provar retomada positiva com JWT real. Suspensão validada somente B, status suspended e seis RPCs; canceled/past_due/security_hold, demais RPCs/perfis/revogação e MFA real não aprovados. Sem alterações em Auth, ledger, schema/grants, cobrança ou produção; etapa 1 segue aberta.


## Retomada HTTP positiva aprovada — 2026-10-07, 21:56 Brasil

Proprietário executou npm run test:restoration-http no Windows com JWT/login real e apresentou PASS: ambas assinaturas active; register_payment da loja B voltou a escrever, pagamento fictício 1 com available_amount=1, organização própria e integrity_ok=true. Tag DEV SUSPENSION ef9110f9-141b-4a21-be25-a50865935970. Fato fictício permanece DEV. Agente não recebeu credenciais nem executou este HTTP autenticado. Fecha a pendência da retomada neste cenário B active -> suspended -> active e seis RPCs negadas. Não aprova MFA, revogação de papéis/sessões, canceled/past_due/security_hold, todas as RPCs ou demais perfis. Etapa 1 continua aberta; ambas lojas ativas, nenhuma janela de suspensão pendente. Próximo escopo: MFA real com staff e matriz de autorização restante, preservando usuários tenant/credenciais atuais e sem promoção automática a Master.


## Gate estorno/cancelamento preparado — 2026-10-07, após retomada HTTP

Ver docs/DEV_FINANCIAL_LIFECYCLE_GATE.md. Novo test:financial-lifecycle cria fatos fictícios próprios nas duas lojas, testa reverse_payment/cancel_charge concorrentes (um UUID/um 23505), saldos/reversão de alocações/audit/originais preservados, ID estrangeiro P0002 e organização alheia 42501, motivo/período 22023 e FIFO após estorno 55000. Só corrige fatos novos, sem FIFO positivo sobre integrante compartilhado. 11 testes locais PASS e sintaxe PASS. SQL verify_dev_financial_lifecycle.sql passou nas duas lojas dentro de ROLLBACK, claims simuladas; não comprova JWT/HTTP/concorrência. HTTP novo ainda pendente do proprietário. Ambas lojas continuam active, sem nova janela de status, Auth/grants/schema/frontend/cobrança/produção alterados. Etapa 1 segue aberta para MFA/staff, revogação/perfis, institucional/FIFO positivo e matriz restante. CI deve ser conferida após push.


## Lifecycle HTTP aprovado pelo proprietário — 2026-10-07, 22:10 Brasil

Execução Windows/Node pelo proprietário, npm ci zero vulnerabilidades dev-gate e 11 testes locais PASS apresentados. npm run test:financial-lifecycle: Tenant A PASS, Tenant B PASS e conclusão HTTP/JWT PASS. Tag DEV LIFECYCLE 8b67cd58-6f78-4f70-b3e7-d3e07f287653. Estorno/cancelamento nos dois encadeamentos, operações simultâneas com evento único/rejeição exata de duplicata, efeitos nos saldos, auditoria/ator, reversão de alocações, originais preservados e negativas de recursos estrangeiros aprovados no escopo do roteiro. Fatos fictícios corrigidos permanecem no DEV. Saída fornecida pelo proprietário; agente não executou HTTP com credenciais, não recebeu senha/token/env. CI do código preparado: Foundation checks run 37710839313 success. Novo gate deixa de ser somente preparado; HTTP positivo/negativo dessa matriz está aprovado, sem inferir cobertura integral. Ambas lojas ativas, nenhuma suspensão pendente. Etapa 1 continua aberta: MFA real/staff, revogação/perfis/sessões, FIFO positivo, financeiro institucional e matriz restante. Não repetir comandos já aprovados sem motivo, não apagar ledger. Produção/merge/cobranças novas não aprovadas.


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


## MFA Master comprovado; expectativa de leitura da auditoria corrigida — 2026-10-07, 23:26 Brasil

Execução local do proprietário alcançou a consulta de auditoria após passar enrollment/challengeAndVerify real, currentLevel=aal2, getUser UUID conferido, vínculo MASTER ativo positivo, plano fixo price0 já active=true e RPC set_saas_plan_active retornando UUID esperado. Interrompeu por42501 permission denied for table saas_master_audit_logs; roteiro integral encerrou com FAIL e NÃO deve ser descrito como saída final PASS. Etapas anteriores comprovadas pelo ponto de falha, mais inventário administrativo factor_type=totp/status=verified. Nenhum secret/OTP/QR/token recebido pelo agente.

Inspeção de contrato: tabela saas_master_audit_logs RLS=true, sem policies e sem SELECT authenticated, backend-only. Não adicionar grant/policy para satisfazer expectativa errada. Consulta administrativa encontrou exatamente um evento saas_plan.reactivate/resource_type saas_plan/recurso7c71fda8-13b9-4bd4-999a-7df06937666d, actor71e27b4c-f0ba-46f7-832f-4faf29e8603d, reason DEV MASTER MFA fb5a5b74-00b4-45c8-9a6b-0565c2b69f56, previous_active=true e new_active=true. Evidência combinada: MFA/AAL1 negativo/AAL2 positivo/RPC e auditoria backend comprovados nesta execução; saída integral corrigida ainda não executada. Sem cobrança comercial ativada.

Roteiro corrigido exige42501 para leitura direta backend-audit e informa que operador precisa conferir evento único pela tag; não converte qualquer erro em PASS nem declara auditoria positiva via HTTP. 12 testes/sintaxe locais PASS. Não repetir cadastro TOTP: fator verificado permanece para próximas autenticações. Reexecução desnecessária desta operação comprovada; futura execução corrigida reutiliza fator. Support/Billing, suporte temporário/expiração/revogação e ciclo Auth permanecem OPEN, etapa1 em execução, etapa2 pendente.


## Gate staff live preparado — 2026-10-07, após MFA Master

Ver docs/DEV_STAFF_LIVE_GATE.md. Novo test:staff-live preparado: terceira identidade dedicada michael.c.carvalho+corsys-dev-staff@gmail.com, SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno, mesma sessão JWT em janela read_only A/negação B, expiração por datas passadas/reabertura/revogação, Billing positivo subscriptions e limites Support/Master, active=false, cleanup e logout global com refresh anterior negado por código Auth específico (rede não PASS). Não confundir revogação refresh com invalidação criptográfica instantânea do access JWT. Fatos são ticket/mensagem internos fictícios; nenhum pagamento/cobrança/provedor ativado.

Oito scripts bind/transição/cleanup guardados preservam último Master e contas tenant. Teste de todas transições em ROLLBACK passou DEV_STAFF_TRANSITIONS_ROLLBACK_PASS, usando B só dentro da transação com ADMIN removido/revertido. 12 testes/sintaxe locais PASS. Consulta posterior confirmou A/B ADMIN, único Master ativo, zero janelas suporte abertas e conta staff ainda inexistente. Nenhuma nova transição persistida, HTTP/TOTP desta conta NÃO executados. Proprietário precisa criar conta oficial, sem senha no chat; depois conferirUUID/bind e preencher .env privado. Em FAIL/cancelamento operador deve executar cleanup imediatamente. Stage1 continua aberta; nenhuma produção/custo/grant/schema/policy alterada. Conferir CI do pacote após push.


## Staff live HTTP/MFA aprovado — 2026-10-07, 23:51 Brasil

Proprietário executou test:staff-live na cópia Windows (4), com saída final PASS apresentada. Tag DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738. SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno e mensagem, janela Aread_only/B oculto/20writes por loja negados, expiração por datas passadas, reabertura positiva, encerramento/revogação, Billing assinaturas positivas/limites financeiro-Support-Master, inactive e cleanup, logout global e refresh anterior rejeitado por código Auth/status esperado PASS. Mesmo JWT preservado durante as mudanças SQL; não equivale a invalidação criptográfica imediata do accessJWT em logout. Ticket fictício e TOTP verificado permanecem, credenciais não recebidas.

Agente aplicou sete transições guardadas entre WAITs. SQL final: A/B ADMIN próprios, tenant_links0, duas subscriptionsactive, somente Master dedicado active, zero janelas suporte abertas, auth.sessions staff0; fatores Master/staff TOTP verified. Janela temporária ENCERRADA, cleanupRequired=false. CI pacote37718586263success. Gates de perfis/MFA/staff/suporte/refresh concluídos no escopo executado. Revisão do critério histórico IDOR por recurso em cada RPC ainda identifica casos de configuração/aprovação e views financeiras/DRE a conferir; não encerrar etapa1 nem promover etapa2 antes de completar essa matriz. Autorização cross-org20RPCs não substitui own-org/foreign-resource-ID. Sem produção/custos/grants/schema alterados.
