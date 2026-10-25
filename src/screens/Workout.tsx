import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteSynced, type Effort, type EntryLog, type Workout } from '../db'
import { exerciseOf } from '../lib/session'
import { Btn, fmtKg, Icon, Label, LEVEL_WORD, Scale, Seg, Sheet, Stepper } from '../ui'
import { ExerciseDetail } from './Exercises'

const TAG: Record<string, { word: string; cls: string }> = {
  up: { word: 'Heavier', cls: 'bg-go text-bg' },
  new: { word: 'New', cls: 'bg-ink text-bg' },
  hold: { word: 'Same load', cls: 'bg-card2 text-ink' },
  down: { word: 'Lighter', cls: 'bg-warn text-bg' },
  deload: { word: 'Deload', cls: 'bg-card2 text-ink' },
}

const unitOf = (u: string) => (u === 'm' ? 'm' : u.startsWith('s') ? 'sec' : u === 'min' ? 'min' : 'reps')
const isWork = (e: EntryLog) => e.plan?.role !== 'warmup' && !e.skipped

export default function WorkoutScreen({ onClose }: { onClose: () => void }) {
  const w = useLiveQuery(() => db.workouts.filter((x) => x.source === 'app' && !x.endedAt).first(), [], 'loading' as const)
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // first unfinished working exercise is open by default
  useEffect(() => {
    if (w && w !== 'loading' && activeIdx === null) {
      const i = w.entries.findIndex((e) => isWork(e) && e.sets.some((s) => !s.done))
      setActiveIdx(i >= 0 ? i : null)
    }
  }, [w, activeIdx])

  if (w === 'loading') return null
  if (!w) {
    return (
      <div className="pt-safe px-5">
        <p className="text-mute">No session in progress.</p>
        <Btn className="mt-4" onClick={onClose}>
          Back to today
        </Btn>
      </div>
    )
  }

  const save = (entries: EntryLog[]) => db.workouts.update(w.id!, { entries })
  const elapsed = Math.floor((Date.now() - w.startedAt) / 60000)
  const work = w.entries.filter(isWork)
  const total = work.reduce((a, e) => a + e.sets.length, 0)
  const done = work.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)

  const sections: { label: string; items: { e: EntryLog; i: number }[] }[] = []
  w.entries.forEach((e, i) => {
    const label = e.plan?.section ?? 'Extra'
    let s = sections.find((x) => x.label === label)
    if (!s) sections.push((s = { label, items: [] }))
    s.items.push({ e, i })
  })

  const nextAfter = (i: number) => {
    const n = w.entries.findIndex((e, j) => j > i && isWork(e) && e.sets.some((s) => !s.done))
    return n >= 0 ? n : null
  }

  return (
    <div className={`min-h-dvh ${rest ? 'pb-52' : 'pb-24'}`}>
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center justify-between px-3 pb-2.5">
          <button onClick={onClose} className="press flex min-h-11 items-center gap-0.5 rounded-xl pl-1 pr-3 font-semibold">
            <Icon name="back" size={22} />
            Today
          </button>
          <div className="text-center">
            <div className="font-display text-[22px] font-extrabold uppercase leading-none">{w.title} day</div>
            <div className="mt-0.5 text-[13px] text-mute">
              <span className="num text-[15px] text-ink">{elapsed}</span> min · <span className="num text-[15px] text-ink">{done}</span>/{total} sets
            </div>
          </div>
          <Btn kind="soft" className="min-h-11 px-4" onClick={() => setFinishing(true)}>
            Finish
          </Btn>
        </div>
        <div className="h-[3px] bg-card" aria-hidden="true">
          <div className="h-full bg-tint transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-7 px-4 pt-4">
        {w.readiness && (
          <p className="text-[14px] text-mute">
            <span className="font-display text-[16px] font-extrabold uppercase tracking-wide text-tint">{LEVEL_WORD[w.readiness]} day.</span> Weights below already account for it.
          </p>
        )}
        {sections.map((sec) => (
          <section key={sec.label}>
            <Label>{sec.label}</Label>
            <div className={sec.items[0]?.e.plan?.role === 'warmup' ? 'divide-y divide-line overflow-hidden rounded-[22px] bg-card' : 'space-y-2.5'}>
              {sec.items.map(({ e, i }) =>
                e.plan?.role === 'warmup' ? (
                  <WarmupRow key={i} e={e} onInfo={() => setDetail(e.ex)} onToggle={() => save(w.entries.map((x, j) => (j === i ? { ...x, sets: x.sets.map((s) => ({ ...s, done: !e.sets.every((q) => q.done) })) } : x)))} />
                ) : e.skipped ? (
                  <SkippedRow key={i} e={e} onRestore={() => save(w.entries.map((x, j) => (j === i ? { ...x, skipped: false } : x)))} />
                ) : i === activeIdx ? (
                  <ActiveCard
                    key={i}
                    e={e}
                    onInfo={() => setDetail(e.ex)}
                    onChange={(ne) => save(w.entries.map((x, j) => (j === i ? ne : x)))}
                    onLogged={(ne) => {
                      if (e.plan?.rest) setRest({ until: Date.now() + e.plan.rest * 1000, total: e.plan.rest })
                      if (ne.sets.every((s) => s.done)) setActiveIdx(nextAfter(i))
                    }}
                  />
                ) : (
                  <CollapsedCard key={i} e={e} onOpen={() => setActiveIdx(i)} />
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      {rest && <RestBar rest={rest} onChange={setRest} />}
      <Sheet open={!!detail} onClose={() => setDetail(null)}>
        {detail && <ExerciseDetail id={detail} />}
      </Sheet>
      {finishing && <FinishSheet w={w} onClose={() => setFinishing(false)} onDone={onClose} />}
    </div>
  )
}

function WarmupRow({ e, onToggle, onInfo }: { e: EntryLog; onToggle: () => void; onInfo: () => void }) {
  const ex = exerciseOf(e.ex)
  const done = e.sets.every((s) => s.done)
  const u = ex.unit === 'min' ? ' min' : ex.unit.startsWith('s') ? ' sec' : ''
  const side = ex.unit.endsWith('side') ? ' each side' : ''
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <button onClick={onToggle} aria-pressed={done} aria-label={`${ex.name} done`} className={`press grid h-11 w-11 shrink-0 place-items-center rounded-xl ${done ? 'bg-tint text-bg' : 'bg-card2 text-mute'}`}>
        <Icon name="check" size={20} stroke={2.6} />
      </button>
      <button className="min-w-0 flex-1 py-1 text-left" onClick={onInfo}>
        <div className={`text-[16px] font-semibold ${done ? 'text-mute line-through decoration-line' : ''}`}>{ex.name}</div>
        <div className="text-[13px] text-mute">
          {e.sets.length > 1 ? `${e.sets.length} × ` : ''}
          {e.plan?.target}
          {u}
          {side}
        </div>
      </button>
    </div>
  )
}

function SkippedRow({ e, onRestore }: { e: EntryLog; onRestore: () => void }) {
  const ex = exerciseOf(e.ex)
  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] border border-dashed border-line px-4 py-3">
      <div className="min-w-0">
        <div className="text-[16px] font-semibold text-mute line-through decoration-line">{ex.name}</div>
        <div className="text-[13px] text-mute">{e.plan?.reason}</div>
      </div>
      <Btn kind="ghost" className="shrink-0 px-1" onClick={onRestore}>
        Do it anyway
      </Btn>
    </div>
  )
}

function Target({ e }: { e: EntryLog }) {
  const ex = exerciseOf(e.ex)
  const p = e.plan
  if (!p) return null
  const loaded = ex.inc > 0 || p.weight > 0
  return (
    <span className="num">
      {loaded && (
        <>
          {fmtKg(p.weight)}
          {p.weight ? <span className="ml-0.5 font-sans text-[0.4em] font-bold text-mute">KG</span> : null}
          <span className="mx-1 text-mute">×</span>
        </>
      )}
      {p.target}
      <span className="ml-0.5 font-sans text-[0.4em] font-bold uppercase text-mute">
        {unitOf(ex.unit)}
        {ex.unit.endsWith('side') ? '/side' : ''}
      </span>
    </span>
  )
}

function CollapsedCard({ e, onOpen }: { e: EntryLog; onOpen: () => void }) {
  const ex = exerciseOf(e.ex)
  const doneN = e.sets.filter((s) => s.done).length
  const finished = doneN === e.sets.length && doneN > 0
  return (
    <button onClick={onOpen} className={`press flex w-full items-center gap-3 rounded-[22px] bg-card px-4 py-3.5 text-left ${finished ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold leading-snug">{ex.name}</div>
        <div className="mt-1 flex items-center gap-1" aria-label={`${doneN} of ${e.sets.length} sets done`}>
          {e.sets.map((s, k) => (
            <span key={k} className={`h-[7px] w-5 rounded-full ${s.done ? 'bg-tint' : 'bg-card2'}`} />
          ))}
        </div>
      </div>
      <div className="text-[24px]">
        <Target e={e} />
      </div>
    </button>
  )
}

function ActiveCard({ e, onChange, onLogged, onInfo }: { e: EntryLog; onChange: (e: EntryLog) => void; onLogged: (e: EntryLog) => void; onInfo: () => void }) {
  const ex = exerciseOf(e.ex)
  const p = e.plan
  const loaded = ex.inc > 0 || (p?.weight ?? 0) > 0
  const firstOpen = e.sets.findIndex((s) => !s.done)
  const [sel, setSel] = useState(firstOpen >= 0 ? firstOpen : Math.max(0, e.sets.length - 1))
  const cur = e.sets[sel] ?? e.sets[0]
  const tag = p ? TAG[p.tag] : undefined
  const repStep = ex.unit.startsWith('s') ? 5 : ex.unit === 'm' ? 5 : 1

  const setVal = (field: 'w' | 'r', v: number) => onChange({ ...e, sets: e.sets.map((s, j) => (j === sel ? { ...s, [field]: v } : s)) })

  const log = () => {
    // log this set and carry its load forward to the sets still to do
    const sets = e.sets.map((s, j) => (j === sel ? { ...s, done: true } : j > sel && !s.done ? { ...s, w: cur.w } : s))
    const ne = { ...e, sets }
    onChange(ne)
    onLogged(ne)
    navigator.vibrate?.(15)
    const nxt = sets.findIndex((s) => !s.done)
    if (nxt >= 0) setSel(nxt)
  }
  const undo = () => onChange({ ...e, sets: e.sets.map((s, j) => (j === sel ? { ...s, done: false } : s)) })

  return (
    <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[26px] font-extrabold uppercase leading-[0.95] tracking-wide">{ex.name}</h3>
        <button onClick={onInfo} aria-label={`How to do ${ex.name}`} className="press -mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-mute">
          <Icon name="info" size={22} />
        </button>
      </div>

      {p && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <div className="text-[46px]">
              <Target e={e} />
            </div>
            {tag && <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${tag.cls}`}>{tag.word}</span>}
          </div>
          <p className="mt-1.5 text-[14px] leading-snug text-mute">{p.reason}</p>
          {p.last && <p className="mt-0.5 text-[13px] text-mute">Last time: {p.last}</p>}
        </div>
      )}

      {/* set pills */}
      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Sets">
        {e.sets.map((s, k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === sel}
            onClick={() => setSel(k)}
            className={`press min-h-11 min-w-[64px] rounded-xl px-2.5 text-left ${s.done ? 'bg-tint/20' : 'bg-card2'} ${k === sel ? 'ring-2 ring-ink' : ''}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wide text-mute">
              Set {k + 1} {s.done && <Icon name="check" size={11} stroke={3} className="inline -mt-0.5 text-tint" />}
            </div>
            <div className="num text-[18px]">
              {loaded ? `${fmtKg(s.w)}×` : ''}
              {s.r ?? '–'}
            </div>
          </button>
        ))}
      </div>

      {/* steppers for the selected set */}
      <div className="mt-3 flex gap-2">
        {loaded && <Stepper label="weight" unit="kg" value={cur.w} step={ex.inc || 2.5} onChange={(v) => setVal('w', v)} />}
        <Stepper label={unitOf(ex.unit)} unit={unitOf(ex.unit)} value={cur.r} step={repStep} onChange={(v) => setVal('r', v)} />
      </div>

      {cur.done ? (
        <Btn kind="soft" className="mt-3 w-full" onClick={undo}>
          Undo set {sel + 1}
        </Btn>
      ) : (
        <Btn className="mt-3 min-h-14 w-full text-[18px]" onClick={log}>
          Log set {sel + 1}
        </Btn>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            className="press min-h-11 rounded-xl px-3 text-[14px] font-semibold text-mute"
            onClick={() => {
              const last = e.sets[e.sets.length - 1]
              onChange({ ...e, sets: [...e.sets, { w: last?.w ?? p?.weight ?? null, r: last?.r ?? p?.target ?? null, done: false }] })
            }}
          >
            + Set
          </button>
          {e.sets.length > 1 && !e.sets[e.sets.length - 1].done && (
            <button
              className="press min-h-11 rounded-xl px-3 text-[14px] font-semibold text-mute"
              onClick={() => {
                onChange({ ...e, sets: e.sets.slice(0, -1) })
                setSel((s) => Math.min(s, e.sets.length - 2))
              }}
            >
              − Set
            </button>
          )}
        </div>
      </div>

      {e.sets.some((s) => s.done) && (
        <div className="mt-2 border-t border-line pt-3">
          <div className="mb-1.5 text-[13px] text-mute">How did that feel? Sets the next jump.</div>
          <Seg<Effort>
            name="Effort"
            value={e.effort}
            onChange={(effort) => onChange({ ...e, effort })}
            options={[
              { v: 'easy', label: 'Easy' },
              { v: 'solid', label: 'Solid' },
              { v: 'grind', label: 'Grind' },
            ]}
          />
        </div>
      )}
    </div>
  )
}

function RestBar({ rest, onChange }: { rest: { until: number; total: number }; onChange: (r: { until: number; total: number } | null) => void }) {
  const left = Math.max(0, Math.round((rest.until - Date.now()) / 1000))
  const buzzed = useRef(false)
  useEffect(() => {
    if (left === 0 && !buzzed.current) {
      buzzed.current = true
      navigator.vibrate?.([200, 100, 200])
    }
  }, [left])
  const pct = Math.min(100, (left / rest.total) * 100)
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card" role="timer" aria-live="off">
      <div className="h-1 bg-card2">
        <div className="h-full bg-tint transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-2">
        <div>
          <div className="eyebrow">{left === 0 ? 'Rest done' : 'Rest'}</div>
          <div className={`num text-[64px] ${left === 0 ? 'text-tint' : ''}`} aria-label={`${left} seconds of rest left`}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn kind="soft" className="px-4" onClick={() => onChange({ until: rest.until + 15000, total: rest.total + 15 })}>
            +15 s
          </Btn>
          <Btn kind={left === 0 ? 'primary' : 'soft'} className="px-4" onClick={() => onChange(null)}>
            {left === 0 ? 'Go' : 'Skip'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function FinishSheet({ w, onClose, onDone }: { w: Workout; onClose: () => void; onDone: () => void }) {
  const [feel, setFeel] = useState<number | undefined>(w.feel)
  const [note, setNote] = useState(w.note ?? '')
  const doneSets = w.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  return (
    <Sheet open onClose={onClose} title="Finish session">
      <div className="space-y-5 pb-4">
        <p className="text-[15px] text-mute">
          <span className="num text-[22px] text-ink">{doneSets}</span> sets in <span className="num text-[22px] text-ink">{Math.round((Date.now() - w.startedAt) / 60000)}</span> min
        </p>
        <div>
          <Label>How did it feel?</Label>
          <Scale name="Feel" value={feel} onChange={setFeel} labels={['Terrible', 'Amazing']} />
        </div>
        <div>
          <Label>Note</Label>
          <textarea aria-label="Note" value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} placeholder="Anything worth remembering" className="w-full rounded-2xl bg-card2 px-4 py-3" />
        </div>
        <div className="flex gap-2">
          <Btn
            kind="danger"
            onClick={async () => {
              if (confirm('Discard this session? Nothing from it will be saved.')) {
                await deleteSynced('workouts', w.id!)
                onDone()
              }
            }}
          >
            Discard
          </Btn>
          <Btn
            className="flex-1"
            onClick={async () => {
              const entries = w.entries.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
              await db.workouts.update(w.id!, { endedAt: Date.now(), feel, note: note || undefined, entries })
              onDone()
            }}
          >
            Save session
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}
