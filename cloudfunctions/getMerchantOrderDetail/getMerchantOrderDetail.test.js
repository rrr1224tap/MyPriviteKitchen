const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createGetMerchantOrderDetailHandler
} = require('./merchant-order-detail-service')

const ORDERS = [
  {
    _id: 'order_doc_001',
    order_id: 'order_001',
    order_no: '20260617103000123',
    merchant_id: 'merchant_001',
    user_openid: 'openid_user_001',
    status: 'pending',
    payment_status: 'unpaid',
    pickup_type: 'self_pickup',
    remark: '少辣',
    item_count: 2,
    total_amount_cent: 5580,
    created_at: new Date('2026-06-17T10:30:00.000Z'),
    updated_at: new Date('2026-06-17T10:30:00.000Z')
  },
  {
    _id: 'order_doc_002',
    order_id: 'order_002',
    order_no: '20260617104000123',
    merchant_id: 'merchant_002',
    user_openid: 'openid_user_002',
    status: 'pending',
    payment_status: 'unpaid',
    pickup_type: 'self_pickup',
    remark: '',
    item_count: 1,
    total_amount_cent: 2990,
    created_at: new Date('2026-06-17T10:40:00.000Z'),
    updated_at: new Date('2026-06-17T10:40:00.000Z')
  },
  {
    _id: 'order_doc_empty_items',
    order_id: 'order_empty_items',
    order_no: '20260617105000123',
    merchant_id: 'merchant_001',
    user_openid: 'openid_user_003',
    status: 'accepted',
    payment_status: 'unpaid',
    pickup_type: 'self_pickup',
    remark: '',
    item_count: 0,
    total_amount_cent: 0,
    created_at: new Date('2026-06-17T10:50:00.000Z'),
    updated_at: new Date('2026-06-17T10:50:00.000Z')
  }
]

const ORDER_ITEMS = [
  {
    _id: 'order_item_doc_001',
    order_item_id: 'order_item_001',
    order_id: 'order_001',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    dish_name: '招牌肥牛石锅拌饭',
    dish_image_url: '',
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
    ],
    created_at: new Date('2026-06-17T10:30:00.000Z')
  },
  {
    _id: 'order_item_doc_002',
    order_item_id: 'order_item_002',
    order_id: 'order_001',
    merchant_id: 'merchant_001',
    dish_id: 'dish_002',
    dish_name: '经典肉酱砂锅米线',
    dish_image_url: '',
    unit_price_cent: 2590,
    quantity: 1,
    subtotal_cent: 2590,
    created_at: new Date('2026-06-17T10:30:00.000Z')
  },
  {
    _id: 'order_item_doc_003',
    order_item_id: 'order_item_003',
    order_id: 'order_002',
    merchant_id: 'merchant_002',
    dish_id: 'dish_003',
    dish_name: '其他商家餐品',
    dish_image_url: '',
    unit_price_cent: 2990,
    quantity: 1,
    subtotal_cent: 2990,
    created_at: new Date('2026-06-17T10:40:00.000Z')
  }
]

const DISHES = [
  {
    dish_id: 'dish_001',
    merchant_id: 'merchant_001',
    name: '招牌肥牛石锅拌饭',
    tutorials: [
      {
        title: '韩式牛肉拌饭做法',
        platform: 'douyin',
        url: 'douyin-token-001',
        note: '重点看酱料比例',
        enabled: true,
        sort_order: 1
      },
      {
        title: '停用教程',
        platform: 'other',
        url: 'hidden',
        note: '',
        enabled: false,
        sort_order: 2
      }
    ]
  },
  {
    dish_id: 'dish_002',
    merchant_id: 'merchant_001',
    name: '经典肉酱砂锅米线'
  },
  {
    dish_id: 'dish_003',
    merchant_id: 'merchant_002',
    name: '其他商家餐品',
    tutorials: [
      {
        title: '其他商家教程',
        platform: 'douyin',
        url: 'forbidden',
        enabled: true,
        sort_order: 1
      }
    ]
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
    openid: 'openid_staff_002',
    role: 'owner',
    status: 'active'
  },
  {
    merchant_id: 'merchant_001',
    openid: 'openid_inactive_staff',
    role: 'staff',
    status: 'disabled'
  }
]

function createDependencies(overrides = {}) {
  return {
    getOpenid: () => 'openid_staff_001',
    findMerchantStaff: async ({ merchant_id, openid }) =>
      STAFF.find(
        (staff) =>
          staff.merchant_id === merchant_id && staff.openid === openid
      ) || null,
    findOrderById: async (orderId) =>
      ORDERS.find((order) => order.order_id === orderId || order._id === orderId) ||
      null,
    findOrderItemsByOrderId: async (orderId, merchantId) =>
      ORDER_ITEMS.filter(
        (item) => item.order_id === orderId && item.merchant_id === merchantId
      ),
    findDishesByIds: async (dishIds, merchantId) =>
      DISHES.filter((dish) => dish.merchant_id === merchantId && dishIds.includes(dish.dish_id)),
    logError: () => {},
    ...overrides
  }
}

test('active merchant staff can view own merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies())

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_001'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.message, '获取商家订单详情成功')
  assert.equal(result.data.order.order_id, 'order_001')
  assert.equal(result.data.order.total_amount_cent, 5580)
  assert.equal(result.data.items.length, 2)
  assert.equal(result.data.items[0].unit_price_cent, 2990)
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
  assert.equal(result.data.items[0].tutorials.length, 1)
  assert.equal(result.data.items[0].tutorials[0].title, '韩式牛肉拌饭做法')
  assert.equal(result.data.items[0].tutorials[0].platform, 'douyin')
  assert.equal(result.data.items[0].tutorials[0].url, 'douyin-token-001')
  assert.deepEqual(result.data.items[1].tutorials, [])
})

test('unauthorized user cannot view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(
    createDependencies({
      getOpenid: () => 'openid_unknown'
    })
  )

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('inactive staff cannot view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(
    createDependencies({
      getOpenid: () => 'openid_inactive_staff'
    })
  )

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('staff cannot view order from another merchant', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies())

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_002'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('missing order_id returns invalid params', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies())

  const result = await handler({
    merchant_id: 'merchant_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('nonexistent order returns not found', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies())

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_not_exists'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('order without items still returns order main info', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies())

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_empty_items'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order.order_id, 'order_empty_items')
  assert.deepEqual(result.data.items, [])
})

test('merchant order detail remains compatible when dish tutorials are unavailable', async () => {
  const handler = createGetMerchantOrderDetailHandler(
    createDependencies({
      findDishesByIds: undefined
    })
  )

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_001'
  })

  assert.equal(result.success, true)
  assert.deepEqual(result.data.items[0].tutorials, [])
  assert.deepEqual(result.data.items[1].tutorials, [])
})

test('missing openid returns unauthorized', async () => {
  const handler = createGetMerchantOrderDetailHandler(
    createDependencies({
      getOpenid: () => ''
    })
  )

  const result = await handler({
    merchant_id: 'merchant_001',
    order_id: 'order_001'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})
