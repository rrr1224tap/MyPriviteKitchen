export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'webAdminAuth proxy'
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED'
    })
  }

  try {
    const upstream = await fetch(
      'https://cloud1-d1gg2kq762389ea4-1443234267.ap-shanghai.app.tcloudbase.com/webAdminAuth',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body || {})
      }
    )

    const contentType = upstream.headers.get('content-type') || 'application/json'
    const text = await upstream.text()

    res.status(upstream.status)
    res.setHeader('Content-Type', contentType)
    return res.send(text)
  } catch (error) {
    return res.status(502).json({
      error: 'UPSTREAM_UNAVAILABLE',
      message: error && error.message ? error.message : 'Failed to reach CloudBase'
    })
  }
}
