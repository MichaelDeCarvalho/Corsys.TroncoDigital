# ADR 0019 — Separar draft, provisionamento e panorama comercial no Master SaaS

Status: aprovado para DEV, 2026-10-10; PROD BLOQUEADO.

### Contexto
As funções `save_saas_onboarding_draft` e `provision_saas_onboarding_database` já existiam no schema V35, mas nenhuma UI Master permitia o ciclo. A criação real de tenant tem efeito comercial e enfileira convite; rascunho não pode criar Loja por acidente. O Cliente 360 histórico do HTML exige escopo comercial, suporte e contratos sem dar acesso indevido ao ledger privado dos integrantes.

### Decisão
Acesso somente MASTER com MFA/AAL2 validado no PostgreSQL. Salvar rascunho em formulário distinto do comando de provisionamento; exigir plano publicado e início compatível, papel inicial `ADMIN`, informações essenciais e confirmação textual `PROVISIONAR`. Invocar a RPC legada sem reimplementar criação de organizações nem enviar convite no frontend. Provisão é idempotente pela mesma linha de onboarding, com lock e retorno de organização existente. O sistema só confirma `saas_jobs` enfileirado, não envio de e-mail. Cliente 360 oferece leitura separada `read_master_client_360`, retornando apenas resumo de assinatura, faturas e chamados da Loja selecionada, sem impersonação ou acesso ao financeiro dos integrantes.

### Segurança e limites
RLS do catálogo e dos rascunhos permanece; comandos restringidos pelo servidor, view Master via RPC AAL2. Testes SQL DEV com rollback cobrem usuário MASTER, AAL1, tenant e replay. A RPC de rascunho existente não vincula hash do payload à chave idempotente: corrigir antes de PROD para impedir colidir com dados distintos. Fluxo de invite/aceite real não homologado. Relatório 360 não é editor de contrato e pode conter dados comerciais sensíveis; não usar em sessão de cliente. Sem PRODUCTION.


## Aditamento de segurança — 2026-10-10

O formulário de criação de novos rascunhos foi migrado para a RPC `create_master_onboarding_draft_idempotent` (migração DEV #46), que compara chave e payload normalizado antes de reutilizar o resultado e não gera eventos de etapas duplicados no retry. O risco de colisão no comando legado ficou mitigado **para a nova interface**, mas continua existindo para consumidores que ainda chamam `save_saas_onboarding_draft` diretamente; documentar depreciação/compatibilidade e bloquear PROD até resolver o risco residual. Gate SQL de replay e autorização MASTER/AAL2 aprovado, sem dados persistidos.
