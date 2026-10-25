import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, tombstoneAll } from '../db'
import { hevyToWorkouts } from '../lib/hevy'
import { DEFAULT_PROGRAM_START, exerciseOf, weekRange } from '../lib/session'
import { describeLast } from '../engine/suggest'
import { Btn, Card, Label } from '../ui'
import { api, getPasscode, getSyncStatus, setPasscode, subscribeSync, syncNow } from '../lib/sync'
import { connectWhoop, disconnectWhoop, lastWhoopFetch, refreshWhoop } from '../lib/whoop'

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
      await tombstoneAll()
      const noId = (r: { id?: number }) => {
        const { id: _id, ...rest } = r
        return rest
      }
      await db.transaction('rw', [db.workouts, db.checkins, db.mat, db.customExercises, db.settings], async () => {
        await Promise.all([db.workouts.clear(), db.checkins.clear(), db.mat.clear(), db.customExercises.clear(), db.settings.clear()])
        await db.workouts.bulkAdd((d.workouts ?? []).map(noId))
        await db.checkins.bulkAdd(d.checkins ?? [])
        await db.mat.bulkAdd((d.mat ?? []).map(noId))
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

      <CloudCard />
      <WhoopCard />

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
          {counts ? `${counts.w} workouts and ${counts.m} mat sessions on this phone. ` : ''}A file copy you keep yourself, on top of cloud sync.
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
        <Label>Delete data</Label>
        <p className="mb-3 text-[14px] text-mute">Removes every workout, check-in and mat session from this phone and from cloud sync. Export a backup first if you might want it back.</p>
        <Btn
          kind="danger"
          className="w-full"
          onClick={async () => {
            if (!confirm('Delete all training data here and in cloud sync? This cannot be undone.')) return
            await tombstoneAll()
            await Promise.all([db.workouts.clear(), db.checkins.clear(), db.mat.clear(), db.customExercises.clear(), db.settings.clear(), db.whoop.clear()])
            await syncNow()
            setMsg('All data deleted.')
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

const ago = (t: number | null) => {
  if (!t) return 'never'
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

function CloudCard() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!status.enabled) {
    return (
      <Card>
        <Label>Cloud sync</Label>
        <p className="mb-3 text-[14px] text-mute">Enter the passcode you set in Vercel. Your log is then backed up and shared between your phone and computer.</p>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setErr(null)
            try {
              await api('/api/sync', { method: 'POST', body: JSON.stringify({ cursor: new Date().toISOString(), changes: [] }) }, code)
              setPasscode(code)
              await syncNow()
            } catch (x) {
              setErr((x as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <input aria-label="Passcode" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode" className="h-12 min-w-0 flex-1 rounded-2xl bg-card2 px-4" />
          <Btn disabled={!code || busy}>{busy ? 'Checking…' : 'Turn on'}</Btn>
        </form>
        {err && (
          <p role="alert" className="mt-2 text-[14px] text-stop">
            {err}
          </p>
        )}
      </Card>
    )
  }
  return (
    <Card>
      <Label>Cloud sync</Label>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px]">
          {status.running ? 'Syncing…' : status.lastError ? <span className="text-stop">Last sync failed: {status.lastError}</span> : <>Synced {ago(status.lastOk)}</>}
          <div className="text-[13px] text-mute">Syncs on open, after each change, and every few minutes.</div>
        </div>
        <Btn kind="soft" className="shrink-0" disabled={status.running} onClick={() => syncNow()}>
          Sync now
        </Btn>
      </div>
      <button
        className="mt-3 text-[13px] text-mute underline decoration-line underline-offset-4"
        onClick={() => {
          if (confirm('Turn off cloud sync on this device? Your data stays here and in the cloud.')) setPasscode(null)
        }}
      >
        Turn off on this device
      </button>
    </Card>
  )
}

function WhoopCard() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus)
  const [state, setState] = useState<'unknown' | 'connected' | 'off'>('unknown')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(lastWhoopFetch())

  useEffect(() => {
    const h = location.hash
    if (h.includes('whoop=connected')) setNote('WHOOP connected. Pulling your last 10 days…')
    if (h.includes('whoop=error')) setNote('WHOOP: ' + decodeURIComponent(h.split('detail=')[1] ?? 'sign-in failed'))
    if (h.includes('whoop=')) history.replaceState(null, '', '#more')
    if (!getPasscode()) return
    refreshWhoop()
      .then((r) => {
        setState(r.connected ? 'connected' : 'off')
        setLast(lastWhoopFetch())
        if (r.connected && h.includes('whoop=connected')) setNote(`WHOOP connected. ${r.added} sessions added to your mat log.`)
      })
      .catch((e) => {
        setState('off')
        setNote('WHOOP: ' + (e as Error).message)
      })
  }, [status.enabled])

  return (
    <Card>
      <Label>WHOOP</Label>
      {!status.enabled ? (
        <p className="text-[14px] text-mute">Turn on cloud sync first — the WHOOP link uses the same passcode.</p>
      ) : state === 'connected' ? (
        <>
          <p className="text-[15px]">
            Connected · updated {ago(last)}
            <span className="block text-[13px] text-mute">Recovery feeds your morning readiness. BJJ, judo, runs and padel land in your mat log to rate.</span>
          </p>
          <div className="mt-3 flex gap-2">
            <Btn
              kind="soft"
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await refreshWhoop(14)
                  setLast(lastWhoopFetch())
                  setNote(r.added ? `${r.added} new sessions from WHOOP.` : 'Up to date.')
                  syncNow()
                } catch (e) {
                  setNote('WHOOP: ' + (e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Updating…' : 'Update now'}
            </Btn>
            <Btn
              kind="danger"
              onClick={async () => {
                if (!confirm('Disconnect WHOOP? Sessions already imported stay in your log.')) return
                await disconnectWhoop()
                setState('off')
                setNote('WHOOP disconnected.')
              }}
            >
              Disconnect
            </Btn>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[14px] text-mute">Brings in recovery, HRV and resting heart rate each morning, and your BJJ and judo sessions for you to rate.</p>
          <Btn
            className="w-full"
            disabled={busy || state === 'unknown'}
            onClick={async () => {
              setBusy(true)
              try {
                await connectWhoop()
              } catch (e) {
                setNote('WHOOP: ' + (e as Error).message)
                setBusy(false)
              }
            }}
          >
            {state === 'unknown' ? 'Checking…' : 'Connect WHOOP'}
          </Btn>
        </>
      )}
      {note && (
        <p role="status" className="mt-3 text-[14px] text-mute">
          {note}
        </p>
      )}
    </Card>
  )
}
