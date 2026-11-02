## Atualização de ativação — 01/11/2026

Ativação especificamente autorizada pelo proprietário. Migration master_audit_read_model aplicada somente ao DEV szqkdekwhzxsoxorgvaz, versão real 20261102000933; arquivo alinhado sem alterar SQL aplicado. MASTER_AUDIT_READ_MODEL_SQL_PASS em transação ROLLBACK: resultado autorizado e ordenado, sem metadata, faixa inválida negada, AAL1/não-staff/anon negados, SELECT direto negado. Read-back: 5 eventos antes/depois, RLS true, SELECT authenticated false, anon EXECUTE false, authenticated EXECUTE true sujeito ao helper MASTER+AAL2, search_path vazio. São claims SQL simuladas, não HTTP/MFA real. CI412 PASS para implementação; atualização de registro/versão será checada no PR. Produção e secrets preservados.

A proposta abaixo foi aprovada para DEV; as referências a aprovação pendente e migration não aplicada registram o estado anterior, substituído por esta evidência.

# ADR-0042 — Leitura minimizada da auditoria Master

Data: 01/11/2026. Status: proposta, ativação DEV depende de aprovação específica.

## Evidência e lacuna

A aba Auditoria de MasterOperations era informativa. Inspeção read-only do projeto DEV confirmou tabela `saas_master_audit_logs` com RLS e sem RPC de auditoria. A tabela possui `staff_user_id`, `organization_id`, `action`, `resource_type`, `resource_id`, `metadata`, `created_at` e identificador bigint. Não possui `actor_user_id` ou `reason` como colunas próprias. O helper `private.require_platform_staff(text)` exige usuário autenticado, AAL2 e papel ativo.

## Proposta

RPC aditiva `list_master_audit_events` reutiliza o helper com papel MASTER. Não altera grants/policies da tabela nem eventos existentes. Retorna somente sete colunas, excluindo metadata. Datas são inclusivas em UTC, com intervalo até 366 dias; filtros exatos por ação e Loja; limite 1..100; paginação por ID descendente usando chave primária existente. ID é texto no contrato HTTP para preservar bigint.

Cliente valida intervalo, Loja, ordenação, limites e cursor, omite campos inesperados e cancela consultas antigas. A UI oferece filtros e navegação por páginas de 25 eventos; não mostra JSON técnico nem permite alterações. Acesso SUPPORT/BILLING não é ampliado.

## Ativação e verificação

Migration `20261102000933_master_audit_read_model.sql` preparada, NÃO aplicada. Antes da ativação exigir aprovação para o acesso administrativo novo. Depois aplicar somente DEV e executar `supabase/tests/test_master_audit_read_model.sql`: claims simuladas, resultado autorizado, AAL1 e não-staff negados, anon sem EXECUTE, SELECT direto negado e histórico preservado em ROLLBACK. Testes SQL preparados não são execução real; Docker local indisponível nesta sessão. CI valida gramática, tipos, testes cliente e build; não valida autorização real da RPC.

Após gate SQL, homologar UI/HTTP com sessão MASTER AAL2 real; OTP permanece com o proprietário. Não inferir sucesso de ausência de dados.

## Recuperação e riscos

Em falha, revogar EXECUTE da nova função para authenticated no DEV por migration corretiva e manter histórico/backend intactos. A RPC concede consulta cross-tenant intencional apenas ao MASTER; este é o motivo da aprovação específica. Não aplica novas regras financeiras nem acessa produção. Performance de filtros em grande volume ainda não medida; o índice de ID atende cursor/ordenação, sem adicionar locks de índice nesta entrega.

Referência oficial: https://supabase.com/docs/guides/database/functions (consultada em 01/11/2026).
