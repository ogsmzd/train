import Dexie, { type Table } from 'dexie'
import type { MatType } from './data/program'

export type Level = 'green' | 'amber' | 'red'
export type Effort = 'easy' | 'solid' | 'grind'

export interface SetLog {
  w: number | null // kg (null = bodyweight / not loaded)
  r: number | null // reps, seconds or metres depending on the exercise unit
  done: boolean
}

export interface PlanSnapshot {
  sets: number
  weight: number
  target: number
  min: number
  max: number
  rest: number
  reason: string
  tag: string
  last?: string
  section: string
  role: string
}

export interface EntryLog {
  ex: string
  sets: SetLog[]
  effort?: Effort // optional one-tap "how did that feel"
  skipped?: boolean
  plan?: PlanSnapshot // what the app suggested when the session started
}

export interface Workout {
  id?: number
  date: string // YYYY-MM-DD
  startedAt: number
  endedAt?: number
  dayId?: string // pull | push | legs
  title: string
  entries: EntryLog[]
  feel?: number // 1–5, end of session
  note?: string
  readiness?: Level
  source: 'app' | 'hevy'
  uid?: string // stable id across devices (cloud sync)
  updatedAt?: number
}

export interface Checkin {
  date: string // YYYY-MM-DD (primary key)
  back: Level
  sleep: number // 1–5
  soreness: number // 1–5 (5 = very sore)
  energy: number // 1–5
  whoopRecovery?: number // 0–100, filled by the WHOOP link
  updatedAt?: number
}

export interface MatSession {
  id?: number
  date: string
  type: MatType
  label: string
  minutes: number
  intensity?: number // RPE 1–10
  feel?: number // 1–5 — your own rating, separate from WHOOP strain
  note?: string
  source: 'manual' | 'whoop'
  whoopId?: string
  strain?: number
  avgHr?: number
  time?: string // HH:MM start, when known
  uid?: string
  updatedAt?: number
}

export interface CustomExercise {
  id: string
  name: string
  updatedAt?: number
}

export interface Setting {
  key: string
  value: unknown
  updatedAt?: number
}

/** A WHOOP morning: one row per local date, refreshed from WHOOP (not synced — WHOOP is the source). */
export interface WhoopDay {
  date: string
  recovery: number
  hrv: number | null
  rhr: number | null
  sleepPerf: number | null
}

export interface Tombstone {
  key: string // `${kind}:${id}`
  kind: string
  id: string
  at: number
}

class TrainDB extends Dexie {
  workouts!: Table<Workout, number>
  checkins!: Table<Checkin, string>
  mat!: Table<MatSession, number>
  customExercises!: Table<CustomExercise, string>
  settings!: Table<Setting, string>
  whoop!: Table<WhoopDay, string>
  tombstones!: Table<Tombstone, string>
  constructor(name = 'train') {
    super(name)
    this.version(1).stores({
      workouts: '++id, date, dayId, source',
      checkins: 'date',
      mat: '++id, date, source, whoopId',
      customExercises: 'id',
      settings: 'key',
    })
    this.version(2)
      .stores({
        workouts: '++id, date, dayId, source, &uid, updatedAt',
        checkins: 'date, updatedAt',
        mat: '++id, date, source, whoopId, &uid, updatedAt',
        customExercises: 'id, updatedAt',
        settings: 'key, updatedAt',
        whoop: 'date',
        tombstones: 'key',
      })
      .upgrade(async (tx) => {
        const now = Date.now()
        await tx.table('workouts').toCollection().modify((w: Workout) => {
          w.uid ??= uuid()
          w.updatedAt ??= now
        })
        await tx.table('mat').toCollection().modify((m: MatSession) => {
          m.uid ??= uuid()
          m.updatedAt ??= now
        })
        for (const t of ['checkins', 'customExercises', 'settings']) await tx.table(t).toCollection().modify((r: { updatedAt?: number }) => void (r.updatedAt ??= now))
      })
  }
}

export function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export const db = new TrainDB()

// ---------- change tracking for cloud sync ----------
// While remote changes are being applied, writes must not count as local edits.
export const syncState = { applyingRemote: false, onLocalChange: () => {} }
const SYNCED = ['workouts', 'checkins', 'mat', 'customExercises', 'settings'] as const
const LOCAL_ONLY_SETTINGS = new Set<string>([])
for (const name of SYNCED) {
  const t = db.table(name)
  t.hook('creating', (_k, obj: any) => {
    if ((name === 'workouts' || name === 'mat') && !obj.uid) obj.uid = uuid()
    if (syncState.applyingRemote) {
      obj.updatedAt ??= Date.now()
      return
    }
    obj.updatedAt = Date.now()
    if (!(name === 'settings' && LOCAL_ONLY_SETTINGS.has(obj.key))) queueMicrotask(syncState.onLocalChange)
  })
  t.hook('updating', (mods: any) => {
    if (syncState.applyingRemote) return
    queueMicrotask(syncState.onLocalChange)
    if ('updatedAt' in mods) return
    return { updatedAt: Date.now() }
  })
}

/** Tombstone every synced record (used before wiping or replacing all data). */
export async function tombstoneAll() {
  const at = Date.now()
  const stones: Tombstone[] = []
  for (const w of await db.workouts.toArray()) if (w.uid) stones.push({ key: `workout:${w.uid}`, kind: 'workout', id: w.uid, at })
  for (const m of await db.mat.toArray()) if (m.uid) stones.push({ key: `mat:${m.uid}`, kind: 'mat', id: m.uid, at })
  for (const c of await db.checkins.toArray()) stones.push({ key: `checkin:${c.date}`, kind: 'checkin', id: c.date, at })
  for (const c of await db.customExercises.toArray()) stones.push({ key: `custom:${c.id}`, kind: 'custom', id: c.id, at })
  for (const st of await db.settings.toArray()) stones.push({ key: `setting:${st.key}`, kind: 'setting', id: st.key, at })
  await db.tombstones.bulkPut(stones)
}

/** Delete from a synced table and leave a tombstone so other devices delete it too. */
export async function deleteSynced(table: 'workouts' | 'mat', localId: number) {
  const row = await db.table(table).get(localId)
  await db.table(table).delete(localId)
  if (row?.uid) {
    const kind = table === 'workouts' ? 'workout' : 'mat'
    await db.tombstones.put({ key: `${kind}:${row.uid}`, kind, id: row.uid, at: Date.now() })
    syncState.onLocalChange()
  }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key)
  return (s?.value as T) ?? fallback
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value })

export function todayISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
