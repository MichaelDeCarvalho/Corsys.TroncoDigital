# RELEASE CHECKLIST — V35

## Estado atual — 2026-10-08 Brasil

Etapa 1 CONCLUÍDA no DEV; etapa 2 EM EXECUÇÃO, começando pela conciliação de integrantes, parâmetros e estrutura financeira com o piloto V35. Evidência consolidada e limites: [V35_STAGE_1_CLOSURE_REPORT.md](docs/V35_STAGE_1_CLOSURE_REPORT.md).
Último HTTP: DEV FINAL AUTHORIZATION 09fcfa34-48ad-4c19-ac60-b2c173b2648b, PASS nas duas lojas; 28 views e oito negativas adicionais por recurso em cada loja. Estados finais e saldos conferidos administrativamente. CI do código f467d8e6: run 37720733935 success.
Produção/release comercial continuam bloqueados pelo escopo restante V35, homologação, recuperação e aprovação. Os registros datados abaixo são históricos; suas pendências da etapa 1 são superadas somente no escopo discriminado no relatório, sem converter cenários não avaliados em PASS.


## Verificado nesta etapa
- [x] Hashes históricos das 16 migrations originais registrados; baselines 009/014 corrigidas antes da primeira aplicação.
- [x] Gramática SQL verificada na entrega inicial; revisão atual acompanhada pela CI.
- [x] Sintaxe dos scripts JS e quatro testes do guard DEV aprovados.
- [x] Dependências fixadas e lockfile gerado.
- [x] `npm audit --omit=dev --audit-level=high`: zero findings retornados.
- [x] Configuração TOML gerada pela CLI e parseada localmente.
- [x] CI estática preparada com permissions: contents:read e actions por SHA.

## Gates de runtime — aprovados no escopo DEV do relatório
- [x] Projeto existente DEV selecionado pelo usuário; plano Free verificado, sem nova infraestrutura paga.
- [x] 19 migrations aplicadas do zero e histórico local alinhado.
- [x] Catálogo de segurança e invariantes SQL executados.
- [x] JWT/RLS cross-user e cross-tenant positivo/negativo. Escopo e limites no relatório de encerramento.
- [x] Master/Billing/Support e AAL1/AAL2 exercitados. Escopo e limites no relatório de encerramento.
- [x] Financeiro, fechamento e imutabilidade em teste SQL com rollback.
- [x] Suspensão e RPCs exercitados com JWT real. Escopo e limites no relatório de encerramento.
- [x] Concorrência, sobrealocação e idempotência. Escopo e limites no relatório de encerramento.
- [x] Correção das views administrativas comprovada em runtime. Escopo e limites no relatório de encerramento.
- [x] CI remota aprovada para o incremento frontend: commit 04436e78c5116c550bff88ac4a905f3ddf083263, run 37077478804.

## Produto e deploy
- [ ] Frontend responsivo e integrações reais.
- [ ] Storage privado, auth, observabilidade e rollback.
- [x] Preview Cloudflare inicial publicado e verificado.
- [ ] Revisão desktop/mobile autenticada completa.
- [ ] Produção configurada e verificada.

## Resultado
**BLOCKED para release.** Checks estáticos aprovados não comprovam runtime, segurança ou deploy.

- [x] Auth users confirmados e vinculados a duas Lojas DEV.
- [x] RLS e RPCs com SET ROLE/claims simuladas aprovados, incluindo negação cross-tenant.
- [x] HTTP/Data API com JWT assinado real (separado do teste SQL). Escopo e limites no relatório de encerramento.

## Frontend DEV e publicação
- [x] Typecheck app/node, 13 testes frontend, build Vite e Wrangler dry-run aprovados.
- [x] npm audit completo: zero vulnerabilidades após atualização Wrangler 4.147.0.
- [x] Build sem configuração pública falha de forma explícita.
- [ ] Conta/plano/consumo Cloudflare verificados (painel bloqueado por verificação contra bots).
- [x] Preview inicial publicado e tela de login/assets verificados.
- [x] Proprietário confirmou dois logins reais e visualização somente da Loja própria.
- [ ] Fluxo autenticado desktop/mobile e teste negativo HTTP/JWT completo.

