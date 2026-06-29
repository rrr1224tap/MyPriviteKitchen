const {
  verifyWebAdminToken
} = require('./web-admin-token-helper')

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
    error: {
      code,
      message
    },
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

function toDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const rawValue = value && value.$date ? value.$date : value
  const date = new Date(rawValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function getTodayRange(now) {
  const current = toDate(now) || new Date()
  const start = new Date(current)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return {
    start,
    end
  }
}

function isDateBefore(value, target) {
  const date = toDate(value)
  return Boolean(date && date.getTime() < target.getTime())
}

function isToday(value, todayRange) {
  const date = toDate(value)
  return Boolean(
    date &&
    date.getTime() >= todayRange.start.getTime() &&
    date.getTime() < todayRange.end.getTime()
  )
}

function isCancelledStatus(status) {
  return status === 'cancelled' || status === 'canceled'
}

function hasEnabledEntries(value) {
  return Array.isArray(value) && value.some((item) => item && item.enabled !== false)
}

function formatOrderStatus(status) {
  const statusTextMap = {
    pending: '待接单',
    accepted: '已接单',
    cooking: '制作中',
    finished: '已完成',
    cancelled: '已取消',
    canceled: '已取消'
  }
  return statusTextMap[status] || '未知状态'
}

function buildMerchantOverview(merchants = []) {
  return merchants.reduce((summary, merchant) => {
    summary.total += 1
    if (merchant && merchant.status === 'disabled') {
      summary.disabled += 1
    } else {
      summary.active += 1
    }
    return summary
  }, {
    total: 0,
    active: 0,
    disabled: 0
  })
}

function buildStaffOverview(staffList = []) {
  return staffList.reduce((summary, staff) => {
    const role = staff && staff.role
    const status = staff && staff.status
    summary.total += 1
    if (status === 'disabled') {
      summary.disabled += 1
    } else {
      summary.active += 1
    }

    if (role === 'owner') {
      summary.owner += 1
    }

    if (role === 'staff') {
      summary.staff += 1
    }
    return summary
  }, {
    total: 0,
    active: 0,
    disabled: 0,
    owner: 0,
    staff: 0
  })
}

function getInviteEffectiveStatus(invite = {}, now) {
  if (invite.status === 'used') {
    return 'used'
  }

  if (invite.status === 'disabled') {
    return 'disabled'
  }

  if (invite.status === 'expired' || isDateBefore(invite.expires_at, now)) {
    return 'expired'
  }

  return 'unused'
}

function buildInviteOverview(invites = [], now) {
  return invites.reduce((summary, invite) => {
    const status = getInviteEffectiveStatus(invite, now)
    summary.total += 1
    if (status === 'used') {
      summary.used += 1
    } else if (status === 'disabled') {
      summary.disabled += 1
    } else if (status === 'expired') {
      summary.expired += 1
    } else {
      summary.unused += 1
    }
    return summary
  }, {
    total: 0,
    unused: 0,
    used: 0,
    disabled: 0,
    expired: 0
  })
}

function buildDishOverview(dishes = []) {
  return dishes.reduce((summary, dish = {}) => {
    summary.total += 1
    if (dish.status === 'on_sale') {
      summary.on_sale += 1
    } else if (dish.status === 'off_sale') {
      summary.off_sale += 1
    } else if (dish.status === 'sold_out') {
      summary.sold_out += 1
    }

    if (!hasEnabledEntries(dish.ingredients)) {
      summary.without_ingredients += 1
    }

    if (!hasEnabledEntries(dish.tutorials)) {
      summary.without_tutorials += 1
    }
    return summary
  }, {
    total: 0,
    on_sale: 0,
    off_sale: 0,
    sold_out: 0,
    without_ingredients: 0,
    without_tutorials: 0
  })
}

function isCategoryDisabled(category = {}) {
  if (category.status === 'disabled') {
    return true
  }

  return category.enabled === false
}

function buildCategoryOverview(categories = []) {
  return categories.reduce((summary, category) => {
    summary.total += 1
    if (isCategoryDisabled(category)) {
      summary.disabled += 1
    } else {
      summary.active += 1
    }
    return summary
  }, {
    total: 0,
    active: 0,
    disabled: 0
  })
}

function formatRecentOrder(order = {}) {
  return {
    order_id: order._id || order.order_id || '',
    order_no: order.order_no || '',
    status: order.status || '',
    status_text: formatOrderStatus(order.status),
    total_amount_cent: Number.isFinite(order.total_amount_cent) ? order.total_amount_cent : 0,
    created_at: order.created_at || null,
    item_count: Number.isFinite(order.item_count) ? order.item_count : 0
  }
}

function buildOrderOverview(orders = [], todayRange) {
  const todayOrders = orders.filter((order) => isToday(order.created_at, todayRange))
  const recent = [...orders]
    .sort((left, right) => {
      const rightDate = toDate(right.created_at)
      const leftDate = toDate(left.created_at)
      return (rightDate ? rightDate.getTime() : 0) - (leftDate ? leftDate.getTime() : 0)
    })
    .slice(0, 5)
    .map(formatRecentOrder)

  return {
    today_total: todayOrders.length,
    today_not_cancelled: todayOrders.filter((order) => !isCancelledStatus(order.status)).length,
    today_cancelled: todayOrders.filter((order) => isCancelledStatus(order.status)).length,
    today_finished: todayOrders.filter((order) => order.status === 'finished').length,
    recent
  }
}

function buildWarnings({ merchants, invites, dishes, orders, now, todayRange, dishSummary }) {
  const warnings = []

  const disabledMerchants = merchants.filter((merchant) => merchant && merchant.status === 'disabled').length
  if (disabledMerchants > 0) {
    warnings.push({
      type: 'disabled_merchants',
      level: 'notice',
      title: '存在禁用商户',
      count: disabledMerchants
    })
  }

  if (dishSummary.without_ingredients > 0) {
    warnings.push({
      type: 'without_ingredients',
      level: 'warning',
      title: '存在未配置食材的餐品',
      count: dishSummary.without_ingredients
    })
  }

  if (dishSummary.without_tutorials > 0) {
    warnings.push({
      type: 'without_tutorials',
      level: 'notice',
      title: '存在未配置做法参考的餐品',
      count: dishSummary.without_tutorials
    })
  }

  const expiredUnusedInvites = invites.filter((invite) => (
    invite &&
    (invite.status === 'unused' || !invite.status) &&
    isDateBefore(invite.expires_at, now)
  )).length
  if (expiredUnusedInvites > 0) {
    warnings.push({
      type: 'expired_unused_invites',
      level: 'notice',
      title: '存在已过期未使用邀请码',
      count: expiredUnusedInvites
    })
  }

  const todayNotCancelledOrders = orders.filter((order) => (
    isToday(order.created_at, todayRange) && !isCancelledStatus(order.status)
  ))
  if (todayNotCancelledOrders.length > 0 && dishSummary.without_ingredients > 0) {
    warnings.push({
      type: 'prep_may_be_empty',
      level: 'warning',
      title: '今日有订单，但部分餐品未配置食材',
      count: dishSummary.without_ingredients
    })
  }

  return warnings
}

function buildDependencies(dependencies = {}) {
  return {
    getOpenid: dependencies.getOpenid,
    getSuperAdminOpenids: dependencies.getSuperAdminOpenids,
    now: dependencies.now || (() => new Date()),
    findMerchants: dependencies.findMerchants,
    findStaff: dependencies.findStaff,
    findInvites: dependencies.findInvites,
    findDishes: dependencies.findDishes,
    findCategories: dependencies.findCategories,
    findOrders: dependencies.findOrders,
    getTokenSecret: dependencies.getTokenSecret,
    logger: dependencies.logger || console
  }
}

function isWebAdminRequest(event = {}) {
  return Boolean(event && Object.prototype.hasOwnProperty.call(event, 'admin_token'))
}

function assertWebAdmin(event, deps) {
  const verifyResult = verifyWebAdminToken(event.admin_token, {
    secret: deps.getTokenSecret ? deps.getTokenSecret() : process.env.WEB_ADMIN_TOKEN_SECRET,
    now: deps.now()
  })

  if (!verifyResult.ok) {
    const message = verifyResult.code === 'TOKEN_EXPIRED'
      ? '登录状态已过期'
      : '登录状态无效或已过期'
    return {
      error: failure(verifyResult.code, message)
    }
  }

  return {
    is_web_admin: true,
    role: verifyResult.role
  }
}

function assertSuperAdmin(event, deps) {
  if (isWebAdminRequest(event)) {
    return assertWebAdmin(event, deps)
  }

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

function ensureList(value) {
  return Array.isArray(value) ? value : []
}

function createGetAdminOverviewHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function getAdminOverview(event = {}) {
    try {
      const adminResult = assertSuperAdmin(event, deps)
      if (adminResult.error) {
        return adminResult.error
      }

      const now = deps.now()
      const todayRange = getTodayRange(now)
      const [
        merchants,
        staff,
        invites,
        dishes,
        categories,
        orders
      ] = await Promise.all([
        deps.findMerchants ? deps.findMerchants() : [],
        deps.findStaff ? deps.findStaff() : [],
        deps.findInvites ? deps.findInvites() : [],
        deps.findDishes ? deps.findDishes() : [],
        deps.findCategories ? deps.findCategories() : [],
        deps.findOrders ? deps.findOrders() : []
      ])

      const merchantList = ensureList(merchants)
      const staffList = ensureList(staff)
      const inviteList = ensureList(invites)
      const dishList = ensureList(dishes)
      const categoryList = ensureList(categories)
      const orderList = ensureList(orders)

      const dishSummary = buildDishOverview(dishList)
      const data = {
        generated_at: now,
        merchants: buildMerchantOverview(merchantList),
        staff: buildStaffOverview(staffList),
        invites: buildInviteOverview(inviteList, now),
        dishes: dishSummary,
        categories: buildCategoryOverview(categoryList),
        orders: buildOrderOverview(orderList, todayRange)
      }
      data.warnings = buildWarnings({
        merchants: merchantList,
        invites: inviteList,
        dishes: dishList,
        orders: orderList,
        now,
        todayRange,
        dishSummary
      })

      return success('获取后台数据概览成功', data)
    } catch (error) {
      deps.logger.error('getAdminOverview failed', error)
      return failure('DATABASE_ERROR', '后台数据概览加载失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetAdminOverviewHandler,
  parseSuperAdminOpenids,
  buildMerchantOverview,
  buildStaffOverview,
  buildInviteOverview,
  buildDishOverview,
  buildCategoryOverview,
  buildOrderOverview,
  buildWarnings
}
