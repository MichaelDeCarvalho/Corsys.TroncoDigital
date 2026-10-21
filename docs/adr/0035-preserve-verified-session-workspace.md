# ADR-0035 — Preservar formulário durante revalidação da mesma identidade

21/10/2026. Correção descoberta na homologação DEV.

O hook colocava toda mudança de sessão em checking, desmontando Workspace, seleção de Loja e formulários. Uma prévia de ágape B foi perdida durante a jornada longa. A regressão reproduziu o defeito com TOKEN_REFRESHED e falhou antes da correção.

Manter montada somente a identidade anteriormente validada quando o evento identifica o mesmo usuário. Durante getUser, envolver Workspace em inert/aria-busy: não aceitar novas interações. Continuar getUser no servidor, fora do callback de Auth e com proteção de revisão contra respostas atrasadas. Erro de validação, logout, recuperação ou usuário diferente ocultam a área anterior. Nenhum JWT é extraído, impresso ou armazenado por este código.

Após revalidação, consultar novamente Lojas e disponibilidade Master. Preservar a seleção quando ainda autorizada; removê-la quando revogada. Atualização de escopo bloqueia interações sem desmontar a Loja válida. Server-side permission, assinatura, MFA e RLS permanecem a fronteira de autorização; dados de sessão do evento não concedem acesso.

Regressões: TOKEN_REFRESHED e SIGNED_IN do mesmo usuário conservam tela/campo/Loja; escopo revogado é removido; validação indisponível e troca de identidade ocultam dados; resposta tardia após logout não reabre sessão. Suite App + recuperação:23 testes PASS. Gate DEV de refresh usa apenas auth.refreshSession e getUser, reportando A/B sem credenciais; teste real preparado, ainda pendente neste checkpoint.

Fontes verificadas21/out: [onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), SDK instalado2.117.2. Não ignora revalidação nem altera persistência ou permissões.
