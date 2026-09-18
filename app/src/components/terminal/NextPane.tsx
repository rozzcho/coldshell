import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { BIWEEKLY, BIWEEKLY_OPEN, CHALLENGE, RULES_URL, explorerTxUrl, trackConfig } from '../../config'
import { useChallengeState } from '../../lib/challenge'
import { formatCountdown, openChallenge, type Challenge } from '../../lib/schedule'
import { formatDateTime, useTimeZoneMode } from '../../lib/timeZone'
import { useRegister } from '../../lib/useRegister'
import { useCommands, useScrollOutput, type Chip } from './chips'
import { shorten, usdc } from './format'

const RESUME_KEY = 'pog:register-track'

/** One key/value line of output. `state` prints at the end of the line, like a check result. */
function Row({ label, children, state }: { label: string; children: React.ReactNode; state?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {children}
        {state && <span className="term-state" data-state={state}>{state}</span>}
      </dd>
    </>
  )
}

function ChallengeBlock({ challenge, now }: { challenge: Challenge; now: number }) {
  const [zone] = useTimeZoneMode()
  const state = useChallengeState(challenge.id, { track: challenge.track })
  const track = trackConfig(challenge.track)
  return (
    <div className="term-block">
      <p className="term-head">
        {track.name.toLowerCase().replace(' challenge', '')}#{challenge.id}
        <span className="term-tag">[ registration open ]</span>
      </p>
      <dl className="term-rows">
        <Row label="starts in">{formatCountdown(challenge.startMs - now)}</Row>
        <Row label="dates">
          {formatDateTime(challenge.startMs, zone)} ~ {formatDateTime(challenge.endMs - 60_000, zone)}
        </Row>
        <Row label="entry">
          {usdc(track.entryFeeUsdc)} × multiply (1x–{CHALLENGE.maxMultiply}x)
        </Row>
        <Row label="participants">{state ? state.participants : '…'}</Row>
        <Row label="prize pool">{state ? usdc(state.prizePool) : '…'}</Row>
      </dl>
    </div>
  )
}

function ListChips({ chips, back, active }: { chips: Chip[]; back?: () => void; active: boolean }) {
  useCommands({ chips, back }, [chips, back], active)
  return null
}

/** The register conversation: what the terminal checked, then one question. */
function RegisterView({
  challenge,
  active,
  onCancel,
}: {
  challenge: Challenge
  active: boolean
  onCancel: () => void
}) {
  const { publicKey } = useWallet()
  const register = useRegister(challenge)
  const { status, discord, multiply, total, balance, sol, needsSol, insufficient, done } = register
  const track = trackConfig(challenge.track)
  const name = `${track.name.toLowerCase().replace(' challenge', '')}#${challenge.id}`

  // Nothing to choose until both accounts are there: the conversation waits instead.
  const connected = Boolean(publicKey) && Boolean(discord)
  const blocked = !connected || needsSol || insufficient || status.kind === 'loading'

  useScrollOutput([status.kind, connected])

  useCommands(
    {
      chips: done
        ? [
            ...(status.kind === 'success'
              ? [{ key: 'tx', label: 'open explorer', href: explorerTxUrl(status.signature) }]
              : []),
            { key: 'again', label: 'check discord room', onClick: register.unlockDiscord },
          ]
        : !connected
          ? []
          : [
              ...(needsSol
                ? [{ key: 'sol', label: register.funding ? 'sending…' : 'get test SOL', onClick: register.getTestSol }]
                : []),
              {
                key: 'down',
                label: '−',
                onClick: () => register.setMultiply((m) => Math.max(1, m - 1)),
                disabled: multiply <= 1 || register.busy,
              },
              { key: 'mult', label: `${multiply}x`, disabled: true },
              {
                key: 'up',
                label: '+',
                onClick: () => register.setMultiply((m) => Math.min(CHALLENGE.maxMultiply, m + 1)),
                disabled: multiply >= CHALLENGE.maxMultiply || register.busy,
              },
              {
                key: 'yes',
                label: status.kind === 'paying' ? 'signing…' : 'y',
                tone: 'yes' as const,
                onClick: register.pay,
                disabled: blocked || register.busy,
              },
              { key: 'no', label: 'n', tone: 'no' as const, onClick: onCancel, disabled: register.busy },
            ],
      back: register.busy ? undefined : onCancel,
    },
    [done, status.kind, connected, needsSol, multiply, register.busy, register.funding],
    active,
  )

  if (done) {
    return (
      <div className="term-block">
        <p className="term-head">{name}</p>
        <p className="term-line">registered · {multiply}x · {usdc(total)}</p>
        {status.kind === 'success' && <p className="term-line term-dim">tx {shorten(status.signature)}</p>}
        <p className="term-line">{register.accessText ?? 'start grinding.'}</p>
      </div>
    )
  }

  return (
    <div className="term-block">
      <p className="term-head">
        {name} · entry {usdc(track.entryFeeUsdc)} × multiply
      </p>
      <dl className="term-rows">
        <Row label="wallet" state={publicKey ? 'ok' : 'needed'}>
          {publicKey ? shorten(publicKey.toBase58()) : '—'}
        </Row>
        <Row label="discord" state={discord ? 'ok' : 'needed'}>
          {register.me === null ? '…' : (discord?.username ?? '—')}
        </Row>
        <Row label="multiply">{multiply}x</Row>
        <Row label="total">{usdc(total)}</Row>
        <Row
          label="balance"
          state={balance === null ? undefined : insufficient ? 'short' : 'ok'}
        >
          {balance === null ? '—' : usdc(balance)}
        </Row>
        {needsSol && (
          <Row label="sol" state="needed">
            {sol === null ? '—' : sol.toFixed(3)}
          </Row>
        )}
      </dl>
      {status.kind === 'error' && <p className="term-line term-bad">{status.message}</p>}
      {connected ? (
        <p className="term-line term-ask">
          proceed? this counts as agreeing to the{' '}
          <a href={RULES_URL} target="_blank" rel="noopener noreferrer">
            rules
          </a>
          .
        </p>
      ) : (
        <p className="term-line term-ask">
          connect {!publicKey && !discord ? 'both' : !publicKey ? 'a wallet' : 'Discord'} with the{' '}
          {!publicKey && !discord ? 'buttons' : 'button'} at the top right of this window.
        </p>
      )}
    </div>
  )
}

