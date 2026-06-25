const VALID_ACTIONS = ['check', 'fixDishMerchantId', 'fixCategoryMerchantId']
const VALID_MERCHANT_STATUS = ['active', 'disabled']
const VALID_STAFF_ROLE = ['owner', 'staff']
const VALID_STAFF_STATUS = ['active', 'disabled']
const VALID_INVITE_ROLE = ['owner', 'staff']
const VALID_INVITE_STATUS = ['unused', 'used', 'disabled', 'expired']
const VALID_CATEGORY_STATUS = ['active', 'disabled']
const VALID_ORDER_STATUS = ['pending', 'accepted', 'cooking', 'finished', 'cancelled', 'canceled']

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

function isMissingText(value) {
  return !normalizeText(value)
}

function ensureList(value) {
  return Array.isArray(value) ? value : []
}

function getRecordId(record = {}) {
  return normalizeText(record._id || record.id || record.merchant_id || record.category_id || record.dish_id)
}

function getCategoryId(category = {}) {
  return normalizeText(category._id || category.category_id || category.id)
}

function isInvalidNumber(value) {
  return typeof value !== 'number' || !Number.isFinite(value) || value < 0
}

function hasEnabledEntries(value) {
  return Array.isArray(value) && value.some((item) => item && item.enabled !== false)
}

function groupDuplicates(list, keyGetter) {
  const counter = new Map()
  list.forEach((item) => {
    const key = normalizeText(keyGetter(item))
    if (!key) {
      return
    }
    counter.set(key, (counter.get(key) || 0) + 1)
  })

  return [...counter.values()].filter((count) => count > 1).reduce((total, count) => total + count - 1, 0)
}

function makeIssue({
  level = 'warning',
  code,
  title,
  description,
  count,
  fixable = false,
  action = ''
}) {
  return {
    level,
    code,
    title,
    description,
    count,
    fixable,
    action
  }
}

function addIssue(issues, issue) {
  if (issue.count > 0) {
    issues.push(issue)
  }
}

function buildMerchantsSection(merchants = []) {
  const issues = []
  const activeMerchants = merchants.filter((merchant) => merchant && merchant.status !== 'disabled')
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'NO_ACTIVE_MERCHANT',
    title: '没有启用商户',
    description: '当前没有可用商户，请确认是否已创建并启用商户。',
    count: activeMerchants.length ? 0 : 1
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DUPLICATE_MERCHANT_ID',
    title: '存在重复商户 ID',
    description: '多个商户使用了相同 merchant_id，请人工确认后处理。',
    count: groupDuplicates(merchants, (merchant) => merchant && merchant.merchant_id)
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'EMPTY_MERCHANT_NAME',
    title: '存在名称为空的商户',
    description: '商户名称为空会影响后台识别和展示。',
    count: merchants.filter((merchant) => isMissingText(merchant && merchant.name)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_MERCHANT_STATUS',
    title: '存在异常商户状态',
    description: '商户状态只能是 active 或 disabled。',
    count: merchants.filter((merchant) => (
      merchant && merchant.status && !VALID_MERCHANT_STATUS.includes(merchant.status)
    )).length
  }))

  return {
    key: 'merchants',
    title: '商户数据',
    issues
  }
}

