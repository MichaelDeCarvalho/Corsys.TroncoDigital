# CORSYS CLOUDFLARE ENGINEERING

## Escopo

Use este módulo quando o projeto envolver:

- Cloudflare Workers;
- Workers Static Assets;
- Cloudflare Pages;
- deploy de frontend;
- SPA;
- sites estáticos;
- aplicações full-stack;
- Workers Builds;
- GitHub/GitLab;
- Wrangler;
- domínio e DNS;
- HTTPS;
- Custom Domains;
- Routes;
- environment variables;
- secrets;
- redirects;
- headers;
- APIs server-side;
- CORS;
- caching;
- observabilidade;
- troubleshooting;
- migração de Netlify/Vercel/Pages;
- evolução do plano gratuito para produção.

---

# 1. PRINCÍPIO CENTRAL

Cloudflare é infraestrutura de deploy e execução.

Não alterar a arquitetura válida de um projeto apenas para adaptá-lo à Cloudflare.

Antes de configurar qualquer aplicação:

1. ler a estrutura existente;
2. identificar framework e runtime;
3. abrir `package.json`;
4. identificar package manager;
5. identificar comando real de build;
6. identificar diretório real de saída;
7. identificar SPA, SSG, SSR ou aplicação full-stack;
8. identificar APIs/backend existentes;
9. identificar Supabase, banco, Auth e Storage;
10. identificar secrets e variáveis públicas;
11. identificar domínio;
12. identificar CI/CD existente;
13. identificar requisitos de produção.

Nunca inventar:

- `npm run build`;
- diretório `dist`;
- diretório `build`;
- versão Node;
- framework;
- variável;
- secret;
- endpoint;
- configuração Wrangler;
- compatibilidade com Cloudflare.

Confirmar no projeto e, quando sujeito a mudança, na documentação oficial atual.

---

# 2. SOURCE OF TRUTH

Para qualquer configuração Cloudflare sujeita a alteração, usar esta ordem:

1. documentação oficial atual da Cloudflare;
2. referência oficial do Wrangler;
3. documentação oficial do framework;
4. changelog oficial;
5. repositório oficial;
6. conhecimento Corsys para arquitetura e padrões.

Documentação principal:

https://developers.cloudflare.com/

Workers:

https://developers.cloudflare.com/workers/

Wrangler:

https://developers.cloudflare.com/workers/wrangler/

Static Assets:

https://developers.cloudflare.com/workers/static-assets/

Pages:

https://developers.cloudflare.com/pages/

Nunca assumir que:

- limite;
- preço;
- comando;
- propriedade;
- runtime;
- versão;
- compatibilidade;
- binding;
- integração;

continua igual sem verificar documentação oficial quando isso for relevante à implementação.

---

# 3. PADRÃO ATUAL PARA NOVOS PROJETOS

Para novos projetos, considerar primeiro:

```text
Cloudflare Workers
+
Workers Static Assets
```

Workers Static Assets é o padrão preferencial atual para:

- sites estáticos;
- SPAs;
- React;
- Vue;
- Svelte;
- aplicações client-side;
- SSG;
- frontend com pequenas APIs;
- aplicações full-stack compatíveis.

Cloudflare Pages continua suportado.

Não migrar automaticamente um projeto Pages existente que esteja funcionando.

Para projeto novo, preferir Workers Static Assets salvo quando houver motivo técnico comprovado para Pages.

Não usar Workers Sites em novos projetos.

---

# 4. DECISÃO: STATIC ASSETS, WORKER OU PAGES

## 4.1 Frontend estático / SPA

Arquitetura preferencial:

```text
GitHub
   ↓
Workers Builds
   ↓
Cloudflare Worker
   +
Static Assets
   ↓
Frontend
```

Não é obrigatório criar código server-side de Worker.

Um Worker pode servir apenas Static Assets.

---

## 4.2 Frontend + API pequena

Usar:

```text
Static Assets
+
Worker script
```

Exemplo conceitual:

```text
Browser
   │
   ├── /assets/* → Static Assets
   │
   └── /api/* → Worker
                     │
                     ├── Supabase
                     ├── Gemini
                     ├── Resend
                     └── API externa
```

