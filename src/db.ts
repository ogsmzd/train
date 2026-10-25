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
}

export interface Checkin {
  date: string // YYYY-MM-DD (primary key)
  back: Level
  sleep: number // 1–5
  soreness: number // 1–5 (5 = very sore)
  energy: number // 1–5
  whoopRecovery?: number // 0–100, filled by the WHOOP link (Phase 2)
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
}

export interface CustomExercise {
  id: string
  name: string
}

export interface Setting {
  key: string
  value: unknown
}

class TrainDB extends Dexie {
  workouts!: Table<Workout, number>
  checkins!: Table<Checkin, string>
  mat!: Table<MatSession, number>
  customExercises!: Table<CustomExercise, string>
  settings!: Table<Setting, string>
  constructor(name = 'train') {
    super(name)
    this.version(1).stores({
      workouts: '++id, date, dayId, source',
      checkins: 'date',
      mat: '++id, date, source, whoopId',
      customExercises: 'id',
      settings: 'key',
    })
  }
}

export const db = new TrainDB()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key)
  return (s?.value as T) ?? fallback
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value })

export function todayISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
