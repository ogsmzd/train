// WHOOP redirects here after sign-in. Swap the code for tokens, keep them server-side, go back to the app.
import { checkState, redirectUri, saveTokens, tokenRequest } from '../_lib.js'

export default async function handler(req, res) {
  const back = (status, detail) => {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, `/#more?whoop=${status}${detail ? '&detail=' + encodeURIComponent(detail) : ''}`)
  }
  try {
    const { code, state, error, error_description } = req.query
    if (error) return back('error', error_description || error)
    if (!checkState(state)) return back('error', 'The sign-in link expired or was not started from the app. Try again from More.')
    if (!code) return back('error', 'WHOOP sent no authorisation code.')
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(req) })
    await saveTokens(tokens)
    back('connected')
  } catch (e) {
    console.error(e)
    back('error', e.message)
  }
}
