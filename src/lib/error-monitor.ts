export type ErrorSeverity = 'error' | 'warn' | 'info'
export type ErrorCategory = 'render_error' | 'auth_error' | 'auth_event' | 'config_error' | 'unhandled_error'

export interface ErrorReport {
  id: string
  timestamp: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  stack?: string
  context?: Record<string, unknown>
}

type ErrorListener = (report: ErrorReport) => void

const SENSITIVE_KEY_PATTERN = /password|token|secret|jwt|key|otp|auth|credential|cookie|session_id/i

/**
 * Sanitizes object keys and values to prevent secret/credential leakage in logs.
 * Fail-closed: strips any key matching sensitive security patterns.
 */
export function sanitizeContext(data: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepthExceeded]'
  if (data === null || data === undefined) return data
  if (typeof data === 'string') {
    // If string looks like a JWT or long bearer token, redact
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(data)) {
      return '[REDACTED_JWT]'
    }
    return data
  }
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map(item => sanitizeContext(item, depth + 1))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeContext(val, depth + 1)
    }
  }
  return sanitized
}

let reportCounter = 0

function generateReportId(): string {
  reportCounter = (reportCounter + 1) % 1_000_000
  return `err_${Date.now()}_${reportCounter.toString(36)}`
}

function extractErrorInfo(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || 'Erro sem mensagem explicita',
      stack: error.stack,
    }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return { message: (error as { message: string }).message }
  }
  return { message: String(error ?? 'Erro desconhecido') }
}

class ExceptionMonitor {
  private reports: ErrorReport[] = []
  private maxReports = 50
  private listeners: Set<ErrorListener> = new Set()

  /**
   * Captures an unexpected exception or render crash.
   */
  captureException(error: unknown, context?: Record<string, unknown>): ErrorReport {
    try {
      const { message, stack } = extractErrorInfo(error)
      const report: ErrorReport = {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        category: (context?.category as ErrorCategory) || 'render_error',
        severity: 'error',
        message,
        stack,
        context: context ? (sanitizeContext(context) as Record<string, unknown>) : undefined,
      }

      this.addReport(report)
      return report
    } catch {
      // Fail-safe: monitoring service must never crash the host application
      const fallbackReport: ErrorReport = {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        category: 'render_error',
        severity: 'error',
        message: 'Falha interna do monitor de exceções',
      }
      return fallbackReport
    }
  }

  /**
   * Captures authentication lifecycle events (login, logout, session refresh).
   */
  captureAuthEvent(eventName: string, details?: Record<string, unknown>): ErrorReport {
    try {
      const report: ErrorReport = {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        category: 'auth_event',
        severity: 'info',
        message: `Auth event: ${eventName}`,
        context: details ? (sanitizeContext(details) as Record<string, unknown>) : undefined,
      }

      this.addReport(report)
      return report
    } catch {
      return {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        category: 'auth_event',
        severity: 'info',
        message: `Auth event: ${eventName}`,
      }
    }
  }

  /**
   * Captures authentication or authorization errors.
   */
  captureAuthError(error: unknown, details?: Record<string, unknown>): ErrorReport {
    try {
      const { message, stack } = extractErrorInfo(error)
      const report: ErrorReport = {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        category: 'auth_error',
        severity: 'error',
        message,
        stack,
        context: details ? (sanitizeContext(details) as Record<string, unknown>) : undefined,
      }

      this.addReport(report)
      return report
    } catch {
      return {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        category: 'auth_error',
        severity: 'error',
        message: 'Erro desconhecido de autenticação',
      }
    }
  }

  private addReport(report: ErrorReport): void {
    this.reports.push(report)
    if (this.reports.length > this.maxReports) {
      this.reports.shift()
    }

    // Safe notification of subscribers
    this.listeners.forEach(listener => {
      try {
        listener(report)
      } catch {
        // Ignore subscriber failures
      }
    })
  }

  getReports(): ErrorReport[] {
    return [...this.reports]
  }

  clear(): void {
    this.reports = []
  }

  subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const errorMonitor = new ExceptionMonitor()
