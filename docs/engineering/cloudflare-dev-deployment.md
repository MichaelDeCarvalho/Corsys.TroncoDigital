# Publicação Cloudflare DEV — Corsys.TroncoDigital

Configuração preparada e dry-run aprovado; deploy não realizado. O painel retornou verificação contra bots persistente no navegador remoto em 2026-10-02. Não tentar contornar a verificação. Wrangler local não possui sessão autenticada. Um login no navegador pessoal não autentica automaticamente esta sessão.

## Caminho pelo painel, executado pelo proprietário

1. Na conta Cloudflare pretendida, confirmar Workers Free e franquia disponível de Builds. Se houver cobrança, upgrade ou contratação proposta, apresentar antes de seguir.
2. Em Workers & Pages, criar um Worker DEV novo a partir do GitHub. Não substituir Worker existente. Revisar a integração/permissões e conceder acesso apenas ao repositório necessário quando a interface permitir.
3. Escolher MichaelDeCarvalho/Corsys.TroncoDigital e configurar os valores abaixo antes do primeiro build. A branch padrão main não contém esta entrega.

| Campo | Valor |
|---|---|
| Nome do Worker | corsys-tronco-digital-dev |
| Branch | feat/v35-dev-gate-20261002 |
| Root directory | raiz do repositório |
| Build command | npm ci --ignore-scripts && npm run check |
| Deploy command | npx wrangler deploy --config wrangler.dev.jsonc |
| NODE_VERSION, variável de build | 24.19.0 |
| VITE_SUPABASE_URL, variável pública de build | https://szqkdekwhzxsoxorgvaz.supabase.co |
| VITE_SUPABASE_PUBLISHABLE_KEY, variável pública de build | chave sb_publishable do projeto DEV, obtida no painel Supabase |

O termo production branch da Cloudflare refere-se ao Worker selecionado: este Worker inteiro é DEV, separado da futura produção. Não conectar main ou um Worker de produção existente. Não configurar domínios/DNS neste passo.

A chave publicável é entregue ao navegador por design; RLS e RPCs autorizam o acesso. Não usar sb_secret, service_role, senha, token Auth ou credencial administrativa. A chave placeholder da CI do GitHub não permite login e não serve para este build.

O nome no painel deve corresponder ao name em wrangler.dev.jsonc. O output real é dist, já informado no arquivo. O config tem fallback SPA e public/_headers é copiado pelo Vite. Não criar backend Worker adicional ou mudar a stack. Inspecionar os logs de build e aguardar URL de sucesso; não declarar deploy com base apenas no build.

Se a interface não permitir escolher esses campos antes da criação, registrar a tela/erro e ajustar o fluxo antes de publicar. Labels do painel podem mudar; a referência confiável são os campos oficiais abaixo.

## Custos consultados em 2026-10-02

Documentação Cloudflare: requests de static assets gratuitos e ilimitados; Workers Builds Free inclui 3.000 minutos/mês, 1 build concorrente e timeout de 20 minutos. A conta Cloudflare específica e sua utilização NÃO foram verificadas. Não ativar Workers Paid nem APIs pagas. Não habilitar novos recursos de cache computacional ou backend neste frontend estático. Os limites/custos devem ser reavaliados se a arquitetura mudar.

## Depois da publicação

Informar apenas a URL pública e o resultado do build, nunca tokens/senhas. Validar /, CSS/JS, HTTPS, headers e fallback; verificar desktop/mobile e console. Com os dois usuários DEV: login, sessão após refresh, Loja própria, integrantes, criação/leitura de chamado e logout. Executar HTTP/JWT cross-tenant independentemente da UI. MFA, suspensão e concorrência permanecem gates separados; não publicar produção ou liberar operações financeiras com base apenas neste preview.

## Fontes oficiais consultadas

- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
