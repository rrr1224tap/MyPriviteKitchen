const crypto = require('node:crypto')
const { verifyWebAdminToken } = require('./web-admin-token-helper')

const CREATE_SIGNUP_INVITE_ACTION = 'createMerchantSignupInvite'
const PREVIEW_SIGNUP_INVITE_ACTION = 'previewMerchantSignupInvite'
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8,12}$/
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_EXPIRES_DAYS = 7
const MAX_EXPIRES_DAYS = 30
const MAX_REMARK_LENGTH = 100
const MAX_CODE_RETRY = 5

function success(message, data = {}) {
  return {
    success: true,
    code: 'SUCCESS',
    message,
    data
  }
}

function failure(code, message) {
  return {
    success: false,
    code,
    message,
    data: null
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
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

function normalizeEventPayload(event = {}) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return {}
  }

  if (Object.prototype.hasOwnProperty.call(event, 'action') ||
    Object.prototype.hasOwnProperty.call(event, 'admin_token')) {
    return event
  }

  const bodyPayload = parseJsonBody(event.body)
  if (Object.keys(bodyPayload).length > 0) {
    return bodyPayload
  }

  const queryPayload = event.queryStringParameters
  if (queryPayload && typeof queryPayload === 'object' && !Array.isArray(queryPayload)) {
    return queryPayload
  }

  return {}
}

function createRandomInviteCode() {
  let code = ''
  for (let index = 0; index < 8; index += 1) {
    code += INVITE_CODE_CHARS[crypto.randomInt(0, INVITE_CODE_CHARS.length)]
  }
  return code
}

function buildDependencies(dependencies = {}) {
  return {
    getTokenSecret: dependencies.getTokenSecret,
    now: dependencies.now || (() => new Date()),
    createInviteCode: dependencies.createInviteCode || createRandomInviteCode,
    findInviteByCode: dependencies.findInviteByCode,
    createInvite: dependencies.createInvite,
    logger: dependencies.logger || console
  }
}

function assertSuperAdmin(payload, deps) {
  const verifyResult = verifyWebAdminToken(payload.admin_token, {
    secret: deps.getTokenSecret ? deps.getTokenSecret() : process.env.WEB_ADMIN_TOKEN_SECRET,
    now: deps.now()
  })

  if (!verifyResult.ok) {
    return {
      error: failure(
        verifyResult.code,
        verifyResult.code === 'TOKEN_EXPIRED' ? '登录状态已过期，请重新登录' : '登录状态无效或已过期'
      )
    }
  }

  if (verifyResult.role !== 'super_admin') {
    return {
      error: failure('FORBIDDEN', '只有超级管理员可以创建开店邀请码')
    }
  }

  return {
    role: 'super_admin'
  }
}

function parseExpiresDays(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_EXPIRES_DAYS
  }

  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > MAX_EXPIRES_DAYS) {
    return null
  }

  return numberValue
}

function formatInvite(invite = {}) {
  return {
    code: invite.code || '',
    invite_type: invite.invite_type || 'merchant_signup',
    status: invite.status || 'unused',
    role: invite.role || 'owner',
    expires_at: invite.expires_at || null,
    created_at: invite.created_at || null,
    remark: invite.remark || ''
  }
}

function formatInvitePreview(invite = {}) {
  return {
    code: invite.code || '',
    invite_type: invite.invite_type || '',
    status: invite.status || '',
    can_use: true,
    expires_at: invite.expires_at || null
  }
}

function normalizeInviteCode(value) {
  return normalizeText(value).toUpperCase()
}

function isValidInviteCode(code) {
  return INVITE_CODE_PATTERN.test(code)
}

async function createUniqueInviteCode(deps) {
  for (let retry = 0; retry < MAX_CODE_RETRY; retry += 1) {
    const code = normalizeText(deps.createInviteCode()).toUpperCase()
    if (!code) {
      continue
    }

    const existing = await deps.findInviteByCode(code)
    if (!existing) {
      return code
    }
  }

  return ''
}

