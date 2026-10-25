import { it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { hevyToWorkouts, parseHevyDate } from './hevy'
import { suggest } from '../engine/suggest'
import { DAY_BY_ID } from '../data/program'
import { EX_BY_ID } from '../data/exercises'

it('parses hevy dates', () => {
  const d = parseHevyDate('17 Oct 2026, 10:21')!
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 17, 10])
})

const F = process.env.HEVY_CSV
it.runIf(F && existsSync(F))('imports the real export and drives suggestions', () => {
  const res = hevyToWorkouts(readFileSync(F!, 'utf8'))
  console.log('workouts', res.workouts.length, 'mapped sets', res.mapped, 'unmapped', res.unmapped.length)
  expect(res.workouts.length).toBe(31)
  const hist = (ex: string) =>
    res.workouts.slice().reverse().flatMap((w) => w.entries.filter((e) => e.ex === ex).map((e) => ({ ...e, date: w.date })))
  for (const [day, ex] of [['push', 'chest_press'], ['pull', 'lat_pulldown'], ['legs', 'leg_press'], ['push', 'incline_db']] as const) {
    const item = DAY_BY_ID[day].sections.flatMap((s) => s.items).find((i) => i.ex === ex)!
    const s = suggest(item, EX_BY_ID[ex], hist(ex), { level: 'green', backRed: false, deload: false })
    console.log(ex, '| last:', s.last, '| next:', s.weight, 'kg ×', s.target, '|', s.reason)
  }
})
