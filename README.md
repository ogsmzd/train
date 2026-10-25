# Train

Oggie's personal gym + mat + recovery log. A light web app you add to the iPhone home screen.

- **Today**: morning check-in (back, sleep, soreness, energy) sets the day's readiness; today's session with suggested weights; BJJ / judo sessions with your own feel rating.
- **Workout**: v5 Push / Pull / Legs with back warm-up, abs and heavy back finisher. Each exercise shows the suggested load and why, last session's numbers, set logging, rest timer, and an Easy / Solid / Grind tap that feeds the next suggestion.
- **Progress**: history (including Hevy import) and estimated-1RM trend for the main lifts.
- **Exercises**: picture demo, key cues, what it does on the mat, link to form videos.
- **More**: Hevy CSV import, weekly summary to paste to Claude, backup/restore, programme start date (every 6th week = deload).

Data is stored on the device (IndexedDB) so it works with no signal in the gym, and syncs to Supabase through passcode-protected Vercel functions (last write wins per record).

WHOOP (official API v2): morning recovery, HRV, resting HR and sleep feed readiness; BJJ, judo, runs and padel become mat-log entries to rate. Tokens live server-side only.

## Server settings (Vercel → Settings → Environment Variables)
`WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_PASSCODE`. Check them at `/api/health`.

## Run locally
    npm install
    npm run dev        # http://localhost:5173
    npm test           # suggestion-engine tests

## Deploy
Push to GitHub, then import the repo in Vercel (framework: Vite, defaults are fine).

Exercise images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
