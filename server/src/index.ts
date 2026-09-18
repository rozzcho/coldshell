import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { config } from './config.ts'
import { ClipError, store } from './clips.ts'

const app = new Hono()

app.use('/api/*', cors({ origin: config.appUrl }))

app.get('/api/health', (c) => c.json({ ok: true }))

/**
 * Takes today's minute. The body is the recording itself: at this size going straight through
 * the server is simpler than handing out presigned URLs, and the storage behind this can move
 * to R2 without the browser noticing.
 */
app.post('/api/clip', async (c) => {
  const { wallet, shell, day, sha256 } = c.req.query()
  const type = c.req.header('content-type') ?? ''
  try {
    const bytes = new Uint8Array(await c.req.arrayBuffer())
    const stored = await store({ wallet, shell: Number(shell), day: Number(day), sha256, type }, bytes)
    return c.json(stored)
  } catch (err) {
    if (err instanceof ClipError) return c.json({ error: err.message }, 400)
    console.error('[clip]', err)
    return c.json({ error: 'could not store that' }, 500)
  }
})

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`coldshell on http://localhost:${port}`)
})
