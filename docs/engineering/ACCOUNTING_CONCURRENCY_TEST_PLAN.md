# Plano de prova de concorrência do Plano Contábil — Incremento 11

**Status:** NOT EVALUATED para concorrência real entre conexões independentes.

## Objetivo e ambiente
Comprovar que publicação e mutações contábeis da mesma Loja serializam no registro `organizations`, enquanto escritas de outra Loja não aguardam globalmente. Teste apenas no DEV; não usar tokens, e-mails ou bancos reais em logs. Tudo deve terminar com `ROLLBACK`.

## Pré-condições
Duas conexões PostgreSQL **independentes** comprovadas por `select pg_backend_pid()`, obtidas pelo mesmo Postgres DEV com credenciais autorizadas, além de um banco com as migrations 31/32 instaladas. Clientes preparados com `statement_timeout` e `lock_timeout` curtos. Não confundir execução `Promise.all` de um conector multiplexado com sessões de banco independentes.

## Casos e critérios

1. **Mesma Loja:** sessão A faz `BEGIN; SELECT id FROM public.organizations WHERE id = :tenant_a FOR UPDATE; SELECT pg_sleep(3);` sem COMMIT; sessão B, durante o hold, tenta `SELECT ... FOR UPDATE NOWAIT` do mesmo tenant. Deve receber `55P03` (lock_not_available), não bloquear por mais do que o timeout. Ambas fazem `ROLLBACK`.
2. **Outra Loja:** ainda com A bloqueada, sessão C tenta `SELECT id ... WHERE id=:tenant_b FOR UPDATE NOWAIT`. Deve passar; comparar `pg_backend_pid()` e timestamps para provar que as janelas se sobrepõem. Fazer ROLLBACK.
3. **Escrita funcional de catálogo:** sessão B solicita nova categoria ativa ou ativação de conta sem cobertura. Deve falhar com `23514` mesmo após liberar A. Categoria inativa e conta inativa devem ser admitidas. Testar usando credenciais de ADMIN de Loja com JWT válido e transação revertida.
4. **Publicação concorrente:** sessões independentes tentam publicar a mesma versão completa, com chaves distintas. Uma deve publicar; outra deve receber conflito determinístico, e deve existir apenas um evento de publicação, sem período publicado sobreposto. Repetição da mesma chave/payload retorna o mesmo UUID; com motivo alterado, falha.
5. **Permissões/tenant:** assinante suspenso, TREASURER, VIEWER e token de Loja B não podem publicar plano da Loja A. Teste HTTP/JWT assinado (não simular apenas `request.jwt.claims`).

## Resultado da tentativa por connector
Foi tentado `Promise.all` de três `execute_sql` com `pg_sleep`, rollback e `FOR UPDATE NOWAIT`. A consulta de outra Loja teve êxito, mas a que deveria observar a trava da mesma Loja falhou com a asserção `same-tenant lock unexpectedly free` após cerca de 17,5 segundos de tempo agregado. O executor pode ter sequenciado ou retardado as chamadas, impossibilitando garantir a interseção temporal das transações. **Isso não é evidência de PASS nem prova de falha dos triggers**. Não alegar concorrência real validada até executar em conexões independentes com PID e janela medida.

## Gates
Não liberar PROD sem teste paralelo com duas ou mais sessões, JWT HTTP real, revisão de novas contas inativas nos fluxos consumidores, baseline do HTML V35 desktop/mobile e revisão de rollback. Registrar resultados observados e ambiente, sem armazenar chaves.
