# CURRENT ARCHITECTURE

React 19 + Vite 6 + TypeScript, cliente supabase-js com chave publicável. Supabase PostgreSQL/Auth DEV. Cloudflare Worker corsys-tronco-digital-dev serve assets estáticos; não há servidor HTTP próprio ou segredo administrativo no browser. Consultas passam pela Data API/RLS; chamado usa RPC autorizada.

## Componentes

- src/auth: login, getUser, descarte de respostas antigas de identidade e logout local.
- src/lib/tenant-data.ts: organizações, até 200 integrantes, até 100 chamados, RPC create_saas_support_ticket.
- src/components/Workspace.tsx: seleção de Loja; recriação do painel por tenant.
- src/lib/finance-data.ts e components/Finance.tsx: consultas independentes a v_charge_balances, v_institutional_payable_effective e v_institutional_receivable_effective. Ordem por vencimento e ID, páginas de 25 com um registro adicional para detectar próxima página. Dados efetivos/em aberto vêm do backend; sem totais de página apresentados como saldo global. Retorno de tenant inesperado, integrity_ok inválido ou valor monetário inválido provoca erro explícito. Abort/recriação descartam resposta atrasada ao trocar tenant/tipo de consulta.
- src/styles.css: layout adaptativo; navegação móvel e tabela com scroll interno/foco por teclado. Celular real ainda não revisado.

## Fronteiras

RLS/RPCs são autorização; filtros no browser são defesa adicional. Nenhuma alteração de schema/permissão neste incremento. Nenhuma escrita financeira, Storage, billing provider, chamada IA ou e-mail integrada. Consulta vazia não demonstra total global; RLS pode restringir registros conforme o papel.

SDK persiste a sessão; getUser valida identidade. Chave sb_publishable é pública. Build exige URL HTTPS e configuração pública válidas; secrets, .env.local e .wrangler não versionados. CSP só autoriza conexão com o Supabase DEV. wrangler.dev.jsonc é exclusivo DEV.

## Validação e continuidade

CI foundation-checks: jobs static e frontend, permissions contents:read, actions por SHA, sem deploy/secrets pelo GitHub Actions. Cloudflare tem integração de build da branch DEV configurada pelo proprietário. Gate adicional scripts/check_v35_preservation.py verifica hashes/presença dos artefatos históricos; não avalia semântica SQL ou UI.

Requisitos canônicos e módulos pendentes: docs/V35_COVERAGE.md e os 29 ADRs originais. Estado/evidência de entrega: SESSION_HANDOFF.md. Produção depende de autorização posterior.

## Referência do piloto

HTML V34 operacional recebido em 2026-10-03. docs/V35_PILOT_PARITY.md reconcilia o mínimo do HTML com a V35; docs/V35_PILOT_INVENTORY.md lista todos os controles extraídos por DOM/AST. A referência em docs/pilot/ mantém código de produto e linhas originais, removendo somente tags externas de antivírus; não é servida no app. Gate verifica hashes/21 telas, sem provar runtime. Master/duas lojas/Cliente 360º devem ser homologados visualmente e por cliques; abertura local foi bloqueada no navegador desta revisão.

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.


## Etapa 1 iniciada — 2026-10-05 Brasil / 2026-10-06 UTC

Proprietário autorizou avançar pela sequência de oito etapas. docs/V35_DELIVERY_PLAN.md registra estado/evidência e pendências. Decisões comerciais em docs/adr/0005-commercial-launch-decisions.md e config/commercial-decisions.json: dois planos BRL 125/180 mensais, cobrança manual e futura Stripe preferencial; suporte interno/WhatsApp manual, automação futura; domínio pendente. Configuração registrada, catálogo/integrações ainda não ativados.

SQL de catálogo e isolamento reexecutado com sucesso. Novo scripts/verify_dev_subscription_and_staff.sql passou após corrigir fixture publicada sem timestamp: tolerância/suspensão/override, limites de staff/AAL e proteção do último Master; claims simuladas, helpers/triggers, rollback conferido sem dados temporários. Não equivale a HTTP/JWT/MFA reais ou comandos financeiros completos. dev-gate possui roteiro HTTP reforçado e exemplo dos UUIDs existentes, sem necessidade de chave administrativa. Oito testes locais passaram; roteiro HTTP autenticado ainda não executado por ausência das senhas em ambiente seguro. Não solicitar senhas/tokens pelo chat nem alterar credenciais existentes. Nenhuma migration, grant, schema, frontend, produção ou serviço pago alterado.


## Continuidade da etapa 1 — 2026-10-06 UTC

Ver docs/V35_STAGE_1_EVIDENCE.md. Invariantes financeiras e pós-V31 passaram. Novos roteiros verify_dev_financial_commands.sql e verify_dev_roles_and_support.sql passaram no DEV: RPCs nas duas lojas, idempotência sequencial/auditoria, leituras próprias/cruzadas, sobrealocação e IDs alheios, suspensão, perfis e suporte temporário/revogação/expiração. Claims simuladas; tudo revertido, zero fixtures temporárias conferidas. Oito testes locais PASS. Etapa 1 permanece em execução: JWT real, MFA real, matriz HTTP e concorrência simultânea ainda não comprovados. Nenhuma alteração de schema, grants, senhas, frontend, produção ou cobrança.


## Recuperação de senha DEV — 2026-10-07

Implementado Esqueci minha senha, solicitação resetPasswordForEmail com redirectTo da origem atual, tratamento PASSWORD_RECOVERY e formulário autenticado updateUser. SDK detectSessionInUrl=true; flag de recuperação é somente apresentação, identidade validada por getUser e RLS continua server-side. Formulário compara identidade antes de trocar senha, exige confirmação/12 caracteres, bloqueia duplicidade e limpa campos após tentativa; resposta de solicitação não confirma existência de conta. Recuperação mantém workspace oculto até retorno explícito ao login. Site URL/Redirect URLs DEV configurados conforme relato do proprietário, não conferidos via API. Reenvio e recuperação reais por e-mail dependem de homologação do proprietário; nenhum e-mail enviado pelo agente, nenhuma senha/token lido, nenhum grant ou schema alterado. Não declarar etapa 1 concluída. Ver docs/DEV_PASSWORD_RECOVERY.md.
