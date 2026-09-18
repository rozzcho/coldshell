/** Shared formatting for terminal output: everything lines up in columns. */

export const shorten = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`

export const usdc = (amount: number) => `${amount.toFixed(2)} USDC`

/** 3h02m, or 12m for anything under an hour. */
export function duration(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Weekly days get their weekday; other tracks just get a number. */
export function dayLabel(index: number, startMs: number, dayMs: number) {
  if (dayMs !== 24 * 60 * 60 * 1000) return `d${index + 1}`
  return WEEKDAYS[(new Date(startMs + index * dayMs).getUTCDay() + 6) % 7]
}

/** A bar of filled and empty blocks, the way a progress meter prints. */
export function bar(fraction: number, width = 12) {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}
