// Two-way sync. The phone sends what changed since its last push and gets back
// everything the server saw since its cursor. Last write (by updatedAt) wins.
import { HttpError, requirePasscode, route, sb, send } from './_lib.js'

const KINDS = new Set(['workout', 'mat', 'checkin', 'custom', 'setting'])
const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"'

export default route(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
  requirePasscode(req)
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const changes = Array.isArray(body.changes) ? body.changes : []
  const cursor = typeof body.cursor === 'string' ? body.cursor : null
  const pullStarted = Date.now()

  // ---- push ----
  let accepted = 0
  if (changes.length) {
    for (const c of changes) if (!KINDS.has(c.kind) || !c.id || typeof c.updatedAt !== 'number') throw new HttpError(400, 'Bad change record.')
    const byKind = {}
    for (const c of changes) (byKind[c.kind] ??= []).push(c)
    const nowISO = new Date().toISOString()
    const rows = []
    for (const [kind, list] of Object.entries(byKind)) {
      const existing = []
      for (let i = 0; i < list.length; i += 100) {
        const ids = list.slice(i, i + 100).map((c) => q(c.id)).join(',')
        existing.push(...((await sb(`records?select=id,updated_at&kind=eq.${kind}&id=in.(${encodeURIComponent(ids)})`)) || []))
      }
      const known = new Map(existing.map((r) => [r.id, Number(r.updated_at)]))
      for (const c of list) {
        const prev = known.get(String(c.id))
        if (prev !== undefined && prev >= c.updatedAt) continue
        rows.push({ kind, id: String(c.id), data: c.deleted ? null : c.data, deleted: !!c.deleted, updated_at: c.updatedAt, server_at: nowISO })
      }
    }
    for (let i = 0; i < rows.length; i += 200) {
      await sb('records?on_conflict=kind,id', { method: 'POST', body: rows.slice(i, i + 200), prefer: 'resolution=merge-duplicates,return=minimal' })
    }
    accepted = rows.length
  }

  // ---- pull ----
  const out = []
  const PAGE = 500
  for (let offset = 0; ; offset += PAGE) {
    const filter = cursor ? `&server_at=gt.${encodeURIComponent(cursor)}` : ''
    const page = await sb(`records?select=kind,id,data,deleted,updated_at&order=server_at.asc,kind.asc,id.asc&limit=${PAGE}&offset=${offset}${filter}`)
    out.push(...page.map((r) => ({ kind: r.kind, id: r.id, data: r.data, deleted: r.deleted, updatedAt: Number(r.updated_at) })))
    if (page.length < PAGE) break
  }

  // overlap the cursor a little so a write committing during this request is never missed
  send(res, 200, { accepted, changes: out, cursor: new Date(pullStarted - 10_000).toISOString() })
})
