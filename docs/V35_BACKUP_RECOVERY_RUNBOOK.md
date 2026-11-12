# V35 — ensaio de backup e restauração

Estado **pendente de execução observada**. O ensaio usa dois bancos descartáveis
PostgreSQL 17, com dados sintéticos de duas Lojas. O backup do ensaio abrange o
banco descartável inteiro.

## Preparar

1. Crie duas bases isoladas, uma de origem e uma vazia para restauração. Use
   credenciais temporárias. Confirme os destinos antes de executar qualquer comando.
2. Carregue na origem a fixture sintética, com chamados, eventos públicos e internos
   das Lojas A e B, papéis representativos e registros financeiros e de auditoria.
   Registre contagens, totais em centavos, vínculos e negativos de autorização.
3. Configure as conexões em serviços locais `v35-fixture-source` e
   `v35-fixture-restore`. Verifique nome, usuário e endereço de cada destino.

## Executar

```sh
psql 'service=v35-fixture-source' -X -v ON_ERROR_STOP=1 -c 'select current_database(), current_user, inet_server_addr()'
psql 'service=v35-fixture-restore' -X -v ON_ERROR_STOP=1 -c 'select current_database(), current_user, inet_server_addr()'
pg_dump --dbname='service=v35-fixture-source' --format=custom --file=v35-fixture.dump
pg_restore --list v35-fixture.dump
pg_restore --dbname='service=v35-fixture-restore' --exit-on-error --single-transaction v35-fixture.dump
```

Prepare no destino os papéis e extensões exigidos pela fixture. Use uma base vazia
compatível com o dump, que já contém definições e dados.

## Critérios de aceite

- Compare contagens, vínculos, valores em centavos e trilha de auditoria com a
  origem. Teste acesso da Loja A, Loja B, Master e anônimo na base restaurada.
- Registre revisão, duração, comandos, resultados e diferenças. Preserve somente
  as evidências sanitizadas e descarte o ambiente de ensaio conforme sua política.
- Para uma exportação por Loja, defina um contrato próprio com escopo server-side
  por organização, projeção mínima e testes negativos A/B. A opção `--table` do
  `pg_dump` seleciona tabelas inteiras e não aplica filtro por organização.
- A recuperação gerenciada do Supabase e a exportação por Loja têm critérios de
  aceite próprios, ainda pendentes.

[Documentação PostgreSQL 17 de pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
