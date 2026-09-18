import { useTheme } from '../lib/theme'

/**
 * The wordmark is the logo: the name set in the serif, in blue. Clicking it switches the page
 * between dark and light; the window's three dots set it alight in their own colour for a moment.
 */
export function Tagline({ tint }: { tint: string | null }) {
  const [theme, toggleTheme] = useTheme()
  return (
    <div className="tagline">
      <button
        type="button"
        className="wordmark"
        data-tint={tint ?? undefined}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        onClick={toggleTheme}
      >
        coldshell
      </button>
      <p className="tagline-pitch">you vs you</p>
      <p className="tagline-how">
        Stake what would hurt to lose. Record a minute of yourself every day. Nobody watches it.
        Finish the week and every cent comes back, along with the film.
      </p>
    </div>
  )
}
