# ADR-0051 — Edição segura da identidade da prestadora

Aceito tecnicamente sob aprovação A04/E03 e ressalva do proprietário em 25/11/2026.

Reutilizar saas_platform_configuration para identidade; permitir edição somente via save_platform_identity pelo MASTER/AAL2. Payload completo de dez campos; opcionais nulos, formato validado no servidor, sem campos de segredos ou política comercial. Lock da linha e comparação updated_at rejeitam conflito PT409. Audit atômico em saas_master_audit_logs contém nomes de campos e motivo, sem valores pessoais antigos/novos. Sem UPDATE direto para authenticated. Sem retry cego; reconciliar após resposta incerta. Retorno do timestamp confirma o resultado antes do reload.

A migration é aditiva e não escreve dados existentes ao aplicar. Não altera contratos/documentos nem concede acesso tenant. Campos reais permanecem vazios até cadastro pelo proprietário no final; frontend não apresenta preenchimento como requisito para testar DEV. CNPJ numérico/alfanumérico: somente conferência de formato, não certificação oficial. Permissões/negativas e rollback são testados em PostgreSQL descartável; a homologação JWT real segue separada.

Recuperação: ocultar editor e manter função sem uso até forward-fix. Não excluir log nem modificar migration já aplicada.
