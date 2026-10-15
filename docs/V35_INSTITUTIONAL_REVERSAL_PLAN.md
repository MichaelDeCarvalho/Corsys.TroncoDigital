# Estorno institucional — próxima entrega da Etapa 2

Estado em 2026-10-15: desenho para revisão; NÃO implementado, migrado ou homologado.
Não publicar nem liquidar fixtures para testar antes dos gates abaixo.

## Evidência e dependência

O código versionado contém pagamentos/recebimentos institucionais, alocações,
reversões imutáveis, validações, RLS e views de caixa/DRE. A busca nos comandos e
na interface não encontrou operação pública correspondente ao estorno completo.
Isso não prova ausência no catálogo DEV: a integração nega a consulta administrativa.
Confirmar catálogo, migrations aplicadas e assinatura real antes de adicionar RPC.
Não alterar migrations históricas, planos publicados ou Lojas originais.

## Contrato proposto

Um comando por tenant recebe tipo (pagamento de despesa ou recebimento de receita),
ID do movimento, data do estorno, motivo e chave de idempotência. Reusar autorização
server-side institucional, auditoria e mecanismo de idempotência existentes.
Revogar execução de PUBLIC/anon e conceder somente authenticated; a concessão
nunca substitui checar permissão, vínculo ativo e organização dentro do comando.

Validar tipo, ID, motivo, data e competência aberta antes da escrita. Bloquear
data anterior ao fato. Replay da mesma chave/payload devolve o mesmo resultado;
payload divergente ou novo estorno de fato já estornado deve ser recusado.
Derivar competência da data no servidor. Retornar ID determinístico do fato.

Reverter alocações ativas e depois o movimento na mesma transação, exclusivamente
por eventos append-only. Bloquear o fato e ordenar locks de obrigações, alinhando
a ordem às funções existentes para serializar contra novas alocações e correções.
Nunca atualizar/apagar fatos históricos ou desativar triggers/RLS.

Caso especial: obrigação parcialmente liquidada e depois cancelada. Remover sua
alocação sem novo evento de ajuste pode produzir aberto em obrigação cancelada.
A primeira versão deve recusar esse caso explicitamente até existir regra de
negócio e modelo de evento aprovados. Revisar também vínculos de conciliação;
não apagar vínculos históricos silenciosamente para viabilizar o estorno.

## Interface proposta

Histórico limitado e validado por tenant, status de estorno, escolha do movimento,
data, motivo e confirmação explícita. Preservar chave na repetição após resultado
incerto; não disparar retry automático nem presumir sucesso por timeout. Recarregar
histórico, alocações, saldo e obrigação após resultado confirmado. Rejeitar resposta
malformada/fora do tenant. RLS e autorização do comando são controles efetivos.

## Gates de aceite antes de publicar

1. Confirmar catálogo e estado atual do DEV szqkdekwhzxsoxorgvaz; criar migration
   aditiva pela CLI conforme convenção e revisar diff/grants/search_path/locks.
2. Testes SQL com rollback A/B: pagamento e recebimento, reversão das alocações,
   restauração de caixa, DRE sem nova receita/despesa, auditoria e idempotência.
3. Negativos: outra Loja/ID, perfil sem permissão, suspensão, competência fechada,
   data inválida, obrigação cancelada, replay divergente e concorrência com alocação.
4. Testes de componentes/leituras: dois tipos, resposta inválida, troca de Loja,
   timeout/repetição, confirmação e atualização. Tipos/build/preservação e segurança.
5. Somente após migration/gates SQL: preview DEV isolado e jornada UI A/B com
   operações fictícias até R$1 já autorizadas; estornar, conferir saldo R$10 e DRE.
   Validar desktop/mobile e registrar versão/commit/resultados/limites no PR #4.

Se o acesso administrativo continuar indisponível, esta entrega fica pendente;
não declarar o desenho como funcionalidade concluída. A homologação básica A/B
registrada no relatório da Etapa 2 permanece válida para seu escopo.
