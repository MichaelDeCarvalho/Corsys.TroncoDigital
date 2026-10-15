# Jornadas assinadas DEV — 2026-10-14

## Escopo autorizado

Proprietário autorizou persistir duas Lojas QA isoladas, com as identidades A/B
existentes, duas contas mapeadas e R$10 fictícios por Loja. Sem novos usuários,
convites, provedores externos ou cobranças. Históricos originais A/B preservados.
Preflight `seed_dev_transfer_browser_qa.sql` passou com rollback antes da aprovação;
persistência posterior confirmada. Não reexecutar seed cegamente.

- QA A: `68ca5c28-b1bd-4d42-b758-f80b4b31a97f`; origem
  `d6e9a3e6-cacf-491f-b2fa-55f7ab54028f`, destino `92d120d5-0f45-47f1-8cee-c06ea6925e15`.
- QA B: `98b857a9-0547-4c83-a3fa-11783ae4912e`; origem
  `ca86e4c5-de93-4134-ba0e-ea47b3e56e3a`, destino `aade161d-62ab-4576-9446-a979aa60977f`.
- Seed usou current_date UTC do banco (2026-10-15), portanto as jornadas usam essa
  data contábil fictícia. Data desta sessão no Brasil: 2026-10-14.

As Lojas originais têm planos publicados sem conta patrimonial; o guard rejeita
ativar nova conta sem cobertura em todos os planos aplicáveis. Não alterar guard,
triggers, mappings ou planos históricos para facilitar homologação. As Lojas QA
foram criadas com as duas contas e mappings antes de publicar seu próprio plano.

## Defeito encontrado e correção

Transferência B UI gravou uma única vez (`1f124bed-e806-433f-97e8-45f86ea18027`),
mas o frontend classificou UUID válido como resposta incerta: regex tinha um grupo
de quatro caracteres ausente. Retry com mesma chave não duplicou o registro.
Regex corrigida; também preservado feedback de sucesso/erro durante reload dos
dados. Dois testes existentes ampliados para exigir confirmação visível falharam
antes e passaram após correção. Não é apenas teste de chamada do mock.

## Testes HTTP pelo navegador sem extrair credenciais

`dev-qa.html` é uma entrada adicional opcional, construída somente com
`VITE_DEV_QA_ENABLED=true` e Supabase DEV exato. Build normal não inclui essa página.
Runtime verifica hostname DEV, flag e identidade esperada; esses gates limitam a
ferramenta de teste, não substituem autorização/RLS do banco. Sem novos grants.

Usa o cliente Supabase padrão da aplicação e getUser; não lê/exibe/exporta JWT,
senha ou armazenamento de sessão. Não contém login próprio. Testes acionados por
botões usam requisições RPC reais e Promise.all no próprio cliente, evitando a
serialização observada no conector SQL. A identidade A/B deve ser autenticada
normalmente na aplicação antes de abrir a página QA.

Rotinas: leitura própria positiva + RLS estrangeiro; RPC com org e IDs estrangeiros;
transferência com replay concorrente de mesma chave, payload divergente e disputa
de saldo entre chaves; conciliação B com replay concorrente e disputa de capacidade
nos dois extratos previamente aprovados. Cleanup em finally estorna/desfaz somente
os IDs retornados pelas próprias chamadas. Erros de transporte/validação não são
aceitos como prova de isolamento. Fixtures com saldo inesperado falham fechado.

Pendentes de execução browser: jornadas A/B completas, upload persistido e gates
assinados. Registrar resultados após observação; implementação não equivale a PASS.
