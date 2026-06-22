const test = require('node:test')
const assert = require('node:assert/strict')

const { createUpdateOrderStatusHandler } = require('./order-status-service')

const NOW = new Date('2026-06-17T12:00:00.000Z')

const BASE_ORDERS = [
  {
    _id: 'order_doc_001',
    order_id: 'order_001',
    order_no: '20260617103000123',
    merchant_id: 'merchant_001',
    status: 'pending',
    updated_at: new Date('2026-06-17T10:30:00.000Z')
  },
  {
    _id: 'order_doc_002',
    order_id: 'order_accepted',
    order_no: '20260617103500123',
    merchant_id: 'merchant_001',
    status: 'accepted',
    updated_at: new Date('2026-06-17T10:35:00.000Z')
  },
  {
    _id: 'order_doc_003',
    order_id: 'order_cooking',
    order_no: '20260617103800123',
    merchant_id: 'merchant_001',
    status: 'cooking',
    updated_at: new Date('2026-06-17T10:38:00.000Z')
  },
  {
    _id: 'order_doc_004',
    order_id: 'order_finished',
    order_no: '20260617104000123',
    merchant_id: 'merchant_001',
    status: 'finished',
    updated_at: new Date('2026-06-17T10:40:00.000Z')
  },
  {
    _id: 'order_doc_005',
    order_id: 'order_cancelled',
    order_no: '20260617105000123',
    merchant_id: 'merchant_001',
    status: 'cancelled',
    updated_at: new Date('2026-06-17T10:50:00.000Z')
  },
  {
    _id: 'order_doc_006',
    order_id: 'order_unknown_status',
    order_no: '20260617105500123',
    merchant_id: 'merchant_001',
    status: 'unknown',
    updated_at: new Date('2026-06-17T10:55:00.000Z')
  }
]

const STAFF = [
  {
    merchant_id: 'merchant_001',
    openid: 'openid_staff_001',
    role: 'owner',
    status: 'active'
  },
  {
    merchant_id: 'merchant_002',
    openid: 'openid_staff_001',
    role: 'owner',
    status: 'active'
  },
  {
    merchant_id: 'merchant_001',
    openid: 'openid_disabled_staff',
    role: 'staff',
    status: 'disabled'
  }
]

function cloneOrders() {
  return BASE_ORDERS.map((order) => ({ ...order }))
}

function createDependencies(overrides = {}) {
  const orders = cloneOrders()
  const calls = {
    update: null
  }
  const dependencies = {
    logError: () => {},
    getOpenid: () => 'openid_staff_001',
    now: () => NOW,
    findMerchantStaff: async ({ merchant_id, openid }) =>
      STAFF.find((staff) => staff.merchant_id === merchant_id && staff.openid === openid) || null,
    findOrderById: async (orderId) =>
      orders.find((order) => order.order_id === orderId) || null,
    updateOrderStatus: async ({ order_id, current_status, updateData }) => {
      calls.update = { order_id, current_status, updateData }
      const order = orders.find(
        (item) => item.order_id === order_id && item.status === current_status
      )

      if (!order) {
        const error = new Error('status conflict')
        error.code = 'STATUS_CONFLICT'
        throw error
      }

      Object.assign(order, updateData)
      return order
    },
    ...overrides
  }

  return { dependencies, calls, orders }
}

test('active merchant staff can update pending order to accepted', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order_id, 'order_001')
  assert.equal(result.data.order_no, '20260617103000123')
  assert.equal(result.data.merchant_id, 'merchant_001')
  assert.equal(result.data.old_status, 'pending')
  assert.equal(result.data.new_status, 'accepted')
  assert.equal(result.data.updated_at, NOW)
  assert.equal(calls.update.order_id, 'order_001')
  assert.equal(calls.update.current_status, 'pending')
  assert.equal(calls.update.updateData.status, 'accepted')
  assert.equal(calls.update.updateData.updated_at, NOW)
  assert.equal(calls.update.updateData.accepted_at, NOW)
  assert.equal(orders[0].status, 'accepted')
})

test('accepted order can update to cooking', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_accepted',
    next_status: 'cooking'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.old_status, 'accepted')
  assert.equal(result.data.new_status, 'cooking')
  assert.equal(calls.update.current_status, 'accepted')
  assert.equal(calls.update.updateData.cooking_at, NOW)
  assert.equal(orders[1].status, 'cooking')
})

test('cooking order can update to finished', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_cooking',
    next_status: 'finished'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.old_status, 'cooking')
  assert.equal(result.data.new_status, 'finished')
  assert.equal(calls.update.current_status, 'cooking')
  assert.equal(calls.update.updateData.finished_at, NOW)
  assert.equal(orders[2].status, 'finished')
})

test('pending order can update to cancelled', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'cancelled'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.old_status, 'pending')
  assert.equal(result.data.new_status, 'cancelled')
  assert.equal(calls.update.current_status, 'pending')
  assert.equal(calls.update.updateData.cancelled_at, NOW)
  assert.equal(orders[0].status, 'cancelled')
})

test('accepted order can update to cancelled', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_accepted',
    next_status: 'cancelled'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.old_status, 'accepted')
  assert.equal(result.data.new_status, 'cancelled')
  assert.equal(calls.update.current_status, 'accepted')
  assert.equal(calls.update.updateData.cancelled_at, NOW)
  assert.equal(orders[1].status, 'cancelled')
})

test('unauthorized user cannot update order status', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => 'openid_unknown'
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('inactive merchant staff cannot update order status', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => 'openid_disabled_staff'
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('merchant staff cannot update another merchant order', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_002',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('pending order cannot update directly to finished', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'finished'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('pending order cannot update directly to cooking', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'cooking'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('accepted order cannot update directly to finished', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_accepted',
    next_status: 'finished'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('accepted order cannot update back to pending', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_accepted',
    next_status: 'pending'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('cooking order cannot update back to accepted', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_cooking',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('cooking order cannot update back to pending', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_cooking',
    next_status: 'pending'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('cooking order cannot update to cancelled', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_cooking',
    next_status: 'cancelled'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('finished order cannot be updated again', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_finished',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('cancelled order cannot be updated again', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_cancelled',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('invalid next status is rejected', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'paid'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_STATUS')
})

test('invalid current status is rejected', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_unknown_status',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_STATUS')
})

test('missing required params are rejected', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: '',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('missing target status is rejected', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('returns NOT_FOUND when order does not exist', async () => {
  const { dependencies } = createDependencies()
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_missing',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('returns UNAUTHORIZED when cloud openid is unavailable', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('returns STATUS_CONFLICT when conditional update finds status changed', async () => {
  const { dependencies } = createDependencies({
    updateOrderStatus: async () => {
      const error = new Error('status conflict')
      error.code = 'STATUS_CONFLICT'
      throw error
    }
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('returns DATABASE_ERROR when database update fails unexpectedly', async () => {
  const { dependencies } = createDependencies({
    updateOrderStatus: async () => {
      throw new Error('database failed')
    }
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    next_status: 'accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DATABASE_ERROR')
})
