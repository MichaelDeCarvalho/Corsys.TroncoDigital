# M01.03 — roteiro de homologação DEV

## Entradas

- Revisão do PR #31 aprovada e CI verde.
- Arquivo oficial integral em UTF-8, versão e início de vigência aprovados. A minuta recebida serve como referência de revisão e permanece fora do catálogo.
- Origem HTTPS do frontend DEV e callback `/onboarding/accept` na lista de redirecionamentos do Supabase Auth.
- Para a M01.04, destinatário dedicado e autorização de envio. O teste de recuperação anterior não cobre o convite.

## Preparação do documento

Calcular o SHA-256 do arquivo oficial com `Get-FileHash -Algorithm SHA256 -LiteralPath <arquivo>` e registrar o valor em minúsculas. Preservar quebras de linha e espaços. Se a importação remover BOM ou alterar a codificação, reconciliar os bytes com o arquivo aprovado antes da publicação.

Em transação, inserir os metadados da versão em `public.saas_terms_versions` e o texto associado em `private.onboarding_terms_documents`. Antes de confirmar, comparar o hash aprovado com `encode(sha256(convert_to(document_text, 'UTF8')), 'hex')` no banco. Se houver divergência, reverter a transação. Uma correção de conteúdo exige nova versão.

## Ordem e evidência

1. Conferir o destino Supabase DEV `szqkdekwhzxsoxorgvaz` e o commit aprovado. Aplicar a migration antes de publicar a função que chama as novas RPCs.
2. Antes de provisionar o documento, confirmar com identidade de teste autorizada que catálogo vazio bloqueia aceite e vínculo. Confirmar a negativa para outra identidade e verificar que o run permanece em `awaiting_invite`. Se ainda não houver uma identidade de teste vinculada ao run, executar essas negativas no início do gate M01.04, antes do provisionamento.
3. Configurar `ONBOARDING_APP_ORIGIN` e o callback no Auth, publicar função e frontend DEV compatíveis e verificar o redirect durante a M01.04.
4. Com destinatário autorizado, observar o callback com JWT real. Conferir versão, hash, texto e botão de aceite desabilitado antes do consentimento. Após o aceite, confirmar um perfil na Loja correta, um recibo da versão e um evento de conclusão. Reabrir o callback e confirmar que não há segunda gravação.
5. Registrar revisão, migration, resultado de cada negativa e evidência de perfil, recibo e auditoria no handoff. O registro deve omitir credenciais, tokens e links de convite.
