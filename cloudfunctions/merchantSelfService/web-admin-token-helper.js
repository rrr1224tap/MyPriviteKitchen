const crypto = require('node:crypto')

const TOKEN_ROLE = 'super_admin'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function base64urlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64urlDecode(value) {
  const text = normalizeText(value)
  if (!/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new Error('INVALID_BASE64URL')
  }

  const padded = text.padEnd(text.length + ((4 - (text.length % 4)) % 4), '=')
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function timingSafeEqualText(left, right) {
  const leftText = normalizeText(left)
  const rightText = normalizeText(right)

  if (!leftText || !rightText) {
    return false
  }

  const leftBuffer = Buffer.from(leftText)
  const rightBuffer = Buffer.from(rightText)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function signPayload(payloadSegment, secret) {
  return base64urlEncode(
    crypto
      .createHmac('sha256', secret)
      .update(payloadSegment)
      .digest()
  )
}

function verifyWebAdminToken(token, options = {}) {
  const secret = normalizeText(options.secret)
  const now = options.now instanceof Date ? options.now : new Date()

  if (!secret) {
    return {
      ok: false,
      code: 'SERVER_CONFIG_ERROR'
    }
  }

  const tokenText = normalizeText(token)
  if (!tokenText) {
    return {
      ok: false,
      code: 'UNAUTHORIZED'
    }
  }

  const parts = tokenText.split('.')
  if (parts.length !== 2) {
    return {
      ok: false,
      code: 'UNAUTHORIZED'
    }
  }

  const [payloadSegment, signatureSegment] = parts
  const expectedSignature = signPayload(payloadSegment, secret)
  if (!timingSafeEqualText(signatureSegment, expectedSignature)) {
    return {
      ok: false,
      code: 'UNAUTHORIZED'
    }
  }

  try {
    const payload = JSON.parse(base64urlDecode(payloadSegment).toString('utf8'))
    if (!payload || payload.role !== TOKEN_ROLE) {
      return {
        ok: false,
        code: 'UNAUTHORIZED'
      }
    }

    const expiresAt = new Date(payload.expires_at)
    if (!payload.expires_at || Number.isNaN(expiresAt.getTime())) {
      return {
        ok: false,
        code: 'UNAUTHORIZED'
      }
    }

    if (expiresAt.getTime() <= now.getTime()) {
      return {
        ok: false,
        code: 'TOKEN_EXPIRED'
      }
    }

    return {
      ok: true,
      is_web_admin: true,
      role: TOKEN_ROLE,
      payload
    }
  } catch (error) {
    return {
      ok: false,
      code: 'UNAUTHORIZED'
    }
  }
}

module.exports = {
  verifyWebAdminToken
}
