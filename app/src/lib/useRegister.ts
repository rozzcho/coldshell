import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { trackConfig } from '../config'
import {
  DISCORD_LOGIN_URL,
  confirmRegistration,
  getMe,
  getRegisterTx,
  logout,
  requestTestSol,
  type GrantResult,
  type Me,
} from './api'
import { challengePda, participantPda, usdcAta } from './program'
import { ExpiredError, signAndConfirm } from './send'
import type { Challenge } from './schedule'

export type RegisterStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'registered' }
  | { kind: 'paying' }
  | { kind: 'success'; signature: string }
  | { kind: 'error'; message: string }

type Access = { kind: 'idle' } | { kind: 'checking' } | { kind: 'done'; result: GrantResult } | { kind: 'failed' }

function errorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message || err.name : String(err)
  if (/already in use/i.test(text)) return 'you are already registered.'
  if (/OverlappingChallenge|another track/i.test(text)) return 'you are already in a challenge that overlaps this one.'
  if (/insufficient funds/i.test(text)) return 'not enough USDC.'
  if (/User rejected|rejected the request/i.test(text)) return 'cancelled in the wallet.'
  if (/Failed to fetch|Request failed \(50[24]\)/i.test(text)) return 'server is offline.'
  if (/Signature verification failed/i.test(text)) return 'the wallet signature was invalid. try again.'
  return text || 'something went wrong. try again.'
}

/** What the Discord room unlock is doing, in one line. */
export function accessLine(access: Access) {
  switch (access.kind) {
    case 'checking':
      return 'unlocking the Discord room…'
    case 'failed':
      return "couldn't reach Discord. try again."
    case 'done': {
      const { roleGranted, reason } = access.result
      if (roleGranted) return 'Discord room unlocked.'
      if (reason === 'bot-not-configured') return 'the Discord bot is offline. your role comes once it is running.'
      if (reason === 'not-in-guild') return 'join the Discord server, then check again.'
      return "couldn't give the Discord role. try again."
    }
    default:
      return null
  }
}

/**
 * Everything registering needs: what is in the wallet, who is signed in, and the transaction.
 * Lifted out of the old payment card so the terminal can print it instead of drawing a form.
 */
export function useRegister(openChallenge: Challenge) {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  const [status, setStatus] = useState<RegisterStatus>({ kind: 'loading' })
  const [balance, setBalance] = useState<number | null>(null)
  const [sol, setSol] = useState<number | null>(null)
  const [funding, setFunding] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [access, setAccess] = useState<Access>({ kind: 'idle' })
  const [multiply, setMultiply] = useState(1)

  const challenge = useMemo(
    () => challengePda(openChallenge.track, openChallenge.id),
    [openChallenge.track, openChallenge.id],
  )
  const entryFeeUsdc = trackConfig(openChallenge.track).entryFeeUsdc
  const total = entryFeeUsdc * multiply
  const discord = me?.discord ?? null

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' })
    getMe()
      .then(setMe)
      .catch(() => setMe({ oauthConfigured: false, discord: null }))
    if (!publicKey) {
      setBalance(null)
      setSol(null)
      setStatus({ kind: 'ready' })
      return
    }
    try {
      const [tokenBalance, lamports, participantInfo] = await Promise.all([
        connection.getTokenAccountBalance(usdcAta(publicKey)).catch(() => null),
        connection.getBalance(publicKey).catch(() => null),
        connection.getAccountInfo(participantPda(challenge, publicKey)),
      ])
      setBalance(tokenBalance ? Number(tokenBalance.value.uiAmount ?? 0) : 0)
      setSol(lamports === null ? null : lamports / 1_000_000_000)
      setStatus(participantInfo ? { kind: 'registered' } : { kind: 'ready' })
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) })
    }
  }, [connection, publicKey, challenge])

  useEffect(() => {
    load()
  }, [load])

  const unlockDiscord = useCallback(async () => {
    setAccess({ kind: 'checking' })
    try {
      setAccess({ kind: 'done', result: await confirmRegistration() })
    } catch {
      setAccess({ kind: 'failed' })
    }
  }, [])

  const getTestSol = useCallback(async () => {
    if (!publicKey) return
    setFunding(true)
    try {
      await requestTestSol(publicKey.toBase58())
      await load()
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) })
    } finally {
      setFunding(false)
    }
  }, [publicKey, load])

  const switchDiscord = useCallback(async () => {
    await logout().catch(() => {})
    window.location.href = `${DISCORD_LOGIN_URL}?switch=1`
  }, [])

  const pay = useCallback(async () => {
    if (!publicKey) return
    if (!signTransaction) {
      setStatus({ kind: 'error', message: 'this wallet cannot sign transactions.' })
      return
    }
    setStatus({ kind: 'paying' })
    try {
      // The server builds the transaction and co-signs it for the verified Discord account.
      const { challengeId, transaction, lastValidBlockHeight } = await getRegisterTx(
        publicKey.toBase58(),
        multiply,
        openChallenge.track,
      )
      if (challengeId !== openChallenge.id) {
        throw new Error(`registration moved on to #${challengeId}. run register again.`)
      }
      const bytes = Buffer.from(transaction, 'base64')

      // Simulate on a copy: simulateTransaction replaces the blockhash, which voids the server signature.
      const sim = await connection.simulateTransaction(Transaction.from(bytes))
      if (sim.value.err) {
        throw new Error(sim.value.logs?.join('\n') || JSON.stringify(sim.value.err))
      }

      let signature: string
      try {
        signature = await signAndConfirm(connection, signTransaction, bytes, lastValidBlockHeight)
      } catch (err) {
        if (!(err instanceof ExpiredError)) throw err
        // Approval took too long: build a fresh transaction and ask for one more signature.
        const retry = await getRegisterTx(publicKey.toBase58(), multiply, openChallenge.track)
        signature = await signAndConfirm(
          connection,
          signTransaction,
          Buffer.from(retry.transaction, 'base64'),
          retry.lastValidBlockHeight,
        )
      }

      setBalance((b) => (b === null ? b : b - total))
      setStatus({ kind: 'success', signature })
      unlockDiscord()
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) })
    }
  }, [publicKey, signTransaction, multiply, openChallenge.track, openChallenge.id, connection, total, unlockDiscord])

  // Without SOL a wallet cannot pay network fees — and an empty wallet does not exist on chain yet.
  const needsSol = sol !== null && sol < 0.01
  const insufficient = balance !== null && balance < total
  const done = status.kind === 'success' || status.kind === 'registered'

  return {
    status,
    access,
    accessText: accessLine(access),
    balance,
    sol,
    funding,
    me,
    discord,
    multiply,
    setMultiply,
    entryFeeUsdc,
    total,
    needsSol,
    insufficient,
    done,
    busy: status.kind === 'paying' || access.kind === 'checking',
    pay,
    getTestSol,
    unlockDiscord,
    switchDiscord,
    reload: load,
  }
}
