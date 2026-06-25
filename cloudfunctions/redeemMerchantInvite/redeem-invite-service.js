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

function formatStaff(staff = {}) {
  return {
    _id: staff._id || '',
    merchant_id: staff.merchant_id || '',
    openid: staff.openid || '',
    masked_openid: maskOpenid(staff.openid),
    role: staff.role === 'owner' ? 'owner' : 'staff',
    status: staff.status === 'disabled' ? 'disabled' : 'active',
    nickname: staff.nickname || staff.staff_name || '',
    remark: staff.remark || '',
    created_at: staff.created_at || null,
    updated_at: staff.updated_at || null
  }
}

function buildDependencies(dependencies = {}) {
  return {
    getOpenid: dependencies.getOpenid,
    now: dependencies.now || (() => new Date()),
    findInviteByCode: dependencies.findInviteByCode,
    findMerchantByMerchantId: dependencies.findMerchantByMerchantId,
    findStaffByMerchantAndOpenid: dependencies.findStaffByMerchantAndOpenid,
    createStaff: dependencies.createStaff,
    updateStaff: dependencies.updateStaff,
    updateInvite: dependencies.updateInvite,
    logger: dependencies.logger || console
  }
}

function getInviteCode(event = {}) {
  const payload = normalizePayload(event.payload || event.data)
  return normalizeText(payload.code || event.code).toUpperCase()
}

function isExpired(invite, now) {
  if (!invite.expires_at) {
    return false
  }

  const expiresAt = invite.expires_at instanceof Date ? invite.expires_at : new Date(invite.expires_at)
  if (Number.isNaN(expiresAt.getTime())) {
    return false
  }

  return expiresAt.getTime() <= now.getTime()
}

async function createOrUpdateStaff(deps, invite, openid, now) {
  const existingStaff = await deps.findStaffByMerchantAndOpenid({
    merchant_id: invite.merchant_id,
    openid
  })
  const role = invite.role === 'owner' ? 'owner' : 'staff'

  if (existingStaff) {
    const updateData = {
      role,
      status: 'active',
      updated_at: now
    }
    const updatedStaff = await deps.updateStaff({
      staff_id: existingStaff._id,
      updateData
    })
    return {
      ...existingStaff,
      ...(updatedStaff || updateData)
    }
  }

  const staff = {
    merchant_id: invite.merchant_id,
    openid,
    role,
    status: 'active',
    nickname: '',
    remark: '',
    created_at: now,
    updated_at: now
  }

  return deps.createStaff(staff)
}

function createRedeemMerchantInviteHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function redeemMerchantInvite(event = {}) {
    try {
      const openid = normalizeText(deps.getOpenid ? deps.getOpenid() : '')
      if (!openid) {
        return failure('UNAUTHORIZED', '无法识别用户身份')
      }

      const code = getInviteCode(event)
      if (!code) {
        return failure('INVALID_PARAMS', '邀请码不能为空')
      }

      const invite = await deps.findInviteByCode(code)
      if (!invite) {
        return failure('INVITE_NOT_FOUND', '邀请码无效')
      }

      if (invite.status === 'used') {
        return failure('INVITE_USED', '邀请码已被使用')
      }

      if (invite.status === 'disabled') {
        return failure('INVITE_DISABLED', '邀请码已禁用')
      }

      const now = deps.now()
      if (invite.status === 'expired' || isExpired(invite, now)) {
        if (invite.status !== 'expired') {
          await deps.updateInvite({
            code,
            updateData: {
              status: 'expired',
              updated_at: now
            }
          })
        }
        return failure('INVITE_EXPIRED', '邀请码已过期')
      }

      if (invite.status !== 'unused') {
        return failure('INVITE_INVALID', '邀请码无效')
      }

      const merchant = await deps.findMerchantByMerchantId(invite.merchant_id)
      if (!merchant) {
        return failure('MERCHANT_NOT_FOUND', '商户不存在')
      }

      if (merchant.status === 'disabled') {
        return failure('MERCHANT_DISABLED', '商户已禁用')
      }

      const staff = await createOrUpdateStaff(deps, invite, openid, now)
      await deps.updateInvite({
        code,
        updateData: {
          status: 'used',
          used_by_openid: openid,
          used_at: now,
          updated_at: now
        }
      })

      return success('商户身份绑定成功', {
        staff: formatStaff(staff),
        merchant: {
          merchant_id: merchant.merchant_id || '',
          name: merchant.name || '',
          status: merchant.status || 'active'
        }
      })
    } catch (error) {
      deps.logger.error('redeemMerchantInvite failed', error)
      return failure('DATABASE_ERROR', '绑定商户身份失败，请稍后重试')
    }
  }
}

module.exports = {
  createRedeemMerchantInviteHandler,
  formatStaff,
  maskOpenid
}
