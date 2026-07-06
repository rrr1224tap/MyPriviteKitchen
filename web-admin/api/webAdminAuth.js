const UPSTREAM =
  'https://cloud1-d1gg2kdq762389ea4-1443234267.ap-shanghai.app.tcloudbase.com/webAdminAuth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'webAdminAuth proxy',
      upstream: UPSTREAM
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED'
    })
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body || {})
    })

    const contentType = upstream.headers.get('content-type') || ''
    const text = await upstream.text()

    res.status(upstream.status)

    if (contentType.includes('application/json')) {
      try {
        return res.json(JSON.parse(text))
      } catch (error) {
        return res.send(text)
      }
    }

    return res.send(text)
  } catch (error) {
    return res.status(502).json({
      error: 'UPSTREAM_UNAVAILABLE',
      message: error && error.message ? error.message : 'Failed to reach CloudBase',
      upstream: UPSTREAM
    })
  }
}
