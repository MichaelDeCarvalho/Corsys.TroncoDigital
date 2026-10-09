# Publicação contábil V35 — verificação DEV

A RPC `publish_validated_accounting_plan` foi aplicada no Supabase DEV como migration `20261009162535_validated_accounting_plan_publication`.

A verificação SQL reversível está em `scripts/verify_dev_validated_accounting_publication.sql`.

Pendência: versionar a migration aplicada e incluir no manifesto SHA256; não executar em produção.
