import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO } from './db'
import { readiness } from './engine/suggest'
import { Icon, type IconName } from './ui'
import Today from './screens/Today'
import WorkoutScreen from './screens/Workout'
import Progress from './screens/Progress'
import Exercises from './screens/Exercises'
import More from './screens/More'

type Tab = 'today' | 'progress' | 'exercises' | 'more'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'exercises', label: 'Exercises', icon: 'dumbbell' },
  { id: 'more', label: 'More', icon: 'more' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const h = location.hash.slice(1) as Tab
    return TABS.some((t) => t.id === h) ? h : 'today'
  })
  const [inWorkout, setInWorkout] = useState(false)
  const active = useLiveQuery(() => db.workouts.filter((w) => w.source === 'app' && !w.endedAt).count())
  const checkin = useLiveQuery(() => db.checkins.get(todayISO()))

  // the whole app takes on today's readiness colour
  useEffect(() => {
    const el = document.documentElement
    if (checkin) el.dataset.ready = readiness(checkin).level
    else delete el.dataset.ready
  }, [checkin])

  useEffect(() => {
    history.replaceState(null, '', '#' + tab)
    window.scrollTo(0, 0)
  }, [tab])

  if (inWorkout) return <WorkoutScreen onClose={() => setInWorkout(false)} />

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="pt-safe mx-auto w-full max-w-lg flex-1 px-5 pb-32">
        {tab === 'today' && <Today onOpenWorkout={() => setInWorkout(true)} />}
        {tab === 'progress' && <Progress />}
        {tab === 'exercises' && <Exercises />}
        {tab === 'more' && <More />}
      </main>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={on ? 'page' : undefined} className={`press relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${on ? 'text-ink' : 'text-mute'}`}>
                <span className={`absolute top-0 h-[3px] w-8 rounded-b-full ${on ? 'bg-tint' : ''}`} />
                <span className="relative">
                  <Icon name={t.icon} size={24} stroke={on ? 2.2 : 1.75} />
                  {t.id === 'today' && active ? <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-tint ring-2 ring-bg" aria-label="Session in progress" /> : null}
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