function buildStaffSection(staffList = [], merchantIds = new Set()) {
  const issues = []
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'STAFF_MISSING_MERCHANT_ID',
    title: '存在缺失商户 ID 的成员',
    description: '成员缺少 merchant_id，会导致无法判断归属商户。',
    count: staffList.filter((staff) => isMissingText(staff && staff.merchant_id)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'STAFF_MISSING_OPENID',
    title: '存在缺失 OpenID 的成员',
    description: '成员缺少 openid，无法完成身份识别。',
    count: staffList.filter((staff) => isMissingText(staff && staff.openid)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'STAFF_ORPHAN_MERCHANT',
    title: '存在关联不到商户的成员',
    description: '成员记录中的 merchant_id 在商户集合中不存在。',
    count: staffList.filter((staff) => {
      const merchantId = normalizeText(staff && staff.merchant_id)
      return merchantId && !merchantIds.has(merchantId)
    }).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_STAFF_ROLE',
    title: '存在异常成员角色',
    description: '成员角色只能是 owner 或 staff。',
    count: staffList.filter((staff) => staff && staff.role && !VALID_STAFF_ROLE.includes(staff.role)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_STAFF_STATUS',
    title: '存在异常成员状态',
    description: '成员状态只能是 active 或 disabled。',
    count: staffList.filter((staff) => staff && staff.status && !VALID_STAFF_STATUS.includes(staff.status)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DUPLICATE_STAFF',
    title: '存在重复商户成员',
    description: '同一 merchant_id + openid 出现了重复成员记录。',
    count: groupDuplicates(staffList, (staff) => `${normalizeText(staff && staff.merchant_id)}::${normalizeText(staff && staff.openid)}`)
  }))

  return {
    key: 'staff',
    title: '成员数据',
    issues
  }
}

function buildInvitesSection(invites = [], merchantIds = new Set(), now = new Date()) {
  const issues = []
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVITE_MISSING_CODE',
    title: '存在缺失邀请码的记录',
    description: '邀请码为空时无法被正常兑换。',
    count: invites.filter((invite) => isMissingText(invite && invite.code)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DUPLICATE_INVITE_CODE',
    title: '存在重复邀请码',
    description: '重复邀请码会导致兑换归属不明确。',
    count: groupDuplicates(invites, (invite) => invite && invite.code)
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVITE_ORPHAN_MERCHANT',
    title: '存在关联不到商户的邀请码',
    description: '邀请码记录中的 merchant_id 在商户集合中不存在。',
    count: invites.filter((invite) => {
      const merchantId = normalizeText(invite && invite.merchant_id)
      return merchantId && !merchantIds.has(merchantId)
    }).length
  }))
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'EXPIRED_UNUSED_INVITE',
    title: '存在已过期但仍标记未使用的邀请码',
    description: '第一版只提示，不会自动修改邀请码状态。',
    count: invites.filter((invite) => {
      const date = toDate(invite && invite.expires_at)
      return invite && invite.status === 'unused' && date && date.getTime() < now.getTime()
    }).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_INVITE_STATUS',
    title: '存在异常邀请码状态',
    description: '邀请码状态只能是 unused、used、disabled 或 expired。',
    count: invites.filter((invite) => invite && invite.status && !VALID_INVITE_STATUS.includes(invite.status)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_INVITE_ROLE',
    title: '存在异常邀请码角色',
    description: '邀请码角色只能是 owner 或 staff。',
    count: invites.filter((invite) => invite && invite.role && !VALID_INVITE_ROLE.includes(invite.role)).length
  }))

  return {
    key: 'invites',
    title: '邀请码数据',
    issues
  }
}

function buildDishesSection(dishes = [], categoryIds = new Set()) {
  const issues = []
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DISH_MISSING_MERCHANT_ID',
    title: '存在缺失商户 ID 的餐品',
    description: '这些餐品可以安全补齐默认商户 ID，不会覆盖已有 merchant_id。',
    count: dishes.filter((dish) => isMissingText(dish && dish.merchant_id)).length,
    fixable: true,
    action: 'fixDishMerchantId'
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DISH_EMPTY_NAME',
    title: '存在名称为空的餐品',
    description: '餐品名称为空会影响菜单和后台识别。',
    count: dishes.filter((dish) => isMissingText(dish && dish.name)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DISH_INVALID_PRICE',
    title: '存在价格异常的餐品',
    description: 'price_cent 必须是大于等于 0 的数字。',
    count: dishes.filter((dish) => isInvalidNumber(dish && dish.price_cent)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'DISH_INVALID_STOCK',
    title: '存在库存异常的餐品',
    description: 'stock_count 或兼容旧字段 stock 不能为负数，也不能是非数字。',
    count: dishes.filter((dish) => {
      if (!dish) {
        return false
      }
      if (dish.stock_count !== undefined) {
        return isInvalidNumber(dish.stock_count)
      }
      if (dish.stock !== undefined) {
        return isInvalidNumber(dish.stock)
      }
      return false
    }).length
  }))
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'DISH_MISSING_CATEGORY',
    title: '存在没有分类的餐品',
    description: '餐品缺少 category_id，可能无法在菜单中正确归类。',
    count: dishes.filter((dish) => isMissingText(dish && dish.category_id)).length
  }))
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'DISH_ORPHAN_CATEGORY',
    title: '存在关联不到分类的餐品',
    description: '餐品 category_id 在分类集合中不存在。',
    count: dishes.filter((dish) => {
      const categoryId = normalizeText(dish && dish.category_id)
      return categoryId && !categoryIds.has(categoryId)
    }).length
  }))
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'DISH_WITHOUT_INGREDIENTS',
    title: '存在未配置启用食材的餐品',
    description: '这些餐品不会贡献今日备料明细。',
    count: dishes.filter((dish) => !hasEnabledEntries(dish && dish.ingredients)).length
  }))
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'DISH_WITHOUT_TUTORIALS',
    title: '存在未配置启用做法参考的餐品',
    description: '商家订单详情中可能看不到做法参考。',
    count: dishes.filter((dish) => !hasEnabledEntries(dish && dish.tutorials)).length
  }))

  return {
    key: 'dishes',
    title: '餐品数据',
    issues
  }
}

