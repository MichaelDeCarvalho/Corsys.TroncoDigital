# V35 — M02.03: gate específico de homologação financeira no Supabase DEV

**Estado:** roteiro de execução, ainda **não autorizado/realizado** para a M02.02-D.  
**Base GitHub:** `main=86f1c62634d4e2dc0a5ad1fbac1cd49218517907` (PR #40, 10/11/2026).  
**Ambiente permitido apenas mediante autorização específica:** Supabase DEV `szqkdekwhzxsoxorgvaz`; frontend Worker DEV existente. **PROD proibido**.

## Evidências já obtidas — não repetir

- M02.02-A PR #34 (`16bfd8e8`) integra bloqueio de conciliação sob leitura truncada/incoerente; CI aprovado, **gate DEV específico pendente**.
- M02.02-B PR #37 (`66db9bf7`) integra eventos operacionais paginados; M02.02-C PR #38 (`b13aa26d`) integra saldo contábil por conta. CI 3/3 em ambos; frontend **não publicado** nesta etapa.
- M02.02-D PR #40 (`86f1c626`) integra `20261110220000_v35_cash_flow_detail.sql`, ranking de despesas com alocações, estornos, descrição/categoria da origem e saldo histórico em uma instrução SQL. CI #459 static/frontend/onboarding PASS. Gate PostgreSQL 17 **descartável** com rollback, autorizações negativas, A/B, parcial, reversão e concorrência. Não chamar isso de JWT real/QA DEV.
- Em leitura somente no Supabase DEV, a função `public.read_tenant_cash_flow_detail(uuid,date,date,integer)` estava **ausente**, confirmando não haver ativação D. Publique **somente** após autorização.
- `docs/adr/0045-cash-flow-origin-snapshot.md` fixa classificação da despesa no instante do pagamento, não retroativa. Nominal de categorias pode refletir catálogo atual. Repasse neutro está excluído.

## Ordem obrigatória de execução (futura)

1. **Revalidar Git HEAD, versão de migration e estado do DEV antes de qualquer escrita.** Verificar capacidade de recuperação e ausência de diferenças materiais de schema. Registrar evidências (sem expor dados pessoais ou secrets).
2. **Após autorização escrita, somente no DEV:** aplicar **uma vez** `20261110220000_v35_cash_flow_detail.sql`, preservando histórico de versões aplicado. A migration deve preceder a publicação do frontend que a utiliza. Não mudar RLS, credenciais ou permissões fora do escopo.
3. **Read-back SQL:** `to_regprocedure(...)`, `prosecdef`, `search_path` vazio, EXECUTE negado a anon e concedido a authenticated com `private.require_permission(finance.read)`; comparar manifesto de migrations.
4. **Negativas e integridade no DEV:** anon, autenticação sem `finance.read`, Loja cruzada A/B, período/página inválidos; casos conhecidos de lançamento, estorno, parcial, múltiplas alocações, resíduo sem categoria e somatórios. Preferir registros existentes já autorizados, sem gerar fatos financeiros permanentes; testes sintéticos apenas em transação revertida e sem alterar usuários reais.
5. **Coerência financeira:** comparar realizados com `read_tenant_daily_cash_flow`, separando saldo patrimonial (abertura/transferências) de fluxo operacional e DRE por competência. Ranking por data de liquidação; classificação histórica conforme ADR 0045; atenção ao histórico de categoria e ao custo de leitura em volume.
6. **Publicar frontend somente no Worker DEV mediante autorização específica** e conferir página desktop/mobile, loading, sem dados, erro, negação, paginação e saldos. O pacote atual inclui callback M01.03, mas a migration e os termos oficiais de M01.03 seguem inativos: **não acionar onboarding/convites nem cadastrar termos fictícios**.
7. **Registros:** salvar versão exata de Worker, versão aplicada de migration, evidências sem identificação pessoal, testes PASS/FAIL, riscos e recuperação. Não marcar M02.03 CONCLUIDO antes da homologação real e dos gates materiais restantes.

## Limites e autorização

Este roteiro **não autoriza**: migration, deploy, RLS/roles, operações financeiras persistentes, envio de e-mail, criação de convites, publicação de termos, mudanças no PROD ou leitura de segredos. O aceite deve identificar especificamente M02.02-D/M02.03, Supabase DEV e frontend DEV.

Se os testes DEV não forem viáveis sem dados de teste persistentes ou credenciais, **interromper esse subgate e pedir autorização específica**, sem improvisar. Falhas de consistência bloqueiam promoção.