Criar Worker somente quando houver responsabilidade server-side real.

---

## 4.3 Backend já existente

Se o projeto já usa corretamente:

- Supabase Edge Functions;
- backend Node.js;
- FastAPI;
- outro serviço;

não criar um Worker duplicando a mesma responsabilidade sem justificativa.

Avaliar:

- proximidade dos dados;
- autenticação;
- autorização;
- runtime;
- timeout;
- custo;
- observabilidade;
- manutenção.

---

## 4.4 Cloudflare Pages

Pages pode permanecer quando:

- projeto já está publicado e funcionando;
- migração não produz benefício suficiente;
- arquitetura depende de recursos específicos do Pages;
- custo/risco de migração não se justifica.

Para projetos novos, verificar primeiro Workers Static Assets.

---

# 5. AUDITORIA OBRIGATÓRIA DO PROJETO

Antes do primeiro deploy Cloudflare, produzir um diagnóstico contendo:

```text
Projeto:
Framework:
Versão:
Package manager:
Tipo:
SPA / SSG / SSR / Full-stack / Estático

Root directory:
Build command:
Build output:
Node/runtime:
Variáveis públicas:
Secrets:
APIs:
Banco:
Autenticação:
Storage:
Backend:
Domínio:
CI/CD atual:
```

Obter esses valores do projeto.

Não preencher por suposição.

---

# 6. PACKAGE.JSON

Antes de configurar build, analisar:

```json
{
  "scripts": {},
  "dependencies": {},
  "devDependencies": {}
}
```

Confirmar especialmente:

- `build`;
- `dev`;
- `preview`;
- framework;
- versão do Node quando especificada;
- adaptadores Cloudflare;
- Vite;
- React;
- Next.js;
- Astro;
- Svelte;
- Vue;
- bibliotecas server-only.

Não modificar scripts válidos apenas para encaixar uma receita genérica.

---

# 7. WRANGLER

Para novos projetos Workers, preferir atualmente:

```text
wrangler.jsonc
```

Tratar o arquivo de configuração Wrangler como fonte de verdade da configuração Cloudflare quando aplicável.

Configuração mínima conceitual para frontend estático:

```jsonc
{
  "name": "NOME_DO_PROJETO",
  "compatibility_date": "DATA_ATUAL_VALIDADA",
  "assets": {
    "directory": "./DIRETORIO_REAL_DO_BUILD"
  }
}
```

Os valores acima são placeholders.

Nunca assumir `./dist`.

Determinar o diretório produzido pelo build real.

Não copiar uma `compatibility_date` antiga arbitrariamente.

Para uma configuração nova, seguir a orientação oficial atual da Cloudflare.

---

# 8. SINGLE PAGE APPLICATION — SPA

Se o frontend usar client-side routing, como aplicações React/Vue/Svelte SPA, verificar necessidade de fallback para `index.html`.

Configuração conceitual:

```jsonc
{
  "assets": {
    "directory": "./DIRETORIO_REAL",
    "not_found_handling": "single-page-application"
  }
}
```

Isso deve ser aplicado somente se o projeto realmente for SPA.

Testar diretamente URLs como:

```text
/
/login
/dashboard
/produtos/123
/configuracoes
```

Recarregar cada URL diretamente no navegador.

O deploy não está concluído se:

```text
/ funciona
```

mas:

```text
/dashboard + refresh
```

retorna 404.

---

# 9. STATIC ASSETS + API

Quando houver Worker server-side junto ao frontend, separar claramente:

```text
assets
vs.
Worker
```

Rotas de API podem exigir execução do Worker antes dos assets.

Exemplo conceitual:

```jsonc
{
  "main": "./CAMINHO_REAL_DO_WORKER",
  "assets": {
    "directory": "./DIRETORIO_REAL",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": [
      "/api/*"
    ]
  }
}
```

Não adicionar `main`, `binding` ou `run_worker_first` se não forem necessários.

A configuração deve refletir o fluxo real.

---

# 10. GITHUB E DEPLOY

Preferir código versionado em GitHub.

Fluxo esperado:

```text
desenvolvimento
↓
branch
↓
commit
↓
Pull Request quando aplicável
↓
main
↓
Cloudflare Workers Builds
↓
build
↓
deploy
```

