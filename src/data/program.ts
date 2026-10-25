// Oggie's v5 programme (Oct 2026) + weekly mat schedule.

export type Section = 'warmup' | 'main' | 'abs' | 'finisher' | 'cooldown'
export type Role = 'power' | 'core' | 'grappling' | 'accessory' | 'warmup'

export interface Item {
  ex: string
  sets: number
  min: number // bottom of rep (or seconds / metres) range
  max: number // top of range
  rest: number // seconds
  start: number // starting load in kg (0 = bodyweight)
  role: Role
  cut?: number // cut order on bad days: 1 goes first
  spine?: boolean // skipped when the back is flagged red
}

export interface Day {
  id: 'pull' | 'push' | 'legs'
  name: string
  weekday: number // 0 Sun … 6 Sat
  note: string
  sections: { key: Section; label: string; items: Item[] }[]
}

const I = (ex: string, sets: number, min: number, max: number, rest: number, start: number, role: Role, extra: Partial<Item> = {}): Item => ({ ex, sets, min, max, rest, start, role, ...extra })

const WARMUP = {
  key: 'warmup' as const,
  label: 'Back warm-up · 10 min',
  items: [
    I('bike', 1, 5, 5, 0, 0, 'warmup'),
    I('cat_camel', 1, 8, 8, 0, 0, 'warmup'),
    I('bird_dog', 2, 8, 8, 20, 0, 'warmup'),
    I('side_plank', 2, 20, 20, 20, 0, 'warmup'),
    I('glute_bridge', 2, 12, 12, 20, 0, 'warmup'),
    I('dead_bug', 1, 8, 8, 0, 0, 'warmup'),
  ],
}

