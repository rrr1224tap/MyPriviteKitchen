const ORDER_STATUS_PENDING = 'pending'
const ORDER_STATUS_CANCELLED = 'cancelled'

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

function getOrderUserOpenid(order = {}) {
  return order.user_openid || order.openid || ''
}

function getOrderId(order = {}) {
  return order.order_id || order._id || ''
}

function isStatusConflictError(error) {
  return error && error.code === 'STATUS_CONFLICT'
}

function createCancelUserOrderHandler(dependencies) {
  return async function cancelUserOrder(event = {}) {
    try {
      const openid = dependencies.getOpenid()

      if (!openid) {
        return failure('UNAUTHORIZED', '无法识别用户身份')
      }

      const orderId = normalizeText(event.order_id)

      if (!orderId) {
        return failure('INVALID_PARAMS', '缺少订单信息')
      }

      const order = await dependencies.findOrderById(orderId)

      if (!order) {
        return failure('NOT_FOUND', '订单不存在')
      }

      if (getOrderUserOpenid(order) !== openid) {
        return failure('FORBIDDEN', '当前账号无法操作该订单')
      }

      if (order.status !== ORDER_STATUS_PENDING) {
        return failure('STATUS_CONFLICT', '当前订单状态不允许取消')
      }

      const now = dependencies.now()
      const resolvedOrderId = getOrderId(order)
      const updateData = {
        status: ORDER_STATUS_CANCELLED,
        cancelled_at: now,
        updated_at: now
      }

      try {
        await dependencies.cancelOrder({
          order_id: resolvedOrderId,
          user_openid: openid,
          current_status: ORDER_STATUS_PENDING,
          updateData
        })
      } catch (error) {
        if (isStatusConflictError(error)) {
          return failure('STATUS_CONFLICT', '订单状态已变化，当前不可取消')
        }

        if (typeof dependencies.logError === 'function') {
          dependencies.logError('cancelUserOrder database update failed', error)
        }

        return failure('DATABASE_ERROR', '订单取消失败，请稍后重试')
      }

      return success('订单已取消', {
        order_id: resolvedOrderId,
        status: ORDER_STATUS_CANCELLED,
        cancelled_at: now
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('cancelUserOrder failed', error)
      }

      return failure('DATABASE_ERROR', '订单取消失败，请稍后重试')
    }
  }
}

module.exports = {
  createCancelUserOrderHandler
}
