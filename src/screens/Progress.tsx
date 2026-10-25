import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type MatSession, type Workout } from '../db'
import { PROGRAM } from '../data/program'
import { e1rm, exerciseOf } from '../lib/session'
import { describeLast } from '../engine/suggest'
import { Card, fmtKg, Label, Seg, Sheet } from '../ui'

type Row = { kind: 'gym'; w: Workout } | { kind: 'mat'; m: MatSession }

export default function Progress() {
  const [tab, setTab] = useState<'history' | 'lifts'>('history')
  const [open, setOpen] = useState<Workout | null>(null)
  const custom = useLiveQuery(() => db.customExercises.toArray()) ?? []
  const names = Object.fromEntries(custom.map((c) => [c.id, c.name]))
  const data = useLiveQuery(async () => {
    const ws = (await db.workouts.toArray()).filter((w) => w.endedAt || w.source === 'hevy')
    const ms = await db.mat.toArray()
    return { ws, ms }
  })
  if (!data) return null

  const rows: Row[] = [...data.ws.map((w) => ({ kind: 'gym' as const, w })), ...data.ms.map((m) => ({ kind: 'mat' as const, m }))].sort((a, b) => {
    const da = a.kind === 'gym' ? a.w.date : a.m.date
    const dbb = b.kind === 'gym' ? b.w.date : b.m.date
    return dbb.localeCompare(da)
  })

  // per-exercise bests for the programme's main lifts
  const mainLifts = PROGRAM.flatMap((d) => d.sections.flatMap((s) => s.items.filter((i) => i.role === 'core' && exerciseOf(i.ex).inc > 0).map((i) => ({ ex: i.ex, day: d.name }))))
  const lifts = mainLifts.map(({ ex, day }) => {
    const sessions = data.ws
      .filter((w) => w.entries.some((e) => e.ex === ex))
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((w) => {
        const e = w.entries.find((x) => x.ex === ex)!
        const est = Math.max(0, ...e.sets.filter((s) => s.done && s.w && s.r).map((s) => e1rm(s.w!, s.r!)))
        return { date: w.date, est }
      })
      .filter((s) => s.est > 0)
    return { ex, day, sessions }
  })

  return (
    <div className="space-y-3">
      <h1 className="num pt-1 text-[52px] uppercase">Progress</h1>
      <Seg
        name="View"
        value={tab}
        onChange={setTab}
        options={[
          { v: 'history', label: 'History' },
          { v: 'lifts', label: 'Main lifts' },
        ]}
      />
      {tab === 'history' ? (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
          {rows.length === 0 && <div className="p-4 text-mute">Nothing logged yet. Log a session from Today, or import your Hevy history under More.</div>}
          {rows.slice(0, 150).map((r) =>
            r.kind === 'gym' ? (
              <button key={'w' + r.w.id} className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(r.w)}>
                <div>
                  <div className="text-[15px] font-medium">{r.w.title}</div>
                  <div className="text-xs text-mute">
                    {r.w.date} · {r.w.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)} sets{r.w.source === 'hevy' ? ' · Hevy' : ''}
                  </div>
                </div>
                {r.w.feel ? <span className="text-sm text-mute">felt {r.w.feel}/5</span> : null}
              </button>
            ) : (
              <div key={'m' + r.m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[15px] font-medium">{r.m.label}</div>
                  <div className="text-xs text-mute">
                    {r.m.date} · {r.m.minutes} min{r.m.intensity ? ` · RPE ${r.m.intensity}` : ''}
                  </div>
                </div>
                {r.m.feel ? <span className="text-sm text-mute">felt {r.m.feel}/5</span> : null}
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {lifts.map((l) => (
            <Card key={l.ex}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[16px] font-semibold">{exerciseOf(l.ex).name}</div>
                <div className="eyebrow">{l.day}</div>
              </div>
              {l.sessions.length ? (
                <div className="mt-2 flex items-end gap-4">
                  <div className="shrink-0">
                    <div className="num text-[40px]">
                      {l.sessions[l.sessions.length - 1].est.toFixed(0)}
                      <span className="ml-1 font-sans text-[13px] font-bold text-mute">KG</span>
                    </div>
                    <div className="text-[12px] text-mute">est. max · best {Math.max(...l.sessions.map((s) => s.est)).toFixed(0)}</div>
                  </div>
                  <Spark values={l.sessions.map((s) => s.est)} />
                </div>
              ) : (
                <div className="mt-1 text-[14px] text-mute">No sessions logged yet.</div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${open.title} · ${open.date}` : ''}>
        {open && (
          <div className="space-y-3 pb-4">
            {open.note && <p className="text-[14px] text-mute">“{open.note}”</p>}
            {open.entries
              .filter((e) => e.sets.some((s) => s.done))
              .map((e, i) => {
                const ex = exerciseOf(e.ex, names)
                return (
                  <div key={i}>
                    <Label>{ex.name}</Label>
                    <div className="text-[14px]">{describeLast({ ...e, date: open.date }, ex) ?? e.sets.map((s) => fmtKg(s.w)).join(' ')}</div>
                  </div>
                )
              })}
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="flex-1 text-[13px] text-mute">One session so far</div>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const W = 300
  const H = 40
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 4 - ((v - min) / (max - min || 1)) * (H - 8)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 min-w-0 flex-1" role="img" aria-label="Estimated max over time" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--tint)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
