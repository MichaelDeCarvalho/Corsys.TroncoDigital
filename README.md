# Corsys.TroncoDigital — V35

Sistema web SaaS de tesouraria para Lojas Maçônicas (multi-tenant), com painel Master SaaS e interfaces para desktop e mobile.

## Estado da fonte no GitHub — 21/10/2026

A branch `main` contém o desenvolvimento DEV consolidado até o commit `7d0673539db3f917bbfcaa1ede51c3a000607dec` (originado do PR #5, que inclui o PR #4 e a fundação). A atualização da `main` foi um fast-forward, sem reescrever histórico. Referência de segurança: `backup/v35-pre-ai-studio-20261021`.

**O código disponível não significa produto concluído ou pronto para produção.** O núcleo financeiro, operações e controles multi-tenant têm implementação e homologação parcial; a paridade integral das 21 telas V35 (6 Master e 15 Loja), algumas jornadas críticas e o release continuam pendentes. Migrações SQL 1–66 foram versionadas e utilizadas no ambiente DEV; não executar indiscriminadamente em produção.

O código-fonte e os scripts estão no GitHub. Dados do Supabase, usuários Auth, variáveis e credenciais de ambientes, histórico transacional e configurações externas da Cloudflare **não são um backup incluído neste repositório**.

## Stack efetiva

- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS 4.
- Banco/Auth/API: Supabase PostgreSQL, Auth, RLS e RPCs; regras financeiras críticas autorizadas no servidor.
- Hospedagem DEV: Cloudflare Workers Static Assets; configuração `wrangler.dev.jsonc`.
- CI: `.github/workflows/foundation-checks.yml` (verificações estáticas, testes, tipagem e build).

## Referência V35 obrigatória

- **HTML de referência original, preservado para comparação:** `docs/pilot/v35-planos-ofertas.reference.html`.
- Histórico V34: `docs/pilot/v34-master-operacional.reference.html`.
- Inventário detalhado das 21 telas e controles: `docs/V35_PILOT_V35_INVENTORY.md`.
- Matriz de paridade e lacunas: `docs/V35_PILOT_PARITY.md`.
- Evolução técnica e evidências recentes: `docs/V35_EXECUTION_20261021.md`, `docs/V35_STAGE_2_IMPLEMENTATION.md`.
- Regras do projeto: `AGENTS.md`, `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, `SESSION_HANDOFF.md` e ADRs em `docs/adr/`.

A referência HTML é um **protótipo de escopo visual e funcional**, não deve ser copiada como autenticação nem executada como substituta da aplicação conectada ao Supabase.

## Desenvolvimento e validação

Requer Node.js compatível com `package.json` (>=22.12 e <25); Python 3.12 para verificações de SQL.

```bash
npm ci --ignore-scripts
npm run check
npm ci --ignore-scripts --prefix dev-gate
npm run check --prefix dev-gate
python -m pip install -r scripts/requirements-checks.txt
python scripts/check_sql.py
python scripts/check_v35_preservation.py
```

Para desenvolvimento local, configurar apenas as variáveis **públicas** documentadas em `.env.example`, apontando ao ambiente DEV autorizado. Nunca inserir senhas, JWTs, `service_role`, `sb_secret`, tokens ou outras credenciais no repositório, código cliente ou no prompt de uma IA. Não reutilizar credenciais de produção em previews.

## Google AI Studio + ChatGPT — colaboração via GitHub

Importar **este repositório na branch principal `main`**, que agora contém o código V35 mais recente versionado. O AI Studio pode sincronizar mudanças com GitHub; verificar o branch efetivo no painel antes do primeiro push.

1. Ler `AGENTS.md`, os documentos de contexto/handoff e as referências V35 acima antes de alterar código.
2. Preservar React/Vite/Supabase/Cloudflare e as RPCs existentes. **Não reconstruir o sistema do zero, migrar banco/provedor nem gerar dados fictícios como se fossem fatos reais.**
3. Priorizar paridade fiel do HTML original com a UI React e responsividade; marcar telas/ações como pendentes até validar fluxo real.
4. Trabalhar em mudanças pequenas e revisáveis; para mudanças críticas, usar branch/PR, com testes e revisão antes da integração.
5. Não executar migrações, seeds, exclusões, operações financeiras reais nem deploy de produção por iniciativa da IA. Segurança multi-tenant, RLS, autorização server-side, idempotência e trilha de auditoria são obrigatórias.
6. Usar o GitHub como fonte única do código. O estado dos dados DEV/PROD continua separado.

Última evidência técnica antes da consolidação: GitHub Actions `Foundation checks` nº 324, resultado SUCCESS no commit `7d067353`. Uma alteração posterior precisa de validação própria; CI não equivale a aceite integral do produto.
