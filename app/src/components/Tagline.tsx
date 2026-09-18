import { useTheme } from '../lib/theme'

/**
 * The title line: the name, then what it is for, set the same size in the same serif. Clicking
 * the name switches the page between dark and light; the window's three dots set it alight in
 * their own colour for a moment.
 */
export function Tagline({ tint }: { tint: string | null }) {
  const [theme, toggleTheme] = useTheme()
  return (
    <div className="tagline">
      <h1 className="wordmark">
        <button
          type="button"
          className="wordmark-name"
          data-tint={tint ?? undefined}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        >
          coldshell
        </button>
        <span className="wordmark-slogan"> &mdash; you vs you</span>
      </h1>
      <p className="tagline-how">
        Stake what would hurt to lose. Record a minute of yourself every day. Nobody watches it.
        Finish the week and every cent comes back, along with the film.
      </p>
    </div>
  )
}