export const PROGRAM: Day[] = [
  {
    id: 'pull',
    name: 'Pull',
    weekday: 1,
    note: 'BJJ at 11:30 — straps on heavy rows and pulldowns to save grip for Tuesday.',
    sections: [
      WARMUP,
      {
        key: 'main',
        label: 'Main',
        items: [
          I('mb_slam', 3, 5, 5, 60, 7, 'power'),
          I('lat_pulldown', 4, 6, 10, 150, 45, 'core'),
          I('tbar_row', 4, 8, 10, 120, 15, 'core'),
          I('sa_cable_row', 3, 10, 12, 90, 12.5, 'accessory'),
          I('straight_arm', 3, 12, 15, 60, 20, 'accessory', { cut: 4 }),
          I('face_pull', 3, 12, 15, 60, 17.5, 'accessory'),
          I('rear_delt', 3, 12, 15, 60, 7.5, 'accessory', { cut: 3 }),
          I('db_curl', 3, 8, 12, 75, 10, 'accessory'),
          I('hammer_cable', 3, 10, 12, 60, 15, 'accessory', { cut: 5 }),
          I('neck_iso', 2, 15, 15, 30, 0, 'grappling'),
        ],
      },
      { key: 'abs', label: 'Abs', items: [I('knee_raise', 3, 12, 15, 60, 0, 'core'), I('pallof', 3, 8, 8, 45, 0, 'grappling')] },
      { key: 'finisher', label: 'Heavy back finisher', items: [I('back_ext', 3, 10, 12, 90, 0, 'core', { spine: true })] },
    ],
  },
  {
    id: 'push',
    name: 'Push',
    weekday: 3,
    note: 'Between your two hardest mat days — crisp, no grinding.',
    sections: [
      WARMUP,
      {
        key: 'main',
        label: 'Main',
        items: [
          I('mb_rot', 3, 5, 5, 60, 5, 'power'),
          I('chest_press', 4, 6, 10, 150, 50, 'core'),
          I('incline_db', 3, 8, 12, 120, 18, 'core'),
          I('seated_db_press', 3, 8, 10, 120, 12, 'core'),
          I('cable_fly', 3, 12, 15, 60, 15, 'accessory', { cut: 2 }),
          I('lateral_raise', 3, 12, 20, 60, 6, 'accessory', { cut: 1 }),
          I('rope_pushdown', 3, 10, 12, 60, 12.5, 'accessory'),
          I('oh_tri', 3, 10, 12, 60, 12.5, 'accessory', { cut: 5 }),
          I('pushups', 2, 10, 25, 60, 0, 'accessory'),
          I('tgu', 2, 3, 3, 60, 8, 'grappling'),
        ],
      },
      { key: 'abs', label: 'Abs', items: [I('ab_wheel', 3, 8, 12, 90, 0, 'core'), I('chop_lift', 2, 8, 8, 45, 10, 'grappling')] },
      { key: 'finisher', label: 'Heavy back finisher', items: [I('back_ext_iso', 3, 30, 45, 60, 0, 'core', { spine: true })] },
      { key: 'cooldown', label: 'Close', items: [I('mobility', 2, 8, 8, 0, 0, 'warmup')] },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    weekday: 5,
    note: 'BJJ at 11:30 is technique only. The weekend absorbs the soreness.',
    sections: [
      WARMUP,
      {
        key: 'main',
        label: 'Main',
        items: [
          I('kb_swing', 4, 8, 8, 60, 16, 'power', { spine: true }),
          I('db_rdl', 4, 6, 8, 150, 16, 'core', { spine: true }),
          I('bulgarian', 3, 8, 10, 120, 10, 'core'),
          I('leg_press', 3, 10, 12, 120, 100, 'core'),
          I('hip_thrust', 3, 10, 12, 90, 25, 'accessory'),
          I('leg_curl', 3, 10, 12, 90, 45, 'accessory'),
          I('calf_sl', 3, 12, 15, 60, 0, 'accessory', { cut: 1 }),
          I('towel_pullup', 3, 3, 8, 90, 0, 'grappling'),
          I('neck_iso', 2, 15, 15, 30, 0, 'grappling'),
        ],
      },
      { key: 'abs', label: 'Abs', items: [I('dead_bug', 3, 10, 10, 60, 2.5, 'core'), I('copenhagen', 2, 20, 30, 45, 0, 'grappling')] },
      {
        key: 'finisher',
        label: 'Heavy back finisher',
        items: [
          I('back_ext_loaded', 3, 8, 10, 120, 10, 'core', { spine: true }),
          I('farmer', 3, 30, 30, 90, 24, 'core'),
          I('bear_hug', 2, 30, 30, 90, 20, 'grappling', { spine: true }),
        ],
      },
    ],
  },
]

export const DAY_BY_ID = Object.fromEntries(PROGRAM.map((d) => [d.id, d])) as Record<Day['id'], Day>

// ---------- mat schedule ----------
export type MatType = 'BJJ group' | 'Private BJJ' | 'Judo' | 'Open mat' | 'Run' | 'Padel' | 'Other'
export interface MatSlot {
  type: MatType
  label: string
  time: string
  minutes: number
}

export const MAT_SCHEDULE: Record<number, MatSlot[]> = {
  1: [{ type: 'BJJ group', label: 'Group BJJ · beginner', time: '11:30', minutes: 60 }],
  2: [
    { type: 'BJJ group', label: 'Group BJJ · all levels', time: '07:00', minutes: 60 },
    { type: 'Private BJJ', label: 'Private BJJ', time: '08:00', minutes: 60 },
    { type: 'Judo', label: 'Judo', time: '18:30', minutes: 120 },
  ],
  3: [{ type: 'BJJ group', label: 'Group BJJ · beginner', time: '12:30', minutes: 60 }],
  4: [
    { type: 'BJJ group', label: 'Group BJJ · all levels', time: '07:00', minutes: 60 },
    { type: 'Private BJJ', label: 'Private BJJ', time: '08:00', minutes: 60 },
    { type: 'Judo', label: 'Judo', time: '18:30', minutes: 60 },
  ],
  5: [{ type: 'BJJ group', label: 'Group BJJ · beginner (technique only)', time: '11:30', minutes: 60 }],
}

// Hevy routine titles → programme day (for history import)
export const HEVY_DAY: Record<string, Day['id']> = {
  'Upper Pull': 'pull',
  Back: 'pull',
  'Upper Push': 'push',
  Chest: 'push',
  'Lower Body': 'legs',
  Legs: 'legs',
}
