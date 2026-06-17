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
    order_id: 'order_finished',
    order_no: '20260617104000123',
    merchant_id: 'merchant_001',
    status: 'finished',
    updated_at: new Date('2026-06-17T10:40:00.000Z')
  },
  {
    _id: 'order_doc_003',
    order_id: 'order_cancelled',
    order_no: '20260617105000123',
    merchant_id: 'merchant_001',
    status: 'cancelled',
    updated_at: new Date('2026-06-17T10:50:00.000Z')
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
    updateOrderStatus: async ({ order_id, updateData }) => {
      calls.update = { order_id, updateData }
      const order = orders.find((item) => item.order_id === order_id)

      if (!order) {
        return null
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
  assert.equal(calls.update.updateData.status, 'accepted')
  assert.equal(calls.update.updateData.updated_at, NOW)
  assert.equal(calls.update.updateData.accepted_at, NOW)
  assert.equal(orders[0].status, 'accepted')
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
  assert.equal(result.code, 'ORDER_STATUS_FLOW_ERROR')
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
  assert.equal(result.code, 'ORDER_STATUS_FLOW_ERROR')
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
  assert.equal(result.code, 'ORDER_STATUS_FLOW_ERROR')
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
  assert.equal(result.code, 'ORDER_STATUS_INVALID')
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
