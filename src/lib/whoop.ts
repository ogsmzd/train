// WHOOP: recovery into the morning readiness, workouts into the mat log.
import { db, todayISO, type MatSession } from '../db'
import { MAT_SCHEDULE, type MatSlot, type MatType } from '../data/program'
import { api } from './sync'

interface WhoopRecovery {
  at: string
  tz: string | null
  recovery: number
  hrv: number | null
  rhr: number | null
  sleepPerf: number | null
}
interface WhoopWorkout {
  id: string
  start: string
  end: string
  tz: string | null
  sport: string
  strain: number | null
  avgHr: number | null
}
interface WhoopData {
  connected: boolean
  recoveries?: WhoopRecovery[]
  workouts?: WhoopWorkout[]
}

const LS_KEY = 'train.whoop.lastFetch'
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
}
export const lastWhoopFetch = () => Number(ls.get(LS_KEY)) || null

/** Local wall-clock date and HH:MM of an instant, using WHOOP's recorded offset (e.g. "+01:00"). */
export function localParts(iso: string, tz: string | null) {
  const d = new Date(iso)
  if (tz && /^[+-]\d{2}:\d{2}$/.test(tz)) {
    const sign = tz[0] === '-' ? -1 : 1
    const mins = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(4, 6)))
    const shifted = new Date(d.getTime() + mins * 60000)
    const p = (n: number) => String(n).padStart(2, '0')
    return { date: `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`, time: `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`, weekday: shifted.getUTCDay() }
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: todayISO(d), time: `${p(d.getHours())}:${p(d.getMinutes())}`, weekday: d.getDay() }
}

const COMBAT = /jiu|bjj|brazilian|grappl|judo|wrestl|martial|mma|sambo/i

/** Which mat-log entry a WHOOP workout becomes, or null to ignore it (gym work is logged in the app). */
export function classify(w: Pick<WhoopWorkout, 'sport' | 'start' | 'tz'>): { type: MatType; label: string; time: string; date: string } | null {
  const { date, time, weekday } = localParts(w.start, w.tz)
  const sport = w.sport || ''
  if (COMBAT.test(sport)) {
    // match to the closest scheduled class that day (within 75 min)
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    let best: MatSlot | null = null
    let gap = 76
    for (const s of MAT_SCHEDULE[weekday] ?? []) {
      const g = Math.abs(toMin(s.time) - toMin(time))
      if (g < gap) {
        gap = g
        best = s
      }
    }
    if (best) return { type: best.type, label: best.label, time, date }
    const type: MatType = /judo/i.test(sport) ? 'Judo' : /jiu|bjj|brazilian/i.test(sport) ? 'BJJ group' : 'Other'
    return { type, label: type === 'Other' ? sport : type, time, date }
  }
  if (/run/i.test(sport)) return { type: 'Run', label: 'Run', time, date }
  if (/padel|tennis|squash|pickle/i.test(sport)) return { type: 'Padel', label: 'Padel', time, date }
  return null
}

export async function connectWhoop() {
  const { url } = await api<{ url: string }>('/api/whoop/start', { method: 'POST' })
  location.href = url
}

export async function disconnectWhoop() {
  await api('/api/whoop/disconnect', { method: 'POST' })
}

/** Pull recent WHOOP data and fold it into the app. Returns false when WHOOP isn't connected. */
export async function refreshWhoop(days = 10): Promise<{ connected: boolean; added: number }> {
  const d = await api<WhoopData>(`/api/whoop/data?days=${days}`)
  if (!d.connected) return { connected: false, added: 0 }

  // recovery → one row per local morning; also stamp today's check-in if it exists
  for (const r of d.recoveries ?? []) {
    const { date } = localParts(r.at, r.tz)
    await db.whoop.put({ date, recovery: r.recovery, hrv: r.hrv, rhr: r.rhr, sleepPerf: r.sleepPerf })
    const c = await db.checkins.get(date)
    if (c && c.whoopRecovery !== r.recovery) await db.checkins.update(date, { whoopRecovery: r.recovery })
  }

  // workouts → mat log
  let added = 0
  for (const w of d.workouts ?? []) {
    const k = classify(w)
    if (!k) continue
    const minutes = Math.max(1, Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000))
    const whoopBits = { whoopId: w.id, strain: w.strain ?? undefined, avgHr: w.avgHr != null ? Math.round(w.avgHr) : undefined, time: k.time }
    const existing = await db.mat.where('whoopId').equals(w.id).first()
    if (existing) {
      if (existing.strain !== whoopBits.strain || existing.avgHr !== whoopBits.avgHr) await db.mat.update(existing.id!, whoopBits)
      continue
    }
    // a session you already logged by hand for that slot: attach WHOOP's numbers to it
    const manual = (await db.mat.where('date').equals(k.date).toArray()).find((m) => !m.whoopId && (m.label === k.label || m.type === k.type))
    if (manual) {
      await db.mat.update(manual.id!, { ...whoopBits, minutes: manual.minutes || minutes })
      continue
    }
    // deterministic id so two devices pulling the same WHOOP workout don't create duplicates
    const rec: MatSession = { uid: `whoop-${w.id}`, date: k.date, type: k.type, label: k.label, minutes, source: 'whoop', ...whoopBits }
    await db.mat.add(rec)
    added++
  }
  ls.set(LS_KEY, String(Date.now()))
  return { connected: true, added }
}
