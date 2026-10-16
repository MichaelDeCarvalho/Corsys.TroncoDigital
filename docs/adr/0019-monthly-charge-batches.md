# ADR 0019 — Cobranças recorrentes com prévia por competência e lote imutável

Status: aceito para DEV (2026-10-09), sem autorização PROD.

Contexto: catálogo mensal e condições por integrante já existem. Emitir por `INSERT` do frontend duplicaria competências, ignoraria isenções ou sobrescreveria preço histórico.

Decisão: um cálculo central `private.monthly_charge_candidates` deriva preço vigente, isenção e valores individuais, e ajusta vencimento dia 31 ao último dia do mês. Prévia `preview_monthly_charge_generation` exige `charges.create`, intervalo limitado, contagem máxima de 200, mapeamento de conta contábil e competência não fechada; calcula fingerprint do estado conhecido. Emissão exige mesmo fingerprint, serializa Loja/regra/integrantes, executa como uma única transação com chave idempotente, confere `charges_recurring_base_uidx` e mantém fatos originais e snapshots. Preview pode declarar que não está pronto, sem emitir nada.

Alternativas recusadas: gerar no navegador, somar preço vigente atual para meses históricos, ignorar cobranças prévias, inserir cobrança 0 em isenção.

Evidência: DEV A/B `scripts/verify_dev_monthly_generation.sql` PASS com 2 cobranças e 1 isenção, override 35,50 e dia 31 em fevereiro, valores contábeis historizados, replay e rollback. Faltam JWT HTTP, concorrência multiconexão e mais de 200 integrantes; regras anuais/institucionais e lotes especiais não cobertos.

Contenção: revogar EXECUTE do gerador público, jamais apagar fatos existentes; correções por eventos e migrations posteriores.

