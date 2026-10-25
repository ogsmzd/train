import { describe, it, expect } from 'vitest'
import { suggest, readiness, isDeloadWeek, type HistoryEntry } from './suggest'
import { EX_BY_ID } from '../data/exercises'
import { DAY_BY_ID } from '../data/program'

const item = (day: 'pull' | 'push' | 'legs', ex: string) => DAY_BY_ID[day].sections.flatMap((s) => s.items).find((i) => i.ex === ex)!
const h = (date: string, sets: [number, number][], effort?: any): HistoryEntry => ({ date, ex: '', effort, sets: sets.map(([w, r]) => ({ w, r, done: true })) })
const G = { level: 'green' as const, backRed: false, deload: false }

describe('progression', () => {
  const lp = item('pull', 'lat_pulldown') // 4×6–10, inc 5
  const ex = EX_BY_ID.lat_pulldown
  it('new exercise uses plan start', () => {
    const s = suggest(lp, ex, [], G)
    expect([s.weight, s.target, s.tag]).toEqual([45, 6, 'new'])
  })
  it('adds a rep when not at top', () => {
    const s = suggest(lp, ex, [h('2026-10-12', [[40, 12], [45, 12], [45, 8], [45, 8]])], G)
    expect([s.weight, s.target, s.tag]).toEqual([45, 9, 'hold'])
  })
  it('goes up when every top set hits 10', () => {
    const s = suggest(lp, ex, [h('2026-10-19', [[45, 10], [45, 10], [45, 10], [45, 10]])], G)
    expect([s.weight, s.target, s.tag]).toEqual([50, 6, 'up'])
  })
  it('double jump when it felt easy', () => {
    const s = suggest(lp, ex, [h('2026-10-19', [[45, 10], [45, 10], [45, 10], [45, 10]], 'easy')], G)
    expect(s.weight).toBe(55)
  })
  it('holds when it was a grind', () => {
    const s = suggest(lp, ex, [h('2026-10-19', [[45, 10], [45, 10], [45, 10], [45, 10]], 'grind')], G)
    expect([s.weight, s.tag]).toEqual([45, 'hold'])
  })
  it('resets 10% after 3 stuck sessions', () => {
    const hist = [h('3', [[50, 7], [50, 7], [50, 6], [50, 6]]), h('2', [[50, 7], [50, 7], [50, 6], [50, 6]]), h('1', [[50, 7], [50, 7], [50, 7], [50, 6]])]
    const s = suggest(lp, ex, hist, G)
    expect([s.weight, s.tag]).toEqual([45, 'down'])
  })
  it('amber holds load instead of going up', () => {
    const s = suggest(lp, ex, [h('x', [[45, 10], [45, 10], [45, 10], [45, 10]])], { ...G, level: 'amber' })
    expect([s.weight, s.tag]).toEqual([45, 'hold'])
  })
  it('red day: 10% lighter, one set fewer', () => {
    const s = suggest(lp, ex, [h('x', [[50, 8], [50, 8], [50, 8], [50, 8]])], { ...G, level: 'red' })
    expect([s.weight, s.sets, s.tag]).toEqual([45, 3, 'down'])
  })
  it('deload halves sets', () => {
    const s = suggest(lp, ex, [h('x', [[45, 10], [45, 10], [45, 10], [45, 10]])], { ...G, deload: true })
    expect([s.weight, s.sets, s.tag]).toEqual([45, 2, 'deload'])
  })
})

describe('skips and fixed ranges', () => {
  it('red day skips cut accessories', () => {
    expect(suggest(item('push', 'lateral_raise'), EX_BY_ID.lateral_raise, [], { ...G, level: 'red' }).skip).toBe(true)
  })
  it('amber skips only the first two cuts', () => {
    expect(suggest(item('push', 'cable_fly'), EX_BY_ID.cable_fly, [], { ...G, level: 'amber' }).skip).toBe(true)
    expect(suggest(item('push', 'oh_tri'), EX_BY_ID.oh_tri, [], { ...G, level: 'amber' }).skip).toBe(false)
  })
  it('back red skips spine-loading work', () => {
    expect(suggest(item('legs', 'db_rdl'), EX_BY_ID.db_rdl, [], { ...G, level: 'red', backRed: true }).skip).toBe(true)
  })
  it('fixed range needs two clean sessions before going up', () => {
    const it1 = item('legs', 'farmer')
    const one = suggest(it1, EX_BY_ID.farmer, [h('2', [[24, 30], [24, 30], [24, 30]])], G)
    expect(one.weight).toBe(24)
    const two = suggest(it1, EX_BY_ID.farmer, [h('2', [[24, 30], [24, 30], [24, 30]]), h('1', [[24, 30], [24, 30], [24, 30]])], G)
    expect(two.weight).toBe(26)
  })
})

describe('readiness', () => {
  it('back red forces red', () => expect(readiness({ date: 'd', back: 'red', sleep: 5, energy: 5, soreness: 1 }).level).toBe('red'))
  it('good feel is green', () => expect(readiness({ date: 'd', back: 'green', sleep: 4, energy: 4, soreness: 2 }).level).toBe('green'))
  it('good feel + red WHOOP → amber', () => expect(readiness({ date: 'd', back: 'green', sleep: 4, energy: 4, soreness: 2, whoopRecovery: 20 }).level).toBe('amber'))
  it('stiff back caps at amber', () => expect(readiness({ date: 'd', back: 'amber', sleep: 5, energy: 5, soreness: 1 }).level).toBe('amber'))
  it('deload every 6th week', () => {
    expect(isDeloadWeek('2026-10-12', '2026-11-16')).toBe(true)
    expect(isDeloadWeek('2026-10-12', '2026-11-09')).toBe(false)
  })
})
