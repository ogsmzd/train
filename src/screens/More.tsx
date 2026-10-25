import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import { hevyToWorkouts } from '../lib/hevy'
import { DEFAULT_PROGRAM_START, exerciseOf, weekRange } from '../lib/session'
import { describeLast } from '../engine/suggest'
import { Btn, Card, Label } from '../ui'

export default function More() {
  const hevyRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const start = useLiveQuery(() => getSetting('programStart', DEFAULT_PROGRAM_START))
  const counts = useLiveQuery(async () => ({ w: await db.workouts.count(), m: await db.mat.count(), hevy: await db.workouts.where('source').equals('hevy').count() }))

  async function importHevy(f: File) {
    try {
      const res = hevyToWorkouts(await f.text())
      const existing = new Set((await db.workouts.where('source').equals('hevy').toArray()).map((w) => w.startedAt))
      const fresh = res.workouts.filter((w) => !existing.has(w.startedAt))
      await db.transaction('rw', db.workouts, db.customExercises, async () => {
        await db.workouts.bulkAdd(fresh)
        await db.customExercises.bulkPut(res.custom)
      })
      setMsg(`Imported ${fresh.length} workouts (${res.workouts.length - fresh.length} already here). ${res.unmapped.length} exercises not in your plan were kept as history.`)
    } catch (e) {
      setMsg('Import failed: ' + (e as Error).message)
    }
  }

  async function exportBackup() {
    const data = { v: 1, at: new Date().toISOString(), workouts: await db.workouts.toArray(), checkins: await db.checkins.toArray(), mat: await db.mat.toArray(), customExercises: await db.customExercises.toArray(), settings: await db.settings.toArray() }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `train-backup-${data.at.slice(0, 10)}.json`
    a.click()
  }

  async function restoreBackup(f: File) {
    try {
      const d = JSON.parse(await f.text())
      if (!confirm('Replace everything in the app with this backup?')) return
      await db.transaction('rw', [db.workouts, db.checkins, db.mat, db.customExercises, db.settings], async () => {
        await Promise.all([db.workouts.clear(), db.checkins.clear(), db.mat.clear(), db.customExercises.clear(), db.settings.clear()])
        await db.workouts.bulkAdd(d.workouts ?? [])
        await db.checkins.bulkAdd(d.checkins ?? [])
        await db.mat.bulkAdd(d.mat ?? [])
        await db.customExercises.bulkAdd(d.customExercises ?? [])
        await db.settings.bulkAdd(d.settings ?? [])
      })
      setMsg('Backup restored.')
    } catch (e) {
      setMsg('Restore failed: ' + (e as Error).message)
    }
  }

  async function copyWeek() {
    const [a, b] = weekRange(new Date())
    const ws = (await db.workouts.where('date').between(a, b, true, true).toArray()).filter((w) => w.endedAt)
    const ms = await db.mat.where('date').between(a, b, true, true).toArray()
    const cs = await db.checkins.where('date').between(a, b, true, true).toArray()
    const lines: string[] = [`Training week ${a} → ${b}`, '']
    lines.push('Check-ins:')
    for (const c of cs.sort((x, y) => x.date.localeCompare(y.date))) lines.push(`- ${c.date}: back ${c.back}, sleep ${c.sleep}/5, soreness ${c.soreness}/5, energy ${c.energy}/5${c.whoopRecovery != null ? `, WHOOP ${c.whoopRecovery}%` : ''}`)
    lines.push('', 'Gym:')
    for (const w of ws.sort((x, y) => x.startedAt - y.startedAt)) {
      lines.push(`- ${w.date} ${w.title} (${Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 60000)} min, readiness ${w.readiness ?? '?'}, felt ${w.feel ?? '?'}/5)${w.note ? ` — "${w.note}"` : ''}`)
      for (const e of w.entries) {
        const s = describeLast({ ...e, date: w.date }, exerciseOf(e.ex))
        if (s) lines.push(`    ${exerciseOf(e.ex).name}: ${s}${e.effort ? ` [${e.effort}]` : ''}`)
      }
    }
    lines.push('', 'Mat & other:')
    for (const m of ms.sort((x, y) => x.date.localeCompare(y.date))) lines.push(`- ${m.date} ${m.label}: ${m.minutes} min, RPE ${m.intensity ?? '?'}, felt ${m.feel ?? '?'}/5${m.strain ? `, WHOOP strain ${m.strain}` : ''}${m.note ? ` — "${m.note}"` : ''}`)
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setMsg('This week is copied — paste it to Claude for a review.')
    } catch {
      setMsg(text)
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="num pt-1 text-[52px] uppercase">More</h1>
      {msg && <Card className="whitespace-pre-wrap border border-line text-[15px]" >{msg}</Card>}

      <Card>
        <Label>Coach review</Label>
        <p className="mb-3 text-[14px] text-mute">Copies this week’s check-ins, sessions and feel ratings as text, ready to paste into your training chat.</p>
        <Btn className="w-full" onClick={copyWeek}>
          Copy this week
        </Btn>
      </Card>

      <Card>
        <Label>Import from Hevy</Label>
        <p className="mb-3 text-[14px] text-mute">Hevy → Profile → Settings → Export & Import Data → Export Workouts. Safe to import again later; duplicates are skipped.</p>
        <input ref={hevyRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importHevy(e.target.files[0])} />
        <Btn kind="soft" className="w-full" onClick={() => hevyRef.current?.click()}>
          Choose Hevy CSV
        </Btn>
      </Card>

      <Card>
        <Label>Programme</Label>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px]">
            Started
            <div className="text-xs text-mute">Every 6th week is a deload</div>
          </div>
          <input aria-label="Programme start date" type="date" value={start ?? ''} onChange={(e) => setSetting('programStart', e.target.value)} className="h-12 rounded-xl bg-card2 px-3" />
        </div>
      </Card>

      <Card>
        <Label>Backup</Label>
        <p className="mb-3 text-[14px] text-mute">
          Everything lives on this phone{counts ? ` (${counts.w} workouts, ${counts.m} mat sessions)` : ''}. Cloud sync comes with the WHOOP link; until then, export a backup now and then.
        </p>
        <div className="flex gap-2">
          <Btn kind="soft" className="flex-1" onClick={exportBackup}>
            Export
          </Btn>
          <input ref={backupRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && restoreBackup(e.target.files[0])} />
          <Btn kind="soft" className="flex-1" onClick={() => backupRef.current?.click()}>
            Restore
          </Btn>
        </div>
      </Card>

      <Card>
        <Label>WHOOP</Label>
        <p className="text-[13px] text-mute">Coming in Phase 2: recovery into your check-in, and BJJ / judo sessions logged automatically for you to rate.</p>
      </Card>

      <Card>
        <Label>Delete data</Label>
        <p className="mb-3 text-[14px] text-mute">Removes every workout, check-in and mat session from this phone. Export a backup first if you might want it back.</p>
        <Btn
          kind="danger"
          className="w-full"
          onClick={async () => {
            if (!confirm('Delete all training data on this phone? This cannot be undone.')) return
            await Promise.all([db.workouts.clear(), db.checkins.clear(), db.mat.clear(), db.customExercises.clear(), db.settings.clear()])
            setMsg('All data deleted from this phone.')
          }}
        >
          Delete all data
        </Btn>
      </Card>

      <p className="px-1 pb-2 text-center text-[12px] text-mute">
        Exercise images: free-exercise-db (public domain) ·{' '}
        <a href="/privacy.html" className="underline">
          Privacy
        </a>
      </p>
    </div>
  )
}
