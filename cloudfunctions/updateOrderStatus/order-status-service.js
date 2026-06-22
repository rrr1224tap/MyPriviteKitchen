const ORDER_STATUS_PENDING = 'pending'
const ORDER_STATUS_ACCEPTED = 'accepted'
const ORDER_STATUS_COOKING = 'cooking'
const ORDER_STATUS_FINISHED = 'finished'
const ORDER_STATUS_CANCELLED = 'cancelled'

const VALID_ORDER_STATUSES = [
  ORDER_STATUS_PENDING,
  ORDER_STATUS_ACCEPTED,
  ORDER_STATUS_COOKING,
  ORDER_STATUS_FINISHED,
  ORDER_STATUS_CANCELLED
]

const ALLOWED_STATUS_FLOW = {
  [ORDER_STATUS_PENDING]: [ORDER_STATUS_ACCEPTED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_ACCEPTED]: [ORDER_STATUS_COOKING, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_COOKING]: [ORDER_STATUS_FINISHED],
  [ORDER_STATUS_FINISHED]: [],
  [ORDER_STATUS_CANCELLED]: []
}

const STATUS_TIME_FIELD = {
  [ORDER_STATUS_ACCEPTED]: 'accepted_at',
  [ORDER_STATUS_COOKING]: 'cooking_at',
  [ORDER_STATUS_FINISHED]: 'finished_at',
  [ORDER_STATUS_CANCELLED]: 'cancelled_at'
}

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

function isValidOrderStatus(status) {
  return VALID_ORDER_STATUSES.includes(status)
}

function isStatusFlowAllowed(currentStatus, nextStatus) {
  return (ALLOWED_STATUS_FLOW[currentStatus] || []).includes(nextStatus)
}

function isStatusConflictError(error) {
  return error && error.code === 'STATUS_CONFLICT'
}

function isActiveMerchantStaff(staff = {}, merchantId, openid) {
  return Boolean(
    staff &&
    staff.merchant_id === merchantId &&
    staff.openid === openid &&
    staff.status === 'active'
  )
}

function getOrderId(order = {}) {
  return order.order_id || order._id || ''
}

function buildUpdateData(nextStatus, now) {
  const updateData = {
    status: nextStatus,
    updated_at: now
  }
  const timeField = STATUS_TIME_FIELD[nextStatus]

  if (timeField) {
    updateData[timeField] = now
  }

  return updateData
}

function createUpdateOrderStatusHandler(dependencies) {
  return async function updateOrderStatus(event = {}) {
    try {
      const openid = dependencies.getOpenid()

      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const merchantId = normalizeText(event.merchant_id)
      const orderId = normalizeText(event.order_id)
      const nextStatus = normalizeText(event.next_status)

      if (!merchantId || !orderId || !nextStatus) {
        return failure('INVALID_PARAMS', '商家 ID、订单 ID 和目标状态不能为空')
      }

      if (!isValidOrderStatus(nextStatus)) {
        return failure('INVALID_STATUS', '订单目标状态不合法')
      }

      const staff = await dependencies.findMerchantStaff({
        merchant_id: merchantId,
        openid
      })

      if (!isActiveMerchantStaff(staff, merchantId, openid)) {
        return failure('FORBIDDEN', '没有修改订单状态的权限')
      }

      const order = await dependencies.findOrderById(orderId)

      if (!order) {
        return failure('NOT_FOUND', '订单不存在')
      }

      if (order.merchant_id !== merchantId) {
        return failure('FORBIDDEN', '不能修改其他商家的订单')
      }

      const oldStatus = normalizeText(order.status)

      if (!isValidOrderStatus(oldStatus)) {
        return failure('INVALID_STATUS', '订单当前状态不合法')
      }

      if (!isStatusFlowAllowed(oldStatus, nextStatus)) {
        return failure('STATUS_CONFLICT', '订单当前状态不允许执行该操作')
      }

      const now = dependencies.now()
      const updateData = buildUpdateData(nextStatus, now)

      try {
        await dependencies.updateOrderStatus({
          order_id: getOrderId(order),
          current_status: oldStatus,
          updateData
        })
      } catch (error) {
        if (isStatusConflictError(error)) {
          return failure('STATUS_CONFLICT', '订单状态已变化，请刷新后重试')
        }

        if (typeof dependencies.logError === 'function') {
          dependencies.logError('updateOrderStatus database update failed', error)
        }

        return failure('DATABASE_ERROR', '订单状态更新失败，请稍后重试')
      }

      return success('订单状态更新成功', {
        order_id: getOrderId(order),
        order_no: order.order_no || '',
        merchant_id: order.merchant_id || '',
        old_status: oldStatus,
        new_status: nextStatus,
        updated_at: now
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('updateOrderStatus failed', error)
      }

      return failure('SERVER_ERROR', '订单状态更新失败，请稍后重试')
    }
  }
}

module.exports = {
  createUpdateOrderStatusHandler
}
