# ADR-0027 — conciliação sem contabilização automática

Decisão de 2026-10-14: reutilizar as tabelas de extratos/vínculos e o validador
existentes. A importação passa por prévia local, staging persistido e validação
explícita antes de qualquer correspondência. Conciliar/desfazer não cria pagamentos,
não modifica o ledger e não substitui estorno financeiro.

Quatro comandos com reconciliation.manage, idempotência estrita e auditoria;
sem grants de escrita nas tabelas. Correspondências travam importação, linha e
fato financeiro; o validador preserva limites de linha e fato. Para transferências,
o limite do fato é independente em cada conta bancária: débito e crédito não podem
consumir o mesmo limite entre si. Histórico original e desfazimentos append-only.

Arquivos UTF-8 até 1 MB, 500 linhas, OFX BRL sem entidades ou CSV documentado.
O hash recebido identifica o arquivo para deduplicação; não prova autenticidade
bancária. Sem upload de arquivo bruto/Storage, sem XML executável, sem sugestões
automáticas que autorizem vínculo. Consultas excedentes falham sem operar sobre
uma amostra parcial. Datas, valores e ownership são revalidados pelo servidor.

Variação dos movimentos no período é separada de saldo final; não inventar saldo
do extrato quando o formato não o fornece. Correções de importações imutáveis
exigem histórico sucessor, não edição/destruição de linhas publicadas.

Recuperação: suspender a interface/comandos por release sucessor se necessário;
preservar tabelas, auditoria, arquivos históricos e hashes de migrations aplicadas.
Uma conciliação incorreta é desfeita por evento com motivo. Nenhuma migração PROD.
