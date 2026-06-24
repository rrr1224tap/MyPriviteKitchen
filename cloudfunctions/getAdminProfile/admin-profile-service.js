function success(message, data) {
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

function createGetAdminProfileHandler(dependencies = {}) {
  return async function getAdminProfile() {
    try {
      const openid = normalizeText(dependencies.getOpenid ? dependencies.getOpenid() : '')

      if (!openid) {
        return failure('UNAUTHORIZED', '无法识别用户身份')
      }

      const superAdminOpenids = parseSuperAdminOpenids(
        dependencies.getSuperAdminOpenids
          ? dependencies.getSuperAdminOpenids()
          : process.env.SUPER_ADMIN_OPENIDS
      )
      const isSuperAdmin = superAdminOpenids.includes(openid)

      return success('获取系统管理身份成功', {
        ok: true,
        openid,
        masked_openid: maskOpenid(openid),
        is_super_admin: isSuperAdmin,
        can_enter_admin: isSuperAdmin,
        role: isSuperAdmin ? 'super_admin' : 'user',
        source: 'SUPER_ADMIN_OPENIDS'
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getAdminProfile failed', error)
      }

      return failure('DATABASE_ERROR', '系统管理身份加载失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetAdminProfileHandler,
  maskOpenid,
  parseSuperAdminOpenids
}
