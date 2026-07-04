const crypto = require('node:crypto')

const TOKEN_ROLES = ['super_admin', 'merchant_admin']

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
      code: 'TOKEN_INVALID'
    }
  }

  const [payloadSegment, signatureSegment] = parts
  const expectedSignature = signPayload(payloadSegment, secret)
  if (!timingSafeEqualText(signatureSegment, expectedSignature)) {
    return {
      ok: false,
      code: 'TOKEN_INVALID'
    }
  }

  try {
    const payload = JSON.parse(base64urlDecode(payloadSegment).toString('utf8'))
    if (!payload || !TOKEN_ROLES.includes(payload.role)) {
      return {
        ok: false,
        code: 'FORBIDDEN'
      }
    }

    const expiresAt = new Date(payload.expires_at)
    if (!payload.expires_at || Number.isNaN(expiresAt.getTime())) {
      return {
        ok: false,
        code: 'TOKEN_INVALID'
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
      role: payload.role,
      merchant_id: normalizeText(payload.merchant_id),
      staff_id: normalizeText(payload.staff_id),
      account_id: normalizeText(payload.account_id),
      login_name: normalizeText(payload.login_name),
      expires_at: payload.expires_at,
      token_version: payload.token_version
    }
  } catch (error) {
    return {
      ok: false,
      code: 'TOKEN_INVALID'
    }
  }
}

function resolveAuthorizedMerchantId(authContext = {}, requestedMerchantId = '') {
  const requestMerchantId = normalizeText(requestedMerchantId)

  if (authContext.role === 'super_admin') {
    return {
      ok: true,
      merchant_id: requestMerchantId
    }
  }

  if (authContext.role !== 'merchant_admin') {
    return {
      ok: false,
      code: 'FORBIDDEN'
    }
  }

  const tokenMerchantId = normalizeText(authContext.merchant_id)
  if (!tokenMerchantId) {
    return {
      ok: false,
      code: 'TOKEN_INVALID'
    }
  }

  if (requestMerchantId && requestMerchantId !== tokenMerchantId) {
    return {
      ok: false,
      code: 'MERCHANT_SCOPE_FORBIDDEN'
    }
  }

  return {
    ok: true,
    merchant_id: tokenMerchantId
  }
}

module.exports = {
  verifyWebAdminToken,
  resolveAuthorizedMerchantId
}