Cloudflare Workers Builds pode integrar diretamente com:

- GitHub;
- GitLab.

Antes de habilitar deploy automático, confirmar:

- production branch;
- root directory;
- build command;
- deploy command;
- variáveis;
- secrets;
- permissões do repositório.

Não fornecer secrets de produção a builds ou previews não confiáveis sem necessidade.

---

# 11. BUILD

Determinar no projeto:

```text
Root directory
Install
Build
Output
Deploy
```

Workers Builds executa conceitualmente:

```text
build
↓
deploy
```

O comando de deploy padrão pode utilizar Wrangler, mas verificar configuração atual antes de definir.

Se houver monorepo:

```text
repo/
├── apps/
│   ├── catalogo/
│   └── admin/
└── packages/
```

definir explicitamente qual diretório contém a aplicação.

Nunca apontar o build para a raiz por conveniência se a aplicação estiver em subdiretório.

---

# 12. ENVIRONMENT VARIABLES

Classificar cada variável antes de configurá-la:

```text
PUBLIC
BUILD-TIME
SERVER-SIDE
SECRET
```

## Pública

Pode aparecer no bundle entregue ao navegador.

Exemplos possíveis:

```text
PUBLIC_APP_URL
VITE_PUBLIC_APP_URL
VITE_SUPABASE_URL
```

O prefixo real depende do framework.

Nunca inventar prefixos.

---

## Secret

Secrets nunca devem estar em:

- HTML;
- JavaScript entregue ao browser;
- bundle;
- Git;
- `wrangler.jsonc` como texto;
- screenshots;
- documentação pública;
- logs.

Exemplos:

```text
GEMINI_API_KEY
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
WEBHOOK_SECRET
```

Devem existir somente no ambiente server-side que necessita deles.

---

# 13. SECRETS NO WRANGLER

Usar mecanismo de secrets da Cloudflare para valores sensíveis.

Quando suportado pela versão atual, declarar os nomes dos secrets necessários para permitir validação de configuração.

Exemplo conceitual:

```jsonc
{
  "secrets": {
    "required": [
      "GEMINI_API_KEY",
      "RESEND_API_KEY"
    ]
  }
}
```

Esse bloco contém somente nomes.

Nunca valores.

Para desenvolvimento local, usar conforme documentação atual:

```text
.dev.vars
```

ou:

```text
.env
```

quando apropriado.

Não usar ambos sem necessidade.

Adicionar arquivos de secret ao `.gitignore`.

Exemplo:

```gitignore
.env
.env.*
.dev.vars
.dev.vars.*
```

Preservar `.env.example` somente com nomes e documentação, nunca valores reais.

---

# 14. VARIÁVEIS FRONTEND NÃO SÃO SEGREDOS

Variáveis inseridas durante build de frontend podem acabar incorporadas ao bundle JavaScript.

Não considerar algo seguro apenas porque está configurado como environment variable no painel Cloudflare.

Regra:

```text
Se o navegador precisa receber o valor,
considere-o público.
```

Secret real deve permanecer server-side.

---

# 15. SUPABASE

Se o projeto utilizar Supabase:

Frontend pode usar chave publicável/anon quando a arquitetura oficial permitir e houver RLS adequada.

Nunca expor:

```text
service_role
```

ao navegador.

Responsabilidades típicas:

```text
Supabase
├── Auth
├── PostgreSQL
├── RLS
├── Storage
└── Realtime

Cloudflare
├── frontend
├── CDN
└── Worker server-side quando necessário
```

Não migrar PostgreSQL/Supabase para D1 apenas porque o frontend foi hospedado na Cloudflare.

Migrar banco somente mediante benefício arquitetural comprovado.

---

# 16. GEMINI E OUTRAS APIs

Arquitetura segura:

```text
Browser
   ↓
Worker ou backend seguro
   ↓
Gemini/API externa
   ↓
backend
   ↓
Browser
```

Nunca:

```text
Browser
   ↓
Gemini com secret real embutido
```

O mesmo princípio se aplica a:

- Resend;
- OpenAI;
- APIs privadas;
- pagamentos;
- serviços administrativos.

---

# 17. CORS

CORS não é autenticação.

