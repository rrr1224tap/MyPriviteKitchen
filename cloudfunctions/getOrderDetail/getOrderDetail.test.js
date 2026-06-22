const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetOrderDetailHandler } = require('./order-detail-service')

const ORDER = {
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
}

const ITEMS = [
  {
    order_item_id: 'order_item_001',
    order_id: 'order_001',
    dish_id: 'dish_001',
    dish_name: 'beef rice',
    dish_image_url: 'beef-rice.png',
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
    dish_image: 'noodle.png',
    unit_price_cent: 2590,
    quantity: 1,
    subtotal_cent: 2590
  }
]

function createDependencies(overrides = {}) {
  return {
    logError: () => {},
    getOpenid: () => 'openid_user_001',
    findOrderById: async () => ORDER,
    findOrderItemsByOrderId: async () => ITEMS,
    ...overrides
  }
}

test('getOrderDetail returns current user order with item details', async () => {
  const getOrderDetail = createGetOrderDetailHandler(createDependencies())

  const result = await getOrderDetail({ order_id: 'order_001' })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order.order_id, 'order_001')
  assert.equal(result.data.order.total_amount_cent, 5580)
  assert.equal(result.data.items.length, 2)
  assert.equal(result.data.items[0].unit_price_cent, 2990)
  assert.equal(result.data.items[0].subtotal_cent, 2990)
  assert.equal(result.data.items[0].base_price_cent, 2990)
  assert.equal(result.data.items[0].spec_delta_cent, 300)
  assert.equal(result.data.items[0].addon_delta_cent, 200)
  assert.deepEqual(result.data.items[0].selected_specs, [
    {
      group_id: 'size',
      group_name: '规格',
      option_id: 'large',
      option_name: '大份',
      price_delta_cent: 300
    }
  ])
  assert.deepEqual(result.data.items[0].selected_addons, [
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
  assert.deepEqual(result.data.items[1].selected_specs, [])
  assert.deepEqual(result.data.items[1].selected_addons, [])
})

test('getOrderDetail returns INVALID_PARAMS when order_id is missing', async () => {
  const getOrderDetail = createGetOrderDetailHandler(createDependencies())

  const result = await getOrderDetail({})

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('getOrderDetail returns NOT_FOUND when order does not exist', async () => {
  const getOrderDetail = createGetOrderDetailHandler(createDependencies({
    findOrderById: async () => null
  }))

  const result = await getOrderDetail({ order_id: 'missing_order' })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('getOrderDetail returns FORBIDDEN when order belongs to another user', async () => {
  const getOrderDetail = createGetOrderDetailHandler(createDependencies({
    findOrderById: async () => ({
      ...ORDER,
      user_openid: 'openid_other',
      openid: 'openid_other'
    })
  }))

  const result = await getOrderDetail({ order_id: 'order_001' })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})
