// Returns the WHOOP sign-in link. The phone opens it; WHOOP sends the user back to /api/whoop/callback.
import { env, HttpError, makeState, redirectUri, requirePasscode, route, send, WHOOP_AUTH, WHOOP_SCOPES } from '../_lib.js'

export default route(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
  requirePasscode(req)
  const params = new URLSearchParams({
    client_id: env('WHOOP_CLIENT_ID'),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: WHOOP_SCOPES,
    state: makeState(),
  })
  send(res, 200, { url: `${WHOOP_AUTH}/auth?${params}` })
})
