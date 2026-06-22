const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

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

function normalizePositiveInteger(value, defaultValue) {
  const number = Number(value)

  if (!Number.isInteger(number) || number <= 0) {
    return defaultValue
  }

  return number
}

function normalizePage(value) {
  return normalizePositiveInteger(value, DEFAULT_PAGE)
}

function normalizePageSize(value) {
  return Math.min(
    normalizePositiveInteger(value, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  )
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function isSafeAmount(value) {
  return Number.isInteger(value) && value >= 0
}

function getOrderUserOpenid(order = {}) {
  return order.user_openid || order.openid || ''
}

function formatOrder(order = {}, items = []) {
  const totalAmountCent = Number(order.total_amount_cent)
  const itemCount = Number(order.item_count)

  return {
    _id: order._id || '',
    order_id: order.order_id || order._id || '',
    order_no: order.order_no || '',
    merchant_id: order.merchant_id || '',
    user_openid: getOrderUserOpenid(order),
    status: order.status || '',
    payment_status: order.payment_status || '',
    payment_method: order.payment_method || '',
    pickup_type: order.pickup_type || '',
    remark: order.remark || '',
    item_count: Number.isInteger(itemCount) ? itemCount : 0,
    total_amount_cent: isSafeAmount(totalAmountCent) ? totalAmountCent : 0,
    created_at: order.created_at || null,
    updated_at: order.updated_at || null,
    accepted_at: order.accepted_at || null,
    cooking_at: order.cooking_at || null,
    finished_at: order.finished_at || null,
    cancelled_at: order.cancelled_at || null,
    items: items.map(formatOrderItem)
  }
}

function formatOrderItem(item = {}) {
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
    created_at: item.created_at || null
  }
}

function groupItemsByOrderId(items) {
  return asList(items).reduce((result, item) => {
    const orderId = item.order_id || ''

    if (!orderId) {
      return result
    }

    if (!result[orderId]) {
      result[orderId] = []
    }

    result[orderId].push(item)
    return result
  }, {})
}

function createGetUserOrdersHandler(dependencies) {
  return async function getUserOrders(event = {}) {
    try {
      const openid = dependencies.getOpenid()

      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const merchantId = normalizeText(event.merchant_id)
      const status = normalizeText(event.status)
      const page = normalizePage(event.page)
      const pageSize = normalizePageSize(event.page_size)

      const orderResult = await dependencies.findUserOrders({
        openid,
        merchant_id: merchantId,
        status,
        page,
        page_size: pageSize
      })

      const orders = asList(orderResult && orderResult.list)
        .filter((order) => getOrderUserOpenid(order) === openid)
      const total = Number.isInteger(orderResult && orderResult.total)
        ? orderResult.total
        : orders.length
      const orderIds = orders
        .map((order) => order.order_id || order._id)
        .filter(Boolean)
      const orderItems = orderIds.length
        ? await dependencies.findOrderItemsByOrderIds(orderIds)
        : []
      const itemsByOrderId = groupItemsByOrderId(orderItems)
      const list = orders.map((order) => {
        const orderId = order.order_id || order._id || ''
        return formatOrder(order, itemsByOrderId[orderId] || [])
      })

      return success('获取订单列表成功', {
        list,
        pagination: {
          page,
          page_size: pageSize,
          total,
          has_more: page * pageSize < total
        }
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getUserOrders failed', error)
      }

      return failure('SERVER_ERROR', '获取订单列表失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetUserOrdersHandler
}