Antes de corrigir CORS, diagnosticar:

- Origin;
- método;
- OPTIONS/preflight;
- headers;
- credentials;
- status HTTP;
- autenticação;
- endpoint;
- domínio de frontend;
- domínio da API.

Não aplicar automaticamente:

```http
Access-Control-Allow-Origin: *
```

em APIs privadas.

Se frontend e API estiverem sob o mesmo domínio quando possível, avaliar arquitetura que reduza dependência de CORS.

---

# 18. CUSTOM DOMAINS

Para aplicação cujo Worker é a própria origem, considerar Custom Domain.

Exemplo:

```text
catalogo.corsys.com.br
```

ou:

```text
app.exemplo.com
```

Custom Domains podem permitir à Cloudflare gerenciar:

- DNS necessário;
- associação ao Worker;
- certificado TLS.

Para produção, preferir domínio próprio em vez de depender somente de:

```text
*.workers.dev
```

Verificar sempre a configuração atual da zona DNS antes de alterar registros.

Nunca sobrescrever registro DNS existente sem analisar impacto.

---

# 19. CUSTOM DOMAIN VS ROUTE

Usar conceitualmente:

## Custom Domain

Quando:

```text
Worker = origem da aplicação
```

Exemplo:

```text
app.exemplo.com
      ↓
    Worker
```

## Route

Quando:

```text
Worker
   ↓
origem existente
```

Exemplo:

```text
request
↓
Worker
↓
servidor já existente
```

Não tratar Custom Domain e Route como equivalentes.

---

# 20. DNS E HTTPS

Antes de alterar DNS:

1. identificar zona;
2. listar registros existentes;
3. identificar domínio raiz/subdomínio;
4. detectar e-mail/MX;
5. detectar serviços existentes;
6. detectar registros usados por terceiros;
7. planejar mudança;
8. validar HTTPS após propagação.

Nunca apagar ou substituir:

- MX;
- SPF;
- DKIM;
- DMARC;
- registros de API;
- serviços externos;

sem necessidade comprovada.

---

# 21. REDIRECTS

Workers Static Assets pode usar arquivo:

```text
_redirects
```

para redirects de assets estáticos quando adequado.

Antes de criar, verificar se a regra pertence:

- ao arquivo `_redirects`;
- ao Worker;
- a Bulk Redirects;
- ao framework;
- a outra camada.

Redirect configurado para Static Assets não deve ser assumido como aplicável automaticamente a respostas geradas pelo Worker.

---

# 22. HEADERS

Workers Static Assets pode usar:

```text
_headers
```

para headers de respostas estáticas.

Considerar quando apropriado:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Strict-Transport-Security
```

Não copiar CSP genérica sem testar o projeto.

Uma CSP incorreta pode quebrar:

- scripts;
- APIs;
- imagens;
- fontes;
- Supabase;
- embeds.

Headers definidos para Static Assets não devem ser assumidos como aplicados automaticamente a respostas geradas pelo Worker.

Worker server-side deve configurar seus próprios headers quando necessário.

---

# 23. CACHE

Cloudflare já possui comportamento de cache para Static Assets.

Não criar regras complexas de cache sem necessidade.

Para assets versionados/hash:

```text
/assets/app.a1b2c3.js
```

cache longo pode ser adequado.

Para:

```text
index.html
```

avaliar atualização e revalidação.

Nunca aplicar cache agressivo indiscriminadamente a:

- APIs privadas;
- dados personalizados;
- respostas autenticadas;
- dados sensíveis.

---

# 24. AUTENTICAÇÃO E AUTORIZAÇÃO

Cloudflare não substitui modelo de autorização da aplicação.

Não confiar somente em:

- rota escondida;
- React Router;
- variável no browser;
- botão invisível;
- Cloudflare CORS;
- URL difícil de descobrir.

Toda operação privada deve validar autorização server-side.

Se Supabase for usado:

```text
Auth
+
RLS
+
autorização de backend quando necessária
```

---

# 25. WORKER NÃO É OBRIGATÓRIO

Evitar criar Worker script apenas porque a aplicação está na Cloudflare.

Para frontend puramente estático:

```text
Workers Static Assets
```

pode ser suficiente.

Adicionar backend somente quando necessário para:

- secret;
- API privada;
- integração privilegiada;
- transformação server-side;
- webhook;
- autenticação server-side;
- regras críticas.

---

# 26. RECURSOS CLOUDFLARE ADICIONAIS

Não adicionar automaticamente:

- D1;
- KV;
- R2;
- Durable Objects;
- Queues;
- Workflows;
- Cron;
- AI;
- Vectorize.

Primeiro identificar necessidade.

Exemplos:

```text
R2
→ objetos/arquivos quando houver benefício.