function buildCategoriesSection(categories = [], dishes = []) {
  const issues = []
  const usedCategoryIds = new Set(dishes.map((dish) => normalizeText(dish && dish.category_id)).filter(Boolean))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'CATEGORY_MISSING_MERCHANT_ID',
    title: '存在缺失商户 ID 的分类',
    description: '这些分类可以安全补齐默认商户 ID，不会覆盖已有 merchant_id。',
    count: categories.filter((category) => isMissingText(category && category.merchant_id)).length,
    fixable: true,
    action: 'fixCategoryMerchantId'
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'CATEGORY_EMPTY_NAME',
    title: '存在名称为空的分类',
    description: '分类名称为空会影响菜单和后台识别。',
    count: categories.filter((category) => isMissingText(category && category.name)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_CATEGORY_STATUS',
    title: '存在异常分类状态',
    description: '分类 status 如存在，只能是 active 或 disabled。',
    count: categories.filter((category) => (
      category && category.status && !VALID_CATEGORY_STATUS.includes(category.status)
    )).length
  }))
  addIssue(issues, makeIssue({
    level: 'warning',
    code: 'EMPTY_CATEGORY',
    title: '存在没有餐品的空分类',
    description: '空分类不会影响下单，但可能让菜单管理更混乱。',
    count: categories.filter((category) => {
      const categoryId = getCategoryId(category)
      return categoryId && !usedCategoryIds.has(categoryId)
    }).length
  }))

  return {
    key: 'categories',
    title: '分类数据',
    issues
  }
}

function getOrderItems(order = {}, orderItemsByOrderId = new Map()) {
  if (Array.isArray(order.items)) {
    return order.items
  }

  const orderId = normalizeText(order._id || order.order_id)
  const orderNo = normalizeText(order.order_no)
  return [
    ...(orderId ? ensureList(orderItemsByOrderId.get(orderId)) : []),
    ...(orderNo ? ensureList(orderItemsByOrderId.get(orderNo)) : [])
  ]
}

