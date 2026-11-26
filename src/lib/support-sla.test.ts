import { describe, expect, it } from 'vitest'
import {
  BUSINESS_SLA_TARGET_MINUTES,
  computeBusinessMinutesBetween,
  computeBusinessSlaDeadline,
  evaluateTicketBusinessSla,
} from './support-sla'

describe('support-sla (C06 Horário comercial Mon-Fri 09:00-18:00 America/Sao_Paulo)', () => {
  it('computes 0 business minutes over weekends and after-hours', () => {
    // Friday 18:00 BRT -> 21:00 UTC; Monday 09:00 BRT -> 12:00 UTC
    const mins = computeBusinessMinutesBetween('2026-10-09T21:00:00Z', '2026-10-12T12:00:00Z')
    expect(mins).toBe(0)
  })

  it('counts 540 business minutes across a full Mon-Fri 09:00-18:00 BRT business day', () => {
    const mins = computeBusinessMinutesBetween('2026-10-12T12:00:00Z', '2026-10-12T21:00:00Z')
    expect(mins).toBe(BUSINESS_SLA_TARGET_MINUTES)
  })

  it('skips weekend when computing 1-business-day deadline from Friday afternoon', () => {
    // Friday 15:00 BRT = 18:00 UTC -> 3h remaining Friday (180m) + 6h Monday (09:00-15:00 BRT = 18:00 UTC Monday)
    const due = computeBusinessSlaDeadline('2026-10-09T18:00:00Z')
    expect(due.toISOString()).toBe('2026-10-12T18:00:00.000Z')
  })

  it('evaluates met vs breached SLA accurately for responded and open tickets', () => {
    const met = evaluateTicketBusinessSla({
      opened_at: '2026-10-09T18:00:00Z',
      first_response_seconds: 1800, // 30m
      resolution_seconds: null,
      status: 'working',
    })
    expect(met.met).toBe(true)
    expect(met.breached).toBe(false)
    expect(met.label).toContain('Atendido')

    const breached = evaluateTicketBusinessSla(
      {
        opened_at: '2026-10-09T12:00:00Z', // Fri 09:00 BRT
        first_response_seconds: null,
        resolution_seconds: null,
        status: 'new',
      },
      new Date('2026-10-12T15:00:00Z') // Mon 12:00 BRT -> 540 + 180 = 720m elapsed
    )
    expect(breached.breached).toBe(true)
    expect(breached.label).toContain('SLA vencido')
  })
})