async function handleCreateMerchantSignupInvite(deps, payload, adminResult) {
  const expiresDays = parseExpiresDays(payload.expires_in_days)
  if (!expiresDays) {
    return failure('EXPIRES_IN_DAYS_INVALID', '邀请码有效期必须为 1-30 天')
  }

  const remark = normalizeText(payload.remark)
  if (remark.length > MAX_REMARK_LENGTH) {
    return failure('REMARK_TOO_LONG', '备注不能超过 100 个字')
  }

  try {
    const code = await createUniqueInviteCode(deps)
    if (!code) {
      return failure('INVITE_CODE_GENERATE_FAILED', '生成邀请码失败，请稍后重试')
    }

    const now = deps.now()
    const invite = {
      code,
      invite_type: 'merchant_signup',
      merchant_id: '',
      used_merchant_id: '',
      role: 'owner',
      status: 'unused',
      remark,
      created_by_role: adminResult.role,
      created_by_openid: '',
      created_by_account_id: '',
      used_by_openid: '',
      used_by_account_id: '',
      expires_at: new Date(now.getTime() + expiresDays * DAY_MS),
      created_at: now,
      updated_at: now,
      used_at: null,
      disabled_at: null
    }

    const createdInvite = await deps.createInvite(invite)

    return success('开店邀请码已创建', {
      invite: formatInvite(createdInvite || invite)
    })
  } catch (error) {
    deps.logger.error('merchantSelfService createMerchantSignupInvite failed', error)
    return failure('INTERNAL_ERROR', '创建开店邀请码失败，请稍后重试')
  }
}

async function handlePreviewMerchantSignupInvite(deps, payload) {
  const code = normalizeInviteCode(payload.code)
  if (!code || !isValidInviteCode(code)) {
    return failure('INVALID_INVITE_CODE', '邀请码格式不正确')
  }

  try {
    const invite = await deps.findInviteByCode(code)
    if (!invite) {
      return failure('INVITE_NOT_FOUND', '邀请码不存在')
    }

    if (invite.invite_type !== 'merchant_signup') {
      return failure('INVITE_TYPE_MISMATCH', '该邀请码不能用于开店')
    }

    if (invite.status === 'used') {
      return failure('INVITE_USED', '邀请码已使用')
    }

    if (invite.status === 'disabled') {
      return failure('INVITE_DISABLED', '邀请码已禁用')
    }

    if (invite.status === 'expired') {
      return failure('INVITE_EXPIRED', '邀请码已过期')
    }

    if (invite.status !== 'unused') {
      return failure('INVITE_EXPIRED', '邀请码不可用')
    }

    const expiresAt = new Date(invite.expires_at)
    if (!invite.expires_at || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= deps.now().getTime()) {
      return failure('INVITE_EXPIRED', '邀请码已过期')
    }

    return success('邀请码可用', {
      invite: formatInvitePreview(invite)
    })
  } catch (error) {
    deps.logger.error('merchantSelfService previewMerchantSignupInvite failed', error)
    return failure('INTERNAL_ERROR', '预览开店邀请码失败，请稍后重试')
  }
}

function createMerchantSelfServiceHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function merchantSelfService(event = {}) {
    try {
      const normalizedEvent = normalizeEventPayload(event)
      const action = normalizeText(normalizedEvent.action)
      const payload = normalizePayload(normalizedEvent.payload || normalizedEvent.data || normalizedEvent)

      if (action !== CREATE_SIGNUP_INVITE_ACTION && action !== PREVIEW_SIGNUP_INVITE_ACTION) {
        return failure('INVALID_ACTION', '开店服务操作类型不合法')
      }

      if (action === PREVIEW_SIGNUP_INVITE_ACTION) {
        return handlePreviewMerchantSignupInvite(deps, payload)
      }

      const adminResult = assertSuperAdmin(payload, deps)
      if (adminResult.error) {
        return adminResult.error
      }

      return handleCreateMerchantSignupInvite(deps, payload, adminResult)
    } catch (error) {
      deps.logger.error('merchantSelfService server error', error)
      return failure('INTERNAL_ERROR', '开店服务异常，请稍后重试')
    }
  }
}

module.exports = {
  createMerchantSelfServiceHandler,
  formatInvite,
  parseExpiresDays,
  normalizeEventPayload
}
