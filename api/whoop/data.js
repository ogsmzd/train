// Recent WHOOP recovery and workouts, trimmed to what the app uses.
import { HttpError, loadTokens, requirePasscode, route, send, whoopCollection } from '../_lib.js'

export default route(async (req, res) => {
  requirePasscode(req)
  if (!(await loadTokens())) return send(res, 200, { connected: false })
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 10))
  const start = new Date(Date.now() - days * 86400000).toISOString()
  const [recoveries, workouts, sleeps] = await Promise.all([
    whoopCollection('/v2/recovery', start),
    whoopCollection('/v2/activity/workout', start),
    whoopCollection('/v2/activity/sleep', start).catch(() => []),
  ])
  const sleepById = new Map(sleeps.map((s) => [String(s.id), s]))
  send(res, 200, {
    connected: true,
    fetchedAt: Date.now(),
    recoveries: recoveries
      .filter((r) => r.score_state === 'SCORED' && r.score)
      .map((r) => {
        const s = sleepById.get(String(r.sleep_id))
        return {
          cycleId: r.cycle_id,
          at: s?.end || r.created_at, // wake-up time decides which day it belongs to
          tz: s?.timezone_offset || null,
          recovery: Math.round(r.score.recovery_score),
          hrv: r.score.hrv_rmssd_milli != null ? Math.round(r.score.hrv_rmssd_milli) : null,
          rhr: r.score.resting_heart_rate != null ? Math.round(r.score.resting_heart_rate) : null,
          sleepPerf: s?.score?.sleep_performance_percentage != null ? Math.round(s.score.sleep_performance_percentage) : null,
        }
      }),
    workouts: workouts
      .filter((w) => w.score_state === 'SCORED')
      .map((w) => ({
        id: String(w.id),
        start: w.start,
        end: w.end,
        tz: w.timezone_offset || null,
        sport: w.sport_name || '',
        strain: w.score?.strain != null ? Math.round(w.score.strain * 10) / 10 : null,
        avgHr: w.score?.average_heart_rate ?? null,
      })),
  })
})
