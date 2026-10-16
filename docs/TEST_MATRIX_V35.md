# Matriz de validação V35

## Interface
- criar plano em rascunho;
- editar nome e código interno do rascunho;
- editar preço/recursos/vigência;
- publicar e preservar snapshot anterior;
- desativar e reativar plano;
- excluir plano novo sem publicação/vínculo;
- tentar excluir plano publicado/vinculado: deve bloquear e orientar Desativar;
- filtrar histórico de versões por intervalo de vigência;
- filtrar por Rascunho, Vigente, Publicada futura, Histórica e Desativado;
- limpar filtros;
- criar promoção rascunho;
- editar promoção;
- desativar/reativar promoção;
- excluir promoção nunca publicada/usada;
- tentar excluir promoção publicada/usada: deve bloquear.

## Banco
- aplicar migrations 001–016 do zero;
- snapshots `display_name_snapshot`/`internal_code_snapshot` preenchidos no backfill;
- draft de plano aceita alterar nome/código;
- publicação não modifica snapshots das versões anteriores;
- `delete_saas_plan_if_unused` bloqueia versão publicada, assinatura, onboarding, promoção e mudança agendada;
- `set_saas_plan_active(false)` mantém assinaturas existentes;
- `create/update_saas_promotion_draft` funcionam sem CRUD direto do browser;
- exclusão de oferta bloqueia publicação/resgate/vínculo;
- desativação da oferta preserva resgates;
- views administrativas respeitam RLS via `security_invoker`;
- Master sem AAL2/MFA não executa comandos privilegiados;
- tenant não acessa control plane.
