# ADR 0018 — Decisão idempotente de aprovações institucionais

Status: aceito para DEV, 2026-10-09.

A V35 já possuía solicitação, decisões imutáveis, restrição de um voto por usuário e `v_payable_approval_state` como fonte do status agregado. A API `decide_payable_approval` autentica por `approvals.review` e audita, mas uma falha de transporte após gravar não permitia distinguir sucesso de duplicação.

Decisão: manter o RPC original como implementação do voto e adicionar `decide_payable_approval_idempotent(org,request,decision,reason,key)`. A função exige permissão, valida payload, preserva replay e só então chama o comando original. UI consulta apenas solicitações pendentes da Loja e não inicia pagamentos.

Consequências: nenhum novo estado duplicado de aprovação, sem alterações retroativas e sem bypass de autorização. RLS/role ainda são o controle central, não o botão. Pendente: verificar múltiplos aprovadores reais, autoaprovação, políticas versionadas, controle de acesso HTTP assinado, concorrência de conexões diferentes e paridade total das telas. SQL A/B rollback PASS; contenção via revogar EXECUTE do wrapper, sem apagar votos históricos.

