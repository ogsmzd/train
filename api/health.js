// Reports whether server-side settings are present. Never returns the values.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    ok: true,
    whoopClientId: Boolean(process.env.WHOOP_CLIENT_ID),
    whoopClientSecret: Boolean(process.env.WHOOP_CLIENT_SECRET),
  })
}
