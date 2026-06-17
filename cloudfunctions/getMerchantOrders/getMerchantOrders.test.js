const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetMerchantOrdersHandler } = require('./merchant-orders-service')

const ORDERS = [
  {
    _id: 'order_doc_001',
    order_id: 'order_001',
    order_no: '20260617103000123',
    user_openid: 'openid_user_001',
    merchant_id: 'merchant_001',
    status: 'pending',
    payment_status: 'unpaid',
    pickup_type: 'self_pickup',
    item_count: 2,
    total_amount_cent: 5580,
    created_at: new Date('2026-06-17T10:30:00.000Z'),
    updated_at: new Date('2026-06-17T10:30:00.000Z')
  },
  {
    _id: 'order_doc_002',
    order_id: 'order_002',
    order_no: '20260617102000123',
    user_openid: 'openid_user_002',
    merchant_id: 'merchant_001',
    status: 'finished',
    payment_status: 'unpaid',
    pickup_type: 'self_pickup',
    item_count: 1,
    total_amount_cent: 2990,
    created_at: new Date('2026-06-17T10:20:00.000Z'),
    updated_at: new Date('2026-06-17T10:20:00.000Z')
  },
  {
    _id: 'order_doc_003',
    order_id: 'order_003',
    order_no: '20260617101000123',
    user_openid: 'openid_user_003',
    merchant_id: 'merchant_002',
    status: 'pending',
    item_count: 1,
    total_amount_cent: 2590,
    created_at: new Date('2026-06-17T10:10:00.000Z')
  }
]

const ORDER_ITEMS = [
  {
    order_item_id: 'order_item_001',
    order_id: 'order_001',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    dish_name: 'beef rice',
    unit_price_cent: 2990,
    quantity: 1,
    subtotal_cent: 2990
  },
  {
    order_item_id: 'order_item_002',
    order_id: 'order_001',
    merchant_id: 'merchant_001',
    dish_id: 'dish_002',
    dish_name: 'noodle',
    unit_price_cent: 2590,
    quantity: 1,
    subtotal_cent: 2590
  },
  {
    order_item_id: 'order_item_003',
    order_id: 'order_002',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    dish_name: 'beef rice',
    unit_price_cent: 2990,
    quantity: 1,
    subtotal_cent: 2990
  },
  {
    order_item_id: 'order_item_004',
    order_id: 'order_003',
    merchant_id: 'merchant_002',
    dish_id: 'dish_002',
    dish_name: 'other merchant order',
    unit_price_cent: 2590,
    quantity: 1,
    subtotal_cent: 2590
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
    merchant_id: 'merchant_empty',
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

function createDependencies(overrides = {}) {
  return {
    logError: () => {},
    getOpenid: () => 'openid_staff_001',
    findMerchantStaff: async ({ merchant_id, openid }) =>
      STAFF.find((staff) => staff.merchant_id === merchant_id && staff.openid === openid) || null,
    findMerchantOrders: async ({ merchant_id, status, page, page_size }) => {
      const filtered = ORDERS
        .filter((order) => order.merchant_id === merchant_id)
        .filter((order) => !status || order.status === status)
        .sort((left, right) => right.created_at - left.created_at)

      const start = (page - 1) * page_size
      return {
        list: filtered.slice(start, start + page_size),
        total: filtered.length
      }
    },
    findOrderItemsByOrderIds: async (orderIds) =>
      ORDER_ITEMS.filter((item) => orderIds.includes(item.order_id)),
    ...overrides
  }
}

test('getMerchantOrders returns merchant orders for active staff', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies())

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001',
    page: 1,
    page_size: 10
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(
    result.data.list.map((order) => order.order_id),
    ['order_001', 'order_002']
  )
  assert.equal(result.data.list[0].items.length, 2)
  assert.equal(result.data.list[0].total_amount_cent, 5580)
  assert.equal(result.data.pagination.total, 2)
})

test('getMerchantOrders rejects users without merchant staff permission', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => 'openid_unknown'
  }))

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('getMerchantOrders rejects inactive merchant staff', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => 'openid_disabled_staff'
  }))

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('getMerchantOrders supports status filtering', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies())

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001',
    status: 'finished'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
  assert.equal(result.data.list[0].order_id, 'order_002')
  assert.equal(result.data.list[0].status, 'finished')
})

test('getMerchantOrders supports pagination', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies())

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001',
    page: 2,
    page_size: 1
  })

  assert.equal(result.success, true)
  assert.deepEqual(
    result.data.list.map((order) => order.order_id),
    ['order_002']
  )
  assert.equal(result.data.pagination.page, 2)
  assert.equal(result.data.pagination.page_size, 1)
  assert.equal(result.data.pagination.total, 2)
  assert.equal(result.data.pagination.has_more, false)
})

test('getMerchantOrders never returns other merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies())

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001',
    status: 'pending'
  })

  assert.equal(result.success, true)
  assert.deepEqual(
    result.data.list.map((order) => order.order_id),
    ['order_001']
  )
})

test('getMerchantOrders returns an empty list when merchant has no orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies())

  const result = await getMerchantOrders({
    merchant_id: 'merchant_empty'
  })

  assert.equal(result.success, true)
  assert.deepEqual(result.data.list, [])
  assert.equal(result.data.pagination.total, 0)
})

test('getMerchantOrders returns UNAUTHORIZED when cloud openid is unavailable', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    merchant_id: 'merchant_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})
