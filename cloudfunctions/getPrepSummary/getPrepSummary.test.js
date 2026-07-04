const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const crypto = require('node:crypto')

const { createGetPrepSummaryHandler } = require('./prep-summary-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-06-24T10:30:00+08:00')
const WEB_TOKEN_SECRET = 'prep-summary-test-secret'

function createWebToken(options = {}) {
  const now = options.now || FIXED_NOW
  return createSignedToken({
    role: options.role || 'super_admin',
    issued_at: now,
    expires_at: new Date(now.getTime() + (options.ttlMinutes || 60) * 60 * 1000),
    now,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'prep-summary-test-nonce',
    secret: options.secret || WEB_TOKEN_SECRET
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
  const secret = options.secret || WEB_TOKEN_SECRET
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
    nonce: options.nonce || 'prep-summary-merchant-admin-nonce'
  }
  const payloadSegment = base64urlEncode(JSON.stringify(payload))
  const signatureSegment = base64urlEncode(
    crypto.createHmac('sha256', secret).update(payloadSegment).digest()
  )
  return `${payloadSegment}.${signatureSegment}`
}

function makeDate(value) {
  return new Date(value)
}

function createDeps(overrides = {}) {
  const calls = {
    findOrdersByDateRange: []
  }
  const state = {
    openid: overrides.openid === undefined ? 'staff_openid' : overrides.openid,
    now: overrides.now || makeDate('2026-06-24T10:30:00+08:00'),
    merchantStaff: overrides.merchantStaff || [
      {
        merchant_id: 'merchant_001',
        openid: 'staff_openid',
        status: 'active'
      }
    ],
    orders: overrides.orders || [],
    orderItems: overrides.orderItems || [],
    dishes: overrides.dishes || []
  }

  return {
    state,
    calls,
    deps: {
      getOpenid: () => state.openid,
      getTokenSecret: () => WEB_TOKEN_SECRET,
      now: () => state.now,
      findMerchantStaff: async ({ merchant_id, openid }) => {
        return state.merchantStaff.find((staff) => {
          return staff.merchant_id === merchant_id && staff.openid === openid
        }) || null
      },
      findOrdersByDateRange: async ({ merchant_id, start, end }) => {
        calls.findOrdersByDateRange.push({ merchant_id, start, end })
        return state.orders.filter((order) => {
          const createdAt = new Date(order.created_at)
          return order.merchant_id === merchant_id && createdAt >= start && createdAt < end
        })
      },
      findOrderItemsByOrderIds: async (orderIds) => {
        return state.orderItems.filter((item) => orderIds.includes(item.order_id))
      },
      findDishesByIds: async (dishIds, merchantId) => {
        return state.dishes.filter((dish) => {
          return dish.merchant_id === merchantId && dishIds.includes(dish.dish_id)
        })
      },
      logError: () => {}
    }
  }
}

function baseOrders() {
  return [
    {
      order_id: 'order_today_1',
      merchant_id: 'merchant_001',
      status: 'pending',
      created_at: makeDate('2026-06-24T09:00:00+08:00')
    },
    {
      order_id: 'order_today_2',
      merchant_id: 'merchant_001',
      status: 'accepted',
      created_at: makeDate('2026-06-24T12:00:00+08:00')
    },
    {
      order_id: 'order_cancelled',
      merchant_id: 'merchant_001',
      status: 'cancelled',
      created_at: makeDate('2026-06-24T13:00:00+08:00')
    },
    {
      order_id: 'order_yesterday',
      merchant_id: 'merchant_001',
      status: 'pending',
      created_at: makeDate('2026-06-23T23:20:00+08:00')
    }
  ]
}

function baseItems() {
  return [
    {
      order_id: 'order_today_1',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 2
    },
    {
      order_id: 'order_today_2',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 1
    },
    {
      order_id: 'order_today_2',
      merchant_id: 'merchant_001',
      dish_id: 'dish_chicken',
      dish_name: '宫保鸡丁饭',
      quantity: 1
    },
    {
      order_id: 'order_cancelled',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 99
    },
    {
      order_id: 'order_yesterday',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 3
    }
  ]
}

function baseDishes() {
  return [
    {
      dish_id: 'dish_beef',
      merchant_id: 'merchant_001',
      name: '招牌肥牛石锅拌饭',
      ingredients: [
        { name: '肥牛片', amount: 120, unit: 'g', category: '肉类', enabled: true },
        { name: '米饭', amount: 1, unit: '份', category: '主食', enabled: true },
        { name: '拌饭酱', amount: 30, unit: 'g', category: '调料', enabled: true },
        { name: '隐藏测试食材', amount: 999, unit: 'g', category: '调料', enabled: false }
      ]
    },
    {
      dish_id: 'dish_chicken',
      merchant_id: 'merchant_001',
      name: '宫保鸡丁饭',
      ingredients: [
        { name: '鸡丁', amount: 100, unit: 'g', category: '肉类', enabled: true },
        { name: '米饭', amount: 1, unit: '份', category: '主食', enabled: true },
        { name: '花生', amount: 20, unit: 'g', category: '', enabled: true }
      ]
    }
  ]
}

async function runSummary(overrides = {}, event = { merchant_id: 'merchant_001' }) {
  const { deps } = createDeps(overrides)
  const handler = createGetPrepSummaryHandler(deps)
  return handler(event)
}

function loadIndexWithMockedCloud(openid = '') {
  const indexPath = require.resolve('./index')
  delete require.cache[indexPath]

  const collectionData = {
    merchant_staff: [
      {
        merchant_id: 'merchant_001',
        openid: 'staff_openid',
        status: 'active'
      }
    ],
    orders: baseOrders(),
    order_items: baseItems(),
    dishes: baseDishes()
  }
  const chain = {
    _collectionName: '',
    where() {
      return this
    },
    limit() {
      return this
    },
    get: async function get() {
      return {
        data: collectionData[this._collectionName] || []
      }
    }
  }
  const dbMock = {
    command: {
      gte: () => ({ and: () => ({}) }),
      lt: () => ({}),
      in: (values) => values
    },
    collection: (collectionName) => ({
      ...chain,
      _collectionName: collectionName
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

test('returns FORBIDDEN when user is not active merchant staff', async () => {
  const result = await runSummary({
    merchantStaff: []
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('returns UNAUTHORIZED when openid is missing', async () => {
  const result = await runSummary({
    openid: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('returns empty summary when today has no orders', async () => {
  const result = await runSummary({
    orders: [],
    orderItems: [],
    dishes: []
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 0)
  assert.equal(result.data.item_count, 0)
  assert.equal(result.data.ingredient_count, 0)
  assert.deepEqual(result.data.groups, [])
})

test('excludes cancelled orders and orders outside today', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 2)
  assert.equal(result.data.item_count, 4)
  assert.equal(result.data.dish_count, 2)
})

test('aggregates enabled ingredients by name and unit with quantity multiplication', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })
  const allItems = result.data.groups.flatMap((group) => group.items)
  const beef = allItems.find((item) => item.name === '肥牛片')
  const rice = allItems.find((item) => item.name === '米饭')
  const disabled = allItems.find((item) => item.name === '隐藏测试食材')

  assert.equal(beef.amount, 360)
  assert.equal(beef.unit, 'g')
  assert.equal(rice.amount, 4)
  assert.equal(rice.unit, '份')
  assert.equal(disabled, undefined)
})

test('does not merge ingredients with same name but different unit', async () => {
  const result = await runSummary({
    orders: [
      {
        order_id: 'order_today_1',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: 'dish_mix', dish_name: '测试餐品', quantity: 1 }
    ],
    dishes: [
      {
        dish_id: 'dish_mix',
        merchant_id: 'merchant_001',
        name: '测试餐品',
        ingredients: [
          { name: '葱花', amount: 10, unit: 'g', category: '调料', enabled: true },
          { name: '葱花', amount: 1, unit: '把', category: '调料', enabled: true }
        ]
      }
    ]
  })
  const allItems = result.data.groups.flatMap((group) => group.items)

  assert.equal(allItems.filter((item) => item.name === '葱花').length, 2)
})

test('groups missing category into other', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })
  const otherGroup = result.data.groups.find((group) => group.category === '其他')

  assert.ok(otherGroup)
  assert.equal(otherGroup.items[0].name, '花生')
})

test('old dishes without ingredients do not fail', async () => {
  const result = await runSummary({
    orders: [
      {
        order_id: 'order_today_1',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: 'old_dish', dish_name: '老餐品', quantity: 1 }
    ],
    dishes: [
      { dish_id: 'old_dish', merchant_id: 'merchant_001', name: '老餐品' }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 1)
  assert.equal(result.data.ingredient_count, 0)
  assert.deepEqual(result.data.groups, [])
})

test('items without dish_id and invalid quantity are ignored safely', async () => {
  const result = await runSummary({
    orders: [
      {
        order_id: 'order_today_1',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: '', dish_name: '缺失餐品', quantity: 1 },
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: 'dish_beef', dish_name: '招牌肥牛石锅拌饭', quantity: 'bad' }
    ],
    dishes: baseDishes()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.item_count, 0)
  assert.equal(result.data.ingredient_count, 0)
})

test('copy text contains ingredient amount and source dish', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })

  assert.match(result.data.copy_text, /肥牛片 360g/)
  assert.match(result.data.copy_text, /招牌肥牛石锅拌饭 x3/)
  assert.match(result.data.copy_text, /米饭 4份/)
})

test('web valid admin token can read prep summary without openid', async () => {
  const result = await runSummary({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order_count, 2)
  assert.equal(result.data.ingredient_count, 5)
})

test('merchant_admin prep summary uses merchant_id from token when request omits merchant_id', async () => {
  const result = await runSummary({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  }, {
    action: 'getPrepSummary',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order_count, 2)
  assert.equal(result.data.ingredient_count, 5)
})

test('merchant_admin prep summary rejects another requested merchant_id', async () => {
  const result = await runSummary({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_002',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_SCOPE_FORBIDDEN')
})

test('web empty token cannot read prep summary', async () => {
  const result = await runSummary({ openid: '' }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web tampered token cannot read prep summary', async () => {
  const result = await runSummary({ openid: '' }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_INVALID')
})

test('web expired token cannot read prep summary', async () => {
  const result = await runSummary({ openid: '' }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({
      now: new Date('2026-06-23T08:00:00.000Z'),
      ttlMinutes: 30
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
})

test('web non super admin token cannot read prep summary', async () => {
  const result = await runSummary({ openid: '' }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({ role: 'staff' })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('web http string body can read prep summary', async () => {
  const result = await runSummary({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  }, {
    body: JSON.stringify({
      action: 'getPrepSummary',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 2)
})

test('web http object body can read prep summary', async () => {
  const result = await runSummary({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  }, {
    body: {
      action: 'getPrepSummary',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 2)
})

test('web query string parameters can read prep summary', async () => {
  const result = await runSummary({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  }, {
    queryStringParameters: {
      action: 'getPrepSummary',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 2)
})

test('web invalid json body does not crash', async () => {
  const result = await runSummary({ openid: '' }, {
    body: '{invalid json'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web missing merchant id is rejected', async () => {
  const result = await runSummary({ openid: '' }, {
    action: 'getPrepSummary',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('date defaults to today when omitted', async () => {
  const { deps, calls } = createDeps({
    openid: '',
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })
  const handler = createGetPrepSummaryHandler(deps)

  const result = await handler({
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.date, '2026-06-24')
  assert.equal(calls.findOrdersByDateRange[0].start.getFullYear(), 2026)
  assert.equal(calls.findOrdersByDateRange[0].start.getMonth(), 5)
  assert.equal(calls.findOrdersByDateRange[0].start.getDate(), 24)
})

test('web date parameter selects requested day', async () => {
  const { deps, calls } = createDeps({
    openid: '',
    orders: [
      {
        order_id: 'order_requested_day',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-23T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_requested_day', merchant_id: 'merchant_001', dish_id: 'dish_beef', dish_name: '招牌肥牛石锅拌饭', quantity: 1 }
    ],
    dishes: baseDishes()
  })
  const handler = createGetPrepSummaryHandler(deps)

  const result = await handler({
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    date: '2026-06-23',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.date, '2026-06-23')
  assert.equal(result.data.order_count, 1)
  assert.equal(calls.findOrdersByDateRange[0].start.getDate(), 23)
})

test('web only returns current merchant prep data', async () => {
  const result = await runSummary({
    openid: '',
    orders: [
      ...baseOrders(),
      {
        order_id: 'order_other_merchant',
        merchant_id: 'merchant_002',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      ...baseItems(),
      { order_id: 'order_other_merchant', merchant_id: 'merchant_002', dish_id: 'dish_other', dish_name: '其它商户餐品', quantity: 5 }
    ],
    dishes: [
      ...baseDishes(),
      {
        dish_id: 'dish_other',
        merchant_id: 'merchant_002',
        name: '其它商户餐品',
        ingredients: [{ name: '不应出现', amount: 1, unit: '份', enabled: true }]
      }
    ]
  }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })
  const allItems = result.data.groups.flatMap((group) => group.items)

  assert.equal(result.success, true)
  assert.equal(allItems.find((item) => item.name === '不应出现'), undefined)
})

test('web empty prep data returns empty summary', async () => {
  const result = await runSummary({
    openid: '',
    orders: [],
    orderItems: [],
    dishes: []
  }, {
    action: 'getPrepSummary',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 0)
  assert.deepEqual(result.data.groups, [])
})

test('index entry accepts web getPrepSummary action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = WEB_TOKEN_SECRET
  const main = loadIndexWithMockedCloud('')

  try {
    const result = await main({
      action: 'getPrepSummary',
      merchant_id: 'merchant_001',
      date: '2026-06-24',
      admin_token: createWebToken({ now: new Date() })
    })

    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(result.data.order_count, 2)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})
