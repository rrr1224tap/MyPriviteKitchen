const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const crypto = require('node:crypto')
const {
  createGetMerchantOrderDetailHandler
} = require('./merchant-order-detail-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-07-04T10:00:00.000Z')

function createWebToken(options = {}) {
  return createSignedToken({
    role: options.role || 'super_admin',
    secret: options.secret || 'merchant-order-detail-test-secret',
    now: options.now || FIXED_NOW,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'merchant-order-detail-test-nonce'
  }).token
}

function base64urlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createMerchantAdminToken(options = {}) {
  const secret = options.secret || 'merchant-order-detail-test-secret'
  const now = options.now || FIXED_NOW
  const expiresAt = new Date(now.getTime() + (options.ttlMinutes || 60) * 60 * 1000)
  const staffId = options.staff_id || 'staff_merchant_admin'
  const payload = {
    role: 'merchant_admin',
    merchant_id: options.merchant_id === undefined ? 'merchant_001' : options.merchant_id,
    staff_id: staffId,
    account_id: options.account_id || staffId,
    login_name: options.login_name || 'owner',
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    token_version: options.token_version || 1,
    nonce: options.nonce || 'merchant-order-detail-merchant-admin-nonce'
  }
  const payloadSegment = base64urlEncode(JSON.stringify(payload))
  const signatureSegment = base64urlEncode(
    crypto.createHmac('sha256', secret).update(payloadSegment).digest()
  )
  return `${payloadSegment}.${signatureSegment}`
}

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
  const state = {
    writes: 0
  }

  return {
    state,
    getOpenid: () => 'openid_staff_001',
    now: () => FIXED_NOW,
    getTokenSecret: () => 'merchant-order-detail-test-secret',
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

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && Array.isArray(value.values)) {
      return value.values.includes(record[key])
    }

    return record[key] === value
  })
}

function loadIndexWithMockedCloud(openid = '') {
  const indexPath = require.resolve('./index')
  delete require.cache[indexPath]

  const dbMock = {
    command: {
      in: (values) => ({ values })
    },
    collection: (collectionName) => ({
      where: (query) => ({
        limit: () => ({
          get: async () => {
            if (collectionName === 'merchant_staff') {
              return { data: STAFF.filter((record) => matchesQuery(record, query)) }
            }

            if (collectionName === 'orders') {
              return { data: ORDERS.filter((record) => matchesQuery(record, query)) }
            }

            if (collectionName === 'order_items') {
              return { data: ORDER_ITEMS.filter((record) => matchesQuery(record, query)) }
            }

            if (collectionName === 'dishes') {
              return { data: DISHES.filter((record) => matchesQuery(record, query)) }
            }

            return { data: [] }
          }
        })
      })
    })
  }
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    database: () => dbMock,
    getWXContext: () => ({ OPENID: openid })
  }

  const originalLoad = Module._load
  Module._load = function loadMockedModule(request, parent, isMain) {
    if (request === 'wx-server-sdk') {
      return cloudMock
    }

    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    return require('./index').main
  } finally {
    Module._load = originalLoad
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

test('web valid admin token can view merchant order detail without openid', async () => {
  const deps = createDependencies({
    getOpenid: () => ''
  })
  const handler = createGetMerchantOrderDetailHandler(deps)

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order.order_id, 'order_001')
  assert.equal(result.data.order.status, 'pending')
  assert.equal(result.data.order.total_amount_cent, 5580)
  assert.equal(result.data.items.length, 2)
  assert.equal(deps.state.writes, 0)
})

test('merchant_admin order detail uses merchant_id from token when request omits merchant_id', async () => {
  const deps = createDependencies({
    getOpenid: () => ''
  })
  const handler = createGetMerchantOrderDetailHandler(deps)

  const result = await handler({
    action: 'getOrderDetail',
    order_id: 'order_001',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order.order_id, 'order_001')
  assert.equal(result.data.order.merchant_id, 'merchant_001')
  assert.equal(deps.state.writes, 0)
})

test('merchant_admin order detail rejects another requested merchant_id', async () => {
  const deps = createDependencies({
    getOpenid: () => ''
  })
  const handler = createGetMerchantOrderDetailHandler(deps)

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_002',
    order_id: 'order_002',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_SCOPE_FORBIDDEN')
  assert.equal(deps.state.writes, 0)
})

test('web empty token cannot view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web tampered token cannot view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_INVALID')
})

test('web expired token cannot view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    admin_token: createWebToken({
      now: new Date('2026-07-04T08:00:00.000Z'),
      ttlMinutes: 30
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
})

test('web non super admin role cannot view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_001',
    admin_token: createWebToken({ role: 'staff' })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('web http string body can view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    body: JSON.stringify({
      action: 'getOrderDetail',
      merchant_id: 'merchant_001',
      order_id: 'order_001',
      admin_token: createWebToken({ now: new Date() })
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order.order_id, 'order_001')
})

test('web http object body can view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    body: {
      action: 'getOrderDetail',
      merchant_id: 'merchant_001',
      order_id: 'order_001',
      admin_token: createWebToken({ now: new Date() })
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order.order_id, 'order_001')
})

test('web query string parameters can view merchant order detail', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    queryStringParameters: {
      action: 'getOrderDetail',
      merchant_id: 'merchant_001',
      order_id: 'order_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order.order_id, 'order_001')
})

test('web invalid json body does not crash', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    body: '{invalid json'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web detail requires merchant_id', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    order_id: 'order_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web detail requires order_id', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web detail returns not found for missing order', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_not_exists',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('web detail cannot view order from another merchant', async () => {
  const handler = createGetMerchantOrderDetailHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await handler({
    action: 'getOrderDetail',
    merchant_id: 'merchant_001',
    order_id: 'order_002',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('index entry accepts web getOrderDetail action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'merchant-order-detail-test-secret'
  const main = loadIndexWithMockedCloud('')

  try {
    const result = await main({
      action: 'getOrderDetail',
      merchant_id: 'merchant_001',
      order_id: 'order_001',
      admin_token: createWebToken({ now: new Date() })
    })

    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(result.data.order.order_id, 'order_001')
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})
