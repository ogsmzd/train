// Says which server settings are present and whether the database tables exist. Never returns values.
import { sb, scrub, send } from './_lib.js'

export default async function handler(req, res) {
  const has = (k) => Boolean((process.env[k] || '').trim())
  let database = 'not configured'
  if (has('SUPABASE_URL') && has('SUPABASE_SECRET_KEY')) {
    try {
      await sb('records?select=kind&limit=1')
      await sb('whoop_tokens?select=id&limit=1')
      database = 'ok'
    } catch (e) {
      const m = String(e.message || '')
      database = /does not exist|PGRST205|schema cache/i.test(m)
        ? 'tables missing — run the setup SQL'
        : /\(401\)|\(403\)|invalid api key|unauthor/i.test(m)
          ? `secret key rejected (HTTP ${(m.match(/\((\d{3})\)/) || [])[1] || '?'}) — check SUPABASE_SECRET_KEY, then redeploy`
          : /ENOTFOUND|fetch failed|Invalid URL/i.test(m)
            ? 'cannot reach SUPABASE_URL — check the address'
            : 'error: ' + scrub(m).slice(0, 120)
    }
  }
  let whoop = 'not connected'
  if (database === 'ok') {
    try {
      const rows = await sb('whoop_tokens?select=id&limit=1')
      if (rows?.length) whoop = 'connected'
    } catch {}
  }
  send(res, 200, {
    ok: true,
    whoopClientId: has('WHOOP_CLIENT_ID'),
    whoopClientSecret: has('WHOOP_CLIENT_SECRET'),
    supabaseUrl: has('SUPABASE_URL'),
    supabaseSecretKey: has('SUPABASE_SECRET_KEY'),
    appPasscode: has('APP_PASSCODE'),
    database,
    whoop,
  })
}
