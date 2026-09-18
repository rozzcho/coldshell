import flame from '../assets/flame-light.png'
import { useTheme } from '../lib/theme'

/**
 * The flame, then the pitch. Clicking the flame switches the page between dark and light; the
 * window's three dots set it alight in their own colour for a moment.
 */
export function Tagline({ tint }: { tint: string | null }) {
  const [theme, toggleTheme] = useTheme()
  return (
    <div className="tagline">
      <button
        type="button"
        className="tagline-flame"
        data-tint={tint ?? undefined}
        style={{ '--flame': `url(${flame})` } as React.CSSProperties}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        onClick={toggleTheme}
      >
        <img src={flame} alt="" />
      </button>
      <div>
        <p className="tagline-pitch">Lose it or earn it &mdash; it&rsquo;s all on you.</p>
        <p className="tagline-how">
          Stake USDC, study 3 hours a day for 7 days on camera, and split the stakes of everyone who
          didn&rsquo;t finish.
        </p>
      </div>
    </div>
  )
}
