import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteSynced, getSetting, todayISO, type Checkin, type Level, type MatSession } from '../db'
import { MAT_SCHEDULE, PROGRAM, type MatSlot, type MatType } from '../data/program'
import { isDeloadWeek, readiness } from '../engine/suggest'
import { DEFAULT_PROGRAM_START, startWorkout, weekRange } from '../lib/session'
import { Btn, Icon, Label, LEVEL_LABEL, LEVEL_WORD, Scale, Seg, Sheet } from '../ui'

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Today({ onOpenWorkout }: { onOpenWorkout: () => void }) {
  const today = todayISO()
  const now = new Date()
  const weekday = now.getDay()
  const rawCheckin = useLiveQuery(() => db.checkins.get(today), [today])
  const whoopToday = useLiveQuery(() => db.whoop.get(today), [today])
  const checkin = rawCheckin ? { ...rawCheckin, whoopRecovery: whoopToday?.recovery ?? rawCheckin.whoopRecovery } : undefined
  const active = useLiveQuery(() => db.workouts.filter((w) => w.source === 'app' && !w.endedAt).first())
  const doneToday = useLiveQuery(() => db.workouts.where('date').equals(today).filter((w) => !!w.endedAt).toArray(), [today])
  const matToday = useLiveQuery(() => db.mat.where('date').equals(today).toArray(), [today]) ?? []
  const programStart = useLiveQuery(() => getSetting('programStart', DEFAULT_PROGRAM_START))
  const [wk0, wk1] = weekRange(now)
  const week = useLiveQuery(async () => {
    const ws = await db.workouts.where('date').between(wk0, wk1, true, true).filter((w) => !!w.endedAt).toArray()
    const ms = await db.mat.where('date').between(wk0, wk1, true, true).toArray()
    return { ws, ms }
  }, [wk0, wk1])

  const toRate = useLiveQuery(async () => {
    const from = todayISO(new Date(Date.now() - 7 * 86400000))
    return (await db.mat.where('date').between(from, today, true, false).toArray()).filter((m) => !m.feel).sort((a, b) => b.date.localeCompare(a.date))
  }, [today]) ?? []
  const [checkOpen, setCheckOpen] = useState(false)
  const [startAfterCheck, setStartAfterCheck] = useState<null | 'pull' | 'push' | 'legs'>(null)
  const [matSheet, setMatSheet] = useState<null | { slot?: MatSlot; existing?: MatSession }>(null)
  const [anyOpen, setAnyOpen] = useState(false)

  const gymDay = PROGRAM.find((d) => d.weekday === weekday)
  const r = checkin ? readiness(checkin) : null
  const deload = programStart ? isDeloadWeek(programStart, today) : false
  const slots = MAT_SCHEDULE[weekday] ?? []

  async function begin(dayId: 'pull' | 'push' | 'legs') {
    if (!checkin) {
      setStartAfterCheck(dayId)
      setCheckOpen(true)
      return
    }
    await startWorkout(dayId, checkin)
    onOpenWorkout()
  }

  // today's plan in time order
  type Row = { time: string; key: string; node: JSX.Element }
  const rows: Row[] = []
  const gymDone = doneToday?.[0]
  if (active) {
    rows.push({ time: '07:00', key: 'gym', node: <PlanRow time="Now" title={`${active.title} day`} sub="In progress" action={<Btn onClick={onOpenWorkout}>Continue</Btn>} /> })
  } else if (gymDone) {
    rows.push({ time: '07:00', key: 'gym', node: <PlanRow time="07:00" title={`${gymDone.title} day`} sub={gymDone.feel ? `Done · felt ${gymDone.feel}/5` : 'Done'} done /> })
  } else if (gymDay) {
    rows.push({
      time: '07:00',
      key: 'gym',
      node: <PlanRow time="07:00" title={`${gymDay.name} day`} sub={gymDay.note} action={<Btn onClick={() => begin(gymDay.id)}>Start</Btn>} />,
    })
  }
  for (const s of slots) {
    const logged = matToday.find((m) => m.label === s.label)
    rows.push({
      time: s.time,
      key: s.label,
      node: (
        <PlanRow
          time={s.time}
          title={s.label}
          sub={logged ? matSub(logged) : `${s.minutes} min`}
          done={!!logged?.feel}
          onClick={() => setMatSheet({ slot: s, existing: logged })}
          action={
            logged ? (
              <Btn onClick={() => setMatSheet({ slot: s, existing: logged })}>Rate</Btn>
            ) : (
              <Btn kind="soft" onClick={() => setMatSheet({ slot: s })}>
                Log
              </Btn>
            )
          }
        />
      ),
    })
  }
  for (const m of matToday.filter((m) => !slots.some((s) => s.label === m.label))) {
    rows.push({
      time: m.time ?? '99',
      key: 'm' + m.id,
      node: <PlanRow time={m.time ?? '—'} title={m.label} sub={matSub(m)} done={!!m.feel} onClick={() => setMatSheet({ existing: m })} action={<Btn onClick={() => setMatSheet({ existing: m })}>Rate</Btn>} />,
    })
  }
  rows.sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-1">
        <div className="eyebrow">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {deload && <span className="eyebrow rounded-full border border-line px-3 py-1 text-ink">Deload week</span>}
      </header>

      {/* readiness — the thesis of the screen */}
      {r && checkin ? (
        <button onClick={() => setCheckOpen(true)} className="press block w-full text-left" aria-label="Edit morning check-in">
          <div className="num text-[88px] uppercase text-tint">{LEVEL_WORD[r.level]}</div>
          <div className="mt-2 font-display text-[26px] font-bold leading-tight">{LEVEL_LABEL[r.level]}</div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[14px] text-mute">
            <span>
              {r.reasons.join(' · ')}
            </span>
            <span className="shrink-0 font-semibold text-ink underline decoration-line decoration-2 underline-offset-4">Edit</span>
          </div>
        </button>
      ) : (
        <div>
          <div className="num text-[64px] uppercase leading-[0.85]">
            How are
            <br />
            you today?
          </div>
          <p className="mt-3 text-[15px] text-mute">Four taps. Your answers set today’s weights{whoopToday ? ', alongside WHOOP' : ''}.</p>
          <Btn className="mt-4 w-full" onClick={() => setCheckOpen(true)}>
            Check in
          </Btn>
        </div>
      )}

      {whoopToday && <WhoopLine w={whoopToday} />}

      {/* week on the tatami */}
      {week && <WeekStrip ws={week.ws} ms={week.ms} start={wk0} today={today} />}

      {/* today's plan */}
      <section>
        <Label>Today’s plan</Label>
        <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-card">
          {rows.length ? rows.map((r) => <div key={r.key}>{r.node}</div>) : <div className="px-4 py-4 text-[15px] text-mute">Rest day. Sleep, eat, walk.</div>}
        </div>
        <div className="mt-3 flex gap-4 px-1">
          <Btn kind="ghost" className="px-0" onClick={() => setMatSheet({})}>
            Add a session
          </Btn>
          {!active && (
            <Btn kind="ghost" className="px-0" onClick={() => setAnyOpen(true)}>
              Start a gym day
            </Btn>
          )}
        </div>
      </section>

      {toRate.length > 0 && (
        <section>
          <Label>Waiting for your rating</Label>
          <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-card">
            {toRate.map((m) => (
              <PlanRow
                key={m.id}
                time={new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
                title={m.label}
                sub={matSub(m)}
                onClick={() => setMatSheet({ existing: m })}
                action={<Btn onClick={() => setMatSheet({ existing: m })}>Rate</Btn>}
              />
            ))}
          </div>
        </section>
      )}

      <CheckinSheet
        key={(checkin?.date ?? 'none') + String(checkOpen)}
        open={checkOpen}
        initial={checkin}
        whoopRecovery={whoopToday?.recovery}
        cta={startAfterCheck ? 'Save and start' : 'Save check-in'}
        onClose={() => {
          setCheckOpen(false)
          setStartAfterCheck(null)
        }}
        onSaved={async (c) => {
          setCheckOpen(false)
          if (startAfterCheck) {
            await startWorkout(startAfterCheck, c)
            setStartAfterCheck(null)
            onOpenWorkout()
          }
        }}
      />
      <MatSheet state={matSheet} onClose={() => setMatSheet(null)} />
      <Sheet open={anyOpen} onClose={() => setAnyOpen(false)} title="Start a gym day">
        <div className="space-y-2 pb-4">
          {PROGRAM.map((d) => (
            <button
              key={d.id}
              className="press flex min-h-14 w-full items-center justify-between rounded-2xl bg-card2 px-4 text-left"
              onClick={() => {
                setAnyOpen(false)
                begin(d.id)
              }}
            >
              <span className="font-display text-[24px] font-extrabold uppercase">{d.name}</span>
              <span className="text-[13px] text-mute">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday]}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

function matSub(m: MatSession) {
  const bits = [`${m.minutes} min`]
  if (m.strain != null) bits.push(`strain ${m.strain}`)
  if (m.feel) bits.push(`felt ${m.feel}/5`)
  else if (m.source === 'whoop') bits.push('from WHOOP — how did it feel?')
  return bits.join(' · ')
}

function WhoopLine({ w }: { w: { recovery: number; hrv: number | null; rhr: number | null; sleepPerf: number | null } }) {
  const tone = w.recovery >= 67 ? 'text-go' : w.recovery >= 34 ? 'text-warn' : 'text-stop'
  const Stat = ({ v, unit, l }: { v: number | null; unit?: string; l: string }) =>
    v == null ? null : (
      <div>
        <div className="num text-[30px]">
          {v}
          {unit && <span className="ml-0.5 font-sans text-[12px] font-bold text-mute">{unit}</span>}
        </div>
        <div className="text-[12px] text-mute">{l}</div>
      </div>
    )
  return (
    <section aria-label="WHOOP this morning" className="flex items-end justify-between rounded-[22px] bg-card px-4 py-3">
      <div>
        <div className={`num text-[30px] ${tone}`}>
          {w.recovery}
          <span className="ml-0.5 font-sans text-[12px] font-bold text-mute">%</span>
        </div>
        <div className="text-[12px] text-mute">WHOOP recovery</div>
      </div>
      <Stat v={w.hrv} unit="ms" l="HRV" />
      <Stat v={w.rhr} unit="bpm" l="resting HR" />
      <Stat v={w.sleepPerf} unit="%" l="sleep" />
    </section>
  )
}

function PlanRow({ time, title, sub, action, done, onClick }: { time: string; title: string; sub: string; action?: JSX.Element; done?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <div className={`num w-14 shrink-0 text-[24px] ${done ? 'text-mute' : ''}`}>{time}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-[16px] font-semibold leading-snug ${done ? 'text-mute' : ''}`}>{title}</div>
        <div className="text-[13px] leading-snug text-mute">{sub}</div>
      </div>
    </>
  )
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {onClick ? (
        <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {done ? (
        <span className="stamp grid h-9 w-9 place-items-center rounded-full bg-tint text-bg" aria-label="Done">
          <Icon name="check" size={18} stroke={2.6} />
        </span>
      ) : (
        action
      )}
    </div>
  )
}

/** Mon–Sun as seven tatami: a cotton bar per gym session, a stitch per mat session. Hollow = planned. */
function WeekStrip({ ws, ms, start, today }: { ws: { date: string }[]; ms: { date: string; minutes: number }[]; start: string; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return { iso: todayISO(d), wd: d.getDay() }
  })
  const gymCount = ws.length
  const matMin = ms.reduce((a, m) => a + m.minutes, 0)
  return (
    <section aria-label="This week">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="eyebrow">This week</span>
        <span className="text-[13px] text-mute">
          <b className="num text-[18px] text-ink">{gymCount}</b> gym · <b className="num text-[18px] text-ink">{(matMin / 60).toFixed(1)}</b> h mat
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(({ iso, wd }) => {
          const gymPlanned = PROGRAM.some((p) => p.weekday === wd)
          const gymDone = ws.some((w) => w.date === iso)
          const matPlanned = (MAT_SCHEDULE[wd] ?? []).length
          const matDone = ms.filter((m) => m.date === iso).length
          const stitches = Math.max(matPlanned, matDone)
          const isToday = iso === today
          const future = iso > today
          return (
            <div key={iso} className={`flex h-[74px] flex-col justify-between rounded-[10px] p-1.5 ${isToday ? 'bg-card2 ring-2 ring-tint' : 'bg-card'} ${future ? 'opacity-60' : ''}`}>
              <div className={`num text-center text-[16px] ${isToday ? 'text-ink' : 'text-mute'}`}>{DAY_LETTER[wd]}</div>
              <div className="space-y-1">
                {(gymPlanned || gymDone) && <div className={`h-2 rounded-[3px] ${gymDone ? 'bg-ink' : 'border border-mute/60'}`} />}
                <div className="flex justify-center gap-[3px]">
                  {Array.from({ length: stitches }, (_, k) => (
                    <span key={k} className={`h-[7px] w-[7px] rounded-full ${k < matDone ? 'bg-tint' : 'border border-mute/60'}`} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CheckinSheet({ open, initial, onClose, onSaved, cta, whoopRecovery }: { open: boolean; initial?: Checkin; onClose: () => void; onSaved: (c: Checkin) => void; cta: string; whoopRecovery?: number }) {
  const [back, setBack] = useState<Level | undefined>(initial?.back)
  const [sleep, setSleep] = useState<number | undefined>(initial?.sleep)
  const [sore, setSore] = useState<number | undefined>(initial?.soreness)
  const [energy, setEnergy] = useState<number | undefined>(initial?.energy)
  const ready = back && sleep && sore && energy
  return (
    <Sheet open={open} onClose={onClose} title="Morning check-in">
      <div className="space-y-5 pb-4">
        <div>
          <Label>Back</Label>
          <Seg
            name="Back"
            value={back}
            onChange={setBack}
            options={[
              { v: 'green', label: 'Good', cls: 'bg-go text-bg' },
              { v: 'amber', label: 'Stiff', cls: 'bg-warn text-bg' },
              { v: 'red', label: 'Pain / leg', cls: 'bg-stop text-bg' },
            ]}
          />
          {back === 'red' && <p className="mt-2 text-[14px] text-stop">Pain, numbness or tingling down the leg: no spine loading today, and get it checked.</p>}
        </div>
        <div>
          <Label>Sleep</Label>
          <Scale name="Sleep" value={sleep} onChange={setSleep} labels={['Awful', 'Great']} />
        </div>
        <div>
          <Label>Soreness</Label>
          <Scale name="Soreness" value={sore} onChange={setSore} labels={['None', 'Wrecked']} />
        </div>
        <div>
          <Label>Energy</Label>
          <Scale name="Energy" value={energy} onChange={setEnergy} labels={['Flat', 'Buzzing']} />
        </div>
        <Btn
          className="w-full"
          disabled={!ready}
          onClick={async () => {
            const c: Checkin = { date: todayISO(), back: back!, sleep: sleep!, soreness: sore!, energy: energy!, whoopRecovery: whoopRecovery ?? initial?.whoopRecovery }
            await db.checkins.put(c)
            onSaved(c)
          }}
        >
          {cta}
        </Btn>
      </div>
    </Sheet>
  )
}

const MAT_TYPES: MatType[] = ['BJJ group', 'Private BJJ', 'Judo', 'Open mat', 'Run', 'Padel', 'Other']

function MatSheet({ state, onClose }: { state: null | { slot?: MatSlot; existing?: MatSession }; onClose: () => void }) {
  return state ? <MatForm key={state.existing?.id ?? state.slot?.label ?? 'new'} state={state} onClose={onClose} /> : null
}

function MatForm({ state, onClose }: { state: { slot?: MatSlot; existing?: MatSession }; onClose: () => void }) {
  const e = state.existing
  const [type, setType] = useState<MatType>(e?.type ?? state.slot?.type ?? 'BJJ group')
  const [minutes, setMinutes] = useState<number>(e?.minutes ?? state.slot?.minutes ?? 60)
  const [intensity, setIntensity] = useState<number | undefined>(e?.intensity)
  const [feel, setFeel] = useState<number | undefined>(e?.feel)
  const [note, setNote] = useState(e?.note ?? '')
  const label = e?.label ?? state.slot?.label ?? type
  return (
    <Sheet open onClose={onClose} title={label}>
      <div className="space-y-5 pb-4">
        {e?.source === 'whoop' && (
          <p className="text-[14px] text-mute">
            From WHOOP{e.strain ? ` · strain ${e.strain.toFixed(1)}` : ''}
            {e.avgHr ? ` · avg HR ${e.avgHr}` : ''}. Add how it actually felt.
          </p>
        )}
        {!state.slot && !e && (
          <div>
            <Label>Type</Label>
            <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
              {MAT_TYPES.map((t) => (
                <button key={t} role="radio" aria-checked={type === t} onClick={() => setType(t)} className={`press min-h-11 rounded-xl px-3.5 text-[15px] font-semibold ${type === t ? 'bg-ink text-bg' : 'bg-card2 text-mute'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <Label>How did it feel?</Label>
          <Scale name="Feel" value={feel} onChange={setFeel} labels={['Terrible', 'Amazing']} />
        </div>
        <div>
          <Label>How hard was it? · RPE</Label>
          <Scale name="RPE" value={intensity} onChange={setIntensity} n={10} labels={['Easy flow', 'All-out']} />
        </div>
        <div>
          <Label>Minutes</Label>
          <input aria-label="Minutes" type="number" inputMode="numeric" value={minutes} onChange={(ev) => setMinutes(+ev.target.value)} className="num h-14 w-full rounded-2xl bg-card2 px-4 text-[30px]" />
        </div>
        <div>
          <Label>Note</Label>
          <textarea aria-label="Note" value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} placeholder="What you drilled, what caught you" className="w-full rounded-2xl bg-card2 px-4 py-3" />
        </div>
        <div className="flex gap-2">
          {e && (
            <Btn
              kind="danger"
              onClick={async () => {
                if (!confirm('Delete this session?')) return
                await deleteSynced('mat', e.id!)
                onClose()
              }}
            >
              Delete
            </Btn>
          )}
          <Btn
            className="flex-1"
            onClick={async () => {
              const rec: MatSession = { ...(e ?? { date: todayISO(), source: 'manual' as const }), type, label, minutes, intensity, feel, note: note || undefined }
              await db.mat.put(rec)
              onClose()
            }}
          >
            Save session
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}
