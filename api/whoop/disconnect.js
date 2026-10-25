// Revoke the app's WHOOP access and forget the tokens.
import { accessToken, HttpError, requirePasscode, route, sb, send, WHOOP_API } from '../_lib.js'

export default route(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
  requirePasscode(req)
  try {
    const token = await accessToken()
    if (token) await fetch(`${WHOOP_API}/v2/user/access`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  } catch {}
  await sb('whoop_tokens?id=eq.1', { method: 'DELETE' })
  send(res, 200, { connected: false })
})
