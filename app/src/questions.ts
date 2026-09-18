/**
 * Something to say when the minute is long and nothing comes. Never a requirement — nobody
 * checks what is said — but since the footage is never watched, these sentences are the only
 * thing that shapes what people end up telling themselves.
 *
 * Plain and a little blunt, to match everything else here. No encouragement, no emoji.
 */
export const QUESTIONS = [
  'what did you actually do today?',
  "what did you say you'd do, and didn't?",
  'what are you avoiding?',
  'what would make tomorrow not a waste?',
  "what do you know now that you didn't this morning?",
  'what took longer than it should have?',
  'what went better than you expected?',
  'who are you not replying to?',
  'what are you pretending is fine?',
  'what did you do today that nobody asked you to?',
  'what would you do differently if you started this week again?',
  'what is the smallest thing standing in your way?',
  'what did you say no to?',
  'what are you doing this for?',
]

/** The same question for everybody, today. Tomorrow it is a different one. */
export function questionOfTheDay(now = Date.now()) {
  return Math.floor(now / 86_400_000) % QUESTIONS.length
}