KV
→ dados chave/valor distribuídos adequados ao modelo.

D1
→ banco SQL quando arquitetura justificar.

Queues
→ processamento assíncrono desacoplado.

Workflows
→ processos duráveis de múltiplas etapas.

Durable Objects
→ coordenação/estado consistente por entidade.
```

Não substituir Supabase, PostgreSQL ou serviços existentes sem análise de impacto.

---

# 27. PROCESSAMENTOS LONGOS

Não executar cadeia longa dentro de requisição HTTP apenas porque Worker suporta código server-side.

Para fluxos como:

```text
upload
↓
processamento
↓
IA
↓
banco
↓
e-mail
```

avaliar arquitetura assíncrona.

Possíveis componentes, conforme necessidade e disponibilidade atual:

- Queues;
- Workflows;
- backend existente;
- Supabase;
- serviço dedicado.

Persistir estado quando necessário:

```text
job_id
status
stage
attempts
created_at
started_at
completed_at
failed_at
error_code
```

Retries devem ser idempotentes.

---

# 28. SEGURANÇA

Aplicar:

- least privilege;
- deny by default;
- fail securely;
- secrets separados;
- validação server-side;
- rate limiting quando necessário;
- autenticação;
- autorização;
- payload limits;
- logging seguro;
- proteção contra abuso.

Considerar:

- XSS;
- CSRF;
- SSRF;
- injection;
- path traversal;
- open redirects;
- upload malicioso;
- IDOR/BOLA;
- mass assignment;
- credential stuffing.

---

# 29. INSECURE DEFAULTS

Configuração ausente nunca deve silenciosamente desativar controle crítico.

Exemplo inseguro:

```text
AUTH_REQUIRED ausente
↓
default false
↓
API pública
```

Preferir:

```text
AUTH_REQUIRED ausente
↓
startup/deploy falha
```

ou:

```text
auth permanece ativa
```

Secrets obrigatórios ausentes devem idealmente produzir falha clara antes de operação insegura.

---

# 30. GITIGNORE

Auditar antes de publicar:

```gitignore
node_modules/
dist/
.env
.env.*
.dev.vars
.dev.vars.*
.wrangler/
```

A inclusão de `dist/` depende do fluxo real do projeto.

Não adicionar regra sem verificar se aquela pasta precisa ou não ser versionada.

Nunca versionar secrets.

---

# 31. AMBIENTES

Separar quando aplicável:

```text
local
preview/staging
production
```

Não reutilizar indiscriminadamente:

- secrets;
- banco;
- webhooks;
- API keys;
- URLs;

entre ambientes.

Produção deve possuir configuração explícita.

---

# 32. PREVIEWS

Se previews de branch estiverem habilitados:

avaliar risco de:

- apontar para banco de produção;
- disparar e-mails reais;
- chamar APIs pagas;
- receber secrets de produção;
- modificar dados reais.

Preview não deve automaticamente receber acesso privilegiado.

---

# 33. OBSERVABILIDADE

Para Worker com lógica server-side, registrar quando necessário:

```text
timestamp
request_id
correlation_id
route
method
status
duration
error_category
```

Não registrar:

```text
senha
token
API key
cookie completo
authorization header
payload sensível completo
```

---

# 34. TROUBLESHOOTING DE BUILD

Quando deploy falhar, seguir ordem:

```text
1. reproduzir build local;
2. ler erro exato;
3. confirmar package manager;
4. confirmar dependências;
5. confirmar Node/runtime;
6. confirmar build command;
7. confirmar root directory;
8. confirmar output directory;
9. confirmar env vars;
10. confirmar Wrangler;
11. confirmar framework adapter;
12. confirmar documentação atual;
```

Não fazer alterações aleatórias em várias camadas simultaneamente.

---

# 35. TROUBLESHOOTING DE RUNTIME

Se build passou mas aplicação falha:

verificar:

```text
Console do navegador
Network
404
500
CORS
variáveis
API
DNS
TLS
rotas
SPA fallback
Worker logs
Supabase/RLS
autenticação
```

Separar:

```text
erro de build
erro de deploy
erro de frontend
erro de Worker
erro de API externa
erro de banco
erro de DNS
```

---

# 36. TESTES MÍNIMOS DE DEPLOY

Após publicação, validar:

## Frontend

- `/`;
- assets;
- CSS;
- JavaScript;
- imagens;
- responsividade;
- console sem erros críticos.

## SPA

Abrir URL interna diretamente:

```text
/dashboard
```

e executar refresh.

## API

Testar:

- happy path;
- input inválido;
- não autenticado;
- autenticado sem permissão;
- erro externo;
- timeout quando relevante.

## Segurança

Confirmar:

- nenhum secret no bundle;
- nenhum secret no source map;
- nenhum secret no repositório;
- nenhuma service role no browser;
- RLS ativa quando aplicável.

## Domínio

Confirmar:

- DNS;
- HTTPS;
- redirect www/apex se necessário;
- canonical quando relevante.

---

# 37. INSPEÇÃO DO BUNDLE

Antes de considerar produção pronta, procurar no resultado compilado por nomes e valores sensíveis.

Nunca assumir:

```text
"está em environment variable"
```

como prova de que não foi exposto.

Em frontend, variáveis utilizadas pelo bundle podem virar texto público.

---

# 38. ROLLBACK

Antes de mudança relevante de produção, definir rollback.

Separar:

```text
rollback do código
rollback do deploy
rollback do Worker
rollback do DNS
rollback do banco
```

Git revert não reverte automaticamente:

- DNS;
- secrets;
- migrations;
- dados alterados;
- configurações do dashboard.

---

# 39. CUSTOS

Para projeto iniciando gratuito:

identificar quais serviços geram consumo:

- requests;
- CPU;
- builds;
- armazenamento;
- banco;
- egress quando aplicável;
- observabilidade;
- serviços externos.

Não hardcodar limites ou preços na arquitetura sem verificar documentação atual.

Antes de produção, definir pelo menos:

```text
baseline de uso
alertas
limites
serviços pagos potenciais
```

---

# 40. MIGRAÇÃO DE PAGES PARA WORKERS

Não migrar por moda.

Migrar quando houver benefício como:

- recursos Workers mais amplos;
- Static Assets atual;
- observabilidade;
- APIs integradas;
- recursos não disponíveis em Pages;
- padronização de infraestrutura.

Antes da migração verificar:

- framework adapter;
- build output;
- Functions;
- `_worker.js`;
- `_routes.json`;
- redirects;
- headers;
- env vars;
- bindings;
- previews;
- domínio;
- comportamento de assets.

Testar equivalência funcional antes de desligar Pages.

---

# 41. MIGRAÇÃO DE NETLIFY/VERCEL

Antes de migrar, mapear dependências proprietárias.

Exemplos:

```text
Netlify Functions
Netlify redirects
Netlify env
Vercel Functions
Vercel Edge
framework adapters
image optimization
cron
middleware
```

Não assumir compatibilidade 1:1.

Produzir:

```text
recurso atual
→ equivalente Cloudflare
→ diferença
→ risco
→ alteração necessária
```

---

# 42. CORSYS.CATÁLOGO

Para Corsys.Catálogo, preservar como princípio:

```text
GitHub
    ↓
