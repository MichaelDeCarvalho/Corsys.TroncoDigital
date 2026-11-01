import { describe, expect, it } from 'vitest'
import type { DailyCashFlowRow } from './daily-cash-flow'
import { bucketCashFlowTrend } from './cash-flow-trend'

function row(day: number, received: string, paid: string): DailyCashFlowRow {
  return {
    movement_day: `2026-10-${String(day).padStart(2, '0')}`,
    received, paid,
    realized_net: (Number(received) - Number(paid)).toFixed(2),
    member_receivables_due: '0.00',
    institutional_receivables_due: '0.00',
    institution_payables_due: '0.00',
    projected_net: '0.00',
  }
}

describe('Cash flow trend presentation', () => {
  it('groups valid realized days without adding payments or inventing periods', () => {
    const input = [row(1, '100.00', '25.00'), row(2, '50.00', '70.00'), row(3, '0.00', '0.00'), row(4, '15.00', '5.00')]
    expect(bucketCashFlowTrend(input, 2)).toEqual([
      { from: '2026-10-01', to: '2026-10-02', received: 150, paid: 95, realized: 55 },
      { from: '2026-10-03', to: '2026-10-04', received: 15, paid: 5, realized: 10 },
    ])
  })

  it('preserves signed reversals and exact realized net', () => {
    const result = bucketCashFlowTrend([row(1, '-20.00', '10.00')])
    expect(result[0].received).toBe(-20)
    expect(result[0].paid).toBe(10)
    expect(result[0].realized).toBe(-30)
  })

  it('does not show invented data for an empty interval', () => {
    expect(bucketCashFlowTrend([])).toEqual([])
  })

  it('rejects inconsistent realized amounts and invalid configuration', () => {
    expect(() => bucketCashFlowTrend([{ ...row(1, '10.00', '5.00'), realized_net: '99.00' }])).toThrow(/inconsistente/)
    expect(() => bucketCashFlowTrend([row(1, '1.00', '0.00')], 0)).toThrow()
  })
})
