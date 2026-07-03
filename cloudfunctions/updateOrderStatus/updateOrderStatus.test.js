const test = require('node:test')
const assert = require('node:assert/strict')

const { createUpdateOrderStatusHandler } = require('./order-status-service')
const crypto = require('node:crypto')

const NOW = new Date('2026-06-17T12:00:00.000Z')
const WEB_TOKEN_SECRET = 'test-web-token-secret'

const BASE_ORDERS = [
  {
    _id: 'order_doc_001',
    order_id: 'order_001',
    order_no: '20260617103000123',
    merchant_id: 'merchant_001',
    status: 'pending',
    items: [{ dish_id: 'dish_001', quantity: 2 }],
    total_amount_cent: 5600,
    contact_phone: '13800000000',
    contact_name: '测试用户',
    remark: '不要葱',
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
    getTokenSecret: () => WEB_TOKEN_SECRET,
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

function base64urlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createWebToken(payload = {}) {
  const payloadSegment = base64urlEncode(JSON.stringify({
    role: 'super_admin',
    expires_at: '2026-06-17T13:00:00.000Z',
    ...payload
  }))
  const signatureSegment = base64urlEncode(
    crypto.createHmac('sha256', WEB_TOKEN_SECRET).update(payloadSegment).digest()
  )

  return `${payloadSegment}.${signatureSegment}`
}

function createWebEvent(overrides = {}) {
  return {
    admin_token: createWebToken(),
    action: 'updateOrderStatus',
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    status: 'accepted',
    ...overrides
  }
}

test('web admin token can update pending order to accepted', async () => {
  const { dependencies, calls, orders } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent())

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.old_status, 'pending')
  assert.equal(result.data.new_status, 'accepted')
  assert.equal(calls.update.order_id, 'order_001')
  assert.equal(calls.update.current_status, 'pending')
  assert.deepEqual(Object.keys(calls.update.updateData).sort(), ['status', 'updated_at'])
  assert.equal(calls.update.updateData.status, 'accepted')
  assert.equal(calls.update.updateData.updated_at, NOW)
  assert.equal(orders[0].status, 'accepted')
  assert.deepEqual(orders[0].items, [{ dish_id: 'dish_001', quantity: 2 }])
  assert.equal(orders[0].total_amount_cent, 5600)
  assert.equal(orders[0].contact_phone, '13800000000')
  assert.equal(orders[0].contact_name, '测试用户')
  assert.equal(orders[0].remark, '不要葱')
})

test('web empty token cannot update order status', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ admin_token: '' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web tampered token cannot update order status', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)
  const token = createWebToken()

  const result = await updateOrderStatus(createWebEvent({ admin_token: `${token}x` }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web expired token cannot update order status', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({
    admin_token: createWebToken({ expires_at: '2026-06-17T11:00:00.000Z' })
  }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
})

test('web non super admin token cannot update order status', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({
    admin_token: createWebToken({ role: 'operator' })
  }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('http body string can update order status for web admin', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    body: JSON.stringify(createWebEvent())
  })

  assert.equal(result.success, true)
  assert.equal(result.data.new_status, 'accepted')
})

test('http body object can update order status for web admin', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    body: createWebEvent()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.new_status, 'accepted')
})

test('query string parameters can update order status for web admin', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    queryStringParameters: createWebEvent()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.new_status, 'accepted')
})

test('invalid json body does not crash', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus({
    body: '{invalid-json'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web missing merchant id is rejected', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ merchant_id: '' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web missing order id is rejected', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ order_id: '' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web missing status is rejected', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ status: '' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web invalid status is rejected', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ status: 'paid' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_STATUS')
})

test('web order not found is rejected', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ order_id: 'order_missing' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('web cannot update another merchant order', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({
    merchant_id: 'merchant_002',
    order_id: 'order_001'
  }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('web illegal status jump is rejected', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ status: 'finished' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('web finished order cannot move back', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({
    order_id: 'order_finished',
    status: 'accepted'
  }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

test('web cannot update order to cancelled', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const updateOrderStatus = createUpdateOrderStatusHandler(dependencies)

  const result = await updateOrderStatus(createWebEvent({ status: 'cancelled' }))

  assert.equal(result.success, false)
  assert.equal(result.code, 'STATUS_CONFLICT')
})

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
