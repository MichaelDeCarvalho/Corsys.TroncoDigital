# V35 — encerramento da etapa 1 no DEV

Data: 2026-10-08 Brasil. Projeto: szqkdekwhzxsoxorgvaz.
Decisão: etapa 1 CONCLUÍDA no escopo de autorização, isolamento e segurança dos comandos existentes testados. Etapa 2 EM EXECUÇÃO, iniciando pela conciliação de integrantes, parâmetros e estrutura financeira com o inventário obrigatório V35.
Esta decisão não libera produção, merge, uso comercial ou declara o sistema completo.

## Origem e revisão da evidência

HTTP/JWT/TOTP foram executados pelo proprietário no Windows/Node v24.20.0; logs apresentados nesta conversa. O agente executou verificações SQL e conferências administrativas, sem receber credenciais, OTP, QR ou tokens. SQL com claims simuladas é evidência separada, nunca tratado como login/MFA real.
Último roteiro: dev-gate/tests/authorization-final.mjs da revisão f467d8e6fa9ece829219271f30f992babb43bd23. Foundation checks run 37720733935 concluído success. O ZIP inicialmente omitiu o lockfile: arquivo original da branch fornecido, instalação npm ci concluída com zero findings no dev-gate e 12 testes locais PASS. Nenhum arquivo do teste foi alterado por essa correção do pacote.

## Critérios e resultados

| Critério | Evidência | Escopo/limite |
|---|---|---|
| Identidade assinada e isolamento A/B | test:tenant-isolation PASS | Login/getUser, próprios positivos, cruzados ocultos, Master/anon/JWT inválido |
| Comandos e saldos | DEV HTTP 428ce717-21fa-41cc-a7b5-47512ef83bfe | A/B, idempotência concorrente e competição de alocação com erro exato |
| Suspensão e retomada | DEV SUSPENSION 7cb919d9-81de-402a-b708-9404af5c5e3c e ef9110f9-141b-4a21-be25-a50865935970 | B suspended: seis RPCs bloqueadas, leituras preservadas; active retomado; demais status possuem evidência SQL, não HTTP equivalente |
| Estorno/cancelamento | DEV LIFECYCLE 8b67cd58-6f78-4f70-b3e7-d3e07f287653 | A/B, concorrência, um evento, originais/saldos/auditoria e recursos alheios |
| Catálogo, FIFO, institucional e competência | DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696 | 20 comandos cross-org por identidade; FIFO e institucional positivos; close/reopen |
| Perfis e vínculo revogado sem refresh | DEV LIVE PROFILES ff496b1b-823d-4021-9fd5-d21b240f9a6c | Mesmo JWT B: ADMIN/TREASURER/VIEWER/integrante/revogação/ADMIN restaurado |
| Master MFA real | DEV MASTER MFA fb5a5b74-00b4-45c8-9a6b-0565c2b69f56 | Evidência combinada: AAL1 negado, TOTP/AAL2 e RPC positiva, um audit confirmado administrativamente. Roteiro original terminou FAIL por expectativa incorreta de SELECT em audit backend-only; não registrar PASS integral. Contrato corrigido sem abrir grants/RLS |
| Support/Billing e sessões | DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738 | TOTP/AAL2 real, mesma sessão em janela read_only A, B oculto, expiração/reabertura/revogação, Billing/inactive, cleanup e refresh antigo rejeitado após logout |
| IDs estrangeiros com organização própria e views | DEV FINAL AUTHORIZATION 09fcfa34-48ad-4c19-ac60-b2c173b2648b | A/B: oito RPCs adicionais com recursos elegíveis estrangeiros negados; 28 views; dez exigem fatos próprios positivos, incluindo DRE; criação própria de draft/policy futura/decisão manual/audit |
| Consistência final | SELECT administrativo em 2026-10-08 | Três integrantes por org com reconciled=true e integrity_ok=true; estados abaixo |

O conjunto resolve os cinco bloqueios históricos da etapa 1 para os cenários dos comandos existentes: identidade real, MFA/staff, perfis/suspensão, simultaneidade e negativos restantes de recursos/views. Não equivale a todas as combinações de argumentos, todos os módulos previstos ou teste de carga.

## Estado final conferido

- A/B ADMIN somente na própria organização; zero vínculos member_user_links.
- Duas assinaturas active; único staff ativo é o Master dedicado; conta staff de teste sem papel.
- Zero janelas de suporte abertas; zero auth.sessions da conta staff de teste após logout.
- Últimos eventos das competências testadas 2027 são reopen nas duas lojas.
- Políticas fictícias finais published, mode=off, vigência 2030-01-01 a 2030-12-31; não alteram política atual.
- Fatos financeiros/auditorias, drafts futuros, decisões manuais e ticket interno fictícios permanecem DEV. Não apagar ledger nem repetir seeds/testes que exigem fixture limpa.
- Fatores TOTP verificados permanecem nas contas dedicadas.

## Limites que permanecem obrigatórios para entrega

Views vazias de orçamento, conciliação bancária, comunicações, privacidade e billing não homologam esses domínios. Controles de isolamento foram testados; cálculos/jornadas positivos precisam de dados e testes nas respectivas etapas.
Decisões manuais de aprovação não homologam geração automática, quórum e jornada completa. Publicação contábil própria, parâmetros, cenários institucionais completos e demais regras do piloto continuam na matriz das etapas 2–4.
Logout demonstrou rejeição do refresh anterior; não demonstrou invalidação instantânea do access JWT assinado nem espera até expiração. Revogação de autorização foi demonstrada com o mesmo JWT em vínculo/staff/suporte.
Recuperação por e-mail permanece não homologada e bloqueia prontidão operacional (etapa 7); erro de envio observado não comprova falha de isolamento. Paridade integral HTML/React, mobile, integrações, recuperação de dados e produção seguem pendentes.
Proteção contra senhas vazadas, avisos de advisors e dependências da aplicação precisam revisão de release; audit zero do dev-gate não prova audit zero atual da aplicação.
Preservar integralmente HTML V35/ADRs/inventário e layout comum para todas as lojas. Planos comerciais BRL125/180, cobrança manual preparada para Stripe, suporte interno/WhatsApp e domínio pendente continuam decisões, não serviços ativados.

## Próximo trabalho autorizado

Etapa 2: inventariar implementação real versus piloto para integrantes, vínculos/perfis, parâmetros/categorias, vigências/versionamento, plano contábil, fundos, contas e meios de pagamento. Implementar lacunas com persistência, validação server-side e regressão dos limites já comprovados. Nenhum novo teste local do proprietário é solicitado neste marco.
