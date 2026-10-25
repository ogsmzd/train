// Cloud sync: offline-first, last write wins per record.
// Local edits are stamped with updatedAt by Dexie hooks (db.ts); this file pushes
// anything newer than the last push, pulls what the server has seen since our cursor,
// and applies remote records that are newer than the local copy.
import { db, syncState, type CustomExercise, type MatSession, type Setting, type Checkin, type Workout } from '../db'

const LS = {
  passcode: 'train.passcode',
  cursor: 'train.sync.cursor',
  lastPush: 'train.sync.lastPush',
  lastOk: 'train.sync.lastOk',
  lastError: 'train.sync.lastError',
}
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {}
  },
}

export const getPasscode = () => ls.get(LS.passcode)
export function setPasscode(p: string | null) {
  ls.set(LS.passcode, p)
  if (!p) {
    ls.set(LS.cursor, null)
    ls.set(LS.lastPush, null)
  }
  emit()
}

export interface SyncStatus {
  enabled: boolean
  running: boolean
  lastOk: number | null
  lastError: string | null
}
let running = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())
export function subscribeSync(f: () => void) {
  listeners.add(f)
  return () => void listeners.delete(f)
}
let snapshot: SyncStatus | null = null
export function getSyncStatus(): SyncStatus {
  const next = { enabled: !!getPasscode(), running, lastOk: Number(ls.get(LS.lastOk)) || null, lastError: ls.get(LS.lastError) }
  if (snapshot && JSON.stringify(snapshot) === JSON.stringify(next)) return snapshot
  return (snapshot = next)
}

export async function api<T>(path: string, init: RequestInit = {}, passcode = getPasscode()): Promise<T> {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', 'x-passcode': passcode ?? '', ...(init.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j as T
}

type Kind = 'workout' | 'mat' | 'checkin' | 'custom' | 'setting'
interface Change {
  kind: Kind
  id: string
  data?: unknown
  updatedAt: number
  deleted?: boolean
}

const strip = <T extends { id?: number }>(r: T) => {
  const { id: _id, ...rest } = r
  return rest
}

async function collect(since: number): Promise<Change[]> {
  const out: Change[] = []
  const newer = <T extends { updatedAt?: number }>(rows: T[]) => rows.filter((r) => (r.updatedAt ?? 0) > since)
  for (const w of newer(await db.workouts.toArray())) out.push({ kind: 'workout', id: w.uid!, data: strip(w), updatedAt: w.updatedAt! })
  for (const m of newer(await db.mat.toArray())) out.push({ kind: 'mat', id: m.uid!, data: strip(m), updatedAt: m.updatedAt! })
  for (const c of newer(await db.checkins.toArray())) out.push({ kind: 'checkin', id: c.date, data: c, updatedAt: c.updatedAt! })
  for (const c of newer(await db.customExercises.toArray())) out.push({ kind: 'custom', id: c.id, data: c, updatedAt: c.updatedAt! })
  for (const s of newer(await db.settings.toArray())) out.push({ kind: 'setting', id: s.key, data: s, updatedAt: s.updatedAt! })
  const live = new Set(out.map((c) => `${c.kind}:${c.id}`))
  for (const t of await db.tombstones.toArray()) {
    if (t.at > since && !live.has(t.key)) out.push({ kind: t.kind as Kind, id: t.id, deleted: true, updatedAt: t.at })
  }
  return out
}

async function apply(changes: Change[]) {
  if (!changes.length) return
  syncState.applyingRemote = true
  try {
    await db.transaction('rw', [db.workouts, db.mat, db.checkins, db.customExercises, db.settings, db.tombstones], async () => {
      for (const c of changes) {
        if (c.kind === 'workout' || c.kind === 'mat') {
          const table = c.kind === 'workout' ? db.workouts : db.mat
          const local = (await (table as any).where('uid').equals(c.id).first()) as (Workout | MatSession) | undefined
          if (c.deleted) {
            if (local && (local.updatedAt ?? 0) <= c.updatedAt) await table.delete(local.id!)
            continue
          }
          if (local && (local.updatedAt ?? 0) >= c.updatedAt) continue
          const stone = await db.tombstones.get(`${c.kind}:${c.id}`)
          if (stone && stone.at >= c.updatedAt) continue
          await (table as any).put({ ...(c.data as object), uid: c.id, updatedAt: c.updatedAt, ...(local ? { id: local.id } : {}) })
        } else {
          const table = c.kind === 'checkin' ? db.checkins : c.kind === 'custom' ? db.customExercises : db.settings
          const local = (await (table as any).get(c.id)) as (Checkin | CustomExercise | Setting) | undefined
          if (c.deleted) {
            if (local && (local.updatedAt ?? 0) <= c.updatedAt) await (table as any).delete(c.id)
            continue
          }
          if (local && (local.updatedAt ?? 0) >= c.updatedAt) continue
          await (table as any).put({ ...(c.data as object), updatedAt: c.updatedAt })
        }
      }
    })
  } finally {
    syncState.applyingRemote = false
  }
}

/** Push local changes, pull remote ones. Safe to call often; overlapping calls are coalesced. */
export async function syncNow(): Promise<void> {
  const passcode = getPasscode()
  if (!passcode || running || !navigator.onLine) return
  running = true
  emit()
  try {
    const since = Number(ls.get(LS.lastPush)) || 0
    const startedAt = Date.now()
    const changes = await collect(since)
    const res = await api<{ changes: Change[]; cursor: string }>('/api/sync', { method: 'POST', body: JSON.stringify({ cursor: ls.get(LS.cursor), changes }) }, passcode)
    await apply(res.changes)
    ls.set(LS.lastPush, String(startedAt))
    ls.set(LS.cursor, res.cursor)
    ls.set(LS.lastOk, String(Date.now()))
    ls.set(LS.lastError, null)
    // old tombstones are no longer needed once the server has them
    await db.tombstones.where('key').noneOf([]).filter((t) => t.at < startedAt - 30 * 86400000).delete()
  } catch (e) {
    ls.set(LS.lastError, (e as Error).message)
  } finally {
    running = false
    emit()
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
export function scheduleSync(ms = 2500) {
  if (!getPasscode()) return
  clearTimeout(timer)
  timer = setTimeout(syncNow, ms)
}

/** Call once at start-up. */
export function startAutoSync() {
  syncState.onLocalChange = () => scheduleSync()
  syncNow()
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow())
  window.addEventListener('online', () => syncNow())
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 5 * 60 * 1000)
}
