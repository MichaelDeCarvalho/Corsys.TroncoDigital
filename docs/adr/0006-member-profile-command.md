# ADR0006 — alteração cadastral por RPC

Estado: aceita para DEV, 2026-10-08.
Contexto: members tem somente SELECT para authenticated; piloto exige cadastro e edição, sem alterar fatos financeiros ou autorização de acesso.
Decisão: save_member_profile com members.write existente, allowlist/validação server-side, idempotência existente e optimistic locking updated_at sob FOR UPDATE. Trigger de timestamp exclusivo de members avança mesmo em uma transação. Grants autenticados somente daRPC; anon e helper direto negados.
Auditoria minimiza snapshots aos estados/nomes de campos, mantendo ator/motivo. Sem CPF/roles/mensalidade/isenção nesse contrato; regras financeiras e cargos versionados têm comandos próprios a implementar.
Alternativa descartada: INSERT/UPDATE direto na UI abriria um caminho sem validação/auditoria/idempotência; upsert genérico permitiria mass-assignment.
Consequências: novas escritas cadastrais precisam teste HTTP real e regressão dos gates da etapa1; SQL simulado e testesUI não substituem. Risco operacional mitigado por modo leitura/revogação da novaRPC e forward-fix, sem exclusão de dados.
