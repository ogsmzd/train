import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EXERCISES, ytLink } from '../data/exercises'
import { PROGRAM } from '../data/program'
import { e1rm, exerciseHistory, exerciseOf } from '../lib/session'
import { describeLast } from '../engine/suggest'
import { Card, fmtKg, Icon, Label, Sheet } from '../ui'

const DAY_OF: Record<string, string> = {}
for (const d of PROGRAM) for (const s of d.sections) for (const i of s.items) if (i.role !== 'warmup') DAY_OF[i.ex] = DAY_OF[i.ex] ? DAY_OF[i.ex] + ' · ' + d.name : d.name

export default function Exercises() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const list = EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-3">
      <h1 className="num pt-1 text-[52px] uppercase">Exercises</h1>
      <input aria-label="Search exercises" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="h-12 w-full rounded-2xl bg-card px-4" />
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
        {list.map((e) => (
          <button key={e.id} className="press flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setOpen(e.id)}>
            {e.img ? (
              <div className="isolate h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-ink">
                <img src={`/ex/${e.img}/0.jpg`} alt="" loading="lazy" width={64} height={48} className="h-full w-full object-cover mix-blend-multiply" />
              </div>
            ) : (
              <div className="h-12 w-16 shrink-0 rounded-xl bg-card2" />
            )}
            <div className="min-w-0">
              <div className="text-[16px] font-semibold leading-snug">{e.name}</div>
              <div className="text-[13px] text-mute">{DAY_OF[e.id] ?? 'Warm-up'}</div>
            </div>
          </button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && <ExerciseDetail id={open} />}
      </Sheet>
    </div>
  )
}

export function ExerciseDetail({ id }: { id: string }) {
  const ex = exerciseOf(id)
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => 1 - f), 1100)
    return () => clearInterval(t)
  }, [])
  const hist = useLiveQuery(() => exerciseHistory(id), [id]) ?? []
  const best = hist.flatMap((h) => h.sets.filter((s) => s.done && s.w && s.r).map((s) => ({ w: s.w!, r: s.r!, date: h.date, est: e1rm(s.w!, s.r!) }))).sort((a, b) => b.est - a.est)[0]
  return (
    <div className="space-y-4 pb-4">
      <h2 className="font-display text-[30px] font-extrabold uppercase leading-[0.95] tracking-wide">{ex.name}</h2>
      {ex.img && (
        <div className="relative isolate overflow-hidden rounded-[22px] bg-ink">
          <img src={`/ex/${ex.img}/${frame}.jpg`} alt={`${ex.name} demonstration`} className="aspect-[3/2] w-full object-contain mix-blend-multiply" />
          <span className="eyebrow absolute bottom-2 right-2 rounded-md bg-bg/80 px-2 py-0.5 text-ink">{frame === 0 ? 'Start' : 'End'}</span>
        </div>
      )}
      {ex.cues.length > 0 && (
        <div>
          <Label>Key cues</Label>
          <ul className="space-y-1.5">
            {ex.cues.map((c) => (
              <li key={c} className="flex gap-2.5 text-[16px] leading-snug">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-tint" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ex.why && (
        <Card className="bg-card2">
          <Label>On the mat</Label>
          <div className="text-[16px]">{ex.why}</div>
        </Card>
      )}
      <a href={ytLink(ex.name)} target="_blank" rel="noreferrer" className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-card2 px-4 text-[16px] font-semibold">
        <Icon name="play" size={18} /> Watch form videos
      </a>
      {hist.length > 0 && (
        <div>
          <Label>Your history</Label>
          {best && (
            <div className="mb-2 text-[15px]">
              Best: <b>{fmtKg(best.w)} kg × {best.r}</b> <span className="text-mute">(est. 1RM {best.est.toFixed(0)} kg, {best.date})</span>
            </div>
          )}
          <div className="space-y-1 text-[13px] text-mute">
            {hist.slice(0, 5).map((h, i) => (
              <div key={i}>
                <span className="text-ink">{h.date}</span> · {describeLast(h, ex)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
