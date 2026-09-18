import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { QUESTIONS, questionOfTheDay } from '../../questions'
import { ClipRecorder, CONSTRAINTS, MAX_MS, MIN_MS, clock, mb, pickMimeType, type Recording } from '../../lib/recorder'
import { seal, type Sealed } from '../../lib/seal'
import { progress, today } from '../../lib/shell'
import { useCommands, useScrollOutput } from './chips'
import { bar } from './format'

type Stage =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'ready' }
  | { kind: 'recording' }
  | { kind: 'done'; clip: Recording }
  | { kind: 'sealing'; clip: Recording; done: number }
  | { kind: 'sealed'; clip: Recording; stored: Sealed }
  | { kind: 'error'; message: string }

/** Each command's output, kept in the order it was run. */
type Entry = { id: number; command: 'camera' } | { id: number; command: 'example'; question: number }

function reason(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError') return 'camera access was refused. allow it and run camera again.'
  if (name === 'NotFoundError') return 'no camera found.'
  if (name === 'NotReadableError') return 'the camera is in use by something else.'
  return err instanceof Error ? err.message : String(err)
}

/** One block per day, filled once that day is sealed. */
function Days({ sealed, total }: { sealed: number; total: number }) {
  return (
    <>
      <dt>days</dt>
      <dd>
        <span className="term-meter">
          {'█'.repeat(sealed)}
          {'░'.repeat(Math.max(0, total - sealed))}
        </span>
        <span>
          {' '}
          {sealed}/{total}
        </span>
      </dd>
    </>
  )
}

/**
 * Today's minute. The clip never leaves the browser until it is sealed, and the length is timed
 * while recording rather than read back from the file — a WebM from MediaRecorder does not carry
 * its own.
 */
