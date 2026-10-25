// The coaching brain: readiness from your check-in (+ WHOOP later) and a
// per-exercise suggestion built on double progression.
import type { Checkin, Effort, EntryLog, Level } from '../db'
import type { Item } from '../data/program'
import type { Exercise } from '../data/exercises'

const LV: Record<Level, number> = { red: 0, amber: 1, green: 2 }
const FROM = (n: number): Level => (n >= 2 ? 'green' : n >= 1 ? 'amber' : 'red')

export interface Readiness {
  level: Level
  reasons: string[]
}

export function whoopLevel(recovery: number): Level {
  return recovery >= 67 ? 'green' : recovery >= 34 ? 'amber' : 'red'
}

/** Your own feel leads; WHOOP is a second opinion that can pull it either way. */
export function readiness(c: Checkin): Readiness {
  const reasons: string[] = []
  if (c.back === 'red') return { level: 'red', reasons: ['Back flagged red — no spine loading today'] }
  const subjScore = (c.sleep + c.energy + (6 - c.soreness)) / 3 // 1–5
  const subj: Level = subjScore >= 3.5 ? 'green' : subjScore >= 2.5 ? 'amber' : 'red'
  reasons.push(`Your check-in: ${subj}`)
  let n = LV[subj]
  if (typeof c.whoopRecovery === 'number') {
    const w = whoopLevel(c.whoopRecovery)
    reasons.push(`WHOOP recovery ${c.whoopRecovery}%: ${w}`)
    n = Math.round((LV[subj] + LV[w]) / 2)
  }
  if (c.back === 'amber' && n > 1) {
    n = 1
    reasons.push('Back stiff — capped at amber')
  }
  return { level: FROM(n), reasons }
}

export interface HistoryEntry extends EntryLog {
  date: string
}

export interface Suggestion {
  sets: number
  weight: number // kg, 0 = bodyweight
  target: number // reps / seconds / metres to aim for on each set
  skip: boolean
  tag: 'new' | 'up' | 'hold' | 'down' | 'deload' | 'skip'
  reason: string
  last?: string
}

export interface Ctx {
  level: Level
  backRed: boolean
  deload: boolean
}

const roundTo = (w: number, inc: number) => (inc > 0 ? Math.round(w / inc) * inc : w)
const floorTo = (w: number, inc: number) => (inc > 0 ? Math.floor(w / inc) * inc : w)
const fmt = (w: number) => (Number.isInteger(w) ? String(w) : w.toFixed(1))

interface Perf {
  top: number
  topReps: number[]
  success: boolean // every set at top load hit the top of the range
  inRange: boolean
  best: number
  effort?: Effort
  date: string
}

function perf(h: HistoryEntry, item: Item): Perf | null {
  const sets = h.sets.filter((s) => s.done && s.r != null && s.r > 0)
  if (!sets.length) return null
  const top = Math.max(...sets.map((s) => s.w ?? 0))
  const topReps = sets.filter((s) => (s.w ?? 0) === top).map((s) => s.r as number)
  const enough = topReps.length >= Math.ceil(item.sets / 2)
  return {
    top,
    topReps,
    success: enough && topReps.every((r) => r >= item.max),
    inRange: topReps.every((r) => r >= item.min),
    best: Math.max(...topReps),
    effort: h.effort,
    date: h.date,
  }
}

export function describeLast(h: HistoryEntry, ex: Exercise) {
  const done = h.sets.filter((s) => s.done && s.r != null)
  if (!done.length) return undefined
  const u = ex.unit.startsWith('s') ? 's' : ex.unit === 'm' ? 'm' : ''
  return done.map((s) => (s.w ? `${fmt(s.w)}×${s.r}${u}` : `${s.r}${u}`)).join(' · ')
}

/**
 * history: this exercise's previous sessions, most recent first.
 */
