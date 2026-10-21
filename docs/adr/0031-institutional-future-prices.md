# ADR-0031 — Reajustes institucionais futuros

Data: 2026-10-19. DEV somente.

Usar as versões existentes de `institutional_recurring_rule_versions`, sem tabelas novas. A RPC `schedule_institutional_recurring_price` exige `settings.manage`, assinatura apta e versão esperada. Serializa organização com NO KEY UPDATE e regra/última versão com UPDATE; fecha a vigência anterior no mês precedente e cria uma versão futura. Preserva os valores das obrigações emitidas e recusa vigências com qualquer obrigação já emitida a partir delas, inclusive cancelada. Replay usa a mesma chave e retorna a mesma versão; conflito explícito é PT409.

O formulário usa a versão da prévia revisada, confirmação REAJUSTAR e invalida a prévia após o comando. Uma versão que deixou de ser a última exige nova consulta; transporte incerto conserva chave e payload. Vigência limitada aos próximos 12 meses, valor positivo finito com dois decimais. Anual/especial não é implementado por este ADR.

Migration DEV #60 `20261019230916`. Teste SQL rollback: quatro combinações A/B × despesa/receita, 36 rejeições esperadas, caixa preservado, valor anterior 1 e futuro 2, auditoria única, isolamento e VIEWER negados. Interface: testes focados PASS. Homologação browser/HTTP de reajustes ainda pendente neste checkpoint; ver `docs/V35_EXECUTION_20261019.md`. Sem merge/produção.
