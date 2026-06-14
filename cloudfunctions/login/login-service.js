function success(data) {
  return {
    success: true,
    code: 'SUCCESS',
    message: '登录成功',
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

function formatUser(user) {
  if (!user) {
    return null
  }

  return {
    _id: user._id,
    openid: user.openid,
    nickname: user.nickname || '',
    avatar_url: user.avatar_url || user.avatar || '',
    phone: user.phone || '',
    role: user.role || 'user',
    status: user.status || 'active'
  }
}

function formatMerchantStaff(merchantStaff) {
  if (!merchantStaff) {
    return null
  }

  return {
    _id: merchantStaff._id,
    merchant_id: merchantStaff.merchant_id,
    staff_name: merchantStaff.staff_name || '',
    role: merchantStaff.role,
    status: merchantStaff.status
  }
}

function formatMerchant(merchant) {
  if (!merchant) {
    return null
  }

  return Object.assign({}, merchant, {
    merchant_id: merchant.merchant_id || merchant._id
  })
}

function createLoginHandler(dependencies) {
  return async function login(event = {}) {
    try {
      const openid = dependencies.getOpenid()

      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const loginAt = dependencies.now()
      const nickname = normalizeText(event.nickname)
      const avatar = normalizeText(event.avatar_url || event.avatar)
      let user = await dependencies.findUserByOpenid(openid)

      if (!user) {
        user = await dependencies.createUser({
          openid,
          nickname,
          avatar,
          phone: '',
          role: 'user',
          status: 'active',
          created_at: loginAt,
          updated_at: loginAt,
          last_login_at: loginAt
        })
      } else {
        const updates = {
          updated_at: loginAt,
          last_login_at: loginAt
        }

        if (nickname) {
          updates.nickname = nickname
        }

        if (avatar) {
          updates.avatar = avatar
        }

        user = await dependencies.updateUser(user, updates)
      }

      const merchantStaff = await dependencies.findActiveMerchantStaff(openid)
      const merchant = merchantStaff
        ? await dependencies.findMerchantById(merchantStaff.merchant_id)
        : null

      return success({
        openid,
        user: formatUser(user),
        is_merchant: Boolean(merchantStaff),
        merchant_staff: formatMerchantStaff(merchantStaff),
        merchant: formatMerchant(merchant)
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('login failed', error)
      }

      return failure('SERVER_ERROR', '登录失败，请稍后重试')
    }
  }
}

module.exports = {
  createLoginHandler
}
