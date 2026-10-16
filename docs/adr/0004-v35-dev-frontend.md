# ADR — Frontend conectado e preview DEV V35

Status: aceito para implementação DEV; publicação pendente de acesso Cloudflare.

Preservar React/Vite da branch existente. Não migrar para Next.js nesta etapa. Expor login por senha, integrantes em leitura e suporte; adiar lançamentos financeiros até gates JWT/MFA/concorrência.

Sessão verificada por getUser fora do callback Auth; SDK só recebe chave publicável. Isolamento confiável em RLS/RPC; filtros de tenant e descarte de respostas na UI complementam esses controles. Logout local evita encerrar sessões em outros dispositivos.

Cloudflare usa assets estáticos e fallback SPA, configuração somente DEV. Sem deploy automático na CI. Build exige configuração pública; CI usa placeholder e não gera evidência de integração real.

Consequências: suporte ainda sem idempotência server-side; em erro de confirmação, atualizar lista antes de reenviar. Sem recuperação de senha/OAuth/MFA UI neste incremento. Preview público permanece separado da aprovação de produção.
