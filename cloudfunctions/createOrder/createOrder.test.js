const test = require('node:test')
const assert = require('node:assert/strict')

const { createCreateOrderHandler } = require('./order-service')

const NOW = new Date('2026-06-17T10:30:00.000Z')

function createDependencies(overrides = {}) {
  const calls = {
    order: null,
    orderItems: null
  }

  const dependencies = {
    logError: () => {},
    getOpenid: () => 'openid_user_001',
    now: () => NOW,
    generateId: (prefix) => `${prefix}_fixed_001`,
    generateOrderNo: () => '20260617103000123',
    findMerchantById: async () => ({
      _id: 'merchant_001',
      merchant_id: 'merchant_001',
      name: '测试门店',
      status: 'active',
      business_status: 'open'
    }),
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '招牌肥牛石锅拌饭',
        image_url: 'beef-rice.png',
        price_cent: 2990,
        status: 'on_sale',
        stock: 99
      },
      {
        _id: 'dish_002',
        dish_id: 'dish_002',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '经典肉酱砂锅米线',
        image: 'noodle.png',
        price_cent: 2590,
        status: 'on_sale',
        stock: 99
      }
    ],
    createOrder: async (order) => {
      calls.order = order
      return Object.assign({ _id: order.order_id }, order)
    },
    createOrderItems: async (items) => {
      calls.orderItems = items
      return items
    },
    ...overrides
  }

  return { dependencies, calls }
}

test('creates an order and order item snapshots using database dish prices', async () => {
  const { dependencies, calls } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 2, price_cent: 1 },
      { dish_id: 'dish_002', quantity: 1, price_cent: 1 }
    ],
    remark: '少辣',
    pickup_type: 'self_pickup',
    openid: 'fake_openid'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order_id, 'order_fixed_001')
  assert.equal(result.data.order_no, '20260617103000123')
  assert.equal(result.data.status, 'pending')
  assert.equal(result.data.total_amount_cent, 8570)
  assert.equal(result.data.item_count, 3)

  assert.equal(calls.order.openid, 'openid_user_001')
  assert.equal(calls.order.user_openid, 'openid_user_001')
  assert.equal(calls.order.total_amount_cent, 8570)
  assert.equal(calls.order.payment_status, 'unpaid')
  assert.equal(calls.order.payment_method, 'offline')
  assert.equal(calls.order.status, 'pending')

  assert.equal(calls.orderItems.length, 2)
  assert.equal(calls.orderItems[0].dish_name, '招牌肥牛石锅拌饭')
  assert.equal(calls.orderItems[0].unit_price_cent, 2990)
  assert.equal(calls.orderItems[0].price_cent, 2990)
  assert.equal(calls.orderItems[0].quantity, 2)
  assert.equal(calls.orderItems[0].subtotal_cent, 5980)
  assert.equal(calls.orderItems[1].subtotal_cent, 2590)
})

test('returns INVALID_PARAMS when items is empty', async () => {
  const { dependencies } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: []
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('returns INVALID_PARAMS when quantity is invalid', async () => {
  const { dependencies } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 0 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('returns NOT_FOUND when a dish is missing', async () => {
  const { dependencies } = createDependencies({
    findDishesByIds: async () => []
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_404', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('returns DISH_OFF_SALE when a dish is not on sale', async () => {
  const { dependencies } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '下架餐品',
        price_cent: 2990,
        status: 'off_sale',
        stock: 99
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DISH_OFF_SALE')
})

test('returns UNAUTHORIZED when cloud openid is unavailable', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('returns DATABASE_ERROR when order write fails', async () => {
  const { dependencies } = createDependencies({
    createOrder: async () => {
      throw new Error('write failed')
    }
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DATABASE_ERROR')
  assert.equal(result.data, null)
})
