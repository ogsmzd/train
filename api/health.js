// Says which server settings are present and whether the database tables exist. Never returns values.
import { sb, send } from './_lib.js'

export default async function handler(req, res) {
  const has = (k) => Boolean(process.env[k])
  let database = 'not configured'
  if (has('SUPABASE_URL') && has('SUPABASE_SECRET_KEY')) {
    try {
      await sb('records?select=kind&limit=1')
      await sb('whoop_tokens?select=id&limit=1')
      database = 'ok'
    } catch (e) {
      database = /does not exist|PGRST205|schema cache/i.test(e.message) ? 'tables missing — run the setup SQL' : e.message
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
