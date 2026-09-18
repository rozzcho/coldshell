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

/**
 * VITE_DAY_MINUTES shortens a day so a whole week can be walked through in an hour. Days then
 * run from midnight rather than the calendar, because a ten-minute day has no calendar to follow.
 */
const TEST_DAY_MINUTES = Number(import.meta.env.VITE_DAY_MINUTES ?? 0)
export const TEST_MODE = TEST_DAY_MINUTES > 0 && TEST_DAY_MINUTES < 1440
const TEST_DAY = TEST_DAY_MINUTES * 60_000

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
  /** YYYY-MM-DD, local. In test mode, the date plus the shortened clock. */
  date: string
  weekday: string
}

export function today(now = Date.now()): Today {
  const d = new Date(now)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (TEST_MODE) {
    // Everything restarts at midnight, so a test never has to wait for a real week to turn over.
    const elapsed = now - midnight(d)
    const day = Math.floor(elapsed / TEST_DAY)
    return { shell: Math.floor(day / 7) + 1, dayOfShell: (day % 7) + 1, date, weekday: WEEKDAYS[day % 7] }
  }

  const monday = mondayOf(now)
  const shell = Math.floor(daysBetween(midnight(SHELL_EPOCH), monday) / 7) + 1
  const dayOfShell = daysBetween(monday, midnight(d)) + 1
  return { shell, dayOfShell, date, weekday: WEEKDAYS[dayOfShell - 1] }
}

/** How long until the day rolls over, so a test can see the next one coming. */
export function untilNextDay(now = Date.now()) {
  const d = new Date(now)
  if (!TEST_MODE) return midnight(d) + DAY - now
  const elapsed = now - midnight(d)
  return TEST_DAY - (elapsed % TEST_DAY)
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
