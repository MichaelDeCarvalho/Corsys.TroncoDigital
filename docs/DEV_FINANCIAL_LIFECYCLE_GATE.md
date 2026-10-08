# DEV — estornos e cancelamentos por HTTP (2026-10-07)

## Estado
Roteiro preparado, HTTP real NÃO executado pelo agente. Etapa 1 segue aberta.
Baselines HTTP financeiro, suspensão B e retomada já aprovados pelo proprietário,
conforme docs/V35_STAGE_1_EVIDENCE.md. Ambas lojas ativas; nenhuma janela pendente.
MFA real/staff, revogação/perfis, FIFO positivo, institucional e matriz completa pendentes.

## Evidência executada
npm run check --prefix dev-gate: 11 testes locais PASS e sintaxe dos roteiros PASS.
Novo teste impede falso PASS de eventos concorrentes: exige um UUID de sucesso e
exatamente uma rejeição 23505; erro de rede/permissão/validação não vale como duplicata.
SQL scripts/verify_dev_financial_lifecycle.sql executado no DEV dentro de ROLLBACK:
DEV_LIFECYCLE_BALANCES_ROLLBACK_PASS. Dois cenários nas duas lojas, claims simuladas.
Estorno desfaz alocação 40, cobrança reabre 100 e pagamento fica disponível 0.
Cancelamento de cobrança alocada desfaz alocação 40 e pagamento libera crédito 100.
Depois de ambas correções: aberto/disponível/allocated 0, integridade true, originais
100/100/40 mantidos, um evento de reversão de alocação e audit por correção.
Repetição sequencial 23505; FIFO de pagamento estornado 55000.
Não prova concorrência nem JWT/HTTP. Nenhum fato desse SQL permanece no banco.

## Roteiro HTTP
npm run test:financial-lifecycle, dois JWTs de usuários normais, publishable key,
getUser compara UUID, ambas assinaturas active e override none, fixtures próprias
positivas. Novas duas cobranças 100, dois pagamentos 100 e duas alocações 40 por loja.
Somente fatos criados NESTA execução recebem estornos/cancelamentos. Dados anteriores
não são alterados; não roda FIFO positivo no integrante compartilhado das fixtures.
Tag DEV LIFECYCLE UUID impressa antes de escritas. Não gera dinheiro/cobrança externa.

Primeiro cria fatos nas duas lojas. Negativas: organização estrangeira 42501;
IDs estrangeiros dentro da própria organização P0002 para reverse_payment,
cancel_charge e allocate_payment_fifo; motivo vazio e competência inválida 22023.
Saldos próprios permanecem iguais após negativas.

Cenário 1: duas reverse_payment simultâneas: um UUID, um 23505. Verificar saldo,
evento único, ator/audit e reversão de alocação. Repetir exige 23505; FIFO após estorno
exige 55000. Cenário 2: duas cancel_charge simultâneas: um UUID, um 23505, cobrança
cancelada/open 0, crédito do pagamento 100 e reversão de alocação única.
Depois completa correções restantes e verifica saldos 0 e originais preservados.
Eventos de correção estrangeiros ocultos com registros positivos existentes em ambas.
Duas requisições por cenário, não teste de carga ou prova de sobreposição instrumentada.

## Windows
1. Baixar branch atualizada feat/v35-dev-gate-20261002 em nova pasta.
2. Copiar .env.dev privado já preenchido da dev-gate anterior para nova dev-gate.
   Não sobrescrever arquivo privado com modelo, não upload/commit.
3. No cmd da nova dev-gate: npm ci; npm run check (11 PASS).
4. Se project ref só estava definido no cmd antigo:
   set "SUPABASE_DEV_PROJECT_REF=szqkdekwhzxsoxorgvaz"
5. npm run test:financial-lifecycle.
6. Enviar somente outputs/tags. Não precisa repetir gates anteriores.
Se FAIL: parar e informar tag/erro, não repetir automaticamente. Pode haver fatos
parciais persistidos. Inspecionar antes de correção/repetição, nunca apagar ledger.
MFA não é configurado por esse roteiro. Nenhum schema, grant, papel, Auth ou produção alterado.
