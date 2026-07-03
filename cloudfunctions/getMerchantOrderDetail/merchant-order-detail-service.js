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

const WEB_ALLOWED_ACTIONS = ['getOrderDetail']
const { verifyWebAdminToken } = require('./web-admin-token-helper')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asList(value) {
  return Array.isArray(value) ? value : []
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

const VALID_TUTORIAL_PLATFORMS = ['douyin', 'xiaohongshu', 'bilibili', 'other']
const MAX_TUTORIAL_COUNT = 3

function isSafeAmount(value) {
  return Number.isInteger(value) && value >= 0
}

function getOrderId(order = {}) {
  return order.order_id || order._id || ''
}

function getOrderUserOpenid(order = {}) {
  return order.user_openid || order.openid || ''
}

function isActiveMerchantStaff(staff = {}, merchantId, openid) {
  return Boolean(
    staff &&
    staff.merchant_id === merchantId &&
    staff.openid === openid &&
    staff.status === 'active'
  )
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
      error: failure('FORBIDDEN', 'Web 后台当前仅开放订单详情读取')
    }
  }

  return {
    is_web_admin: true,
    role: verifyResult.role
  }
}

function normalizeTutorialPlatform(value) {
  const platform = normalizeText(value)
  return VALID_TUTORIAL_PLATFORMS.includes(platform) ? platform : 'other'
}

function normalizeTutorialList(value, enabledOnly = false) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null
      }

      const title = normalizeText(item.title)
      const url = normalizeText(item.url)
      const note = normalizeText(item.note)

      if (!title && !url && !note) {
        return null
      }

      const enabled = typeof item.enabled === 'boolean' ? item.enabled : true
      if (enabledOnly && !enabled) {
        return null
      }

      return {
        title: title || `做法参考 ${index + 1}`,
        platform: normalizeTutorialPlatform(item.platform),
        url,
        note,
        enabled,
        sort_order: Number.isFinite(Number(item.sort_order))
          ? Number(item.sort_order)
          : index + 1
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.sort_order - right.sort_order)
    .slice(0, MAX_TUTORIAL_COUNT)
}

function buildTutorialMap(dishes = []) {
  return asList(dishes).reduce((map, dish) => {
    const dishId = dish && (dish.dish_id || dish._id || '')
    if (dishId) {
      map[dishId] = normalizeTutorialList(dish.tutorials, true)
    }
    return map
  }, {})
}

function formatOrder(order = {}) {
  const totalAmountCent = Number(order.total_amount_cent)
  const itemCount = Number(order.item_count)

  return {
    _id: order._id || '',
    order_id: getOrderId(order),
    order_no: order.order_no || '',
    merchant_id: order.merchant_id || '',
    user_openid: getOrderUserOpenid(order),
    status: order.status || '',
    payment_status: order.payment_status || '',
    payment_method: order.payment_method || '',
    pickup_type: order.pickup_type || '',
    remark: order.remark || '',
    contact_name: order.contact_name || order.receiver_name || order.user_nickname || '',
    receiver_name: order.receiver_name || '',
    user_nickname: order.user_nickname || '',
    contact_phone: order.contact_phone || order.phone || '',
    phone: order.phone || order.contact_phone || '',
    address: order.address || '',
    pickup_time: order.pickup_time || '',
    dining_type: order.dining_type || '',
    item_count: Number.isInteger(itemCount) ? itemCount : 0,
    total_amount_cent: isSafeAmount(totalAmountCent) ? totalAmountCent : 0,
    created_at: order.created_at || null,
    updated_at: order.updated_at || null,
    accepted_at: order.accepted_at || null,
    cooking_at: order.cooking_at || null,
    finished_at: order.finished_at || null,
    cancelled_at: order.cancelled_at || null
  }
}

