const VALID_ACTIONS = ['listStaff', 'enableStaff', 'disableStaff', 'createInvite', 'listInvites', 'disableInvite']
const WEB_ALLOWED_ACTIONS = ['listStaff', 'listInvites', 'createInvite', 'disableInvite', 'disableStaff', 'enableStaff']
const WEB_ADMIN_OPENID = 'web_super_admin'
const VALID_ROLES = ['owner', 'staff']
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DAY_MS = 24 * 60 * 60 * 1000
const { verifyWebAdminToken } = require('./web-admin-token-helper')

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

function parseSuperAdminOpenids(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean)
  }

  return normalizeText(value)
    .split(',')
    .map(normalizeText)
    .filter(Boolean)
}

function maskOpenid(openid) {
  const text = normalizeText(openid)
  if (!text) {
    return ''
  }

  if (text.length <= 4) {
    return `${text.slice(0, 1)}**${text.slice(-1)}`
  }

  if (text.length <= 8) {
    return `${text.slice(0, 2)}**${text.slice(-2)}`
  }

  return `${text.slice(0, 4)}****${text.slice(-4)}`
}

function getRoleText(role) {
  return role === 'owner' ? '负责人' : '员工'
}

function getStatusText(status) {
  if (status === 'disabled') {
    return '禁用'
  }
  if (status === 'used') {
    return '已使用'
  }
  if (status === 'expired') {
    return '已过期'
  }
  if (status === 'unused') {
    return '未使用'
  }
  return '启用'
}

function formatStaff(staff = {}) {
  const status = staff.status === 'disabled' ? 'disabled' : 'active'
  const role = staff.role === 'owner' ? 'owner' : 'staff'
  return {
    _id: staff._id || '',
    merchant_id: staff.merchant_id || '',
    openid: staff.openid || '',
    masked_openid: maskOpenid(staff.openid),
    role,
    role_text: getRoleText(role),
    status,
    status_text: getStatusText(status),
    nickname: staff.nickname || staff.staff_name || '',
    remark: staff.remark || '',
    created_at: staff.created_at || null,
    updated_at: staff.updated_at || null
  }
}

function formatInvite(invite = {}) {
  const role = invite.role === 'owner' ? 'owner' : 'staff'
  const status = invite.status || 'unused'
  return {
    _id: invite._id || '',
    code: invite.code || '',
    merchant_id: invite.merchant_id || '',
    role,
    role_text: getRoleText(role),
    status,
    status_text: getStatusText(status),
    created_by_openid: invite.created_by_openid || '',
    used_by_openid: invite.used_by_openid || '',
    masked_used_by_openid: maskOpenid(invite.used_by_openid),
    expires_at: invite.expires_at || null,
    created_at: invite.created_at || null,
    used_at: invite.used_at || null,
    updated_at: invite.updated_at || null
  }
}

function createRandomInviteCode() {
  let code = ''
  for (let index = 0; index < 8; index += 1) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
  }
  return code
}

function buildDependencies(dependencies = {}) {
  return {
    getOpenid: dependencies.getOpenid,
    getSuperAdminOpenids: dependencies.getSuperAdminOpenids,
    now: dependencies.now || (() => new Date()),
    createInviteCode: dependencies.createInviteCode || createRandomInviteCode,
    findMerchantByMerchantId: dependencies.findMerchantByMerchantId,
    findStaffByMerchantId: dependencies.findStaffByMerchantId,
    findStaffById: dependencies.findStaffById,
    updateStaff: dependencies.updateStaff,
    findInvitesByMerchantId: dependencies.findInvitesByMerchantId,
    findInviteByCode: dependencies.findInviteByCode,
    createInvite: dependencies.createInvite,
    updateInvite: dependencies.updateInvite,
    getTokenSecret: dependencies.getTokenSecret,
    logger: dependencies.logger || console
  }
}

function assertSuperAdmin(deps) {
  const openid = normalizeText(deps.getOpenid ? deps.getOpenid() : '')
  if (!openid) {
    return {
      error: failure('UNAUTHORIZED', '无法识别用户身份')
    }
  }

  const openids = parseSuperAdminOpenids(
    deps.getSuperAdminOpenids ? deps.getSuperAdminOpenids() : process.env.SUPER_ADMIN_OPENIDS
  )
  if (!openids.includes(openid)) {
    return {
      error: failure('FORBIDDEN', '没有系统管理权限')
    }
  }

  return {
    openid
  }
}

function isWebAdminRequest(event = {}) {
  return Boolean(event && Object.prototype.hasOwnProperty.call(event, 'admin_token'))
}

