const VALID_ACTIONS = ['list', 'get', 'create', 'update', 'enable', 'disable']
const MERCHANT_ID_PATTERN = /^[a-z0-9_-]{3,32}$/

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

function formatMerchant(merchant = {}) {
  return {
    _id: merchant._id || '',
    merchant_id: merchant.merchant_id || '',
    name: merchant.name || '',
    short_name: merchant.short_name || merchant.name || '',
    status: merchant.status === 'disabled' ? 'disabled' : 'active',
    owner_openid: merchant.owner_openid || '',
    masked_owner_openid: maskOpenid(merchant.owner_openid),
    notice: merchant.notice || '',
    created_at: merchant.created_at || null,
    updated_at: merchant.updated_at || null
  }
}

function isValidMerchantId(merchantId) {
  return MERCHANT_ID_PATTERN.test(merchantId)
}

function buildDependencies(dependencies = {}) {
  return {
    getOpenid: dependencies.getOpenid,
    getSuperAdminOpenids: dependencies.getSuperAdminOpenids,
    now: dependencies.now || (() => new Date()),
    findMerchants: dependencies.findMerchants,
    findMerchantByMerchantId: dependencies.findMerchantByMerchantId,
    createMerchant: dependencies.createMerchant,
    updateMerchant: dependencies.updateMerchant,
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

  const superAdminOpenids = parseSuperAdminOpenids(
    deps.getSuperAdminOpenids ? deps.getSuperAdminOpenids() : process.env.SUPER_ADMIN_OPENIDS
  )
  if (!superAdminOpenids.includes(openid)) {
    return {
      error: failure('FORBIDDEN', '没有系统管理权限')
    }
  }

  return {
    openid
  }
}

function getPayloadMerchantId(payload = {}) {
  return normalizeText(payload.merchant_id || payload.id)
}

async function handleList(deps) {
  try {
    const merchants = await deps.findMerchants()
    const list = (merchants || []).map(formatMerchant)
    return success('获取商户列表成功', {
      list,
      total: list.length
    })
  } catch (error) {
    deps.logger.error('manageMerchant list database error', error)
    return failure('DATABASE_ERROR', '获取商户列表失败，请稍后重试')
  }
}

async function handleGet(deps, payload) {
  const merchantId = getPayloadMerchantId(payload)
  if (!merchantId) {
    return failure('INVALID_PARAMS', '商户 ID 不能为空')
  }

  try {
    const merchant = await deps.findMerchantByMerchantId(merchantId)
    if (!merchant) {
      return failure('NOT_FOUND', '商户不存在')
    }

    return success('获取商户详情成功', {
      merchant: formatMerchant(merchant)
    })
  } catch (error) {
    deps.logger.error('manageMerchant get database error', error)
    return failure('DATABASE_ERROR', '获取商户详情失败，请稍后重试')
  }
}

async function handleCreate(deps, payload) {
  const merchantId = normalizeText(payload.merchant_id)
  const name = normalizeText(payload.name)

  if (!merchantId) {
    return failure('VALIDATION_ERROR', '商户 ID 不能为空')
  }

  if (!isValidMerchantId(merchantId)) {
    return failure('VALIDATION_ERROR', '商户 ID 只能包含小写英文、数字、下划线和短横线，长度 3-32 位')
  }

  if (!name) {
    return failure('VALIDATION_ERROR', '商户名称不能为空')
  }

  try {
    const existingMerchant = await deps.findMerchantByMerchantId(merchantId)
    if (existingMerchant) {
      return failure('ALREADY_EXISTS', '商户 ID 已存在')
    }

    const now = deps.now()
    const merchant = {
      merchant_id: merchantId,
      name,
      short_name: normalizeText(payload.short_name) || name,
      status: 'active',
      owner_openid: normalizeText(payload.owner_openid),
      notice: normalizeText(payload.notice),
      created_at: now,
      updated_at: now
    }

    const createdMerchant = await deps.createMerchant(merchant)
    return success('创建商户成功', {
      merchant: formatMerchant(createdMerchant || merchant)
    })
  } catch (error) {
    deps.logger.error('manageMerchant create database error', error)
    return failure('DATABASE_ERROR', '创建商户失败，请稍后重试')
  }
}

async function findExistingMerchant(deps, merchantId, actionName) {
  try {
    const merchant = await deps.findMerchantByMerchantId(merchantId)
    if (!merchant) {
      return {
        error: failure('NOT_FOUND', '商户不存在')
      }
    }

    return {
      merchant
    }
  } catch (error) {
    deps.logger.error(`manageMerchant ${actionName} query database error`, error)
    return {
      error: failure('DATABASE_ERROR', '查询商户失败，请稍后重试')
    }
  }
}

async function handleUpdate(deps, payload) {
  const merchantId = getPayloadMerchantId(payload)
  if (!merchantId) {
    return failure('INVALID_PARAMS', '商户 ID 不能为空')
  }

  if (normalizeText(payload.next_merchant_id)) {
    return failure('VALIDATION_ERROR', '不允许修改商户 ID')
  }

  if (payload._id !== undefined) {
    return failure('VALIDATION_ERROR', '不允许修改商户文档 ID')
  }

  if (payload.status !== undefined) {
    return failure('VALIDATION_ERROR', '商户状态请使用启用或禁用操作')
  }

  const existingResult = await findExistingMerchant(deps, merchantId, 'update')
  if (existingResult.error) {
    return existingResult.error
  }

  const updateData = {}
  if (payload.name !== undefined) {
    const name = normalizeText(payload.name)
    if (!name) {
      return failure('VALIDATION_ERROR', '商户名称不能为空')
    }
    updateData.name = name
  }

  if (payload.short_name !== undefined) {
    updateData.short_name = normalizeText(payload.short_name)
  }

  if (payload.owner_openid !== undefined) {
    updateData.owner_openid = normalizeText(payload.owner_openid)
  }

  if (payload.notice !== undefined) {
    updateData.notice = normalizeText(payload.notice)
  }

  if (Object.keys(updateData).length === 0) {
    return failure('VALIDATION_ERROR', '没有可更新的商户信息')
  }

  updateData.updated_at = deps.now()

  try {
    const updatedMerchant = await deps.updateMerchant({
      merchant_id: merchantId,
      updateData
    })
    return success('更新商户成功', {
      merchant: formatMerchant({
        ...existingResult.merchant,
        ...(updatedMerchant || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageMerchant update database error', error)
    return failure('DATABASE_ERROR', '更新商户失败，请稍后重试')
  }
}

async function handleStatusChange(deps, payload, status) {
  const merchantId = getPayloadMerchantId(payload)
  if (!merchantId) {
    return failure('INVALID_PARAMS', '商户 ID 不能为空')
  }

  const existingResult = await findExistingMerchant(deps, merchantId, status)
  if (existingResult.error) {
    return existingResult.error
  }

  const updateData = {
    status,
    updated_at: deps.now()
  }

  try {
    const updatedMerchant = await deps.updateMerchant({
      merchant_id: merchantId,
      updateData
    })
    return success(status === 'active' ? '启用商户成功' : '禁用商户成功', {
      merchant: formatMerchant({
        ...existingResult.merchant,
        ...(updatedMerchant || updateData)
      })
    })
  } catch (error) {
    deps.logger.error(`manageMerchant ${status} database error`, error)
    return failure('DATABASE_ERROR', '更新商户状态失败，请稍后重试')
  }
}

function createManageMerchantHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function manageMerchant(event = {}) {
    try {
      const action = normalizeText(event.action)
      const payload = normalizePayload(event.payload || event.data)

      if (!action) {
        return failure('INVALID_PARAMS', '操作类型不能为空')
      }

      const adminResult = assertSuperAdmin(deps)
      if (adminResult.error) {
        return adminResult.error
      }

      if (!VALID_ACTIONS.includes(action)) {
        return failure('INVALID_PARAMS', '商户操作类型不合法')
      }

      if (action === 'list') {
        return handleList(deps)
      }

      if (action === 'get') {
        return handleGet(deps, payload)
      }

      if (action === 'create') {
        return handleCreate(deps, payload)
      }

      if (action === 'update') {
        return handleUpdate(deps, payload)
      }

      if (action === 'enable') {
        return handleStatusChange(deps, payload, 'active')
      }

      if (action === 'disable') {
        return handleStatusChange(deps, payload, 'disabled')
      }

      return failure('INVALID_PARAMS', '商户操作类型不合法')
    } catch (error) {
      deps.logger.error('manageMerchant server error', error)
      return failure('SERVER_ERROR', '商户管理操作失败，请稍后重试')
    }
  }
}

module.exports = {
  createManageMerchantHandler,
  success,
  failure,
  formatMerchant,
  maskOpenid,
  parseSuperAdminOpenids
}
