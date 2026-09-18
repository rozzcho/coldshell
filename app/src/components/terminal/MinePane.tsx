import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { BorshAccountsCoder, type Idl } from '@anchor-lang/core'
import idl from '../../idl/coldshell.json'
import { CLAIM_WINDOW_MS, MAX_WARNINGS, USDC_DECIMALS, trackConfig } from '../../config'
import { getProgress, type Progress } from '../../lib/api'
import { PRIZE_POOL_SHARE, useChallengeState } from '../../lib/challenge'
import { useClaimReward } from '../../lib/claim'
import { challengePda, participantPda, warningPda } from '../../lib/program'
import { useRecords } from '../../lib/records'
import { formatDateTime, useTimeZoneMode } from '../../lib/timeZone'
import { useCommands, useScrollOutput } from './chips'
import { bar, dayLabel, duration, usdc } from './format'

const coder = new BorshAccountsCoder(idl as unknown as Idl)
const PAYOUT_UNIT = 10_000 // rewards are rounded down to 0.01 USDC

/** One command's output, kept until `clear`, the way a shell keeps its scrollback. */
type Entry = { id: number; command: 'records' | 'info' | 'claim' }

type Stake = {
  multiply: number
  paidUsdc: number
  passedEveryDay: boolean
  warnings: number
  warnedOut: boolean
  claimed: boolean
  finalized: boolean
  payoutUsdc: number | null
}

type Claim = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done' } | { kind: 'error'; message: string }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

