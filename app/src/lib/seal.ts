/** Sending today's minute away. The only moment a recording leaves the browser. */

export type SealMeta = {
  wallet: string
  shell: number
  day: number
  sha256: string
}

export type Sealed = { key: string; bytes: number; sha256: string }

/**
 * Uploads the clip, reporting how far along it is. XHR rather than fetch because fetch cannot
 * say how much of the body has gone — and on a real connection nine megabytes is long enough
 * that a silent wait feels broken.
 */
export function seal(blob: Blob, meta: SealMeta, onProgress: (fraction: number) => void) {
  const query = new URLSearchParams({
    wallet: meta.wallet,
    shell: String(meta.shell),
    day: String(meta.day),
    sha256: meta.sha256,
  })

  return new Promise<Sealed>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `/api/clip?${query}`)
    request.setRequestHeader('Content-Type', blob.type)
    request.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    request.onload = () => {
      let body: { error?: string } & Partial<Sealed> = {}
      try {
        body = JSON.parse(request.responseText)
      } catch {
        // A response that is not JSON is a failure whatever it says.
      }
      if (request.status === 200 && body.key) resolve(body as Sealed)
      else reject(new Error(body.error ?? `upload failed (${request.status})`))
    }
    request.onerror = () => reject(new Error('the upload could not reach the server'))
    request.send(blob)
  })
}
