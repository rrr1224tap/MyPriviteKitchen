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

function isSafeAmount(value) {
  return Number.isInteger(value) && value >= 0
}

function getOrderUserOpenid(order = {}) {
  return order.user_openid || order.openid || ''
}

function formatOrder(order = {}) {
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
    cancelled_at: order.cancelled_at || null
  }
}

function formatOrderItem(item = {}) {
  const unitPriceCent = Number(item.unit_price_cent || item.price_cent)
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
    unit_price_cent: isSafeAmount(unitPriceCent) ? unitPriceCent : 0,
    price_cent: isSafeAmount(unitPriceCent) ? unitPriceCent : 0,
    quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 0,
    subtotal_cent: isSafeAmount(subtotalCent) ? subtotalCent : 0,
    created_at: item.created_at || null
  }
}

function createGetOrderDetailHandler(dependencies) {
  return async function getOrderDetail(event = {}) {
    try {
      const openid = dependencies.getOpenid()

      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const orderId = normalizeText(event.order_id)

      if (!orderId) {
        return failure('INVALID_PARAMS', '订单 ID 不能为空')
      }

      const order = await dependencies.findOrderById(orderId)

      if (!order) {
        return failure('NOT_FOUND', '订单不存在')
      }

      if (getOrderUserOpenid(order) !== openid) {
        return failure('FORBIDDEN', '不能查看其他用户的订单')
      }

      const resolvedOrderId = order.order_id || order._id || orderId
      const items = await dependencies.findOrderItemsByOrderId(resolvedOrderId)

      return success('获取订单详情成功', {
        order: formatOrder(order),
        items: asList(items).map(formatOrderItem)
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getOrderDetail failed', error)
      }

      return failure('SERVER_ERROR', '获取订单详情失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetOrderDetailHandler
}