/** The My Challenge tab: your own run, and what you can do about it. */
export function MinePane({ active }: { active: boolean }) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [zone] = useTimeZoneMode()
  const claimReward = useClaimReward()
  const [log, setLog] = useState<Entry[]>([])
  const [asking, setAsking] = useState(false)
  const nextId = useRef(0)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [stake, setStake] = useState<Stake | null>(null)
  const [claim, setClaim] = useState<Claim>({ kind: 'idle' })
  const [now, setNow] = useState(() => Date.now())
  const wantsRecords = log.some((entry) => entry.command === 'records')
  const records = useRecords(publicKey ?? null, wantsRecords)

  const load = useCallback(async () => {
    const data = await getProgress().catch(() => null)
    setProgress(data)
    if (!data?.registered || !publicKey) return setStake(null)

    const challenge = challengePda(data.track, data.challengeId)
    const [challengeInfo, participantInfo, warningInfo] = await connection.getMultipleAccountsInfo([
      challenge,
      participantPda(challenge, publicKey),
      warningPda(challenge, publicKey),
    ])
    if (!challengeInfo || !participantInfo) return setStake(null)
    try {
      const c = coder.decode('Challenge', challengeInfo.data) as {
        finalized: boolean
        total_deposited: { toString(): string }
        carry_over: { toString(): string }
        winner_shares: { toString(): string }
      }
      const p = coder.decode('Participant', participantInfo.data) as {
        multiply: number
        amount_paid: { toString(): string }
        days_completed: number
        claimed: boolean
      }
      const fullMask = (1 << data.days.length) - 1
      const passedEveryDay = p.days_completed === fullMask
      const warnings = warningInfo ? (coder.decode('Warning', warningInfo.data) as { count: number }).count : 0
      const winnerShares = Number(c.winner_shares.toString())
      const prizePool = Number(c.total_deposited.toString()) * PRIZE_POOL_SHARE + Number(c.carry_over.toString())
      const warnedOut = warnings >= MAX_WARNINGS
      const payout =
        c.finalized && passedEveryDay && !warnedOut && winnerShares > 0
          ? Math.floor((prizePool * p.multiply) / winnerShares / PAYOUT_UNIT) * PAYOUT_UNIT
          : null
      setStake({
        multiply: p.multiply,
        paidUsdc: Number(p.amount_paid.toString()) / 10 ** USDC_DECIMALS,
        passedEveryDay,
        warnings,
        warnedOut,
        claimed: p.claimed,
        finalized: c.finalized,
        payoutUsdc: payout === null ? null : payout / 10 ** USDC_DECIMALS,
      })
    } catch {
      setStake(null)
    }
  }, [connection, publicKey])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const joined = Boolean(progress?.registered)
  const track = progress ? trackConfig(progress.track) : null
  const startMs = progress && track ? track.launchMs + progress.challengeId * track.durationMs : 0
  const endMs = track ? startMs + track.durationMs : 0
  const name = progress && track ? `${track.name.toLowerCase().replace(' challenge', '')}#${progress.challengeId}` : ''
  const challengeState = useChallengeState(progress?.registered ? progress.challengeId : -1, {
    track: progress?.track,
    withWinners: true,
  })

  const claimed = Boolean(stake?.claimed) || claim.kind === 'done'
  const claimDeadlineMs = endMs + CLAIM_WINDOW_MS
  const claimable = Boolean(
    stake?.finalized && stake.passedEveryDay && !stake.warnedOut && !claimed && now < claimDeadlineMs,
  )

  const sendClaim = async () => {
    if (!progress) return
    setClaim({ kind: 'sending' })
    try {
      await claimReward(progress.track, progress.challengeId)
      setClaim({ kind: 'done' })
      load()
    } catch (err) {
      setClaim({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const run = (command: Entry['command']) => {
    setLog((entries) => [...entries, { id: nextId.current++, command }])
    if (command === 'claim') setAsking(true)
  }

  // Back takes one command off the scrollback, the way undo does.
  const back = () => {
    if (asking) return setAsking(false)
    setLog((entries) => entries.slice(0, -1))
  }

  useCommands(
    {
      chips: asking
        ? [
            {
              key: 'yes',
              label: claim.kind === 'sending' ? 'signing…' : 'y',
              tone: 'yes' as const,
              onClick: sendClaim,
              disabled: !claimable || claim.kind === 'sending' || claim.kind === 'done',
            },
            { key: 'no', label: 'n', tone: 'no' as const, onClick: () => setAsking(false) },
          ]
        : [
            { key: 'records', label: 'records', onClick: () => run('records') },
            { key: 'info', label: 'info', onClick: () => run('info'), disabled: !joined },
            { key: 'claim', label: 'claim', onClick: () => run('claim'), disabled: !joined },
          ],
      back: asking || log.length > 0 ? back : undefined,
    },
    [asking, joined, claimable, claim.kind, log.length],
    active,
  )

  useScrollOutput([log.length, asking, claim.kind])

  if (!publicKey) {
    return (
      <>
        <p className="term-prompt">status</p>
        <p className="term-line term-dim">no wallet connected. connect one to see your challenge.</p>
      </>
    )
  }

  const recordsOutput = () => {
    if (records === null) return <p className="term-line term-dim">reading the chain…</p>
    if (records.length === 0) return <p className="term-line term-dim">no challenges yet.</p>
    return (
      <div className="term-block">
        <p className="term-head">records · {records.length}</p>
        <ul className="term-list">
          {records.map((record) => (
            <li key={record.key}>
              <span className="term-col">{record.label.toLowerCase().replace(' ', '')}</span>
              <span className="term-col">
                {record.multiply}x · {usdc(record.paidUsdc)}
              </span>
              <span className="term-col">
                {record.daysPassed}/{record.days} days
              </span>
              <span className="term-state" data-state={record.result}>
                {record.result}
              </span>
              <span className="term-col term-dim">
                {record.rewardUsdc === null ? '' : `+${usdc(record.rewardUsdc)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const infoOutput = () => {
    if (!joined || !progress || !track) return <p className="term-line term-dim">no active challenge.</p>
    return (
      <div className="term-block">
        <p className="term-head">{name}</p>
        <dl className="term-rows">
          <Row label="dates">
            {formatDateTime(startMs, zone)} ~ {formatDateTime(endMs - 60_000, zone)}
          </Row>
          <Row label="participants">{challengeState ? challengeState.participants : '…'}</Row>
          <Row label="winners so far">{challengeState?.winners ?? '…'}</Row>
          <Row label="prize pool">{challengeState ? usdc(challengeState.prizePool) : '…'}</Row>
          <Row label="your stake">{stake ? `${stake.multiply}x · ${usdc(stake.paidUsdc)}` : '…'}</Row>
          <Row label="warnings">{stake ? `${stake.warnings} / ${MAX_WARNINGS}` : '…'}</Row>
          <Row label="claim by">{formatDateTime(claimDeadlineMs, zone)}</Row>
        </dl>
      </div>
    )
  }

  const claimOutput = () => {
    if (!joined || !progress || !track) return <p className="term-line term-dim">no active challenge.</p>
    const reason = claimed
      ? 'already claimed.'
      : !stake?.finalized
        ? 'the challenge is not settled yet. results open after the recording window.'
        : stake.warnedOut
          ? `out on warnings (${stake.warnings}/${MAX_WARNINGS}).`
          : !stake.passedEveryDay
            ? 'you missed a day, so there is nothing to claim.'
            : now >= claimDeadlineMs
              ? 'the claim window closed.'
              : null
    return (
      <div className="term-block">
        <p className="term-head">{name} · claim</p>
        <dl className="term-rows">
          <Row label="days passed">
            {progress.days.filter((d) => d.goalMet).length} / {progress.days.length}
          </Row>
          <Row label="your share">{!stake || stake.payoutUsdc === null ? '—' : usdc(stake.payoutUsdc)}</Row>
          <Row label="claim by">{formatDateTime(claimDeadlineMs, zone)}</Row>
        </dl>
        {claim.kind === 'error' && <p className="term-line term-bad">{claim.message}</p>}
        {claim.kind === 'done' && <p className="term-line">claimed. check your wallet.</p>}
        {reason ? (
          <p className="term-line term-dim">{reason}</p>
        ) : (
          claim.kind !== 'done' && (
            <p className="term-line term-ask">claim {stake?.payoutUsdc ? usdc(stake.payoutUsdc) : ''} now?</p>
          )
        )}
      </div>
    )
  }

  const progressOutput = () => {
    if (!joined || !progress || !track) {
      return <p className="term-line term-dim">no active challenge. open the next challenge tab to join one.</p>
    }
    const currentDay = now >= startMs && now < endMs ? Math.floor((now - startMs) / track.dayMs) : null
    const passed = progress.days.filter((d) => d.goalMet).length
    const state = now < startMs ? 'upcoming' : now < endMs ? 'running' : stake?.finalized ? 'settled' : 'settling'
    return (
      <div className="term-block">
        <p className="term-head">
          {name}
          <span className="term-tag">[ {state} ]</span>
          {currentDay !== null
            ? `day ${currentDay + 1} of ${progress.days.length}`
            : `${passed} of ${progress.days.length} days`}
        </p>
        <ul className="term-days">
          {progress.days.map((day) => {
            const goal = day.goalSeconds ?? progress.goalSeconds
            const future = currentDay !== null && day.dayIndex > currentDay
            const today = day.dayIndex === currentDay
            const result = day.goalMet ? 'ok' : future ? '' : today ? '…' : 'missed'
            return (
              <li key={day.dayIndex}>
                <span className="term-col">{dayLabel(day.dayIndex, startMs, track.dayMs)}</span>
                {future ? (
                  <span className="term-col term-dim">—</span>
                ) : (
                  <>
                    <span className="term-meter">{bar(goal > 0 ? day.seconds / goal : 0)}</span>
                    <span className="term-col">
                      {duration(day.seconds)} / {duration(goal)}
                    </span>
                  </>
                )}
                {result && (
                  <span
                    className="term-state"
                    data-state={result === 'ok' ? 'ok' : result === '…' ? 'running' : 'missed'}
                  >
                    {result}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {stake && stake.warnings > 0 && (
          <p className="term-line term-bad">
            warnings {stake.warnings} / {MAX_WARNINGS}
          </p>
        )}
      </div>
    )
  }

  const output = { records: recordsOutput, info: infoOutput, claim: claimOutput }

  return (
    <>
      <p className="term-prompt">status</p>
      {progressOutput()}
      {log.map((entry) => (
        <div className="term-entry" key={entry.id}>
          <p className="term-prompt">{entry.command}</p>
          {output[entry.command]()}
        </div>
      ))}
    </>
  )
}
