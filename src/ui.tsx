import { useEffect, useId, type ReactNode } from 'react'
import type { Level } from './db'

export const LEVEL_COLOR: Record<Level, string> = { green: 'bg-go', amber: 'bg-warn', red: 'bg-stop' }
export const LEVEL_TEXT: Record<Level, string> = { green: 'text-go', amber: 'text-warn', red: 'text-stop' }
export const LEVEL_WORD: Record<Level, string> = { green: 'Green', amber: 'Amber', red: 'Red' }
export const LEVEL_LABEL: Record<Level, string> = { green: 'Push it today.', amber: 'Hold steady today.', red: 'Move, don’t grind.' }

// ---------- icons (one stroke family, 1.75px) ----------
const PATHS = {
  check: 'M5 12.5 10 17 19 7',
  info: 'M12 11v6M12 7.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  play: 'M8 5.5v13l10-6.5-10-6.5Z',
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
  chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  dumbbell: 'M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  timer: 'M12 8v5l3 2M9 2.5h6M21 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  skip: 'M6 18 18 6M6 6l12 12',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className = '', stroke = 1.75 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3.2 : stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

// ---------- surfaces ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-card p-4 ${className}`}>{children}</div>
}

export function Btn({ children, onClick, kind = 'primary', className = '', disabled, label }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'soft' | 'danger'; className?: string; disabled?: boolean; label?: string }) {
  const k = {
    primary: 'bg-ink text-bg font-bold',
    soft: 'bg-card2 text-ink font-semibold',
    ghost: 'text-ink font-semibold underline decoration-line decoration-2 underline-offset-4',
    danger: 'bg-card2 text-stop font-semibold',
  }[kind]
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`press min-h-12 rounded-2xl px-5 text-[16px] disabled:opacity-40 ${k} ${className}`}>
      {children}
    </button>
  )
}

/** 1–N tap scale with visible end labels */
export function Scale({ value, onChange, n = 5, labels, name }: { value?: number; onChange: (v: number) => void; n?: number; labels?: [string, string]; name: string }) {
  return (
    <div role="radiogroup" aria-label={name}>
      <div className="flex gap-1.5">
        {Array.from({ length: n }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`press num h-12 flex-1 rounded-xl text-[22px] ${value === v ? 'bg-ink text-bg' : 'bg-card2 text-mute'}`}
          >
            {v}
          </button>
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[13px] text-mute">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  )
}

export function Seg<T extends string>({ value, onChange, options, name }: { value?: T; onChange: (v: T) => void; options: { v: T; label: string; cls?: string }[]; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`press min-h-12 flex-1 rounded-xl px-2 text-[15px] font-semibold ${value === o.v ? o.cls ?? 'bg-ink text-bg' : 'bg-card2 text-mute'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = o
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="scrim fixed inset-0 z-50 flex items-end bg-black/55" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined} className="sheet pb-safe mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-card px-5 pt-2.5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="mx-auto mb-3 block h-6 w-16">
          <span className="mx-auto block h-1.5 w-10 rounded-full bg-line" />
        </button>
        {title && (
          <h2 id={id} className="mb-4 font-display text-[28px] font-extrabold uppercase leading-none tracking-wide">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

/** Big −/+ stepper so nobody has to fight the keyboard mid-set */
export function Stepper({ value, step, onChange, unit, label, min = 0 }: { value: number | null; step: number; onChange: (v: number) => void; unit?: string; label: string; min?: number }) {
  const v = value ?? 0
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return (
    <div className="flex flex-1 items-center rounded-2xl bg-card2" role="group" aria-label={label}>
      <button aria-label={`Less ${label}`} onClick={() => onChange(Math.max(min, +(v - step).toFixed(2)))} className="press grid h-14 w-12 place-items-center rounded-l-2xl text-mute">
        <Icon name="minus" size={22} stroke={2.2} />
      </button>
      <label className="flex flex-1 items-baseline justify-center gap-1">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="num w-full min-w-0 bg-transparent text-center text-[34px] outline-none"
          style={{ width: `${Math.max(2, fmt(v).length) + 0.5}ch` }}
        />
        {unit && <span className="text-[13px] font-semibold text-mute">{unit}</span>}
      </label>
      <button aria-label={`More ${label}`} onClick={() => onChange(+(v + step).toFixed(2))} className="press grid h-14 w-12 place-items-center rounded-r-2xl text-ink">
        <Icon name="plus" size={22} stroke={2.2} />
      </button>
    </div>
  )
}

export const fmtKg = (w: number | null | undefined) => (w == null || w === 0 ? 'BW' : Number.isInteger(w) ? `${w}` : w.toFixed(1))

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`eyebrow mb-2 ${className}`}>{children}</div>
}
