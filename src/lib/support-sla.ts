// Business-hours SLA calculator for V35 Master Support (C06):
// Mon-Fri, 09:00-18:00 America/Sao_Paulo = 540 business minutes (1 business day target).

export const BUSINESS_SLA_TARGET_MINUTES = 540
const START_MINUTE_OF_DAY = 9 * 60
const END_MINUTE_OF_DAY = 18 * 60

const spFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

type SpParts = {
  year: number
  month: number
  day: number
  weekdayIndex: number // 0=Sun..6=Sat
  minuteOfDay: number
}

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function getSaoPauloParts(date: Date): SpParts {
  const parts = spFormatter.formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const hour = Number(map.hour === '24' ? '0' : map.hour)
  const minute = Number(map.minute)
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekdayIndex: weekdayMap[map.weekday] ?? 0,
    minuteOfDay: hour * 60 + minute,
  }
}

function isBusinessDay(weekdayIndex: number): boolean {
  return weekdayIndex >= 1 && weekdayIndex <= 5
}

// Convert São Paulo local YYYY-MM-DD HH:mm (with fixed UTC-03:00 since 2019;
// verifies round-trip and adjusts if an earlier historical DST offset differed).
function saoPauloLocalToDate(year: number, month: number, day: number, minuteOfDay: number): Date {
  const hour = Math.floor(minuteOfDay / 60)
  const min = minuteOfDay % 60
  let guess = new Date(Date.UTC(year, month - 1, day, hour + 3, min, 0, 0))
  const check = getSaoPauloParts(guess)
  const wantedMinutes = hour * 60 + min
  const gotDayKey = check.year * 10000 + check.month * 100 + check.day
  const targetDayKey = year * 10000 + month * 100 + day
  if (gotDayKey !== targetDayKey || check.minuteOfDay !== wantedMinutes) {
    const diffMins = (targetDayKey === gotDayKey
      ? wantedMinutes - check.minuteOfDay
      : targetDayKey > gotDayKey ? (1440 + wantedMinutes - check.minuteOfDay) : (wantedMinutes - check.minuteOfDay - 1440))
    guess = new Date(guess.getTime() + diffMins * 60000)
  }
  return guess
}

function nextCalendarDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function dayKey(p: { year: number; month: number; day: number }): number {
  return p.year * 10000 + p.month * 100 + p.day
}

export function computeBusinessMinutesBetween(startIso: string, endIso: string): number {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0
  }

  let cur = getSaoPauloParts(new Date(startMs))
  const end = getSaoPauloParts(new Date(endMs))
  let total = 0
  let guard = 0

  while (dayKey(cur) <= dayKey(end) && guard < 1500) {
    guard += 1
    if (isBusinessDay(cur.weekdayIndex)) {
      const segStart = dayKey(cur) === dayKey(getSaoPauloParts(new Date(startMs)))
        ? Math.max(START_MINUTE_OF_DAY, cur.minuteOfDay)
        : START_MINUTE_OF_DAY
      const segEnd = dayKey(cur) === dayKey(end)
        ? Math.min(END_MINUTE_OF_DAY, end.minuteOfDay)
        : END_MINUTE_OF_DAY
      if (segEnd > segStart) {
        total += segEnd - segStart
      }
    }
    if (dayKey(cur) === dayKey(end)) break
    const nxt = nextCalendarDay(cur.year, cur.month, cur.day)
    const nextDate = saoPauloLocalToDate(nxt.year, nxt.month, nxt.day, 0)
    cur = getSaoPauloParts(nextDate)
  }

  return total
}

export function computeBusinessSlaDeadline(
  openedAtIso: string,
  targetMinutes: number = BUSINESS_SLA_TARGET_MINUTES
): Date {
  const openedMs = Date.parse(openedAtIso)
  if (!Number.isFinite(openedMs)) {
    throw new Error('Data de abertura inválida para cálculo de SLA.')
  }
  const target = Math.max(1, Math.trunc(targetMinutes))
  let remaining = target
  let cur = getSaoPauloParts(new Date(openedMs))
  let guard = 0

  while (guard < 365) {
    guard += 1
    if (isBusinessDay(cur.weekdayIndex)) {
      const startMin = Math.max(START_MINUTE_OF_DAY, cur.minuteOfDay)
      if (startMin < END_MINUTE_OF_DAY) {
        const availableToday = END_MINUTE_OF_DAY - startMin
        if (remaining <= availableToday) {
          return saoPauloLocalToDate(cur.year, cur.month, cur.day, startMin + remaining)
        }
        remaining -= availableToday
      }
    }
    const nxt = nextCalendarDay(cur.year, cur.month, cur.day)
    cur = getSaoPauloParts(saoPauloLocalToDate(nxt.year, nxt.month, nxt.day, START_MINUTE_OF_DAY))
  }

  return new Date(openedMs + target * 60000)
}

export type TicketBusinessSla = {
  targetMinutes: number
  elapsedBusinessMinutes: number
  remainingBusinessMinutes: number
  dueAtIso: string
  breached: boolean
  met: boolean
  label: string
}

export function evaluateTicketBusinessSla(
  ticket: {
    opened_at: string
    first_response_seconds: number | string | null
    resolution_seconds: number | string | null
    status: string
  },
  now: Date = new Date()
): TicketBusinessSla {
  const openedMs = Date.parse(ticket.opened_at)
  const firstRespSec = ticket.first_response_seconds !== null ? Number(ticket.first_response_seconds) : null
  const isClosed = ticket.status === 'resolved' || ticket.status === 'closed'
  const effectiveEndIso = firstRespSec !== null && Number.isFinite(firstRespSec) && Number.isFinite(openedMs)
    ? new Date(openedMs + firstRespSec * 1000).toISOString()
    : now.toISOString()

  const dueDate = computeBusinessSlaDeadline(ticket.opened_at, BUSINESS_SLA_TARGET_MINUTES)
  const elapsed = computeBusinessMinutesBetween(ticket.opened_at, effectiveEndIso)
  const remaining = Math.max(0, BUSINESS_SLA_TARGET_MINUTES - elapsed)

  if (firstRespSec !== null || isClosed) {
    const met = elapsed <= BUSINESS_SLA_TARGET_MINUTES
    return {
      targetMinutes: BUSINESS_SLA_TARGET_MINUTES,
      elapsedBusinessMinutes: elapsed,
      remainingBusinessMinutes: remaining,
      dueAtIso: dueDate.toISOString(),
      breached: !met,
      met,
      label: met
        ? `Atendido (${elapsed}m úteis / 1 dia útil)`
        : `Fora do SLA (${elapsed}m úteis)`,
    }
  }

  const breached = elapsed > BUSINESS_SLA_TARGET_MINUTES
  return {
    targetMinutes: BUSINESS_SLA_TARGET_MINUTES,
    elapsedBusinessMinutes: elapsed,
    remainingBusinessMinutes: remaining,
    dueAtIso: dueDate.toISOString(),
    breached,
    met: false,
    label: breached
      ? `SLA vencido (${elapsed}m / 540m úteis)`
      : `No prazo (${remaining}m úteis restantes)`,
  }
}
