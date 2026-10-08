# ADR 0008 — Catálogo financeiro e preços mensais com vigência

- Status: accepted para DEV, 2026-10-08.
- Contexto: DYN-008/DYN-009 do piloto e ADR V35-007 exigem categorias e preço histórico. Tabelas já existem, sem RPC de cadastro, com grants SELECT e RLS próprios.
- Decisão: criar três comandos autorizados/auditados/idempotentes para novas categorias, novas regras mensais e preços sucessores. settings.manage do catálogo atual, sem escrita direta. Domínios operacionais existentes não são natureza contábil: neutra/repasse e conta DRE continuam requisitos pendentes, sem equivalência inventada.
- Preço: finito, positivo, até duas casas e numeric(14,2). Primeiro dia de competência futura. Identidade/categoria/regra/version própria conferida antes da escrita. Novo preço exige último UUID sob lock; staleness40001. Vigência anterior encerra no mês precedente; unit_amount histórico e cobranças geradas permanecem intactos.
- Alternativa recusada: atualizar preço in-place ou recalcular débitos anteriores; abrir UPDATE/RLS para facilitar formulário.
- Consequências: geração futura pode escolher preço por competência, mas não foi implementada neste incremento. Dia31 em mês curto terá de seguir regra de geração homologada. Recorrências especiais/anuais/institucionais e classificação/mapeamentos não são substituídos pela regra mensal comum.
- Segurança: require_permission antes de lookup, assinatura ativa, anon sem EXECUTE, payload normalizado, audit e idempotência existentes. Falha de transporte repete mesma chave/payload; conflito de versão pede reload.
- Rollout: migration aditiva DEV20261008203643, criação de funções somente. Sem seed/backfill, alteração de categoria existente ou fatos postados. Layout compartilhado na área Plano de Contas, ainda sem paridade integral V35.
- Verificação: SQL rollback positivo/negativo A/B/TREASURER/suspensão e 45 testes frontend/types/build. Não são HTTP real, concorrência simultânea, homologação visual ou deploy.
- Recuperação: forward-fix; revogar EXECUTE das novas RPCs se necessário, preservando SELECT/histórico. Nunca apagar ledger.
- Referências: docs/V35_STAGE_2_IMPLEMENTATION.md, scripts/verify_dev_monthly_rule_catalog.sql, docs/adr/v35/0007-versioned-recurring-rules.md.
