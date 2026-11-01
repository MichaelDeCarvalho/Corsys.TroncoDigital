import type { DailyCashFlowRow } from './daily-cash-flow'
import { checkedSigned } from './treasury-balances'

export type CashFlowTrendBucket = {
  from: string
  to: string
  received: number
  paid: number
  realized: number
}

/**
 * Pure presentation grouping for rows already validated by loadDailyCashFlow.
 * Does not create accounting facts, assume dates with no backend rows,
 * or confuse realized movement with available bank balance.
 */
export function bucketCashFlowTrend(
  rows: readonly DailyCashFlowRow[],
  maxBuckets = 6,
): CashFlowTrendBucket[] {
  if (!Number.isSafeInteger(maxBuckets) || maxBuckets < 1 || maxBuckets > 12) {
    throw new Error('Quantidade de períodos inválida')
  }
  if (rows.length === 0) return []
  const width = Math.ceil(rows.length / maxBuckets)
  const buckets: CashFlowTrendBucket[] = []
  for (let offset = 0; offset < rows.length; offset += width) {
    const sample = rows.slice(offset, offset + width)
    const received = sample.reduce((sum, day) => sum + checkedSigned(day.received), 0)
    const paid = sample.reduce((sum, day) => sum + checkedSigned(day.paid), 0)
    const realized = sample.reduce((sum, day) => sum + checkedSigned(day.realized_net), 0)
    if (Math.abs(received - paid - realized) >= 0.02) {
      throw new Error('Fluxo realizado inconsistente')
    }
    buckets.push({
      from: sample[0].movement_day,
      to: sample[sample.length - 1].movement_day,
      received,
      paid,
      realized,
    })
  }
  return buckets
}