/** The Next Challenge tab: what is open, and the way in. */
export function NextPane({ active }: { active: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  const [registering, setRegistering] = useState<number | null>(null)
  // A cancelled conversation stays on screen the way a stopped command does.
  const [cancelled, setCancelled] = useState<{ id: number; label: string }[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Coming back from the Discord sign-in: pick the register conversation up where it was left.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('register')) return
    const stored = sessionStorage.getItem(RESUME_KEY)
    setRegistering(stored === null ? CHALLENGE.track : Number(stored))
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const weekly = openChallenge(CHALLENGE, now)
  const biweekly = openChallenge(BIWEEKLY, now)

  const start = (track: number) => {
    sessionStorage.setItem(RESUME_KEY, String(track))
    setRegistering(track)
  }

  useScrollOutput([registering, cancelled.length])

  const weeklyName = CHALLENGE.name.toLowerCase().replace(' challenge', '')
  const cancel = (track: number) => {
    setCancelled((list) => [
      ...list,
      { id: nextId.current++, label: track === BIWEEKLY.track ? 'biweekly' : weeklyName },
    ])
    setRegistering(null)
  }

  const listChips: Chip[] = [
    { key: 'w', label: `register ${weeklyName}`, onClick: () => start(CHALLENGE.track) },
    ...(BIWEEKLY_OPEN ? [{ key: 'b', label: 'register biweekly', onClick: () => start(BIWEEKLY.track) }] : []),
  ]

  return (
    <>
      <p className="term-prompt">upcoming</p>
      <ChallengeBlock challenge={weekly} now={now} />
      {BIWEEKLY_OPEN ? (
        <ChallengeBlock challenge={biweekly} now={now} />
      ) : (
        <p className="term-line term-dim">
          biweekly#0 <span className="term-tag">[ locked ]</span> opening soon
        </p>
      )}
      {cancelled.map((entry) => (
        <div className="term-entry" key={entry.id}>
          <p className="term-prompt">register {entry.label}</p>
          <p className="term-line term-dim">cancelled.</p>
        </div>
      ))}
      {registering === null ? (
        <ListChips
          chips={listChips}
          back={cancelled.length > 0 ? () => setCancelled((list) => list.slice(0, -1)) : undefined}
          active={active}
        />
      ) : (
        <div className="term-entry">
          <p className="term-prompt">
            register {registering === BIWEEKLY.track ? 'biweekly' : weeklyName}
          </p>
          <RegisterView
            challenge={registering === BIWEEKLY.track ? biweekly : weekly}
            active={active}
            onCancel={() => cancel(registering)}
          />
        </div>
      )}
    </>
  )
}
