const crypto = require('node:crypto')

const DEFAULT_TTL_MINUTES = 240
const TOKEN_ROLE = 'super_admin'

function success(data) {
  return {
    success: true,
    data
  }
}

function failure(code, message) {
  return {
    success: false,
    error: {
      code,
      message
    }
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function hashPasscode(passcode) {
  return crypto.createHash('sha256').update(normalizeText(passcode)).digest('hex')
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

function timingSafeEqualHex(left, right) {
  const leftText = normalizeText(left).toLowerCase()
  const rightText = normalizeText(right).toLowerCase()

  if (!/^[0-9a-f]+$/.test(leftText) || !/^[0-9a-f]+$/.test(rightText)) {
    return false
  }

  if (leftText.length !== rightText.length) {
    return false
  }

  return crypto.timingSafeEqual(Buffer.from(leftText, 'hex'), Buffer.from(rightText, 'hex'))
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

function signPayload(payloadSegment, secret) {
  return base64urlEncode(
    crypto
      .createHmac('sha256', secret)
      .update(payloadSegment)
      .digest()
  )
}

function parseTtlMinutes(value) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return DEFAULT_TTL_MINUTES
  }

  return numberValue
}

function createSignedToken(options = {}) {
  const role = normalizeText(options.role) || TOKEN_ROLE
  const secret = normalizeText(options.secret)
  const now = options.now instanceof Date ? options.now : new Date()
  const ttlMinutes = parseTtlMinutes(options.ttlMinutes)
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000)
  const nonce = normalizeText(options.nonce) || crypto.randomBytes(16).toString('hex')

  if (!secret) {
    throw new Error('TOKEN_SECRET_REQUIRED')
  }

  const payload = {
    role,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce
  }
  const payloadSegment = base64urlEncode(JSON.stringify(payload))
  const signatureSegment = signPayload(payloadSegment, secret)

  return {
    token: `${payloadSegment}.${signatureSegment}`,
    payload,
    expires_at: payload.expires_at
  }
}

function verifySignedToken(token, options = {}) {
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
      payload
    }
  } catch (error) {
    return {
      ok: false,
      code: 'UNAUTHORIZED'
    }
  }
}

function parseJsonBody(body) {
  if (!body) {
    return {}
  }

  if (typeof body === 'object' && !Array.isArray(body)) {
    return body
  }

  if (typeof body !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(body)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

function getPayload(event = {}) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return {}
  }

  if (event.action) {
    return event
  }

  const bodyPayload = parseJsonBody(event.body)
  if (bodyPayload.action) {
    return bodyPayload
  }

  const queryPayload = event.queryStringParameters
  if (queryPayload && typeof queryPayload === 'object' && !Array.isArray(queryPayload)) {
    return queryPayload
  }

  return {}
}

function getConfig(deps = {}) {
  return {
    passcodeHash: normalizeText(deps.getPasscodeHash ? deps.getPasscodeHash() : process.env.WEB_ADMIN_PASSCODE_HASH),
    passcode: normalizeText(deps.getPasscode ? deps.getPasscode() : process.env.WEB_ADMIN_PASSCODE),
    tokenSecret: normalizeText(deps.getTokenSecret ? deps.getTokenSecret() : process.env.WEB_ADMIN_TOKEN_SECRET),
    tokenTtlMinutes: deps.getTokenTtlMinutes ? deps.getTokenTtlMinutes() : process.env.WEB_ADMIN_TOKEN_TTL_MINUTES
  }
}

function isPasscodeValid(inputPasscode, config) {
  const passcode = normalizeText(inputPasscode)
  if (!passcode) {
    return false
  }

  if (config.passcodeHash) {
    return timingSafeEqualHex(hashPasscode(passcode), config.passcodeHash)
  }

  if (config.passcode) {
    return timingSafeEqualText(passcode, config.passcode)
  }

  return false
}

function createWebAdminAuthHandler(dependencies = {}) {
  const deps = {
    now: dependencies.now || (() => new Date()),
    createNonce: dependencies.createNonce || (() => crypto.randomBytes(16).toString('hex')),
    logger: dependencies.logger || console,
    ...dependencies
  }

  return async function webAdminAuth(event = {}) {
    try {
      const payload = getPayload(event)
      const action = normalizeText(payload.action)

      if (!['login', 'verify'].includes(action)) {
        return failure('INVALID_ACTION', '后台登录操作类型不合法')
      }

      const config = getConfig(deps)
      if (!config.tokenSecret) {
        return failure('SERVER_CONFIG_ERROR', '后台登录配置缺失，请联系管理员')
      }

      if (action === 'login') {
        if (!config.passcodeHash && !config.passcode) {
          return failure('SERVER_CONFIG_ERROR', '后台登录配置缺失，请联系管理员')
        }

        if (!isPasscodeValid(payload.passcode, config)) {
          return failure('INVALID_PASSCODE', '管理口令无效')
        }

        const tokenResult = createSignedToken({
          role: TOKEN_ROLE,
          now: deps.now(),
          ttlMinutes: config.tokenTtlMinutes,
          nonce: deps.createNonce(),
          secret: config.tokenSecret
        })

        return success({
          token: tokenResult.token,
          expires_at: tokenResult.expires_at,
          role: TOKEN_ROLE
        })
      }

      const verifyResult = verifySignedToken(payload.token, {
        secret: config.tokenSecret,
        now: deps.now()
      })

      if (!verifyResult.ok) {
        return failure(
          verifyResult.code,
          verifyResult.code === 'TOKEN_EXPIRED' ? '登录状态已过期' : '登录状态无效或已过期'
        )
      }

      return success({
        valid: true,
        role: TOKEN_ROLE,
        expires_at: verifyResult.payload.expires_at
      })
    } catch (error) {
      if (typeof deps.logger.error === 'function') {
        deps.logger.error('webAdminAuth failed', error)
      }

      return failure('INTERNAL_ERROR', '后台登录服务异常，请稍后重试')
    }
  }
}

module.exports = {
  createWebAdminAuthHandler,
  createSignedToken,
  verifySignedToken,
  hashPasscode,
  parseTtlMinutes
}
