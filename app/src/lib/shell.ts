/**
 * A shell is the calendar week itself, numbered. Everyone inside one is inside the same week,
 * whether it is their first or their fifth.
 *
 * Days run 00:00 to 23:59 UTC so that one day means the same thing everywhere.
 */

const DAY = 86_400_000
const WEEK = 7 * DAY

/** Monday 00:00 UTC of shell #1. */
export const SHELL_EPOCH = Date.UTC(2026, 8, 14)

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type Shell = {
  /** 1-based; 0 or less means the first shell has not started yet. */
  shell: number
  /** 1-based day within the week. */
  day: number
  days: number
  /** YYYY-MM-DD in UTC. */
  date: string
  weekday: string
}

export function shellNow(now = Date.now()): Shell {
  const elapsed = now - SHELL_EPOCH
  const shell = Math.floor(elapsed / WEEK) + 1
  const dayIndex = Math.floor((elapsed - (shell - 1) * WEEK) / DAY)
  const d = new Date(now)
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
  return { shell, day: dayIndex + 1, days: 7, date, weekday: WEEKDAYS[dayIndex] }
}
