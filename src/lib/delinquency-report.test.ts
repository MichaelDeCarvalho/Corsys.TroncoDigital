import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  calculateDaysOverdue,
  classifyMemberBucket,
  DelinquencyMigrationPendingError,
  isMissingRpcError,
  loadDelinquencyBucketSummary,
  loadDelinquencyPage,
  loadFilteredDelinquencyPage,
} from './delinquency-report'

const baseRow = {
  member_id: 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',
  full_name: 'Integrante Teste',
  member_status: 'active',
  overdue_items: 2,
  overdue_amount: '150.00',
  available_credit: '20.00',
  oldest_due: '2026-09-10',
  net_position: '130.00',
}

describe('delinquency-report data loaders & aging boundaries', () => {
  it('classifies aging boundaries deterministically across 0/1, 30/31, 60/61, and 90/91 days', () => {
    expect(calculateDaysOverdue('2026-10-10', '2026-10-10')).toBe(0)
    expect(classifyMemberBucket(0)).toBe('up30')
    expect(calculateDaysOverdue('2026-10-09', '2026-10-10')).toBe(1)
    expect(classifyMemberBucket(1)).toBe('up30')
    expect(calculateDaysOverdue('2026-09-10', '2026-10-10')).toBe(30)
    expect(classifyMemberBucket(30)).toBe('up30')
    expect(calculateDaysOverdue('2026-09-09', '2026-10-10')).toBe(31)
    expect(classifyMemberBucket(31)).toBe('31-60')
    expect(classifyMemberBucket(60)).toBe('31-60')
    expect(calculateDaysOverdue('2026-08-11', '2026-10-10')).toBe(60)
    expect(classifyMemberBucket(61)).toBe('61-90')
    expect(calculateDaysOverdue('2026-08-10', '2026-10-10')).toBe(61)
    expect(classifyMemberBucket(90)).toBe('61-90')
    expect(calculateDaysOverdue('2026-07-12', '2026-10-10')).toBe(90)
    expect(classifyMemberBucket(91)).toBe('over90')
    expect(calculateDaysOverdue('2026-07-11', '2026-10-10')).toBe(91)
    expect(classifyMemberBucket(-1)).toBeNull()
  })

  it('demonstrates UTC vs BRT day-boundary bucket sensitivity when serverDate advances at 21:00 BRT', () => {
    const oldestDue = '2026-10-14'
    const brtDays = calculateDaysOverdue(oldestDue, '2026-11-13')
    const utcDays = calculateDaysOverdue(oldestDue, '2026-11-14')

    expect(brtDays).toBe(30)
    expect(classifyMemberBucket(brtDays)).toBe('up30')
    expect(utcDays).toBe(31)
    expect(classifyMemberBucket(utcDays)).toBe('31-60')
  })

  it('detects both PostgreSQL 42883 and PostgREST PGRST202 missing RPC errors', () => {
    expect(isMissingRpcError({ code: '42883' })).toBe(true)
    expect(isMissingRpcError({ code: 'PGRST202' })).toBe(true)
    expect(isMissingRpcError({ code: '42501' })).toBe(false)
    expect(isMissingRpcError({ code: '23514' })).toBe(false)
    expect(isMissingRpcError(null)).toBe(false)
  })

  it('keeps loadDelinquencyPage calling legacy read_tenant_delinquency directly', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [baseRow], error: null })
    const client = { rpc } as unknown as SupabaseClient

    const res = await loadDelinquencyPage(client, 'org-a', 1)
    expect(res).toEqual({ rows: [baseRow], hasNext: false })
    expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency', {
      p_organization_id: 'org-a',
      p_limit: 26,
      p_offset: 25,
    })
  })

  it('falls back safely to read_tenant_delinquency (page 26 limit, never 1000) only when bucket is null and RPC is missing', async () => {
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === 'read_tenant_delinquency_filtered') {
        return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      }
      return Promise.resolve({ data: [baseRow], error: null })
    })
    const client = { rpc } as unknown as SupabaseClient

    const res = await loadFilteredDelinquencyPage(client, 'org-a', null, 0)
    expect(res).toEqual({ rows: [baseRow], hasNext: false, migrationPending: true })
    expect(rpc).toHaveBeenNthCalledWith(2, 'read_tenant_delinquency', {
      p_organization_id: 'org-a',
      p_limit: 26,
      p_offset: 0,
    })
  })

  it('fails closed without browser filtering when bucket filter is requested and migration is pending (42883 or PGRST202)', async () => {
    for (const code of ['42883', 'PGRST202']) {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { code } })
      const client = { rpc } as unknown as SupabaseClient

      await expect(loadFilteredDelinquencyPage(client, 'org-a', '31-60', 0)).rejects.toThrow(
        DelinquencyMigrationPendingError,
      )
      expect(rpc).toHaveBeenCalledTimes(1)
    }
  })

  it('rethrows authorization (42501) and integrity (23514) errors from summary and filtered RPCs', async () => {
    const deniedClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } }),
    } as unknown as SupabaseClient
    await expect(loadDelinquencyBucketSummary(deniedClient, 'org-a')).rejects.toMatchObject({ code: '42501' })
    await expect(loadFilteredDelinquencyPage(deniedClient, 'org-a', null, 0)).rejects.toMatchObject({ code: '42501' })

    const integrityClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '23514', message: 'integrity' } }),
    } as unknown as SupabaseClient
    await expect(loadDelinquencyBucketSummary(integrityClient, 'org-a')).rejects.toMatchObject({ code: '23514' })
  })

  it('returns migrationPending=true on missing bucket summary RPC (42883/PGRST202) and validates canonical summaries', async () => {
    const missingClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202' } }),
    } as unknown as SupabaseClient
    await expect(loadDelinquencyBucketSummary(missingClient, 'org-a')).resolves.toEqual({
      summaries: [],
      serverDate: null,
      migrationPending: true,
    })

    const validClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { bucket_id: 'up30', member_count: 0, overdue_items: 0, overdue_amount: '0.00', server_date: '2026-10-10' },
          { bucket_id: '31-60', member_count: 2, overdue_items: 3, overdue_amount: '450.50', server_date: '2026-10-10' },
        ],
        error: null,
      }),
    } as unknown as SupabaseClient

    await expect(loadDelinquencyBucketSummary(validClient, 'org-a')).resolves.toEqual({
      summaries: [
        { bucket_id: 'up30', member_count: 0, overdue_items: 0, overdue_amount: 0, server_date: '2026-10-10' },
        { bucket_id: '31-60', member_count: 2, overdue_items: 3, overdue_amount: 450.5, server_date: '2026-10-10' },
      ],
      serverDate: '2026-10-10',
      migrationPending: false,
    })

    const corruptClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { bucket_id: 'up30', member_count: 0, overdue_items: 0, overdue_amount: '10.00', server_date: '2026-10-10' },
        ],
        error: null,
      }),
    } as unknown as SupabaseClient
    await expect(loadDelinquencyBucketSummary(corruptClient, 'org-a')).rejects.toThrow()
  })
})