## Preservação e consulta financeira
- [x] Escopo mínimo V35 obrigatório e módulos pendentes registrados em docs/V35_COVERAGE.md.
- [x] ZIP reenviado é idêntico por hash à fonte importada.
- [x] Gate de preservação: 29 ADRs, 19 migrations, 51 documentos, 263 declarações.
- [x] Typecheck, 23 testes frontend e build aprovados neste incremento.
- [x] Consultas SQL das três views sob role authenticated executadas (vazias; não prova de isolamento positivo/negativo).
- [ ] Publicação remota da nova consulta financeira verificada após push.
- [x] HTML do piloto recebido e inventariado: 21 telas, Cliente 360º, campos/ações/abas e formulários dinâmicos; referência versionada e integridade no gate.
- [ ] Paridade funcional/visual com HTML original do piloto: cliques e homologação desktop/mobile das duas Lojas e Master pendentes.

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.


## Etapa 1 iniciada — 2026-10-05 Brasil / 2026-10-06 UTC

Proprietário autorizou avançar pela sequência de oito etapas. docs/V35_DELIVERY_PLAN.md registra estado/evidência e pendências. Decisões comerciais em docs/adr/0005-commercial-launch-decisions.md e config/commercial-decisions.json: dois planos BRL 125/180 mensais, cobrança manual e futura Stripe preferencial; suporte interno/WhatsApp manual, automação futura; domínio pendente. Configuração registrada, catálogo/integrações ainda não ativados.

SQL de catálogo e isolamento reexecutado com sucesso. Novo scripts/verify_dev_subscription_and_staff.sql passou após corrigir fixture publicada sem timestamp: tolerância/suspensão/override, limites de staff/AAL e proteção do último Master; claims simuladas, helpers/triggers, rollback conferido sem dados temporários. Não equivale a HTTP/JWT/MFA reais ou comandos financeiros completos. dev-gate possui roteiro HTTP reforçado e exemplo dos UUIDs existentes, sem necessidade de chave administrativa. Oito testes locais passaram; roteiro HTTP autenticado ainda não executado por ausência das senhas em ambiente seguro. Não solicitar senhas/tokens pelo chat nem alterar credenciais existentes. Nenhuma migration, grant, schema, frontend, produção ou serviço pago alterado.


## Continuidade da etapa 1 — 2026-10-06 UTC

Ver docs/V35_STAGE_1_EVIDENCE.md. Invariantes financeiras e pós-V31 passaram. Novos roteiros verify_dev_financial_commands.sql e verify_dev_roles_and_support.sql passaram no DEV: RPCs nas duas lojas, idempotência sequencial/auditoria, leituras próprias/cruzadas, sobrealocação e IDs alheios, suspensão, perfis e suporte temporário/revogação/expiração. Claims simuladas; tudo revertido, zero fixtures temporárias conferidas. Oito testes locais PASS. Etapa 1 permanece em execução: JWT real, MFA real, matriz HTTP e concorrência simultânea ainda não comprovados. Nenhuma alteração de schema, grants, senhas, frontend, produção ou cobrança.


## Recuperação de senha DEV — 2026-10-07

Implementado Esqueci minha senha, solicitação resetPasswordForEmail com redirectTo da origem atual, tratamento PASSWORD_RECOVERY e formulário autenticado updateUser. SDK detectSessionInUrl=true; flag de recuperação é somente apresentação, identidade validada por getUser e RLS continua server-side. Formulário compara identidade antes de trocar senha, exige confirmação/12 caracteres, bloqueia duplicidade e limpa campos após tentativa; resposta de solicitação não confirma existência de conta. Recuperação mantém workspace oculto até retorno explícito ao login. Site URL/Redirect URLs DEV configurados conforme relato do proprietário, não conferidos via API. Reenvio e recuperação reais por e-mail dependem de homologação do proprietário; nenhum e-mail enviado pelo agente, nenhuma senha/token lido, nenhum grant ou schema alterado. Não declarar etapa 1 concluída. Ver docs/DEV_PASSWORD_RECOVERY.md.


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


## Gate suspensão/retomada preparado — 2026-10-07, após PASS financeiro HTTP

Ver docs/DEV_SUSPENSION_MFA_GATE.md. Roteiros test:suspension-http (seis RPCs/42501, leitura própria positiva e saldos preservados) e test:restoration-http (write positivo de pagamento fictício 1) preparados. SQL fixo suspend/restore somente assinatura DEV zero-price B, mantendo A active; transições/helpers validados em transação revertida: DEV_SUSPENSION_TRANSITIONS_ROLLBACK_PASS, claims simuladas. As duas lojas continuam active; não iniciar janela sem conseguir restaurar. 10 testes locais PASS e sintaxe PASS; HTTP das novas fases ainda pendente. check:mfa-posture só inventário INFO com getUser/assurance/listFactors, sem cadastrar fator nem alterar Auth; não é MFA PASS. MFA real e staff positivo, sessão/revogação/perfis/matriz completa continuam abertos. Nenhuma alteração persistente de status, schema, grants, layout, senha, cobrança ou produção. Código/docs devem ter CI conferida após push.