function assertWebAdmin(event, action, deps) {
  const verifyResult = verifyWebAdminToken(event.admin_token, {
    secret: deps.getTokenSecret ? deps.getTokenSecret() : process.env.WEB_ADMIN_TOKEN_SECRET,
    now: deps.now()
  })

  if (!verifyResult.ok) {
    return {
      error: failure(
        verifyResult.code,
        verifyResult.code === 'TOKEN_EXPIRED' ? '登录状态已过期' : '登录状态无效或已过期'
      )
    }
  }

  if (!WEB_ALLOWED_ACTIONS.includes(action)) {
    return {
      error: failure('FORBIDDEN', 'Web 后台当前不支持该成员 / 邀请操作')
    }
  }

  return {
    is_web_admin: true,
    role: verifyResult.role,
    openid: WEB_ADMIN_OPENID
  }
}

function assertAdminAccess(event, action, deps) {
  if (isWebAdminRequest(event)) {
    return assertWebAdmin(event, action, deps)
  }

  return assertSuperAdmin(deps)
}

function getMerchantId(payload = {}) {
  return normalizeText(payload.merchant_id || payload.id)
}

function getStaffId(payload = {}) {
  return normalizeText(payload.staff_id || payload._id)
}

function getStaffOpenid(payload = {}) {
  return normalizeText(payload.openid)
}

async function assertMerchantAvailable(deps, merchantId, allowDisabled = false) {
  if (!merchantId) {
    return {
      error: failure('INVALID_PARAMS', '商户 ID 不能为空')
    }
  }

  try {
    const merchant = await deps.findMerchantByMerchantId(merchantId)
    if (!merchant) {
      return {
        error: failure('NOT_FOUND', '商户不存在')
      }
    }

    if (!allowDisabled && merchant.status === 'disabled') {
      return {
        error: failure('MERCHANT_DISABLED', '商户已禁用')
      }
    }

    return {
      merchant
    }
  } catch (error) {
    deps.logger.error('manageMerchantStaff merchant query failed', error)
    return {
      error: failure('DATABASE_ERROR', '查询商户失败，请稍后重试')
    }
  }
}

async function handleListStaff(deps, payload) {
  const merchantId = getMerchantId(payload)
  const merchantResult = await assertMerchantAvailable(deps, merchantId, true)
  if (merchantResult.error) {
    return merchantResult.error
  }

  try {
    const list = (await deps.findStaffByMerchantId(merchantId) || []).map(formatStaff)
    return success('获取商户成员成功', {
      merchant: merchantResult.merchant,
      list,
      total: list.length
    })
  } catch (error) {
    deps.logger.error('manageMerchantStaff listStaff failed', error)
    return failure('DATABASE_ERROR', '获取商户成员失败，请稍后重试')
  }
}

async function handleCreateInvite(deps, payload, adminOpenid) {
  const merchantId = getMerchantId(payload)
  const merchantResult = await assertMerchantAvailable(deps, merchantId)
  if (merchantResult.error) {
    return merchantResult.error
  }

  const role = normalizeText(payload.role) || 'staff'
  if (!VALID_ROLES.includes(role)) {
    return failure('VALIDATION_ERROR', '成员角色不合法')
  }

  const expiresDays = Number(payload.expires_days || payload.expiresDays || 7)
  if (!Number.isInteger(expiresDays) || expiresDays <= 0 || expiresDays > 30) {
    return failure('VALIDATION_ERROR', '邀请码有效期必须为 1-30 天')
  }

  try {
    let code = ''
    for (let retry = 0; retry < 5; retry += 1) {
      code = deps.createInviteCode()
      const existing = await deps.findInviteByCode(code)
      if (!existing) {
        break
      }
      code = ''
    }

    if (!code) {
      return failure('DATABASE_ERROR', '生成邀请码失败，请稍后重试')
    }

    const now = deps.now()
    const invite = {
      code,
      merchant_id: merchantId,
      role,
      status: 'unused',
      created_by_openid: adminOpenid,
      used_by_openid: '',
      expires_at: new Date(now.getTime() + expiresDays * DAY_MS),
      created_at: now,
      used_at: null,
      updated_at: now
    }

    const createdInvite = await deps.createInvite(invite)
    return success('生成邀请码成功', {
      invite: formatInvite(createdInvite || invite)
    })
  } catch (error) {
    deps.logger.error('manageMerchantStaff createInvite failed', error)
    return failure('DATABASE_ERROR', '生成邀请码失败，请稍后重试')
  }
}

async function handleListInvites(deps, payload) {
  const merchantId = getMerchantId(payload)
  const merchantResult = await assertMerchantAvailable(deps, merchantId, true)
  if (merchantResult.error) {
    return merchantResult.error
  }

  try {
    const list = (await deps.findInvitesByMerchantId(merchantId) || []).map(formatInvite)
    return success('获取邀请码列表成功', {
      merchant: merchantResult.merchant,
      list,
      total: list.length
    })
  } catch (error) {
    deps.logger.error('manageMerchantStaff listInvites failed', error)
    return failure('DATABASE_ERROR', '获取邀请码列表失败，请稍后重试')
  }
}

