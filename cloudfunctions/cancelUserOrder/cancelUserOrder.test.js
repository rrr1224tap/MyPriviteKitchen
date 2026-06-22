const test = require('node:test')
const assert = require('node:assert/strict')

const { createCancelUserOrderHandler } = require('./cancel-user-order-service')

const NOW = new Date('2026-06-22T12:00:00.000Z')
const CURRENT_OPENID = 'openid_user_001'

const BASE_ORDERS = [
  {
    _id: 'order_doc_pending',
    order_id: 'order_pending',
    order_no: '20260622120000123',
    user_openid: CURRENT_OPENID,
    status: 'pending',
    updated_at: new Date('2026-06-22T11:50:00.000Z')
  },
  {
    _id: 'order_doc_accepted',
    order_id: 'order_accepted',
    user_openid: CURRENT_OPENID,
    status: 'accepted'
  },
  {
    _id: 'order_doc_cooking',
    order_id: 'order_cooking',
    user_openid: CURRENT_OPENID,
    status: 'cooking'
  },
  {
    _id: 'order_doc_finished',
    order_id: 'order_finished',
    user_openid: CURRENT_OPENID,
    status: 'finished'
  },
  {
    _id: 'order_doc_cancelled',
    order_id: 'order_cancelled',
    user_openid: CURRENT_OPENID,
    status: 'cancelled'
  },
  {
    _id: 'order_doc_other_user',
    order_id: 'order_other_user',
    user_openid: 'openid_user_other',
    status: 'pending'
  },
  {
    _id: 'order_doc_only',
    user_openid: CURRENT_OPENID,
    status: 'pending'
  }
]

function cloneOrders() {
  return BASE_ORDERS.map((order) => ({ ...order }))
}

function createDependencies(overrides = {}) {
  const orders = cloneOrders()
  const calls = {
    cancel: null
  }
  const dependencies = {
    logError: () => {},
    getOpenid: () => CURRENT_OPENID,
    now: () => NOW,
    findOrderById: async (orderId) =>
      orders.find((order) => order.order_id === orderId || order._id === orderId) || null,
    cancelOrder: async ({ order_id, user_openid, current_status, updateData }) => {
      calls.cancel = {
        order_id,
        user_openid,
        current_status,
        updateData
      }
      const order = orders.find(
        (item) =>
          (item.order_id === order_id || item._id === order_id) &&
          item.user_openid === user_openid &&
          item.status === current_status
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

test('current user can cancel own pending order', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_pending'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.message, '订单已取消')
  assert.equal(result.data.order_id, 'order_pending')
  assert.equal(result.data.status, 'cancelled')
  assert.equal(calls.cancel.order_id, 'order_pending')
  assert.equal(calls.cancel.user_openid, CURRENT_OPENID)
  assert.equal(calls.cancel.current_status, 'pending')
  assert.equal(calls.cancel.updateData.status, 'cancelled')
  assert.equal(calls.cancel.updateData.cancelled_at, NOW)
  assert.equal(calls.cancel.updateData.updated_at, NOW)
  assert.equal(orders[0].status, 'cancelled')
})

test('current user can cancel own pending order by database _id', async () => {
  const { dependencies, calls, orders } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_doc_only'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order_id, 'order_doc_only')
  assert.equal(result.data.status, 'cancelled')
  assert.equal(calls.cancel.order_id, 'order_doc_only')
  assert.equal(calls.cancel.user_openid, CURRENT_OPENID)
  assert.equal(orders[6].status, 'cancelled')
})

test('missing order_id is rejected', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(calls.cancel, null)
})

test('missing openid is rejected', async () => {
  const { dependencies, calls } = createDependencies({
    getOpenid: () => ''
  })
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_pending'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(calls.cancel, null)
})

test('missing order is rejected', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_missing'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
  assert.equal(calls.cancel, null)
})

test('order that belongs to another user is rejected', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_other_user'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(calls.cancel, null)
})

test('accepted order cannot be cancelled by user', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_accepted'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
  assert.equal(calls.cancel, null)
})

test('cooking order cannot be cancelled by user', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_cooking'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
  assert.equal(calls.cancel, null)
})

test('finished order cannot be cancelled by user', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_finished'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
  assert.equal(calls.cancel, null)
})

test('cancelled order cannot be cancelled again', async () => {
  const { dependencies, calls } = createDependencies()
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_cancelled'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
  assert.equal(calls.cancel, null)
})

test('conditional update conflict returns STATUS_CONFLICT', async () => {
  const { dependencies } = createDependencies({
    cancelOrder: async () => {
      const error = new Error('status conflict')
      error.code = 'STATUS_CONFLICT'
      throw error
    }
  })
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_pending'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('database error during update returns DATABASE_ERROR', async () => {
  const { dependencies } = createDependencies({
    cancelOrder: async () => {
      throw new Error('database failed')
    }
  })
  const cancelUserOrder = createCancelUserOrderHandler(dependencies)

  const result = await cancelUserOrder({
    order_id: 'order_pending'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DATABASE_ERROR')
})
