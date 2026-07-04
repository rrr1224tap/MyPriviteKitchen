const WEB_ALLOWED_ACTIONS = ['getPrepSummary']
const { verifyWebAdminToken } = require('./web-admin-token-helper')

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

function asList(value) {
  return Array.isArray(value) ? value : []
}

function isActiveMerchantStaff(staff = {}, merchantId, openid) {
  return Boolean(
    staff &&
    staff.merchant_id === merchantId &&
    staff.openid === openid &&
    staff.status === 'active'
  )
}

function normalizeDateValue(value) {
  if (value && typeof value === 'object' && value.$date) {
    return new Date(value.$date)
  }

  return value instanceof Date ? value : new Date(value)
}

function getLocalDayRange(now) {
  const current = now instanceof Date ? now : new Date(now)
  const start = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    0,
    0,
    0,
    0
  )
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start,
    end
  }
}

function getLocalDayRangeFromDateText(dateText) {
  const text = normalizeText(dateText)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null
  }

  const [year, month, day] = text.split('-').map((part) => Number(part))
  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    Number.isNaN(start.getTime()) ||
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null
  }

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start,
    end
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getOrderId(order = {}) {
  return order.order_id || order._id || ''
}

function isOrderInRange(order, start, end) {
  const createdAt = normalizeDateValue(order.created_at)
  return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end
}

function isPrepOrder(order = {}, merchantId, start, end) {
  const status = normalizeText(order.status)
  return order.merchant_id === merchantId &&
    status !== 'cancelled' &&
    status !== 'canceled' &&
    isOrderInRange(order, start, end)
}

function normalizeQuantity(value) {
  const quantity = Number(value)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function normalizeAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function normalizeIngredient(item = {}) {
  const name = normalizeText(item.name)
  const amount = normalizeAmount(item.amount)

  if (!name || amount <= 0 || item.enabled === false) {
    return null
  }

  return {
    name,
    amount,
    unit: normalizeText(item.unit),
    category: normalizeText(item.category) || '其他',
    note: normalizeText(item.note)
  }
}

function formatAmount(value) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(2))).replace(/\.0+$/, '')
}

function addSource(target, source) {
  const key = source.dish_id || source.dish_name
  const existing = target.sources.find((item) => {
    return (item.dish_id || item.dish_name) === key
  })

  if (existing) {
    existing.quantity += source.quantity
    existing.amount += source.amount
    existing.display_amount = `${formatAmount(existing.amount)}${existing.unit}`
    return
  }

  target.sources.push({
    ...source,
    display_amount: `${formatAmount(source.amount)}${source.unit}`
  })
}

function groupItems(items) {
  const categoryOrder = ['主食', '肉类', '蔬菜', '蛋奶', '调料', '其他']
  const groups = items.reduce((result, item) => {
    if (!result[item.category]) {
      result[item.category] = []
    }
    result[item.category].push(item)
    return result
  }, {})

  return Object.keys(groups)
    .sort((left, right) => {
      const leftIndex = categoryOrder.includes(left) ? categoryOrder.indexOf(left) : categoryOrder.length
      const rightIndex = categoryOrder.includes(right) ? categoryOrder.indexOf(right) : categoryOrder.length
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex
      }
      return left.localeCompare(right, 'zh-CN')
    })
    .map((category) => ({
      category,
      items: groups[category].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    }))
}