export function RecordPane({ active, onRegister }: { active: boolean; onRegister: () => void }) {
  const { publicKey } = useWallet()
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState<Entry[]>([])
  const nextId = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<ClipRecorder | null>(null)

  const mimeType = pickMimeType()
  const now = today()
  // Nothing is enrolled yet, so this is the week's own count; with an enrolment it becomes 8 of 14.
  const run = progress()
  // Sealing is not built, so nobody has sealed a day. This becomes a read of the chain.
  const sealed = 0
  // Enrolment is not built either. This becomes a read of the participant account.
  const enrolled = false
  // Anyone may open the camera and record; only sealing needs a wallet and a place in a shell.
  const missing = !publicKey ? 'wallet' : !enrolled ? 'shell' : null

  const sealClip = async (clip: Recording) => {
    if (!publicKey) return
    setStage({ kind: 'sealing', clip, done: 0 })
    try {
      const stored = await seal(
        clip.blob,
        { wallet: publicKey.toBase58(), shell: now.shell, day: run.day, sha256: clip.sha256 },
        (fraction) => setStage({ kind: 'sealing', clip, done: fraction }),
      )
      setStage({ kind: 'sealed', clip, stored })
    } catch (err) {
      setStage({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => release, [release])

  // The preview element only exists once the camera command has printed its output.
  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  })

  const openCamera = async () => {
    setLog((entries) => [...entries, { id: nextId.current++, command: 'camera' }])
    setStage({ kind: 'asking' })
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
      setStage({ kind: 'ready' })
    } catch (err) {
      setStage({ kind: 'error', message: reason(err) })
    }
  }

  const askAnother = () =>
    setLog((entries) => [
      ...entries,
      {
        id: nextId.current++,
        command: 'example',
        question:
          (questionOfTheDay() + entries.filter((e) => e.command === 'example').length) % QUESTIONS.length,
      },
    ])

  const start = () => {
    if (!streamRef.current || !mimeType) return
    const recorder = new ClipRecorder(streamRef.current, mimeType)
    recorderRef.current = recorder
    recorder.start()
    setElapsed(0)
    setStage({ kind: 'recording' })
  }

  const stop = async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    try {
      setStage({ kind: 'done', clip: await recorder.stop() })
    } catch (err) {
      setStage({ kind: 'error', message: reason(err) })
    }
  }

  // The clock the minimum is measured against.
  useEffect(() => {
    if (stage.kind !== 'recording') return
    const timer = setInterval(() => {
      const ms = recorderRef.current?.elapsed ?? 0
      setElapsed(ms)
      if (ms >= MAX_MS) stop()
    }, 200)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind])

  const longEnough = elapsed >= MIN_MS
  const cameraRun = log.some((entry) => entry.command === 'camera')

  // Back takes one command off the scrollback; dropping the camera closes it.
  const back = () => {
    const last = log[log.length - 1]
    if (!last) return
    if (last.command === 'camera') {
      release()
      setStage({ kind: 'idle' })
    }
    setLog((entries) => entries.slice(0, -1))
  }

  useCommands(
    {
      chips: [
        ...(!cameraRun || stage.kind === 'error'
          ? [{ key: 'camera', label: 'camera', onClick: openCamera, disabled: !mimeType }]
          : stage.kind === 'asking'
            ? [{ key: 'wait', label: 'waiting…', disabled: true }]
            : stage.kind === 'ready'
              ? [{ key: 'start', label: 'start', onClick: start }]
              : stage.kind === 'recording'
                ? [
                    {
                      key: 'stop',
                      label: longEnough ? 'stop' : `${Math.ceil((MIN_MS - elapsed) / 1000)}s to go`,
                      onClick: stop,
                      disabled: !longEnough,
                    },
                  ]
                : stage.kind === 'sealing'
                  ? [{ key: 'sealing', label: `sealing… ${Math.round(stage.done * 100)}%`, disabled: true }]
                  : stage.kind === 'sealed'
                    ? [{ key: 'again', label: 'record again', onClick: start }]
                    : stage.kind === 'done'
                      ? [
                          { key: 'again', label: 'record again', onClick: start },
                          {
                            key: 'seal',
                            label: 'seal',
                            tone: 'yes' as const,
                            // Sealing sends the clip away, so it needs a wallet to file it under.
                            onClick: () => sealClip(stage.clip),
                            disabled: !publicKey,
                          },
                        ]
                      : []),
        ...(cameraRun && missing === 'shell' ? [{ key: 'register', label: 'register', onClick: onRegister }] : []),
        ...(cameraRun ? [{ key: 'example', label: 'example', onClick: askAnother }] : []),
      ],
      back: log.length > 0 ? back : undefined,
    },
    [stage.kind, longEnough, elapsed, mimeType, log.length, cameraRun, missing, publicKey],
    active,
  )

  useScrollOutput([stage.kind, log.length])

  return (
    <>
      <p className="term-prompt">record --shell {now.shell}</p>
      <dl className="term-rows">
        <dt>date</dt>
        <dd>
          {now.date} {now.weekday}
        </dd>
        {publicKey && <Days sealed={sealed} total={run.days} />}
      </dl>

      {log.map((entry) =>
        entry.command === 'example' ? (
          <div className="term-entry" key={entry.id}>
            <p className="term-prompt">example</p>
            <p className="term-line">{QUESTIONS[entry.question]}</p>
          </div>
        ) : (
          <div className="term-entry" key={entry.id}>
            <p className="term-prompt">camera</p>
            {!mimeType ? (
              <p className="term-line term-bad">this browser cannot record. use chrome.</p>
            ) : (
              <>
                <dl className="term-rows">
                  <dt>format</dt>
                  <dd>{mimeType}</dd>
                  <dt>status</dt>
                  <dd>
                    {stage.kind === 'asking' ? (
                      'asking…'
                    ) : stage.kind === 'error' ? (
                      <span className="term-bad">{stage.message}</span>
                    ) : (
                      <span className="term-state" data-state="ok">
                        ok
                      </span>
                    )}
                  </dd>
                </dl>
                {missing && stage.kind !== 'error' && (
                  <p className="term-line term-bad">
                    {missing === 'wallet'
                      ? 'connect a wallet first — a recording cannot be sealed without one.'
                      : `you are not in shell ${now.shell}. register to start one.`}
                  </p>
                )}
                {stage.kind !== 'error' && (
                  <div className="record-stage">
                    <video ref={videoRef} muted playsInline className="record-preview" />
                    {stage.kind === 'recording' && (
                      <p className="record-clock">
                        <span className="record-dot" aria-hidden="true" />
                        {clock(elapsed)}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ),
      )}

      {(stage.kind === 'done' || stage.kind === 'sealing' || stage.kind === 'sealed') && (
        <div className="term-block">
          <p className="term-head">clip</p>
          <dl className="term-rows">
            <dt>length</dt>
            <dd>{clock(stage.clip.ms)}</dd>
            <dt>size</dt>
            <dd>{mb(stage.clip.blob.size)}</dd>
            <dt>sha256</dt>
            <dd>{stage.clip.sha256.slice(0, 16)}…</dd>
          </dl>
          {stage.kind === 'done' && (
            <p className="term-line term-dim">nothing has left this browser yet.</p>
          )}
          {stage.kind === 'sealing' && (
            <p className="term-line">
              <span className="term-meter">{bar(stage.done)}</span> {Math.round(stage.done * 100)}%
            </p>
          )}
          {stage.kind === 'sealed' && (
            <>
              <p className="term-line">
                sealed. day {run.day} of shell {now.shell}.
              </p>
              <p className="term-line term-dim">
                writing it on chain is the next thing to build.
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}
