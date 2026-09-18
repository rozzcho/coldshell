import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipRecorder, CONSTRAINTS, MAX_MS, MIN_MS, clock, mb, pickMimeType, type Recording } from '../../lib/recorder'
import { useCommands, useScrollOutput } from './chips'

type Stage =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'ready' }
  | { kind: 'recording' }
  | { kind: 'done'; clip: Recording }
  | { kind: 'error'; message: string }

function reason(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError') return 'camera access was refused. allow it and run camera again.'
  if (name === 'NotFoundError') return 'no camera found.'
  if (name === 'NotReadableError') return 'the camera is in use by something else.'
  return err instanceof Error ? err.message : String(err)
}

/**
 * Today's minute. The clip never leaves the browser until it is sealed, and the length is timed
 * here rather than read back from the file — a WebM from MediaRecorder does not carry its own.
 */
export function RecordPane({ active }: { active: boolean }) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<ClipRecorder | null>(null)

  const mimeType = pickMimeType()

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => release, [release])

  const openCamera = async () => {
    setStage({ kind: 'asking' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setStage({ kind: 'ready' })
    } catch (err) {
      setStage({ kind: 'error', message: reason(err) })
    }
  }

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
  const open = stage.kind === 'ready' || stage.kind === 'recording' || stage.kind === 'done'

  useCommands(
    {
      chips:
        stage.kind === 'idle' || stage.kind === 'error'
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
                : [
                    { key: 'again', label: 'record again', onClick: start },
                    { key: 'seal', label: 'seal', tone: 'yes' as const, disabled: true },
                  ],
      back: stage.kind === 'done' ? () => setStage({ kind: 'ready' }) : undefined,
    },
    [stage.kind, longEnough, elapsed, mimeType],
    active,
  )

  useScrollOutput([stage.kind])

  return (
    <>
      <p className="term-prompt">record</p>

      {!mimeType ? (
        <p className="term-line term-bad">this browser cannot record. use chrome.</p>
      ) : (
        <dl className="term-rows">
          <dt>format</dt>
          <dd>{mimeType}</dd>
          <dt>camera</dt>
          <dd>
            {stage.kind === 'idle' ? (
              <span className="term-dim">not open</span>
            ) : stage.kind === 'asking' ? (
              'asking…'
            ) : stage.kind === 'error' ? (
              <span className="term-bad">{stage.message}</span>
            ) : (
              <span className="term-state" data-state="ok">
                ok
              </span>
            )}
          </dd>
          <dt>minimum</dt>
          <dd>{clock(MIN_MS)}</dd>
        </dl>
      )}

      {/* No black rectangle before there is anything to see in it. */}
      <div className="record-stage" hidden={!open}>
        <video ref={videoRef} muted playsInline className="record-preview" />
        {stage.kind === 'recording' && (
          <p className="record-clock">
            <span className="record-dot" aria-hidden="true" />
            {clock(elapsed)}
          </p>
        )}
      </div>

      {stage.kind === 'done' && (
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
          <p className="term-line term-dim">
            nothing has left this browser yet. sealing it is the next thing to build.
          </p>
        </div>
      )}
    </>
  )
}