function buildCopyText(dateText, groups) {
  if (!groups.length) {
    return `今日备料清单（${dateText}）\n暂无需要准备的食材`
  }

  const lines = [`今日备料清单（${dateText}）`]
  groups.forEach((group) => {
    lines.push('')
    lines.push(group.category)
    group.items.forEach((item) => {
      lines.push(`- ${item.name} ${item.display_amount}`)
      if (item.sources.length) {
        const sourceText = item.sources
          .map((source) => `${source.dish_name} x${source.quantity}`)
          .join('，')
        lines.push(`  来自：${sourceText}`)
      }
      if (item.note) {
        lines.push(`  备注：${item.note}`)
      }
    })
  })

  return lines.join('\n')
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

  if (Object.prototype.hasOwnProperty.call(event, 'merchant_id') ||
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

function isWebAdminRequest(event = {}) {
  return Boolean(event && Object.prototype.hasOwnProperty.call(event, 'admin_token'))
}

function assertWebAdmin(event, action, dependencies) {
  const verifyResult = verifyWebAdminToken(event.admin_token, {
    secret: dependencies.getTokenSecret
      ? dependencies.getTokenSecret()
      : process.env.WEB_ADMIN_TOKEN_SECRET,
    now: dependencies.now ? dependencies.now() : new Date()
  })

  if (!verifyResult.ok) {
    return {
      error: failure(
        verifyResult.code,
        verifyResult.code === 'TOKEN_EXPIRED' ? '登录状态已过期' : '登录状态无效或已过期'
      )
    }
  }

  if (action && !WEB_ALLOWED_ACTIONS.includes(action)) {
    return {
      error: failure('INVALID_PARAMS', '备料操作类型不合法')
    }
  }

  return {
    is_web_admin: true,
    role: verifyResult.role
  }
}

function buildPrepSummary({ orders, orderItems, dishes, merchantId, start, dateText }) {
  const activeOrders = asList(orders).filter((order) => isPrepOrder(order, merchantId, start, new Date(start.getTime() + 24 * 60 * 60 * 1000)))
  const activeOrderIds = new Set(activeOrders.map(getOrderId).filter(Boolean))
  const dishMap = asList(dishes).reduce((result, dish) => {
    const dishId = normalizeText(dish.dish_id || dish._id)
    if (dishId && dish.merchant_id === merchantId) {
      result[dishId] = dish
    }
    return result
  }, {})
  const aggregate = {}
  let itemCount = 0
  const dishIds = new Set()

  asList(orderItems)
    .filter((item) => activeOrderIds.has(item.order_id))
    .filter((item) => !item.merchant_id || item.merchant_id === merchantId)
    .forEach((item) => {
      const dishId = normalizeText(item.dish_id)
      const quantity = normalizeQuantity(item.quantity)
      if (!dishId || quantity <= 0) {
        return
      }

      const dish = dishMap[dishId]
      if (!dish) {
        return
      }

      itemCount += quantity
      dishIds.add(dishId)

      asList(dish.ingredients)
        .map(normalizeIngredient)
        .filter(Boolean)
        .forEach((ingredient) => {
          const key = `${ingredient.name}__${ingredient.unit}`
          const amount = ingredient.amount * quantity
          if (!aggregate[key]) {
            aggregate[key] = {
              name: ingredient.name,
              unit: ingredient.unit,
              category: ingredient.category,
              note: ingredient.note,
              amount: 0,
              sources: []
            }
          }

          aggregate[key].amount += amount
          if (!aggregate[key].note && ingredient.note) {
            aggregate[key].note = ingredient.note
          }
          addSource(aggregate[key], {
            dish_id: dishId,
            dish_name: normalizeText(item.dish_name) || normalizeText(dish.name) || '餐品',
            quantity,
            amount,
            unit: ingredient.unit
          })
        })
    })

  const ingredientItems = Object.values(aggregate).map((item) => ({
    ...item,
    amount: Number(formatAmount(item.amount)),
    display_amount: `${formatAmount(item.amount)}${item.unit}`
  }))
  const groups = groupItems(ingredientItems)

  return {
    date: dateText,
    order_count: activeOrders.length,
    item_count: itemCount,
    dish_count: dishIds.size,
    ingredient_count: ingredientItems.length,
    groups,
    copy_text: buildCopyText(dateText, groups)
  }
}

function createGetPrepSummaryHandler(dependencies) {
  return async function getPrepSummary(event = {}) {
    try {
      const normalizedEvent = normalizeEventPayload(event)
      const action = normalizeText(normalizedEvent.action)
      const isWebAdmin = isWebAdminRequest(normalizedEvent)
      let openid = ''

      const merchantId = normalizeText(normalizedEvent.merchant_id)
      if (!merchantId) {
        return failure('INVALID_PARAMS', '商家 ID 不能为空')
      }

      if (isWebAdmin) {
        const webAdminResult = assertWebAdmin(normalizedEvent, action, dependencies)
        if (webAdminResult.error) {
          return webAdminResult.error
        }
      } else {
        openid = dependencies.getOpenid ? dependencies.getOpenid() : ''

        if (!openid) {
          return failure('UNAUTHORIZED', '无法识别用户身份')
        }
      }

      if (!isWebAdmin) {
        const staff = await dependencies.findMerchantStaff({
          merchant_id: merchantId,
          openid
        })

        if (!isActiveMerchantStaff(staff, merchantId, openid)) {
          return failure('FORBIDDEN', '没有查看今日备料的权限')
        }
      }

      const now = dependencies.now ? dependencies.now() : new Date()
      const requestedRange = getLocalDayRangeFromDateText(normalizedEvent.date)
      const { start, end } = requestedRange || getLocalDayRange(now)
      const dateText = formatDate(start)
      const orders = await dependencies.findOrdersByDateRange({
        merchant_id: merchantId,
        start,
        end
      })
      const activeOrders = asList(orders).filter((order) => isPrepOrder(order, merchantId, start, end))
      const orderIds = activeOrders.map(getOrderId).filter(Boolean)
      const orderItems = orderIds.length
        ? await dependencies.findOrderItemsByOrderIds(orderIds)
        : []
      const dishIds = Array.from(new Set(
        asList(orderItems)
          .map((item) => normalizeText(item.dish_id))
          .filter(Boolean)
      ))
      const dishes = dishIds.length
        ? await dependencies.findDishesByIds(dishIds, merchantId)
        : []

      return success('获取今日备料成功', buildPrepSummary({
        orders: activeOrders,
        orderItems,
        dishes,
        merchantId,
        start,
        dateText
      }))
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getPrepSummary failed', error)
      }

      return failure('DATABASE_ERROR', '备料清单加载失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetPrepSummaryHandler,
  buildPrepSummary
}