Cloudflare Workers + Static Assets
    ↓
Frontend Corsys.Catálogo
```

Serviços existentes devem permanecer em suas responsabilidades:

```text
Supabase
→ Auth / PostgreSQL / RLS / Storage / Realtime

Gemini
→ IA via backend seguro quando secret for necessário

Resend
→ e-mail via backend seguro

GitHub
→ código e histórico
```

Não migrar Supabase para tecnologia Cloudflare sem motivo arquitetural.

Não adicionar Worker backend se não houver operação server-side que justifique.

---

# 43. FLUXO DE CONFIGURAÇÃO DE UM NOVO PROJETO

Ao receber um projeto para configurar na Cloudflare:

## Etapa 1 — Descoberta

Analisar:

```text
árvore de arquivos
package.json
framework
scripts
env
API
banco
auth
assets
rotas
```

## Etapa 2 — Classificação

Definir:

```text
static
SPA
SSG
SSR
full-stack
```

## Etapa 3 — Arquitetura Cloudflare

Escolher:

```text
Workers Static Assets
ou
Static Assets + Worker
ou
Pages existente
```

## Etapa 4 — Configuração

Produzir somente o necessário:

```text
wrangler.jsonc
package.json
_headers
_redirects
.gitignore
env example
```

## Etapa 5 — Git

Configurar integração e branch de produção.

## Etapa 6 — Secrets

Separar public/config/secret.

## Etapa 7 — Deploy

Realizar build e deploy.

## Etapa 8 — Domínio

Configurar domínio após deploy técnico funcionar.

## Etapa 9 — Testes

Executar checklist funcional e de segurança.

## Etapa 10 — Produção

Documentar:

```text
arquitetura
env
deploy
rollback
domínio
riscos
```

---

# 44. FORMATO DE RESPOSTA DO CORSYS

Quando solicitado:

> "Configure este projeto para Cloudflare."

Responder preferencialmente com:

## 1. Diagnóstico

```text
Framework:
Tipo:
Build:
Output:
Backend:
Dependências:
```

## 2. Arquitetura recomendada

Explicar por que:

```text
Workers Static Assets
```

ou outra opção.

## 3. Alterações necessárias

Listar arquivos.

## 4. Código

Entregar conteúdo completo dos arquivos alterados.

## 5. Cloudflare Dashboard

Informar somente configurações que realmente precisam ser feitas manualmente.

## 6. Variáveis e secrets

Tabela:

```text
Variável | Tipo | Onde configurar | Browser?
```

## 7. GitHub

Informar fluxo de deploy.

## 8. Domínio

Passos necessários.

## 9. Testes

Fornecer checklist reproduzível.

## 10. Riscos e limitações

Informar o que não foi possível validar.

---

# 45. REGRA DE ALTERAÇÃO

Em projeto existente:

1. ler antes de editar;
2. preservar convenções válidas;
3. fazer mudança mínima;
4. não trocar stack sem benefício;
5. não duplicar backend;
6. não mover banco sem necessidade;
7. não criar dependência Cloudflare desnecessária;
8. manter rollback possível.

---

# 46. DEFINITION OF DONE

Configuração Cloudflare só está concluída quando, conforme o escopo:

- build local funciona;
- build Cloudflare funciona;
- deploy funciona;
- página abre;
- rotas SPA funcionam;
- assets funcionam;
- APIs funcionam;
- variáveis estão corretas;
- secrets não estão expostos;
- autenticação funciona;
- autorização funciona;
- RLS foi preservada;
- domínio funciona;
- HTTPS funciona;
- erros críticos do console foram avaliados;
- rollback está definido;
- documentação do projeto foi atualizada.

Nunca dizer:

```text
"está funcionando"
```

sem evidência de teste.

Se apenas a configuração foi produzida, dizer:

```text
"Configuração preparada; deploy ainda precisa ser validado no ambiente Cloudflare."
```

---

# 47. REGRA FINAL

Cloudflare deve servir ao projeto.

O projeto não deve ser desnecessariamente reconstruído para servir à Cloudflare.

A sequência correta é:

```text
entender o projeto
↓
identificar arquitetura
↓
consultar documentação oficial atual
↓
escolher recurso mínimo Cloudflare
↓
configurar com segurança
↓
testar
↓
publicar
↓
monitorar
↓
evoluir quando necessário
```

Para novos projetos frontend, verificar primeiro Workers Static Assets.

Para projetos existentes em Pages, preservar Pages quando continuar sendo a opção correta.

Secrets permanecem server-side.

Banco e autenticação permanecem em sua camada responsável.

GitHub permanece a memória versionada do software.

Toda decisão sujeita a mudança deve ser confirmada na documentação oficial atual antes de implementação.