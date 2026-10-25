// Exercise library. Images come from free-exercise-db (public domain, Unlicense),
// bundled under /public/ex/<img>/0.jpg and 1.jpg so they work offline.
// Cues are Oggie-specific coaching points.

export type Unit = 'reps' | 'reps/side' | 's' | 's/side' | 'm' | 'min'

export interface Exercise {
  id: string
  name: string
  img?: string // free-exercise-db folder id
  cues: string[]
  why?: string // what it does for BJJ / judo
  unit: Unit
  inc: number // smallest sensible load jump in kg (0 = bodyweight only)
  loadLabel?: string // e.g. "per dumbbell"
  hevy?: string[] // exercise titles used in Hevy exports
  custom?: boolean
}

const E = (e: Exercise) => e

export const EXERCISES: Exercise[] = [
  // ---------- warm-up ----------
  E({ id: 'bike', name: 'Bike / rower, easy', img: 'Bicycling_Stationary', unit: 'min', inc: 0, cues: ['Conversational pace', 'Just get warm, not tired'] }),
  E({ id: 'cat_camel', name: 'Cat-camel', img: 'Cat_Stretch', unit: 'reps', inc: 0, cues: ['Slow, gentle range', "Don't force the end positions"] }),
  E({ id: 'bird_dog', name: 'Bird dog', unit: 'reps/side', inc: 0, hevy: ['Bird Dog'], cues: ['Hips level, reach long', 'Hold 3 s, no arching'], why: 'Posture in turtle, closed guard and passing' }),
  E({ id: 'side_plank', name: 'Side plank', img: 'Side_Bridge', unit: 's/side', inc: 0, cues: ['Straight line ear–hip–ankle', 'Push the floor away'], why: 'Base against sweeps, frames, kuzushi' }),
  E({ id: 'glute_bridge', name: 'Glute bridge', img: 'Single_Leg_Glute_Bridge', unit: 'reps', inc: 0, cues: ['Squeeze 2 s at the top', 'Ribs down, no back arch'], why: 'Hip drive for upa / bridge escapes' }),

  // ---------- pull ----------
  E({ id: 'mb_slam', name: 'Med-ball scoop toss / slam', img: 'Medicine_Ball_Scoop_Throw', unit: 'reps', inc: 2, cues: ['Hips snap first, arms follow', 'Every rep fast — stop when speed drops'], why: 'Explosive hip extension like a throw' }),
  E({ id: 'lat_pulldown', name: 'Lat pulldown', img: 'Wide-Grip_Lat_Pulldown', unit: 'reps', inc: 5, hevy: ['Lat Pulldown (Cable)', 'Lat Pulldown (Machine)'], cues: ['Sit tall, chest up', 'Elbows to back pockets', 'No leaning back to cheat'], why: 'Pulling opponents in, breaking posture' }),
  E({ id: 'tbar_row', name: 'T-bar row, chest-supported', img: 'Lying_T-Bar_Row', unit: 'reps', inc: 2.5, hevy: ['T Bar Row', 'Chest Supported Incline Row (Dumbbell)'], cues: ['Use the chest-pad version', 'Squeeze shoulder blades, 1 s pause'], why: 'Row strength without loading the low back' }),
  E({ id: 'sa_cable_row', name: 'Single-arm cable row', img: 'Seated_One-arm_Cable_Pulley_Rows', unit: 'reps', inc: 2.5, hevy: ['Single Arm Cable Row'], cues: ['Trunk stays square — resist the twist', 'Pull to the hip'], why: 'One-sided sleeve / collar pull' }),
  E({ id: 'straight_arm', name: 'Straight-arm pulldown', img: 'Straight-Arm_Pulldown', unit: 'reps', inc: 2.5, hevy: ['Straight Arm Lat Pulldown (Cable)'], cues: ['Arms long, slight elbow bend', 'Drive bar to thighs with the lats'] }),
  E({ id: 'face_pull', name: 'Face pull', img: 'Face_Pull', unit: 'reps', inc: 2.5, hevy: ['Face Pull'], cues: ['Pull to the forehead, thumbs back', 'Finish like a double-biceps pose'], why: 'Shoulder health for frames and underhooks' }),
  E({ id: 'rear_delt', name: 'Rear delt fly (machine)', img: 'Reverse_Machine_Flyes', unit: 'reps', inc: 2.5, hevy: ['Rear Delt Reverse Fly (Machine)'], cues: ['Lead with the elbows', 'Control the way back'] }),
  E({ id: 'db_curl', name: 'DB curl', img: 'Dumbbell_Bicep_Curl', unit: 'reps', inc: 2, loadLabel: 'per dumbbell', hevy: ['Bicep Curl (Dumbbell)'], cues: ['Elbows pinned, no hip swing', '2 s lowering'], why: 'Collar pulls, armbar defence' }),
  E({ id: 'hammer_cable', name: 'Hammer curl (cable)', img: 'Cable_Hammer_Curls_-_Rope_Attachment', unit: 'reps', inc: 2.5, hevy: ['Hammer Curl (Cable)'], cues: ['Neutral grip on the rope', 'Squeeze the rope hard'], why: 'Forearms and elbows for gi grips' }),
  E({ id: 'neck_iso', name: 'Neck isometrics, 4 directions', img: 'Isometric_Neck_Exercise_-_Front_And_Back', unit: 's', inc: 0, cues: ['Hand or band resistance', 'Front, back, both sides', 'Firm but never to strain'], why: 'Chokes, cross-face, judo falls' }),
  E({ id: 'knee_raise', name: 'Knee raise, parallel bars', img: 'Hanging_Leg_Raise', unit: 'reps', inc: 0, hevy: ['Knee Raise Parallel Bars'], cues: ['Knees to hip height', "Don't curl the pelvis up", 'Slow on the way down'], why: 'Hip flexors for guard retention' }),
  E({ id: 'pallof', name: 'Half-kneeling Pallof press', img: 'Pallof_Press', unit: 'reps/side', inc: 0, hevy: ['Cable Core Pallof Press'], cues: ['Press out, hold 2 s', 'Trunk does not rotate'], why: 'Resisting rotation — gi grips and kuzushi' }),
  E({ id: 'back_ext', name: '45° back extension', img: 'Hyperextensions_Back_Extensions', unit: 'reps', inc: 2.5, hevy: ['Back Extension (Hyperextension)'], cues: ['Hinge at the hips, spine neutral', '2 s hold at the top, no over-arching', 'Hug a plate once 12 reps are easy'], why: 'Lower-back strength for posture and lifting' }),

  // ---------- push ----------
  E({ id: 'mb_rot', name: 'Med-ball rotational throw', img: 'Medicine_Ball_Scoop_Throw', unit: 'reps/side', inc: 2, cues: ['Back hip drives the throw', 'Arms just follow through'], why: 'Hip-to-shoulder power for throws' }),
  E({ id: 'chest_press', name: 'Chest press (iso-lateral machine)', img: 'Leverage_Chest_Press', unit: 'reps', inc: 5, hevy: ['Iso-Lateral Chest Press (Machine)', 'Chest Press (Machine)'], cues: ['Shoulder blades back and down', 'Full lockout, controlled return'], why: 'Framing and benching out from bottom' }),
  E({ id: 'incline_db', name: 'Incline DB press', img: 'Incline_Dumbbell_Press', unit: 'reps', inc: 2, loadLabel: 'per dumbbell', hevy: ['Incline Bench Press (Dumbbell)'], cues: ['Feet down, no big arch', 'Elbows ~45°'] }),
  E({ id: 'seated_db_press', name: 'Seated DB shoulder press', img: 'Seated_Dumbbell_Press', unit: 'reps', inc: 2, loadLabel: 'per dumbbell', hevy: ['Overhead Press (Dumbbell)', 'Seated Overhead Press (Dumbbell)', 'Shoulder Press (Dumbbell)'], cues: ['Back on the pad', 'Ribs down — no arching to finish'], why: 'Overhead strength for posting and frames' }),
  E({ id: 'cable_fly', name: 'Cable fly', img: 'Cable_Crossover', unit: 'reps', inc: 2.5, hevy: ['Cable Fly Crossovers', 'Cable Fly'], cues: ['Stretch wide, squeeze hands together', 'No grinding reps'] }),
  E({ id: 'lateral_raise', name: 'Lateral raise (DB)', img: 'Side_Lateral_Raise', unit: 'reps', inc: 2, loadLabel: 'per dumbbell', hevy: ['Lateral Raise (Dumbbell)'], cues: ['Lead with elbows to shoulder height', 'No swinging'] }),
  E({ id: 'rope_pushdown', name: 'Triceps rope pushdown', img: 'Triceps_Pushdown_-_Rope_Attachment', unit: 'reps', inc: 2.5, hevy: ['Triceps Rope Pushdown', 'Triceps Pushdown'], cues: ['Elbows pinned', 'Split the rope at the bottom'], why: 'Locking out frames' }),
  E({ id: 'oh_tri', name: 'Overhead triceps extension (cable)', img: 'Cable_Rope_Overhead_Triceps_Extension', unit: 'reps', inc: 2.5, hevy: ['Overhead Triceps Extension (Cable)'], cues: ['Ribs down, no low-back arch', 'Full stretch behind the head'] }),
  E({ id: 'pushups', name: 'Push-ups', img: 'Pushups', unit: 'reps', inc: 0, hevy: ['Push Up'], cues: ['Body in one line', 'Stop 2 reps short of failure'] }),
  E({ id: 'tgu', name: 'Turkish get-up', img: 'Kettlebell_Turkish_Get-Up_Lunge_style', unit: 'reps/side', inc: 4, cues: ['Eyes on the bell the whole way', 'Slow — every position stable'], why: 'Frames, posting, technical stand-up in base' }),
  E({ id: 'ab_wheel', name: 'Ab wheel, from knees', img: 'Ab_Roller', unit: 'reps', inc: 0, cues: ['Hips never sag', 'Stop the rep when the low back wants to arch'], why: 'Anti-extension: posture when your head is pulled down' }),
  E({ id: 'chop_lift', name: 'Cable chop + lift, half-kneeling', img: 'Standing_Cable_Wood_Chop', unit: 'reps/side', inc: 2.5, cues: ['Arms move, trunk resists', '8 chops then 8 lifts each side'], why: 'Hip-to-shoulder force for throws and frames' }),
  E({ id: 'back_ext_iso', name: '45° back extension, ISO hold', img: 'Hyperextensions_Back_Extensions', unit: 's', inc: 5, cues: ['Hold at horizontal, spine locked neutral', 'Hug a plate once 45 s is easy'] }),
  E({ id: 'mobility', name: 'Hip 90/90 + T-spine open books', unit: 'reps/side', inc: 0, cues: ['Slow, breathe into the stretch', 'Rotation from hips and upper back, not low back'], why: 'Guard retention mobility' }),

  // ---------- legs ----------
  E({ id: 'kb_swing', name: 'Kettlebell swing', img: 'One-Arm_Kettlebell_Swings', unit: 'reps', inc: 4, cues: ['Hinge, then snap the hips', 'Stand tall at the top — no leaning back', 'Bell floats, arms are ropes'], why: 'Explosive hips for throws, bridging, upa' }),
  E({ id: 'db_rdl', name: 'Romanian deadlift (DB)', img: 'Stiff-Legged_Dumbbell_Deadlift', unit: 'reps', inc: 2, loadLabel: 'per dumbbell', hevy: ['Romanian Deadlift (Dumbbell)'], cues: ['3 s lowering', 'Stop at the hamstring stretch, before the back rounds', 'Film it occasionally'], why: 'Posterior chain — your documented weak link' }),
  E({ id: 'bulgarian', name: 'Bulgarian split squat (DB)', img: 'Split_Squat_with_Dumbbells', unit: 'reps/side', inc: 2, loadLabel: 'per dumbbell', hevy: ['Bulgarian Split Squat (Dumbbell)'], cues: ['Front shin roughly vertical', 'Control down, drive through the front heel'], why: 'Single-leg strength for entries and stand-ups' }),
  E({ id: 'leg_press', name: 'Leg press', img: 'Leg_Press', unit: 'reps', inc: 10, hevy: ['Leg Press (Machine)'], cues: ['Stop before your hips curl off the pad', 'Feet shoulder width'] }),
  E({ id: 'hip_thrust', name: 'Hip thrust (machine)', img: 'Barbell_Hip_Thrust', unit: 'reps', inc: 5, hevy: ['Hip Thrust (Machine)'], cues: ['Chin tucked, ribs down', '2 s squeeze at the top'] }),
  E({ id: 'leg_curl', name: 'Seated leg curl', img: 'Seated_Leg_Curl', unit: 'reps', inc: 5, hevy: ['Seated Leg Curl (Machine)'], cues: ['Hips pressed into the seat', 'Slow on the way back'], why: 'Hamstring strength' }),
  E({ id: 'calf_sl', name: 'Single-leg calf raise', img: 'Standing_Dumbbell_Calf_Raise', unit: 'reps/side', inc: 2, hevy: ['Single Leg Standing Calf Raise', 'Standing Calf Raise'], cues: ['Full stretch at the bottom', 'Hold a DB once 15 is easy'] }),
  E({ id: 'towel_pullup', name: 'Towel / gi pull-up (or towel hang)', unit: 'reps', inc: 0, cues: ['Towels over the bar, grip like a gi', 'Hang if pull-ups are not there yet', 'Stop at RPE 8'], why: 'Gi grip endurance' }),
  E({ id: 'dead_bug', name: 'Dead bug, weighted / band', img: 'Dead_Bug', unit: 'reps/side', inc: 2.5, hevy: ['Dead Bug'], cues: ['Low back stays glued to the floor', 'Exhale as you extend'] }),
  E({ id: 'copenhagen', name: 'Copenhagen plank, short lever', unit: 's/side', inc: 0, cues: ['Knee on the bench, hips high', 'Short lever first, long lever later'], why: 'Guard squeeze, groin protection in judo' }),
  E({ id: 'back_ext_loaded', name: '45° back extension, loaded', img: 'Hyperextensions_Back_Extensions', unit: 'reps', inc: 2.5, hevy: ['Back Extension (Weighted Hyperextension)'], cues: ['Plate hugged to chest', 'Hips hinge, spine stays neutral'], why: 'Heaviest back work of the week' }),
  E({ id: 'farmer', name: 'Farmer carry', img: 'Farmers_Walk', unit: 'm', inc: 2, loadLabel: 'per hand', cues: ['Tall, braced, short quick steps', "Don't let the bells touch your legs"], why: 'Grip + trunk' }),
  E({ id: 'bear_hug', name: 'Bear-hug sandbag / DB carry', img: 'Sandbag_Load', unit: 'm', inc: 5, cues: ['Hug it high to the chest', 'Stay tall — no leaning back'], why: 'Clinch, body lock, lifting a resisting body' }),
]

export const EX_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

export function ytLink(name: string) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' exercise form')
}