function buildOrdersSection(orders = [], orderItems = []) {
  const issues = []
  const orderItemsByOrderId = new Map()
  orderItems.forEach((item) => {
    const orderId = normalizeText(item && (item.order_id || item.order_no))
    if (!orderId) {
      return
    }
    if (!orderItemsByOrderId.has(orderId)) {
      orderItemsByOrderId.set(orderId, [])
    }
    orderItemsByOrderId.get(orderId).push(item)
  })

  addIssue(issues, makeIssue({
    level: 'error',
    code: 'ORDER_MISSING_NO',
    title: '存在缺失订单号的订单',
    description: '订单号为空会影响对账和人工排查。',
    count: orders.filter((order) => isMissingText(order && order.order_no)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'ORDER_INVALID_AMOUNT',
    title: '存在金额异常的订单',
    description: '订单金额只能检查，第一版不会自动修复。',
    count: orders.filter((order) => isInvalidNumber(order && order.total_amount_cent)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'ORDER_EMPTY_ITEMS',
    title: '存在空商品订单',
    description: '订单没有商品明细，需要人工确认。',
    count: orders.filter((order) => {
      const items = getOrderItems(order, orderItemsByOrderId)
      if (items.length > 0) {
        return false
      }
      return !Number.isFinite(order && order.item_count) || order.item_count <= 0
    }).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'INVALID_ORDER_STATUS',
    title: '存在异常订单状态',
    description: '订单状态不在当前允许范围内。',
    count: orders.filter((order) => order && order.status && !VALID_ORDER_STATUS.includes(order.status)).length
  }))
  addIssue(issues, makeIssue({
    level: 'error',
    code: 'ORDER_ITEM_MISSING_DISH_ID',
    title: '存在订单商品缺失 dish_id',
    description: '订单商品缺少 dish_id 会影响后续追溯和备料。',
    count: orders.reduce((total, order) => {
      const items = getOrderItems(order, orderItemsByOrderId)
      return total + items.filter((item) => isMissingText(item && item.dish_id)).length
    }, 0)
  }))

  return {
    key: 'orders',
    title: '订单数据',
    issues
  }
}

function buildSummary(sections = []) {
  return sections.reduce((summary, section) => {
    section.issues.forEach((issue) => {
      summary.total_issues += issue.count
      if (issue.level === 'error') {
        summary.error_count += issue.count
      } else {
        summary.warning_count += issue.count
      }
      if (issue.fixable) {
        summary.fixable_count += issue.count
      }
    })
    return summary
  }, {
    total_issues: 0,
    error_count: 0,
    warning_count: 0,
    fixable_count: 0
  })
}

function buildFixableActions(sections = []) {
  const actionTextMap = {
    fixDishMerchantId: '补齐餐品默认商户 ID',
    fixCategoryMerchantId: '补齐分类默认商户 ID'
  }
  const counter = new Map()

  sections.forEach((section) => {
    section.issues.forEach((issue) => {
      if (!issue.fixable || !issue.action) {
        return
      }
      counter.set(issue.action, (counter.get(issue.action) || 0) + issue.count)
    })
  })

  return [...counter.entries()].map(([action, count]) => ({
    action,
    title: actionTextMap[action] || action,
    count
  }))
}

function buildHealthReport({
  merchants,
  staff,
  invites,
  dishes,
  categories,
  orders,
  orderItems,
  now
}) {
  const merchantIds = new Set(merchants.map((merchant) => normalizeText(merchant && merchant.merchant_id)).filter(Boolean))
  const categoryIds = new Set(categories.map(getCategoryId).filter(Boolean))
  const sections = [
    buildMerchantsSection(merchants),
    buildStaffSection(staff, merchantIds),
    buildInvitesSection(invites, merchantIds, now),
    buildDishesSection(dishes, categoryIds),
    buildCategoriesSection(categories, dishes),
    buildOrdersSection(orders, orderItems)
  ]

  return {
    generated_at: now,
    summary: buildSummary(sections),
    sections,
    fixable_actions: buildFixableActions(sections)
  }
}

function buildDependencies(dependencies = {}) {
  return {
    getOpenid: dependencies.getOpenid,
    getSuperAdminOpenids: dependencies.getSuperAdminOpenids,
    getDefaultMerchantId: dependencies.getDefaultMerchantId || (() => process.env.DEFAULT_MERCHANT_ID || 'merchant_001'),
    now: dependencies.now || (() => new Date()),
    findMerchants: dependencies.findMerchants,
    findStaff: dependencies.findStaff,
    findInvites: dependencies.findInvites,
    findDishes: dependencies.findDishes,
    findCategories: dependencies.findCategories,
    findOrders: dependencies.findOrders,
    findOrderItems: dependencies.findOrderItems,
    fixDishMerchantId: dependencies.fixDishMerchantId,
    fixCategoryMerchantId: dependencies.fixCategoryMerchantId,
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

async function loadAllData(deps) {
  const [
    merchants,
    staff,
    invites,
    dishes,
    categories,
    orders,
    orderItems
  ] = await Promise.all([
    deps.findMerchants ? deps.findMerchants() : [],
    deps.findStaff ? deps.findStaff() : [],
    deps.findInvites ? deps.findInvites() : [],
    deps.findDishes ? deps.findDishes() : [],
    deps.findCategories ? deps.findCategories() : [],
    deps.findOrders ? deps.findOrders() : [],
    deps.findOrderItems ? deps.findOrderItems() : []
  ])

  return {
    merchants: ensureList(merchants),
    staff: ensureList(staff),
    invites: ensureList(invites),
    dishes: ensureList(dishes),
    categories: ensureList(categories),
    orders: ensureList(orders),
    orderItems: ensureList(orderItems)
  }
}

async function handleCheck(deps) {
  const data = await loadAllData(deps)
  return success('数据健康检查完成', buildHealthReport({
    ...data,
    now: deps.now()
  }))
}

async function handleFixDishMerchantId(deps) {
  const data = await loadAllData(deps)
  const report = buildHealthReport({
    ...data,
    now: deps.now()
  })
  const issue = getFixableIssue(report, 'fixDishMerchantId')
  const beforeCount = issue ? issue.count : 0
  const defaultMerchantId = normalizeText(deps.getDefaultMerchantId())
  const fixedCount = beforeCount > 0 && deps.fixDishMerchantId
    ? await deps.fixDishMerchantId({
      merchant_id: defaultMerchantId,
      updated_at: deps.now()
    })
    : 0

  return success('餐品默认商户 ID 修复完成', {
    action: 'fixDishMerchantId',
    default_merchant_id: defaultMerchantId,
    before_count: beforeCount,
    fixed_count: fixedCount
  })
}

async function handleFixCategoryMerchantId(deps) {
  const data = await loadAllData(deps)
  const report = buildHealthReport({
    ...data,
    now: deps.now()
  })
  const issue = getFixableIssue(report, 'fixCategoryMerchantId')
  const beforeCount = issue ? issue.count : 0
  const defaultMerchantId = normalizeText(deps.getDefaultMerchantId())
  const fixedCount = beforeCount > 0 && deps.fixCategoryMerchantId
    ? await deps.fixCategoryMerchantId({
      merchant_id: defaultMerchantId,
      updated_at: deps.now()
    })
    : 0

  return success('分类默认商户 ID 修复完成', {
    action: 'fixCategoryMerchantId',
    default_merchant_id: defaultMerchantId,
    before_count: beforeCount,
    fixed_count: fixedCount
  })
}

function getFixableIssue(report, action) {
  for (const section of report.sections) {
    const issue = section.issues.find((item) => item.action === action)
    if (issue) {
      return issue
    }
  }
  return null
}

function createCheckAdminDataHealthHandler(dependencies = {}) {
  const deps = buildDependencies(dependencies)

  return async function checkAdminDataHealth(event = {}) {
    try {
      const action = normalizeText(event.action || 'check') || 'check'
      const payload = normalizePayload(event.payload || event.data)

      if (!VALID_ACTIONS.includes(action)) {
        return failure('INVALID_PARAMS', '数据检查操作类型不合法')
      }

      const adminResult = assertSuperAdmin(deps)
      if (adminResult.error) {
        return adminResult.error
      }

      if (action === 'fixDishMerchantId') {
        return handleFixDishMerchantId(deps, payload)
      }

      if (action === 'fixCategoryMerchantId') {
        return handleFixCategoryMerchantId(deps, payload)
      }

      return handleCheck(deps)
    } catch (error) {
      deps.logger.error('checkAdminDataHealth failed', error)
      return failure('DATABASE_ERROR', '数据健康检查失败，请稍后重试')
    }
  }
}

module.exports = {
  createCheckAdminDataHealthHandler,
  parseSuperAdminOpenids,
  buildHealthReport,
  buildMerchantsSection,
  buildStaffSection,
  buildInvitesSection,
  buildDishesSection,
  buildCategoriesSection,
  buildOrdersSection
}
