# V34 — Matriz de validação

## Protótipo
- Novo cliente percorre 5 etapas, lista todos os planos publicados, preenche preço e salva o cliente na sessão.
- Plano novo salva rascunho, edita todos os campos e publica.
- Nova versão mantém o nome do plano e pode alterar preço/recursos.
- Data de vigência igual à data atual mostra versão vigente após publicação.
- Promoção vigente abre aviso de impacto; alteração cria rascunho sucessor e pode ser publicada.
- Cobrança em atraso exibe Encargos e Total atualizado.
- Novo chamado interno abre formulário e entra no Kanban.
- Chamados exibem data/hora de abertura, autor e tempo decorrido.
- Cliente possui item lateral Chamados, pode abrir, acompanhar, responder e consultar histórico.
- Tenant A não mostra tickets de Tenant B no protótipo.

## Runtime Supabase
- aplicar migrations 001–015;
- verificar RLS de onboarding/tickets;
- AAL2 Master para publicar plano/promoção;
- versão publicada imutável;
- entitlements publicados imutáveis;
- promoção sucessora não reescreve resgates antigos;
- invoice charge breakdown fecha com balance view;
- tenant nunca lê ticket interno;
- tenant A nunca lê ticket B;
- SUPPORT sem sessão não lê financeiro do tenant;
- auth invite executado somente server-side;
- testes de concorrência/idempotência antes de produção.
