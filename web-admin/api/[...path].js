const UPSTREAM_BASE =
  'https://cloud1-d1gg2kdq762389ea4-1443234267.ap-shanghai.app.tcloudbase.com'

function getFunctionPath(req) {
  const path = req.query?.path
  if (Array.isArray(path)) {
    return path.filter(Boolean).join('/')
  }

  return typeof path === 'string' ? path : ''
}

export default async function handler(req, res) {
  const functionPath = getFunctionPath(req)
  if (!functionPath) {
    return res.status(404).json({
      error: 'FUNCTION_NOT_FOUND'
    })
  }

  const upstreamUrl = `${UPSTREAM_BASE}/${functionPath}`

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'CloudBase proxy',
      upstream: upstreamUrl
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED'
    })
  }

  try {
    const upstream = await fetch(upstreamUrl, {
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
      upstream: upstreamUrl
    })
  }
}
