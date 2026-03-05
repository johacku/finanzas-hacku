import {
  startOfWeek,
  endOfWeek,
  format,
  addWeeks,
  subWeeks,
  parseISO,
  isValid,
} from 'date-fns'

/** Get Monday of the week containing a given date (hackÜ weeks start on Monday) */
export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 })
}

/** e.g. "Mar 3 – Mar 9, 2026" */
export function formatWeekLabel(weekStart: Date): string {
  const end = getWeekEnd(weekStart)
  return `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}

/** Format date as YYYY-MM-DD for database */
export function formatDateForDB(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Format date for display */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return dateStr
    return format(d, 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

export function getPreviousWeek(weekStart: Date): Date {
  return subWeeks(weekStart, 1)
}

export function getNextWeek(weekStart: Date): Date {
  return addWeeks(weekStart, 1)
}

/** Get array of N past weeks (including current) */
export function getWeekRange(n: number = 12): Date[] {
  const current = getWeekStart()
  return Array.from({ length: n }, (_, i) => subWeeks(current, n - 1 - i))
}

/** Get array of past + future weeks centered around current week */
export function getWeekRangePastFuture(pastWeeks: number = 8, futureWeeks: number = 12): Date[] {
  const current = getWeekStart()
  const weeks: Date[] = []

  // Past weeks (not including current)
  for (let i = pastWeeks; i >= 1; i--) {
    weeks.push(subWeeks(current, i))
  }

  // Current week
  weeks.push(current)

  // Future weeks
  for (let i = 1; i <= futureWeeks; i++) {
    weeks.push(addWeeks(current, i))
  }

  return weeks
}
