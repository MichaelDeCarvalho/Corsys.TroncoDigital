# Publicação contábil V35 — controle de entrega DEV

Migração 31 aplicada **somente ao Supabase DEV**: `20261009162535_validated_accounting_plan_publication`.

Cópia exata da migration está versionada em `supabase/migrations/20261009162535_validated_accounting_plan_publication.sql`; SHA256 `e7a02237ea8d42cdbeb29756c67bbacb501cc4a0e67bc3a14c48b8e876e5aa67` no manifesto.

Teste SQL `scripts/verify_dev_validated_accounting_publication.sql` executado A/B, `DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS`. Simula JWT claims via SQL, não HTTP/JWT assinado. Efeito persistido dos testes: nenhum. Não houve publicação de plano real ou movimento de conta; publicação no frontend somente DEV após build e disponibilização posterior da versão.

**Gates faltantes:** CI do último commit, HTTP/JWT real e autorização de múltiplas contas, concorrência independente e risco de locks SHARE globais, visual desktop/mobile com HTML V35, compatibilidade externa do endpoint legado revogado, regras de criação de categorias ativas após publicação. Nenhum deploy de produção autorizado.