## Gate estorno/cancelamento preparado — 2026-10-07, após retomada HTTP

Ver docs/DEV_FINANCIAL_LIFECYCLE_GATE.md. Novo test:financial-lifecycle cria fatos fictícios próprios nas duas lojas, testa reverse_payment/cancel_charge concorrentes (um UUID/um 23505), saldos/reversão de alocações/audit/originais preservados, ID estrangeiro P0002 e organização alheia 42501, motivo/período 22023 e FIFO após estorno 55000. Só corrige fatos novos, sem FIFO positivo sobre integrante compartilhado. 11 testes locais PASS e sintaxe PASS. SQL verify_dev_financial_lifecycle.sql passou nas duas lojas dentro de ROLLBACK, claims simuladas; não comprova JWT/HTTP/concorrência. HTTP novo ainda pendente do proprietário. Ambas lojas continuam active, sem nova janela de status, Auth/grants/schema/frontend/cobrança/produção alterados. Etapa 1 segue aberta para MFA/staff, revogação/perfis, institucional/FIFO positivo e matriz restante. CI deve ser conferida após push.


## Pacote restante da etapa 1 preparado — 2026-10-07 Brasil / 2026-10-08 UTC

Proprietário determinou continuar até fechar etapa1; não declarar encerrada enquanto gates reais pendentes. Ver docs/DEV_STAGE1_CLOSURE_GATE.md. Persistidas somente fixtures DEV isoladas para FIFO e plano/mapeamentos 2027, sem sobreposição/alteração de fatos 2026. SQL rollback PASS: FIFO/institucional/fechamento, 20 comandos cross-org por identidade, FK institucional23503 e cinco transições de perfil/restauração. 12 testes locais/sintaxe PASS. Preparados test:stage1-remaining, test:profiles-live (JWT original sem refresh durante fases) e test:master-mfa (QR local privado, OTP mascarado, AAL1 negativo/AAL2 positivo). Todos novos HTTP/TOTP ainda NÃO EXECUTADOS pelo proprietário. Ambas assinaturas active, papéis ADMIN originais preservados e nenhum vínculo/staff/fator temporário aplicado. Conta dedicada escolhida via pergunta pelo proprietário: michael.c.carvalho+corsys-dev-master@gmail.com; consulta Auth ainda não encontrou usuário, staff_count=0. Proprietário precisa criá-la no painel e manter senha local; conector não oferece criação Auth. Não inserir Auth por SQL nem fabricar tokens. Bind primeiro Master só após identidade criada/conferida, proteção do último Master permanece. Support/Billing/sessões/expiração/revogação e critérios críticos remanescentes continuam obrigatórios, não cobertos por Master sozinho. Mudanças não promovem etapa2, não alteram produção/cobrança/grants/schema/frontend. Conferir CI contra novo commit. Pendências reais dependem de execução/OTP do proprietário, não de autorização nova.


## Staff live HTTP/MFA aprovado — 2026-10-07, 23:51 Brasil

Proprietário executou test:staff-live na cópia Windows (4), com saída final PASS apresentada. Tag DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738. SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno e mensagem, janela Aread_only/B oculto/20writes por loja negados, expiração por datas passadas, reabertura positiva, encerramento/revogação, Billing assinaturas positivas/limites financeiro-Support-Master, inactive e cleanup, logout global e refresh anterior rejeitado por código Auth/status esperado PASS. Mesmo JWT preservado durante as mudanças SQL; não equivale a invalidação criptográfica imediata do accessJWT em logout. Ticket fictício e TOTP verificado permanecem, credenciais não recebidas.

Agente aplicou sete transições guardadas entre WAITs. SQL final: A/B ADMIN próprios, tenant_links0, duas subscriptionsactive, somente Master dedicado active, zero janelas suporte abertas, auth.sessions staff0; fatores Master/staff TOTP verified. Janela temporária ENCERRADA, cleanupRequired=false. CI pacote37718586263success. Gates de perfis/MFA/staff/suporte/refresh concluídos no escopo executado. Revisão do critério histórico IDOR por recurso em cada RPC ainda identifica casos de configuração/aprovação e views financeiras/DRE a conferir; não encerrar etapa1 nem promover etapa2 antes de completar essa matriz. Autorização cross-org20RPCs não substitui own-org/foreign-resource-ID. Sem produção/custos/grants/schema alterados.
