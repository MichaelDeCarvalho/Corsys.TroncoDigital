# DEV — recuperação de senha
Configuração esperada em Authentication > URL Configuration:
Site URL e Redirect URL: https://corsys-tronco-digital-dev.corsys1.workers.dev/
O proprietário informou que configurou em 2026-10-07; painel não verificado pelo agente.

## Fluxo
1. Na página DEV deslogada, clicar Esqueci minha senha.
2. Informar o e-mail cadastrado e enviar uma vez.
3. Abrir o e-mail mais recente; não reutilizar o link antigo para localhost.
4. A sessão do link é recebida pelo SDK; getUser valida identidade antes do formulário.
5. Informar e confirmar nova senha, mínimo 12 caracteres, salvar.
6. Voltar ao acesso e testar login normal com a nova senha.
7. Atualizar somente a senha correspondente no .env.dev privado local e executar o smoke.

Não enviar links de recuperação, senhas ou .env por chat/GitHub. Não editar manualmente
tokens ou conceder privilégios para contornar recuperação. A mudança de senha é realizada
pelo usuário pelo Supabase Auth; este incremento não altera senhas diretamente.
Nenhum e-mail é enviado automaticamente pelo agente.

## Evidência
30 testes frontend PASS (23 anteriores + 7 de recuperação); typecheck PASS.
Build local PASS com configuração publicável placeholder, não prova Auth real.
Testes cobrem evento de recuperação sem leitura tenant, URL não prova identidade,
confirmação divergente, identidade diferente, duplicidade, falha genérica e sucesso.
Configuração URL, entrega de e-mail e mudança de senha real ainda precisam de homologação.
CI e preview precisam ser conferidos após push.

## Implementação
Cliente SPA com detectSessionInUrl=true, fluxo implícito do SDK existente.
Não faz parsing manual de tokens nem remove RLS. O marcador de recuperação apenas
seleciona a tela: autorização e atualização são verificadas pelo Supabase.
Se a página for recarregada depois de o SDK limpar o link, o marcador em memória
não persiste; para retomar recuperação interrompida, solicitar link novo.
A política frontend de 12 caracteres não substitui a política de senhas do Auth.

Referências oficiais consultadas:
https://supabase.com/docs/guides/auth/passwords
https://supabase.com/docs/guides/auth/redirect-urls
