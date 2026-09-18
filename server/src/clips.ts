import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { config } from './config.ts'

/** Base58 is the wallet alphabet; anything else has no business in a path. */
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SHA256 = /^[0-9a-f]{64}$/

export type ClipMeta = {
  wallet: string
  shell: number
  day: number
  sha256: string
  type: string
}

export class ClipError extends Error {}

function extensionFor(type: string) {
  if (type.startsWith('video/mp4')) return 'mp4'
  if (type.startsWith('video/webm')) return 'webm'
  throw new ClipError('unsupported recording format')
}

/** Everything about a clip that decides where it lives, checked before anything touches disk. */
export function keyFor(meta: ClipMeta) {
  if (!WALLET.test(meta.wallet)) throw new ClipError('bad wallet')
  if (!SHA256.test(meta.sha256)) throw new ClipError('bad hash')
  if (!Number.isInteger(meta.shell) || meta.shell < 1) throw new ClipError('bad shell')
  if (!Number.isInteger(meta.day) || meta.day < 1 || meta.day > 70) throw new ClipError('bad day')
  return `${meta.wallet}/${meta.shell}-${String(meta.day).padStart(2, '0')}.${extensionFor(meta.type)}`
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/**
 * Stores a clip and hands back where it went. The hash is recomputed rather than trusted: it is
 * what goes on chain, and a truncated upload would otherwise be sealed as if it were whole.
 */
export async function store(meta: ClipMeta, bytes: Uint8Array) {
  if (bytes.byteLength < config.clips.minBytes) throw new ClipError('that is too small to be a minute')
  if (bytes.byteLength > config.clips.maxBytes) throw new ClipError('that is larger than a clip may be')

  const digest = sha256(bytes)
  if (digest !== meta.sha256) throw new ClipError('the upload does not match its hash')

  const key = keyFor(meta)
  // resolve() keeps a crafted key from climbing out of the clip directory.
  const path = resolve(join(config.clips.dir, key))
  if (!path.startsWith(resolve(config.clips.dir))) throw new ClipError('bad key')

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  return { key, bytes: bytes.byteLength, sha256: digest }
}