function formatOrderItem(item = {}, tutorialMap = {}) {
  const unitPriceCent = Number(item.unit_price_cent || item.price_cent)
  const basePriceCent = Number(item.base_price_cent)
  const specDeltaCent = Number(item.spec_delta_cent)
  const addonDeltaCent = Number(item.addon_delta_cent)
  const subtotalCent = Number(item.subtotal_cent)
  const quantity = Number(item.quantity)

  return {
    _id: item._id || '',
    order_item_id: item.order_item_id || item._id || '',
    order_id: item.order_id || '',
    order_no: item.order_no || '',
    merchant_id: item.merchant_id || '',
    dish_id: item.dish_id || '',
    dish_name: item.dish_name || '',
    dish_image_url: item.dish_image_url || item.dish_image || '',
    dish_image: item.dish_image || item.dish_image_url || '',
    base_price_cent: isSafeAmount(basePriceCent) ? basePriceCent : 0,
    spec_delta_cent: isSafeAmount(specDeltaCent) ? specDeltaCent : 0,
    addon_delta_cent: isSafeAmount(addonDeltaCent) ? addonDeltaCent : 0,
    unit_price_cent: isSafeAmount(unitPriceCent) ? unitPriceCent : 0,
    price_cent: isSafeAmount(unitPriceCent) ? unitPriceCent : 0,
    quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 0,
    subtotal_cent: isSafeAmount(subtotalCent) ? subtotalCent : 0,
    selected_specs: Array.isArray(item.selected_specs) ? item.selected_specs : [],
    selected_addons: Array.isArray(item.selected_addons) ? item.selected_addons : [],
    tutorials: tutorialMap[item.dish_id] || [],
    created_at: item.created_at || null
  }
}

function createGetMerchantOrderDetailHandler(dependencies) {
  return async function getMerchantOrderDetail(event = {}) {
    try {
      const normalizedEvent = normalizeEventPayload(event)

      const merchantId = normalizeText(normalizedEvent.merchant_id)
      const orderId = normalizeText(normalizedEvent.order_id)

      if (!merchantId || !orderId) {
        return failure('INVALID_PARAMS', '商家 ID 和订单 ID 不能为空')
      }

      const action = normalizeText(normalizedEvent.action)
      if (isWebAdminRequest(normalizedEvent)) {
        const webAdminResult = assertWebAdmin(normalizedEvent, action, dependencies)
        if (webAdminResult.error) {
          return webAdminResult.error
        }
      } else {
        const openid = dependencies.getOpenid()

        if (!openid) {
          return failure('UNAUTHORIZED', '无法获取用户身份')
        }

        const staff = await dependencies.findMerchantStaff({
          merchant_id: merchantId,
          openid
        })

        if (!isActiveMerchantStaff(staff, merchantId, openid)) {
          return failure('FORBIDDEN', '没有查看商家订单详情的权限')
        }
      }

      const order = await dependencies.findOrderById(orderId)

      if (!order) {
        return failure('NOT_FOUND', '订单不存在')
      }

      if (order.merchant_id !== merchantId) {
        return failure('FORBIDDEN', '不能查看其他商家的订单')
      }

      const resolvedOrderId = getOrderId(order) || orderId
      const items = await dependencies.findOrderItemsByOrderId(
        resolvedOrderId,
        merchantId
      )
      const merchantItems = asList(items)
        .filter((item) => !item.merchant_id || item.merchant_id === merchantId)
      const dishIds = Array.from(new Set(
        merchantItems
          .map((item) => normalizeText(item.dish_id))
          .filter(Boolean)
      ))
      const dishes = typeof dependencies.findDishesByIds === 'function' && dishIds.length
        ? await dependencies.findDishesByIds(dishIds, merchantId)
        : []
      const tutorialMap = buildTutorialMap(dishes)

      return success('获取商家订单详情成功', {
        order: formatOrder(order),
        items: merchantItems.map((item) => formatOrderItem(item, tutorialMap))
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getMerchantOrderDetail failed', error)
      }

      return failure('SERVER_ERROR', '获取商家订单详情失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetMerchantOrderDetailHandler
}
