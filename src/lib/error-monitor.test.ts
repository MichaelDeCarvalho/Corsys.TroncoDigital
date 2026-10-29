import { describe, expect, it, vi } from 'vitest'
import { errorMonitor, sanitizeContext } from './error-monitor'

describe('Exception Monitoring Service', () => {
  beforeEach(() => {
    errorMonitor.clear()
  })

  it('captures an exception with message, stack, and category', () => {
    const error = new Error('Falha no componente')
    const report = errorMonitor.captureException(error, { category: 'render_error', view: 'Dashboard' })

    expect(report.severity).toBe('error')
    expect(report.category).toBe('render_error')
    expect(report.message).toBe('Falha no componente')
    expect(report.stack).toBeDefined()
    expect(report.context?.view).toBe('Dashboard')
    expect(errorMonitor.getReports()).toHaveLength(1)
  })

  it('captures non-Error exception types safely', () => {
    const reportStr = errorMonitor.captureException('Erro de string pura')
    expect(reportStr.message).toBe('Erro de string pura')

    const reportObj = errorMonitor.captureException({ message: 'Erro em objeto customizado' })
    expect(reportObj.message).toBe('Erro em objeto customizado')
  })

  it('captures auth events with info severity', () => {
    const report = errorMonitor.captureAuthEvent('session_authenticated', { userId: 'usr-123' })

    expect(report.severity).toBe('info')
    expect(report.category).toBe('auth_event')
    expect(report.message).toContain('session_authenticated')
    expect(report.context?.userId).toBe('usr-123')
  })

  it('captures auth errors with error severity', () => {
    const report = errorMonitor.captureAuthError('Invalid credentials', { status: 'error' })

    expect(report.severity).toBe('error')
    expect(report.category).toBe('auth_error')
    expect(report.message).toBe('Invalid credentials')
    expect(report.context?.status).toBe('error')
  })

  it('sanitizes sensitive fields like passwords, tokens, and jwt', () => {
    const sensitiveData = {
      user_id: 'usr-123',
      password: 'super-secret-password',
      token: 'secret-auth-token',
      jwt: 'header.payload.signature',
      secret_key: 'top-secret',
      nested: {
        otp: '123456',
        public_info: 'safe',
      },
    }

    const sanitized = sanitizeContext(sensitiveData) as Record<string, unknown>
    expect(sanitized.user_id).toBe('usr-123')
    expect(sanitized.password).toBe('[REDACTED]')
    expect(sanitized.token).toBe('[REDACTED]')
    expect(sanitized.jwt).toBe('[REDACTED]')
    expect(sanitized.secret_key).toBe('[REDACTED]')
    expect((sanitized.nested as Record<string, unknown>).otp).toBe('[REDACTED]')
    expect((sanitized.nested as Record<string, unknown>).public_info).toBe('safe')
  })

  it('redacts standalone JWT strings in values', () => {
    const jwtLike = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG66m1df8R3sMT_n_example'
    const sanitized = sanitizeContext(jwtLike)
    expect(sanitized).toBe('[REDACTED_JWT]')
  })

  it('notifies registered subscribers and allows unsubscription', () => {
    const listener = vi.fn()
    const unsubscribe = errorMonitor.subscribe(listener)

    errorMonitor.captureAuthEvent('login_attempt')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    errorMonitor.captureAuthEvent('another_attempt')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('handles subscriber exceptions without throwing', () => {
    const faultyListener = vi.fn().mockImplementation(() => {
      throw new Error('Listener crashed')
    })
    errorMonitor.subscribe(faultyListener)

    expect(() => {
      errorMonitor.captureException(new Error('Normal error'))
    }).not.toThrow()
  })
})
