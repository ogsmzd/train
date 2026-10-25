// Shared server helpers. Files starting with "_" are not routes on Vercel.
import crypto from 'node:crypto'

const WHOOP_BASE = process.env.WHOOP_BASE_URL || 'https://api.prod.whoop.com' // overridable for local tests only
export const WHOOP_API = WHOOP_BASE + '/developer'
export const WHOOP_AUTH = WHOOP_BASE + '/oauth/oauth2'
export const WHOOP_SCOPES = 'read:recovery read:sleep read:workout read:cycles offline'

export function env(name) {
  const v = process.env[name]
  if (!v) throw new HttpError(500, `Server setting ${name} is missing. Add it in Vercel → Settings → Environment Variables.`)
  return v
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

/** Wraps a handler: errors become JSON with a readable message. */
export function route(fn) {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      if (status >= 500) console.error(e)
      send(res, status, { error: e.message || 'Server error' })
    }
  }
}

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest()

/** Constant-time passcode check against APP_PASSCODE. */
export function requirePasscode(req) {
  const expected = env('APP_PASSCODE')
  const given = req.headers['x-passcode'] || ''
  if (!crypto.timingSafeEqual(digest(given), digest(expected))) throw new HttpError(401, 'Wrong passcode.')
}

// ---------- Supabase REST (secret key on the apikey header only) ----------
export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + '/rest/v1/' + path
  const headers = { apikey: env('SUPABASE_SECRET_KEY'), 'Content-Type': 'application/json', Accept: 'application/json' }
  if (prefer) headers.Prefer = prefer
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (!r.ok) {
    let msg = text
    try {
      msg = JSON.parse(text).message || text
    } catch {}
    throw new HttpError(502, `Database error (${r.status}): ${msg}`)
  }
  return text ? JSON.parse(text) : null
}

// ---------- OAuth state: timestamp signed with a server secret ----------
const stateKey = () => digest(env('WHOOP_CLIENT_SECRET') + '|' + env('APP_PASSCODE'))

export function makeState() {
  const ts = String(Date.now())
  const nonce = crypto.randomBytes(8).toString('hex')
  const mac = crypto.createHmac('sha256', stateKey()).update(ts + '.' + nonce).digest('hex').slice(0, 32)
  return `${ts}.${nonce}.${mac}`
}

export function checkState(state) {
  const [ts, nonce, mac] = String(state || '').split('.')
  if (!ts || !nonce || !mac) return false
  const good = crypto.createHmac('sha256', stateKey()).update(ts + '.' + nonce).digest('hex').slice(0, 32)
  if (good.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(mac))) return false
  return Date.now() - Number(ts) < 15 * 60 * 1000
}

export function redirectUri(req) {
  const base = process.env.PUBLIC_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  return base.replace(/\/$/, '') + '/api/whoop/callback'
}

// ---------- WHOOP tokens ----------
export async function tokenRequest(params) {
  const body = new URLSearchParams({ ...params, client_id: env('WHOOP_CLIENT_ID'), client_secret: env('WHOOP_CLIENT_SECRET') })
  const r = await fetch(WHOOP_AUTH + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) {
    const err = new HttpError(r.status === 400 || r.status === 401 ? 401 : 502, `WHOOP sign-in failed: ${j.error_description || j.error || r.status}`)
    err.revoked = j.error === 'invalid_grant'
    throw err
  }
  if (!j.refresh_token) throw new HttpError(502, "WHOOP didn't return a refresh token — the app needs the 'offline' scope.")
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 }
}

export async function loadTokens() {
  const rows = await sb('whoop_tokens?id=eq.1&select=*')
  return rows?.[0] || null
}

export async function saveTokens(t, previousRefresh) {
  const row = { id: 1, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString() }
  if (previousRefresh) {
    // only replace the pair we refreshed, so two refreshes can't clobber each other
    const updated = await sb(`whoop_tokens?id=eq.1&refresh_token=eq.${encodeURIComponent(previousRefresh)}`, { method: 'PATCH', body: row, prefer: 'return=representation' })
    if (!updated?.length) return loadTokens()
    return updated[0]
  }
  const r = await sb('whoop_tokens?on_conflict=id', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=representation' })
  return r?.[0]
}

/** A valid access token, refreshing first if it is about to expire. */
export async function accessToken(force = false) {
  let t = await loadTokens()
  if (!t) return null
  if (force || Number(t.expires_at) - Date.now() < 120_000) {
    try {
      const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token, scope: 'offline' })
      t = await saveTokens(fresh, t.refresh_token)
    } catch (e) {
      if (e.revoked) {
        await sb('whoop_tokens?id=eq.1', { method: 'DELETE' })
        throw new HttpError(401, 'WHOOP access ended — connect WHOOP again from More.')
      }
      throw e
    }
  }
  return t.access_token
}

/** GET a WHOOP collection, following next_token, from `start` onwards. */
export async function whoopCollection(path, startISO, maxPages = 8) {
  const out = []
  let next
  let token = await accessToken()
  if (!token) throw new HttpError(409, 'WHOOP is not connected.')
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ limit: '25', start: startISO })
    if (next) q.set('nextToken', next)
    let r = await fetch(`${WHOOP_API}${path}?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.status === 401) {
      token = await accessToken(true)
      r = await fetch(`${WHOOP_API}${path}?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    }
    if (r.status === 429) throw new HttpError(429, 'WHOOP rate limit hit — try again in a minute.')
    if (!r.ok) throw new HttpError(502, `WHOOP ${path} failed (${r.status}).`)
    const j = await r.json()
    out.push(...(j.records || []))
    next = j.next_token
    if (!next) break
  }
  return out
}
