const crypto = require('node:crypto')
const { verifyWebAdminToken } = require('./web-admin-token-helper')

const CREATE_SIGNUP_INVITE_ACTION = 'createMerchantSignupInvite'
const PREVIEW_SIGNUP_INVITE_ACTION = 'previewMerchantSignupInvite'
const REDEEM_SIGNUP_INVITE_ACTION = 'redeemMerchantSignupInvite'
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8,12}$/
const MERCHANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/
const LOGIN_NAME_PATTERN = /^[a-z0-9_-]{3,32}$/
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_EXPIRES_DAYS = 7
const MAX_EXPIRES_DAYS = 30
const MAX_REMARK_LENGTH = 100
const MAX_CODE_RETRY = 5
const MERCHANT_ADMIN_ROLE = 'merchant_admin'
const DEFAULT_MERCHANT_TOKEN_TTL_MINUTES = 240

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

function base64urlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function signPayload(payloadSegment, secret) {
  return base64urlEncode(
    crypto
      .createHmac('sha256', secret)
      .update(payloadSegment)
      .digest()
  )
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
    findMerchantBySlug: dependencies.findMerchantBySlug,
    findStaffByLoginName: dependencies.findStaffByLoginName,
    createMerchantForSignup: dependencies.createMerchantForSignup,
    createOwnerStaff: dependencies.createOwnerStaff,
    markInviteUsed: dependencies.markInviteUsed,
    disableMerchantForSignup: dependencies.disableMerchantForSignup,
    disableStaffForSignup: dependencies.disableStaffForSignup,
    createStaffId: dependencies.createStaffId || (() => `staff_${crypto.randomBytes(8).toString('hex')}`),
    createPasswordSalt: dependencies.createPasswordSalt || (() => crypto.randomBytes(16).toString('hex')),
    createNonce: dependencies.createNonce || (() => crypto.randomBytes(16).toString('hex')),
    getMerchantTokenTtlMinutes: dependencies.getMerchantTokenTtlMinutes,
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

function normalizeMerchantSlug(value) {
  return normalizeText(value).toLowerCase()
}

function normalizeLoginName(value) {
  return normalizeText(value).toLowerCase()
}

function isValidMerchantSlug(value) {
  return MERCHANT_SLUG_PATTERN.test(value) && !value.includes('--')
}

function isValidLoginName(value) {
  return LOGIN_NAME_PATTERN.test(value)
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function createMerchantAdminToken(deps, payload) {
  const secret = normalizeText(deps.getTokenSecret ? deps.getTokenSecret() : process.env.WEB_ADMIN_TOKEN_SECRET)
  if (!secret) {
    throw new Error('TOKEN_SECRET_REQUIRED')
  }

  const now = deps.now()
  const ttlMinutes = Number(deps.getMerchantTokenTtlMinutes ? deps.getMerchantTokenTtlMinutes() : DEFAULT_MERCHANT_TOKEN_TTL_MINUTES)
  const expiresAt = new Date(now.getTime() + (Number.isInteger(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : DEFAULT_MERCHANT_TOKEN_TTL_MINUTES) * 60 * 1000)
  const tokenPayload = {
    role: MERCHANT_ADMIN_ROLE,
    merchant_id: payload.merchant_id,
    staff_id: payload.staff_id,
    account_id: payload.staff_id,
    login_name: payload.login_name,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    token_version: payload.token_version,
    nonce: deps.createNonce()
  }
  const payloadSegment = base64urlEncode(JSON.stringify(tokenPayload))
  const signatureSegment = signPayload(payloadSegment, secret)

  return {
    token: `${payloadSegment}.${signatureSegment}`,
    expires_at: tokenPayload.expires_at
  }
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

async function assertRedeemableInvite(deps, code) {
  const invite = await deps.findInviteByCode(code)
  if (!invite) {
    return {
      error: failure('INVITE_NOT_FOUND', '邀请码不存在')
    }
  }

  if (invite.invite_type !== 'merchant_signup') {
    return {
      error: failure('INVITE_TYPE_MISMATCH', '该邀请码不能用于开店')
    }
  }

  if (invite.status === 'used') {
    return {
      error: failure('INVITE_USED', '邀请码已使用')
    }
  }

  if (invite.status === 'disabled') {
    return {
      error: failure('INVITE_DISABLED', '邀请码已禁用')
    }
  }

  if (invite.status === 'expired') {
    return {
      error: failure('INVITE_EXPIRED', '邀请码已过期')
    }
  }

  if (invite.status !== 'unused') {
    return {
      error: failure('INVITE_EXPIRED', '邀请码不可用')
    }
  }

  const expiresAt = new Date(invite.expires_at)
  if (!invite.expires_at || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= deps.now().getTime()) {
    return {
      error: failure('INVITE_EXPIRED', '邀请码已过期')
    }
  }

  return {
    invite
  }
}

function validateRedeemPayload(payload) {
  const code = normalizeInviteCode(payload.code)
  if (!code || !isValidInviteCode(code)) {
    return {
      error: failure('INVALID_INVITE_CODE', '邀请码格式不正确')
    }
  }

  const merchantName = normalizeText(payload.merchant_name || payload.name)
  if (!merchantName) {
    return {
      error: failure('MERCHANT_NAME_REQUIRED', '商户名称不能为空')
    }
  }
  if (merchantName.length > 40) {
    return {
      error: failure('MERCHANT_NAME_INVALID', '商户名称不能超过 40 个字')
    }
  }

  const shortName = normalizeText(payload.short_name)
  if (!shortName) {
    return {
      error: failure('SHORT_NAME_REQUIRED', '商户短名称不能为空')
    }
  }
  if (shortName.length > 12) {
    return {
      error: failure('SHORT_NAME_INVALID', '商户短名称不能超过 12 个字')
    }
  }

  const merchantSlug = normalizeMerchantSlug(payload.merchant_slug || payload.merchant_id)
  if (!merchantSlug) {
    return {
      error: failure('MERCHANT_SLUG_REQUIRED', '商户标识不能为空')
    }
  }
  if (!isValidMerchantSlug(merchantSlug)) {
    return {
      error: failure('MERCHANT_SLUG_INVALID', '商户标识格式不正确')
    }
  }

  const loginName = normalizeLoginName(payload.login_name)
  if (!loginName) {
    return {
      error: failure('LOGIN_NAME_REQUIRED', '登录名不能为空')
    }
  }
  if (!isValidLoginName(loginName)) {
    return {
      error: failure('LOGIN_NAME_INVALID', '登录名格式不正确')
    }
  }

  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!password) {
    return {
      error: failure('PASSWORD_REQUIRED', '密码不能为空')
    }
  }
  if (password.length < 8) {
    return {
      error: failure('PASSWORD_TOO_SHORT', '密码至少需要 8 位')
    }
  }

  return {
    data: {
      code,
      merchantName,
      shortName,
      merchantSlug,
      loginName,
      password
    }
  }
}

function formatMerchantForResponse(merchant = {}) {
  return {
    merchant_id: merchant.merchant_id || '',
    merchant_slug: merchant.merchant_slug || '',
    name: merchant.name || '',
    short_name: merchant.short_name || '',
    status: merchant.status || 'active'
  }
}

async function compensateSignup(deps, merchantId, staffId) {
  if (staffId && deps.disableStaffForSignup) {
    await deps.disableStaffForSignup(staffId).catch(() => null)
  }
  if (merchantId && deps.disableMerchantForSignup) {
    await deps.disableMerchantForSignup(merchantId).catch(() => null)
  }
}

async function handleRedeemMerchantSignupInvite(deps, payload) {
  const validation = validateRedeemPayload(payload)
  if (validation.error) {
    return validation.error
  }

  const data = validation.data

  try {
    const inviteResult = await assertRedeemableInvite(deps, data.code)
    if (inviteResult.error) {
      return inviteResult.error
    }

    const existingMerchant = await deps.findMerchantBySlug(data.merchantSlug)
    if (existingMerchant) {
      return failure('MERCHANT_SLUG_EXISTS', '商户标识已存在')
    }

    const existingLogin = await deps.findStaffByLoginName({
      merchant_id: data.merchantSlug,
      login_name: data.loginName
    })
    if (existingLogin) {
      return failure('LOGIN_NAME_INVALID', '登录名已存在')
    }

    const now = deps.now()
    const staffId = deps.createStaffId()
    const merchant = {
      merchant_id: data.merchantSlug,
      merchant_slug: data.merchantSlug,
      name: data.merchantName,
      short_name: data.shortName,
      status: 'active',
      owner_openid: '',
      owner_staff_id: staffId,
      created_from_invite_code: data.code,
      notice: '',
      created_at: now,
      updated_at: now
    }

    let createdMerchant
    try {
      createdMerchant = await deps.createMerchantForSignup(merchant)
    } catch (error) {
      deps.logger.error('merchantSelfService merchant create failed', error)
      return failure('MERCHANT_CREATE_FAILED', '创建商户失败，请稍后重试')
    }

    const passwordSalt = deps.createPasswordSalt()
    const ownerStaff = {
      staff_id: staffId,
      merchant_id: data.merchantSlug,
      openid: '',
      role: 'owner',
      status: 'active',
      nickname: data.shortName || data.loginName,
      remark: '开店邀请码创建的店主',
      login_name: data.loginName,
      password_hash: hashPassword(data.password, passwordSalt),
      password_salt: passwordSalt,
      account_status: 'active',
      token_version: 1,
      last_login_at: now,
      created_at: now,
      updated_at: now
    }

    let createdStaff
    try {
      createdStaff = await deps.createOwnerStaff(ownerStaff)
    } catch (error) {
      deps.logger.error('merchantSelfService owner create failed', error)
      await compensateSignup(deps, data.merchantSlug, '')
      return failure('OWNER_CREATE_FAILED', '创建店主账号失败，请稍后重试')
    }

    try {
      const updatedInvite = await deps.markInviteUsed({
        code: data.code,
        updateData: {
          status: 'used',
          used_merchant_id: data.merchantSlug,
          used_by_account_id: staffId,
          used_at: now,
          updated_at: now
        }
      })

      if (!updatedInvite) {
        await compensateSignup(deps, data.merchantSlug, staffId)
        return failure('INVITE_MARK_USED_FAILED', '标记邀请码使用失败，请稍后重试')
      }
    } catch (error) {
      deps.logger.error('merchantSelfService invite mark used failed', error)
      await compensateSignup(deps, data.merchantSlug, staffId)
      return failure('INVITE_MARK_USED_FAILED', '标记邀请码使用失败，请稍后重试')
    }

    const tokenResult = createMerchantAdminToken(deps, {
      merchant_id: data.merchantSlug,
      staff_id: createdStaff.staff_id || staffId,
      login_name: data.loginName,
      token_version: createdStaff.token_version || 1
    })

    return success('开店成功', {
      merchant: formatMerchantForResponse(createdMerchant || merchant),
      session: {
        token: tokenResult.token,
        role: MERCHANT_ADMIN_ROLE,
        merchant_id: data.merchantSlug,
        expires_at: tokenResult.expires_at
      }
    })
  } catch (error) {
    deps.logger.error('merchantSelfService redeemMerchantSignupInvite failed', error)
    return failure('INTERNAL_ERROR', '开店失败，请稍后重试')
  }
}

function createMerchantSelfServiceHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function merchantSelfService(event = {}) {
    try {
      const normalizedEvent = normalizeEventPayload(event)
      const action = normalizeText(normalizedEvent.action)
      const payload = normalizePayload(normalizedEvent.payload || normalizedEvent.data || normalizedEvent)

      if (action !== CREATE_SIGNUP_INVITE_ACTION &&
        action !== PREVIEW_SIGNUP_INVITE_ACTION &&
        action !== REDEEM_SIGNUP_INVITE_ACTION) {
        return failure('INVALID_ACTION', '开店服务操作类型不合法')
      }

      if (action === PREVIEW_SIGNUP_INVITE_ACTION) {
        return handlePreviewMerchantSignupInvite(deps, payload)
      }

      if (action === REDEEM_SIGNUP_INVITE_ACTION) {
        return handleRedeemMerchantSignupInvite(deps, payload)
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