export function suggest(item: Item, ex: Exercise, history: HistoryEntry[], ctx: Ctx): Suggestion {
  const inc = ex.inc
  let sets = item.sets
  const last = history[0] ? describeLast(history[0], ex) : undefined

  // --- hard skips first ---
  if (ctx.backRed && item.spine) return { sets: 0, weight: 0, target: 0, skip: true, tag: 'skip', reason: 'Skipped: back flagged red', last }
  if (ctx.level === 'red' && item.cut) return { sets: 0, weight: 0, target: 0, skip: true, tag: 'skip', reason: 'Skipped on a red day', last }
  if (ctx.level === 'amber' && item.cut && item.cut <= 2) return { sets: 0, weight: 0, target: 0, skip: true, tag: 'skip', reason: 'Skipped on an amber day', last }

  const perfs = history.map((h) => perf(h, item)).filter((p): p is Perf => !!p)

  // --- base progression ---
  let weight: number
  let target: number
  let tag: Suggestion['tag']
  let reason: string

  if (!perfs.length) {
    weight = item.start
    target = item.min
    tag = 'new'
    reason = item.start ? 'Starting load from your plan' : 'First time — find a solid working effort'
  } else {
    const p = perfs[0]
    weight = p.top
    const loaded = inc > 0
    const fixed = item.min === item.max
    const sameLoadStreak = perfs.filter((q, i) => perfs.slice(0, i + 1).every((x) => x.top === p.top))
    const prevSuccess = perfs[1] && perfs[1].top === p.top && perfs[1].success

    if (p.success && loaded && (!fixed || prevSuccess) && p.effort !== 'grind') {
      const jump = p.effort === 'easy' && !fixed ? inc * 2 : inc
      weight = roundTo(p.top + jump, inc)
      target = item.min
      tag = 'up'
      reason = p.effort === 'easy' ? `Top of range and it felt easy → +${fmt(jump)} kg` : `Hit ${item.max} on every set → +${fmt(jump)} kg`
    } else if (p.success && loaded && p.effort === 'grind') {
      target = item.max
      tag = 'hold'
      reason = 'Hit the reps but it was a grind — own it once more'
    } else if (p.success && loaded && fixed) {
      target = item.max
      tag = 'hold'
      reason = 'One more clean session at this load, then it goes up'
    } else if (p.success && !loaded) {
      target = item.max
      tag = 'hold'
      reason = 'Top of the range — slow the tempo to make it harder'
    } else {
      // not yet at top of range
      const stalled =
        loaded &&
        sameLoadStreak.length >= 3 &&
        !sameLoadStreak.slice(0, 3).some((q) => q.success) &&
        sameLoadStreak[0].best <= sameLoadStreak[2].best
      if (stalled) {
        weight = floorTo(p.top * 0.9, inc)
        target = item.max
        tag = 'down'
        reason = 'Stuck 3 sessions — reset 10% lighter and build back past it'
      } else {
        const lowest = Math.min(...p.topReps)
        target = Math.min(item.max, Math.max(item.min, lowest + 1))
        tag = 'hold'
        reason = p.inRange ? `Same load — add a rep (aim ${target})` : `Same load — get every set to ${item.min}+`
      }
    }
  }

  // --- readiness & deload adjustments ---
  if (ctx.deload) {
    sets = Math.ceil(sets / 2)
    if (tag === 'up') weight = perfs[0]?.top ?? weight
    return { sets, weight, target: tag === 'up' ? item.min : target, skip: false, tag: 'deload', reason: 'Deload week — half the sets, no new loads', last }
  }
  if (ctx.level === 'amber' && tag === 'up') {
    weight = perfs[0].top
    target = item.max
    tag = 'hold'
    reason = 'Amber day — hold the load, repeat the top of the range'
  }
  if (ctx.level === 'red') {
    sets = Math.max(1, sets - 1)
    const base = perfs[0]?.top ?? weight
    weight = inc > 0 ? floorTo(base * 0.9, inc) : base
    target = item.min
    tag = 'down'
    reason = 'Red day — 10% lighter, one set fewer. Moving is the win.'
  }

  return { sets, weight, target, skip: false, tag, reason, last }
}

/** Week index since programme start; every 6th week is a deload. */
export function isDeloadWeek(start: string, today: string) {
  const ms = new Date(today + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()
  const week = Math.floor(ms / (7 * 86400000))
  return week >= 0 && week % 6 === 5
}