async function handleDisableInvite(deps, payload) {
  const merchantId = getMerchantId(payload)
  const merchantResult = await assertMerchantAvailable(deps, merchantId, true)
  if (merchantResult.error) {
    return merchantResult.error
  }

  const code = normalizeText(payload.code).toUpperCase()
  if (!code) {
    return failure('INVALID_PARAMS', '邀请码不能为空')
  }

  try {
    const invite = await deps.findInviteByCode(code)
    if (!invite) {
      return failure('NOT_FOUND', '邀请码不存在')
    }

    if (invite.merchant_id !== merchantId) {
      return failure('FORBIDDEN', '不能禁用其他商户的邀请码')
    }

    if (invite.status && invite.status !== 'unused') {
      return failure('VALIDATION_ERROR', '只能禁用未使用的邀请码')
    }

    const updateData = {
      status: 'disabled',
      updated_at: deps.now()
    }
    const updatedInvite = await deps.updateInvite({
      code,
      updateData
    })

    return success('禁用邀请码成功', {
      invite: formatInvite({
        ...invite,
        ...(updatedInvite || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageMerchantStaff disableInvite failed', error)
    return failure('DATABASE_ERROR', '禁用邀请码失败，请稍后重试')
  }
}

async function handleWebStaffStatus(deps, payload, status) {
  const merchantId = getMerchantId(payload)
  const merchantResult = await assertMerchantAvailable(deps, merchantId, true)
  if (merchantResult.error) {
    return merchantResult.error
  }

  const openid = getStaffOpenid(payload)
  if (!openid) {
    return failure('INVALID_PARAMS', '成员 openid 不能为空')
  }

  try {
    const staffList = await deps.findStaffByMerchantId(merchantId) || []
    const staff = staffList.find((item) => normalizeText(item.openid) === openid)
    if (!staff) {
      return failure('NOT_FOUND', '成员不存在')
    }

    const currentStatus = staff.status === 'disabled' ? 'disabled' : 'active'
    if (currentStatus === status) {
      return failure('VALIDATION_ERROR', status === 'active' ? '成员已启用' : '成员已禁用')
    }

    const updateData = {
      status,
      updated_at: deps.now()
    }
    const updatedStaff = await deps.updateStaff({
      staff_id: staff._id,
      updateData
    })

    return success(status === 'active' ? '启用成员成功' : '禁用成员成功', {
      staff: formatStaff({
        ...staff,
        ...(updatedStaff || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageMerchantStaff update web staff status failed', error)
    return failure('DATABASE_ERROR', '更新成员状态失败，请稍后重试')
  }
}

async function handleStaffStatus(deps, payload, status, adminResult = {}) {
  if (adminResult.is_web_admin) {
    return handleWebStaffStatus(deps, payload, status)
  }

  const staffId = getStaffId(payload)
  if (!staffId) {
    return failure('INVALID_PARAMS', '成员 ID 不能为空')
  }

  try {
    const staff = await deps.findStaffById(staffId)
    if (!staff) {
      return failure('NOT_FOUND', '成员不存在')
    }

    const updateData = {
      status,
      updated_at: deps.now()
    }
    const updatedStaff = await deps.updateStaff({
      staff_id: staffId,
      updateData
    })

    return success(status === 'active' ? '启用成员成功' : '禁用成员成功', {
      staff: formatStaff({
        ...staff,
        ...(updatedStaff || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageMerchantStaff update staff failed', error)
    return failure('DATABASE_ERROR', '更新成员状态失败，请稍后重试')
  }
}

function createManageMerchantStaffHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function manageMerchantStaff(event = {}) {
    try {
      const normalizedEvent = normalizeEventPayload(event)
      const action = normalizeText(normalizedEvent.action)
      const payload = normalizePayload(normalizedEvent.payload || normalizedEvent.data || normalizedEvent)

      if (!action) {
        return failure('INVALID_PARAMS', '操作类型不能为空')
      }

      const adminResult = assertAdminAccess(normalizedEvent, action, deps)
      if (adminResult.error) {
        return adminResult.error
      }

      if (!VALID_ACTIONS.includes(action)) {
        return failure('INVALID_PARAMS', '成员管理操作类型不合法')
      }

      if (action === 'listStaff') {
        return handleListStaff(deps, payload)
      }

      if (action === 'createInvite') {
        return handleCreateInvite(deps, payload, adminResult.openid)
      }

      if (action === 'listInvites') {
        return handleListInvites(deps, payload)
      }

      if (action === 'disableInvite') {
        return handleDisableInvite(deps, payload)
      }

      if (action === 'enableStaff') {
        return handleStaffStatus(deps, payload, 'active', adminResult)
      }

      if (action === 'disableStaff') {
        return handleStaffStatus(deps, payload, 'disabled', adminResult)
      }

      return failure('INVALID_PARAMS', '成员管理操作类型不合法')
    } catch (error) {
      deps.logger.error('manageMerchantStaff server error', error)
      return failure('SERVER_ERROR', '商户成员管理失败，请稍后重试')
    }
  }
}

module.exports = {
  createManageMerchantStaffHandler,
  maskOpenid,
  parseSuperAdminOpenids,
  formatStaff,
  formatInvite
}
