import { db, getSetting, todayISO, type Checkin, type EntryLog, type Workout } from '../db'
import { DAY_BY_ID, type Day } from '../data/program'
import { EX_BY_ID, type Exercise } from '../data/exercises'
import { isDeloadWeek, readiness, suggest, type HistoryEntry } from '../engine/suggest'

export const DEFAULT_PROGRAM_START = '2026-10-12'

export async function exerciseHistory(exId: string, excludeId?: number): Promise<HistoryEntry[]> {
  const all = await db.workouts.orderBy('date').reverse().toArray()
  const out: HistoryEntry[] = []
  for (const w of all.sort((a, b) => b.startedAt - a.startedAt)) {
    if (w.id === excludeId || !w.endedAt && w.source === 'app') continue
    for (const e of w.entries) if (e.ex === exId && !e.skipped && e.sets.some((s) => s.done)) out.push({ ...e, date: w.date })
  }
  return out
}

export function exerciseOf(id: string, custom?: Record<string, string>): Exercise {
  return EX_BY_ID[id] ?? { id, name: custom?.[id] ?? id.replace(/^h_/, '').replace(/_/g, ' '), cues: [], unit: 'reps', inc: 2.5, custom: true }
}

export async function startWorkout(dayId: Day['id'], checkin: Checkin | undefined): Promise<number> {
  const day = DAY_BY_ID[dayId]
  const r = checkin ? readiness(checkin) : { level: 'green' as const, reasons: [] }
  const start = await getSetting('programStart', DEFAULT_PROGRAM_START)
  const ctx = { level: r.level, backRed: checkin?.back === 'red', deload: isDeloadWeek(start, todayISO()) }
  const entries: EntryLog[] = []
  for (const sec of day.sections) {
    for (const item of sec.items) {
      const ex = EX_BY_ID[item.ex]
      const hist = item.role === 'warmup' ? [] : await exerciseHistory(item.ex)
      const s = item.role === 'warmup' ? { sets: item.sets, weight: 0, target: item.min, skip: false, tag: 'warmup', reason: '', last: undefined } : suggest(item, ex, hist, ctx)
      const n = s.skip ? item.sets : s.sets
      entries.push({
        ex: item.ex,
        skipped: s.skip,
        sets: Array.from({ length: n }, () => ({ w: ex.inc > 0 || s.weight ? s.weight : null, r: s.target, done: false })),
        plan: { sets: s.sets, weight: s.weight, target: s.target, min: item.min, max: item.max, rest: item.rest, reason: s.reason, tag: s.tag, last: s.last, section: sec.label, role: item.role },
      })
    }
  }
  const w: Workout = { date: todayISO(), startedAt: Date.now(), dayId, title: day.name, entries, readiness: r.level, source: 'app' }
  return db.workouts.add(w)
}

export async function activeWorkout() {
  return db.workouts.filter((w) => w.source === 'app' && !w.endedAt).first()
}

/** Epley estimated 1RM */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30))

export function weekRange(d = new Date()) {
  const day = (d.getDay() + 6) % 7 // Monday = 0
  const mon = new Date(d)
  mon.setDate(d.getDate() - day)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return [todayISO(mon), todayISO(sun)] as const
}
