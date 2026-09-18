/**
 * A shell is the calendar week itself, numbered. Everyone inside one is inside the same week,
 * whether it is their first or their fifth.
 *
 * Days are local. Nobody has to be anywhere at the same time as anybody else, so there is no
 * reason to make people do timezone arithmetic on their own day — and since nothing is verified,
 * the chain records when a day actually happened regardless of what it is labelled.
 */

const DAY = 86_400_000

/** The Monday shell #1 begins on, in local time. One constant to move. */
export const SHELL_EPOCH = new Date(2026, 8, 14)

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Whole days between two local midnights. Rounding absorbs the hour a clock change adds or drops. */
const daysBetween = (from: number, to: number) => Math.round((to - from) / DAY)

/** The local Monday that starts the week a moment falls in. */
function mondayOf(ts: number) {
  const d = new Date(ts)
  return midnight(d) - ((d.getDay() + 6) % 7) * DAY
}

export type Today = {
  /** 1-based; 0 or less means shell #1 has not started yet. */
  shell: number
  /** 1-based day within this shell's week. */
  dayOfShell: number
  /** YYYY-MM-DD, local. */
  date: string
  weekday: string
}

export function today(now = Date.now()): Today {
  const monday = mondayOf(now)
  const shell = Math.floor(daysBetween(midnight(SHELL_EPOCH), monday) / 7) + 1
  const dayOfShell = daysBetween(monday, midnight(new Date(now))) + 1
  const d = new Date(now)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { shell, dayOfShell, date, weekday: WEEKDAYS[dayOfShell - 1] }
}

/**
 * How far through their own run somebody is: day 8 of 14 for a two-shell commitment. Without an
 * enrolment there is nothing to be part-way through, so it falls back to this week.
 */
export function progress(now = Date.now(), run?: { firstShell: number; shells: number }) {
  const { shell, dayOfShell } = today(now)
  if (!run) return { day: dayOfShell, days: 7 }
  return { day: (shell - run.firstShell) * 7 + dayOfShell, days: run.shells * 7 }
}
