const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

const { createGetMerchantOrdersHandler } = require('./merchant-orders-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-07-04T10:00:00.000Z')

function createWebToken(options = {}) {
  return createSignedToken({
    role: options.role || 'super_admin',
    issued_at: options.now || FIXED_NOW,
    expires_at: new Date((options.now || FIXED_NOW).getTime() + (options.ttlMinutes || 60) * 60 * 1000),
    now: options.now || FIXED_NOW,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'merchant-orders-test-nonce',
    secret: options.secret || 'merchant-orders-test-secret'
  }).token
}

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
    now: () => FIXED_NOW,
    getTokenSecret: () => 'merchant-orders-test-secret',
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

function loadIndexWithMockedCloud(deps = createDependencies()) {
  const indexPath = require.resolve('./index')
  delete require.cache[indexPath]

  const chain = {
    where: () => chain,
    orderBy: () => chain,
    skip: () => chain,
    limit: () => chain,
    get: async () => ({ data: [] }),
    count: async () => ({ total: 0 })
  }
  const dbMock = {
    command: {
      in: (values) => values
    },
    collection: () => chain
  }
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    database: () => dbMock,
    getWXContext: () => ({ OPENID: deps.getOpenid() })
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

test('web valid admin token can list merchant orders without openid', async () => {
  let orderItemReads = 0
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => '',
    findOrderItemsByOrderIds: async () => {
      orderItemReads += 1
      return []
    }
  }))

  const result = await getMerchantOrders({
    action: 'listOrders',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(
    result.data.list.map((order) => order.order_id),
    ['order_001', 'order_002']
  )
  assert.equal(result.data.pagination.total, 2)
  assert.equal(orderItemReads, 0)
})

test('web empty token cannot list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    action: 'listOrders',
    merchant_id: 'merchant_001',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web tampered token cannot list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    action: 'listOrders',
    merchant_id: 'merchant_001',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web expired token cannot list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    action: 'listOrders',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({
      now: new Date('2026-07-04T08:00:00.000Z'),
      ttlMinutes: 30
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
})

test('web non super admin role cannot list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    action: 'listOrders',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({ role: 'staff' })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web http string body can list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    body: JSON.stringify({
      action: 'listOrders',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 2)
})

test('web http object body can list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    body: {
      action: 'listOrders',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 2)
})

test('web query string parameters can list merchant orders', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    queryStringParameters: {
      action: 'listOrders',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 2)
})

test('web invalid json body does not crash', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    body: '{invalid json'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web list orders requires merchant_id', async () => {
  const getMerchantOrders = createGetMerchantOrdersHandler(createDependencies({
    getOpenid: () => ''
  }))

  const result = await getMerchantOrders({
    action: 'listOrders',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('index entry accepts web listOrders action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'merchant-orders-test-secret'
  const main = loadIndexWithMockedCloud(createDependencies({
    getOpenid: () => ''
  }))

  try {
    const result = await main({
      action: 'listOrders',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    })

    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})
