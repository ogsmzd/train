// Import a Hevy "Export Workouts" CSV into Train workouts.
import { EXERCISES } from '../data/exercises'
import { HEVY_DAY } from '../data/program'
import type { CustomExercise, Workout } from '../db'

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** Hevy writes e.g. "17 Oct 2026, 10:21". Falls back to Date parsing. */
export function parseHevyDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2}) (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2})/)
  if (m) return new Date(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1], +m[4], +m[5])
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const slug = (s: string) => 'h_' + s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export interface ImportResult {
  workouts: Workout[]
  custom: CustomExercise[]
  mapped: number
  unmapped: string[]
}

export function hevyToWorkouts(text: string): ImportResult {
  const rows = parseCSV(text.replace(/^﻿/, ''))
  const head = rows[0].map((h) => h.trim())
  const col = (name: string) => head.indexOf(name)
  const need = ['title', 'start_time', 'exercise_title', 'weight_kg', 'reps']
  for (const n of need) if (col(n) < 0) throw new Error(`This doesn't look like a Hevy export (missing "${n}")`)

  const alias = new Map<string, string>()
  for (const e of EXERCISES) for (const h of e.hevy ?? []) alias.set(h.toLowerCase(), e.id)

  const byKey = new Map<string, Workout>()
  const custom = new Map<string, CustomExercise>()
  const unmapped = new Set<string>()
  let mapped = 0

  for (const row of rows.slice(1)) {
    const get = (n: string) => (col(n) >= 0 ? (row[col(n)] ?? '').trim() : '')
    const title = get('title')
    const start = get('start_time')
    const d = parseHevyDate(start)
    if (!d) continue
    const key = title + '|' + start
    let w = byKey.get(key)
    if (!w) {
      const end = parseHevyDate(get('end_time'))
      const p = (n: number) => String(n).padStart(2, '0')
      w = {
        date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        startedAt: d.getTime(),
        endedAt: end?.getTime(),
        dayId: HEVY_DAY[title],
        title,
        entries: [],
        source: 'hevy',
      }
      byKey.set(key, w)
    }
    const exTitle = get('exercise_title')
    let exId = alias.get(exTitle.toLowerCase())
    if (exId) mapped++
    else {
      exId = slug(exTitle)
      custom.set(exId, { id: exId, name: exTitle })
      unmapped.add(exTitle)
    }
    let entry = w.entries.find((e) => e.ex === exId)
    if (!entry) {
      entry = { ex: exId, sets: [] }
      w.entries.push(entry)
    }
    const kg = parseFloat(get('weight_kg'))
    const reps = parseFloat(get('reps'))
    const secs = parseFloat(get('duration_seconds'))
    const km = parseFloat(get('distance_km'))
    const r = !isNaN(reps) ? reps : !isNaN(secs) ? secs : !isNaN(km) ? km * 1000 : null
    if (get('set_type') === 'warmup') continue
    entry.sets.push({ w: isNaN(kg) ? null : kg, r, done: true })
  }

  return {
    workouts: [...byKey.values()].sort((a, b) => a.startedAt - b.startedAt),
    custom: [...custom.values()],
    mapped,
    unmapped: [...unmapped],
  }
}
