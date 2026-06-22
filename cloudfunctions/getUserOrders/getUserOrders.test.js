const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetUserOrdersHandler } = require('./user-orders-service')

const ORDERS = [
  {
    _id: 'order_doc_001',
    order_id: 'order_001',
    order_no: '20260617103000123',
    user_openid: 'openid_user_001',
    openid: 'openid_user_001',
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
    user_openid: 'openid_user_001',
    openid: 'openid_user_001',
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
    user_openid: 'openid_other',
    openid: 'openid_other',
    merchant_id: 'merchant_001',
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
    dish_id: 'dish_001',
    dish_name: 'beef rice',
    base_price_cent: 2990,
    spec_delta_cent: 300,
    addon_delta_cent: 200,
    unit_price_cent: 2990,
    quantity: 1,
    subtotal_cent: 2990,
    selected_specs: [
      {
        group_id: 'size',
        group_name: '规格',
        option_id: 'large',
        option_name: '大份',
        price_delta_cent: 300
      }
    ],
    selected_addons: [
      {
        group_id: 'extra',
        group_name: '加料',
        options: [
          {
            option_id: 'egg',
            option_name: '加蛋',
            price_delta_cent: 200
          }
        ]
      }
    ]
  },
  {
    order_item_id: 'order_item_002',
    order_id: 'order_001',
    dish_id: 'dish_002',
    dish_name: 'noodle',
    unit_price_cent: 2590,
    quantity: 1,
    subtotal_cent: 2590
  },
  {
    order_item_id: 'order_item_003',
    order_id: 'order_002',
    dish_id: 'dish_001',
    dish_name: 'beef rice',
    unit_price_cent: 2990,
    quantity: 1,
    subtotal_cent: 2990
  },
  {
    order_item_id: 'order_item_004',
    order_id: 'order_003',
    dish_id: 'dish_002',
    dish_name: 'other order',
    unit_price_cent: 2590,
    quantity: 1,
    subtotal_cent: 2590
  }
]

function createDependencies(overrides = {}) {
  return {
    logError: () => {},
    getOpenid: () => 'openid_user_001',
    findUserOrders: async ({ openid, merchant_id, status, page, page_size }) => {
      const filtered = ORDERS
        .filter((order) => order.user_openid === openid || order.openid === openid)
        .filter((order) => !merchant_id || order.merchant_id === merchant_id)
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

test('getUserOrders returns current user orders with item details', async () => {
  const getUserOrders = createGetUserOrdersHandler(createDependencies())

  const result = await getUserOrders({
    merchant_id: 'merchant_001',
    page: 1,
    page_size: 10
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.list.length, 2)
  assert.deepEqual(
    result.data.list.map((order) => order.order_id),
    ['order_001', 'order_002']
  )
  assert.equal(result.data.list[0].items.length, 2)
  assert.equal(result.data.list[0].items[0].unit_price_cent, 2990)
  assert.equal(result.data.list[0].items[0].base_price_cent, 2990)
  assert.equal(result.data.list[0].items[0].spec_delta_cent, 300)
  assert.equal(result.data.list[0].items[0].addon_delta_cent, 200)
  assert.deepEqual(result.data.list[0].items[0].selected_specs, [
    {
      group_id: 'size',
      group_name: '规格',
      option_id: 'large',
      option_name: '大份',
      price_delta_cent: 300
    }
  ])
  assert.deepEqual(result.data.list[0].items[0].selected_addons, [
    {
      group_id: 'extra',
      group_name: '加料',
      options: [
        {
          option_id: 'egg',
          option_name: '加蛋',
          price_delta_cent: 200
        }
      ]
    }
  ])
  assert.deepEqual(result.data.list[0].items[1].selected_specs, [])
  assert.deepEqual(result.data.list[0].items[1].selected_addons, [])
  assert.equal(result.data.pagination.total, 2)
})

test('getUserOrders returns an empty list when current user has no orders', async () => {
  const getUserOrders = createGetUserOrdersHandler(createDependencies({
    getOpenid: () => 'openid_empty'
  }))

  const result = await getUserOrders({ page: 1, page_size: 10 })

  assert.equal(result.success, true)
  assert.deepEqual(result.data.list, [])
  assert.equal(result.data.pagination.total, 0)
})

test('getUserOrders supports status filtering', async () => {
  const getUserOrders = createGetUserOrdersHandler(createDependencies())

  const result = await getUserOrders({ status: 'finished' })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
  assert.equal(result.data.list[0].order_id, 'order_002')
  assert.equal(result.data.list[0].status, 'finished')
})

test('getUserOrders never returns other openid orders', async () => {
  const getUserOrders = createGetUserOrdersHandler(createDependencies())

  const result = await getUserOrders({ status: 'pending' })

  assert.equal(result.success, true)
  assert.deepEqual(
    result.data.list.map((order) => order.order_id),
    ['order_001']
  )
})
