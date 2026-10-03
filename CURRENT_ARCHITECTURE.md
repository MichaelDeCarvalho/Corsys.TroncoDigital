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
