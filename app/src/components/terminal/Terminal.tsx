import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { NETWORK_LABEL } from '../../config'
import { ChipBar, ChipProvider, type Commands } from './chips'
import { CommunityPane } from './CommunityPane'
import { MinePane } from './MinePane'
import { RecordPane } from './RecordPane'
import { NextPane } from './NextPane'
import { RulesPane, StartPane } from './DocsPane'

type TabKey = 'record' | 'mine' | 'next' | 'community' | 'start' | 'rules'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'record', label: 'record' },
  { key: 'mine', label: 'my challenge' },
  { key: 'next', label: 'register' },
  { key: 'community', label: 'community' },
  { key: 'start', label: 'how to start' },
  { key: 'rules', label: 'rules' },
]

/**
 * The whole product in one window: a fixed frame, tabs for the views, output inside, and the
 * commands underneath. Nothing here ever changes the page's size.
 */
export function Terminal({ onTint }: { onTint: (colour: string) => void }) {
  const { publicKey } = useWallet()
  const [tab, setTab] = useState<TabKey>('record')
  const [commands, setCommands] = useState<Commands>({ chips: [] })
  // One counter per tab: resetting remounts that pane only, so you stay where you are.
  const [sessions, setSessions] = useState<Record<TabKey, number>>({
    record: 0,
    mine: 0,
    next: 0,
    community: 0,
    start: 0,
    rules: 0,
  })
  const outRef = useRef<HTMLDivElement>(null)

  const reset = () => {
    setSessions((current) => ({ ...current, [tab]: current[tab] + 1 }))
    outRef.current?.scrollTo({ top: 0 })
  }

  // A tab always opens at the top of its output, however far the last one was scrolled.
  useEffect(() => {
    outRef.current?.scrollTo({ top: 0 })
  }, [tab])

  // My challenge only exists once there is a wallet to read it from; that is also where to land.
  useEffect(() => {
    setTab((current) => (publicKey ? (current === 'next' ? 'mine' : current) : current === 'mine' ? 'next' : current))
  }, [publicKey])

  const joined = Boolean(publicKey)
  useEffect(() => {
    if (!joined) setTab((current) => (current === 'community' ? 'next' : current))
  }, [joined])

  const tabs = TABS.filter(
    (t) => (t.key !== 'mine' || publicKey) && (t.key !== 'community' || joined),
  )

  return (
    <ChipProvider value={setCommands}>
      <div className="terminal-wrap">
        <div className="terminal">
          <div className="term-bar">
            <span className="term-lights">
              {(['close', 'min', 'max'] as const).map((light) => (
                <button
                  key={light}
                  type="button"
                  className="term-light"
                  data-light={light}
                  title="Set the flame alight"
                  aria-label="Set the flame alight"
                  onClick={() => onTint(light)}
                />
              ))}
            </span>
            <span className="term-name">coldshell@{NETWORK_LABEL.toLowerCase()}: ~</span>
            <span className="term-account">
              <WalletMultiButton />
            </span>
          </div>
          <div className="term-tabs" role="tablist">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                className="term-tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Every pane stays mounted: stepping into the rules mid-registration must not
              throw the conversation away. Only the visible one owns the command bar. */}
          <div className="term-out" ref={outRef}>
            <div hidden={tab !== 'record'}>
              <RecordPane
                key={sessions.record}
                active={tab === 'record'}
                onRegister={() => setTab('next')}
              />
            </div>
            {publicKey && (
              <div hidden={tab !== 'mine'}>
                <MinePane key={sessions.mine} active={tab === 'mine'} />
              </div>
            )}
            <div hidden={tab !== 'next'}>
              <NextPane key={sessions.next} active={tab === 'next'} />
            </div>
            {joined && (
              <div hidden={tab !== 'community'}>
                <CommunityPane key={sessions.community} active={tab === 'community'} />
              </div>
            )}
            <div hidden={tab !== 'start'}>
              <StartPane key={sessions.start} active={tab === 'start'} />
            </div>
            <div hidden={tab !== 'rules'}>
              <RulesPane key={sessions.rules} active={tab === 'rules'} />
            </div>
          </div>
          {/* The input line of the window: the output above it only ever prints. */}
          <ChipBar commands={commands} onReset={reset} />
        </div>
      </div>
    </ChipProvider>
  )
}
