# Train

Oggie's personal gym + mat + recovery log. A light web app you add to the iPhone home screen.

- **Today**: morning check-in (back, sleep, soreness, energy) sets the day's readiness; today's session with suggested weights; BJJ / judo sessions with your own feel rating.
- **Workout**: v5 Push / Pull / Legs with back warm-up, abs and heavy back finisher. Each exercise shows the suggested load and why, last session's numbers, set logging, rest timer, and an Easy / Solid / Grind tap that feeds the next suggestion.
- **Progress**: history (including Hevy import) and estimated-1RM trend for the main lifts.
- **Exercises**: picture demo, key cues, what it does on the mat, link to form videos.
- **More**: Hevy CSV import, weekly summary to paste to Claude, backup/restore, programme start date (every 6th week = deload).

Data is stored on the device (IndexedDB) so it works with no signal in the gym. Cloud sync and WHOOP come in Phase 2.

## Run locally
    npm install
    npm run dev        # http://localhost:5173
    npm test           # suggestion-engine tests

## Deploy
Push to GitHub, then import the repo in Vercel (framework: Vite, defaults are fine).

Exercise images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
