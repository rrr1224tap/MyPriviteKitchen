const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  createCheckAdminDataHealthHandler
} = require('./admin-data-health-service')

const FIXED_NOW = new Date('2026-06-25T10:00:00.000Z')
const YESTERDAY = new Date('2026-06-24T10:00:00.000Z')
const TOMORROW = new Date('2026-06-26T10:00:00.000Z')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid === undefined ? 'admin_openid' : options.openid,
    superAdminOpenids: options.superAdminOpenids || 'admin_openid',
    now: options.now || FIXED_NOW,
    merchants: options.merchants || [],
    staff: options.staff || [],
    invites: options.invites || [],
    dishes: options.dishes || [],
    categories: options.categories || [],
    orders: options.orders || [],
    writes: []
  }

  const deps = {
    getOpenid: () => state.openid,
    getSuperAdminOpenids: () => state.superAdminOpenids,
    getDefaultMerchantId: () => options.defaultMerchantId || 'merchant_001',
    now: () => state.now,
    findMerchants: async () => state.merchants,
    findStaff: async () => state.staff,
    findInvites: async () => state.invites,
    findDishes: async () => state.dishes,
    findCategories: async () => state.categories,
    findOrders: async () => state.orders,
    fixDishMerchantId: async ({ merchant_id, updated_at }) => {
      let fixed_count = 0
      state.dishes.forEach((dish) => {
        if (!dish.merchant_id || !String(dish.merchant_id).trim()) {
          dish.merchant_id = merchant_id
          dish.updated_at = updated_at
          fixed_count += 1
        }
      })
      state.writes.push({ type: 'dish', fixed_count, merchant_id })
      return fixed_count
    },
    fixCategoryMerchantId: async ({ merchant_id, updated_at }) => {
      let fixed_count = 0
      state.categories.forEach((category) => {
        if (!category.merchant_id || !String(category.merchant_id).trim()) {
          category.merchant_id = merchant_id
          category.updated_at = updated_at
          fixed_count += 1
        }
      })
      state.writes.push({ type: 'category', fixed_count, merchant_id })
      return fixed_count
    },
    logger: {
      error() {}
    }
  }

  return {
    state,
    handler: createCheckAdminDataHealthHandler(deps)
  }
}

async function runHealth(event = {}, options = {}) {
  const { state, handler } = createDependencies(options)
  const result = await handler(event)
  return { result, state }
}

function issueCodes(result, sectionKey) {
  const section = result.data.sections.find((item) => item.key === sectionKey)
  return section ? section.issues.map((issue) => issue.code) : []
}

function getIssue(result, code) {
  for (const section of result.data.sections) {
    const issue = section.issues.find((item) => item.code === code)
    if (issue) {
      return issue
    }
  }
  return null
}

test('super admin can run data health check', async () => {
  const { result } = await runHealth({ action: 'check' })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.summary.total_issues, 1)
  assert.equal(getIssue(result, 'NO_ACTIVE_MERCHANT').level, 'warning')
})

test('non super admin cannot run data health check', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    openid: 'normal_user'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('empty database does not crash', async () => {
  const { result } = await runHealth({ action: 'check' })

  assert.equal(result.success, true)
  assert.equal(result.data.sections.length, 6)
})

test('duplicate merchant_id is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [
      { merchant_id: 'm1', name: '一店', status: 'active' },
      { merchant_id: 'm1', name: '一店副本', status: 'active' }
    ]
  })

  assert.ok(issueCodes(result, 'merchants').includes('DUPLICATE_MERCHANT_ID'))
})

test('empty merchant name is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [
      { merchant_id: 'm1', name: '', status: 'active' }
    ]
  })

  assert.ok(issueCodes(result, 'merchants').includes('EMPTY_MERCHANT_NAME'))
})

test('staff missing openid is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    staff: [{ merchant_id: 'm1', openid: '', role: 'staff', status: 'active' }]
  })

  assert.ok(issueCodes(result, 'staff').includes('STAFF_MISSING_OPENID'))
})

test('staff linked to missing merchant is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    staff: [{ merchant_id: 'missing', openid: 'o1', role: 'staff', status: 'active' }]
  })

  assert.ok(issueCodes(result, 'staff').includes('STAFF_ORPHAN_MERCHANT'))
})

test('duplicate invite code is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    invites: [
      { code: 'ABC12345', merchant_id: 'm1', status: 'unused', role: 'staff', expires_at: TOMORROW },
      { code: 'ABC12345', merchant_id: 'm1', status: 'unused', role: 'staff', expires_at: TOMORROW }
    ]
  })

  assert.ok(issueCodes(result, 'invites').includes('DUPLICATE_INVITE_CODE'))
})

test('expired unused invite is detected without writing', async () => {
  const { result, state } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    invites: [{ code: 'ABC12345', merchant_id: 'm1', status: 'unused', role: 'staff', expires_at: YESTERDAY }]
  })

  assert.ok(issueCodes(result, 'invites').includes('EXPIRED_UNUSED_INVITE'))
  assert.equal(state.writes.length, 0)
})

test('dish missing merchant_id is detected as fixable', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    dishes: [{ _id: 'dish_1', name: '拌饭', price_cent: 1200, category_id: 'cat_1', status: 'on_sale' }]
  })

  const issue = getIssue(result, 'DISH_MISSING_MERCHANT_ID')
  assert.equal(issue.fixable, true)
  assert.equal(issue.action, 'fixDishMerchantId')
})

test('dish missing enabled ingredients is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    dishes: [{ _id: 'dish_1', merchant_id: 'm1', name: '拌饭', price_cent: 1200, category_id: 'cat_1', ingredients: [] }]
  })

  assert.ok(issueCodes(result, 'dishes').includes('DISH_WITHOUT_INGREDIENTS'))
})

test('dish missing enabled tutorials is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    dishes: [{ _id: 'dish_1', merchant_id: 'm1', name: '拌饭', price_cent: 1200, category_id: 'cat_1', tutorials: [] }]
  })

  assert.ok(issueCodes(result, 'dishes').includes('DISH_WITHOUT_TUTORIALS'))
})

test('category missing merchant_id is detected as fixable', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    categories: [{ _id: 'cat_1', name: '主食', enabled: true }]
  })

  const issue = getIssue(result, 'CATEGORY_MISSING_MERCHANT_ID')
  assert.equal(issue.fixable, true)
  assert.equal(issue.action, 'fixCategoryMerchantId')
})

test('empty category is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    categories: [{ _id: 'cat_1', merchant_id: 'm1', name: '主食', enabled: true }],
    dishes: [{ _id: 'dish_1', merchant_id: 'm1', name: '拌饭', category_id: 'cat_2', price_cent: 1200 }]
  })

  assert.ok(issueCodes(result, 'categories').includes('EMPTY_CATEGORY'))
})

test('invalid order amount is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    orders: [{ order_no: 'NO1', status: 'pending', total_amount_cent: -1, items: [{ dish_id: 'dish_1' }] }]
  })

  assert.ok(issueCodes(result, 'orders').includes('ORDER_INVALID_AMOUNT'))
})

test('empty item order is detected', async () => {
  const { result } = await runHealth({ action: 'check' }, {
    merchants: [{ merchant_id: 'm1', name: '一店', status: 'active' }],
    orders: [{ order_no: 'NO1', status: 'pending', total_amount_cent: 1000, items: [] }]
  })

  assert.ok(issueCodes(result, 'orders').includes('ORDER_EMPTY_ITEMS'))
})

test('fixDishMerchantId only fixes dishes missing merchant_id', async () => {
  const { result, state } = await runHealth({ action: 'fixDishMerchantId' }, {
    dishes: [
      { _id: 'dish_missing', merchant_id: '', name: '缺商户' },
      { _id: 'dish_existing', merchant_id: 'keep_me', name: '已有商户' }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.fixed_count, 1)
  assert.equal(state.dishes[0].merchant_id, 'merchant_001')
  assert.equal(state.dishes[1].merchant_id, 'keep_me')
})

test('fixDishMerchantId does not overwrite existing merchant_id', async () => {
  const { result, state } = await runHealth({ action: 'fixDishMerchantId' }, {
    dishes: [
      { _id: 'dish_existing', merchant_id: 'merchant_old', name: '已有商户' }
    ]
  })

  assert.equal(result.data.fixed_count, 0)
  assert.equal(state.dishes[0].merchant_id, 'merchant_old')
})

test('fixCategoryMerchantId only fixes categories missing merchant_id', async () => {
  const { result, state } = await runHealth({ action: 'fixCategoryMerchantId' }, {
    categories: [
      { _id: 'cat_missing', merchant_id: '', name: '缺商户' },
      { _id: 'cat_existing', merchant_id: 'keep_me', name: '已有商户' }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.fixed_count, 1)
  assert.equal(state.categories[0].merchant_id, 'merchant_001')
  assert.equal(state.categories[1].merchant_id, 'keep_me')
})

test('fixCategoryMerchantId does not overwrite existing merchant_id', async () => {
  const { result, state } = await runHealth({ action: 'fixCategoryMerchantId' }, {
    categories: [
      { _id: 'cat_existing', merchant_id: 'merchant_old', name: '已有商户' }
    ]
  })

  assert.equal(result.data.fixed_count, 0)
  assert.equal(state.categories[0].merchant_id, 'merchant_old')
})

test('non super admin cannot run repair actions', async () => {
  const { result, state } = await runHealth({ action: 'fixDishMerchantId' }, {
    openid: 'normal_user',
    dishes: [{ _id: 'dish_missing', merchant_id: '' }]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes.length, 0)
})

test('check action never writes database data', async () => {
  const { result, state } = await runHealth({ action: 'check' }, {
    dishes: [{ _id: 'dish_missing', merchant_id: '' }],
    categories: [{ _id: 'cat_missing', merchant_id: '' }]
  })

  assert.equal(result.success, true)
  assert.equal(state.writes.length, 0)
})

test('repair action returns fixed count', async () => {
  const { result } = await runHealth({ action: 'fixCategoryMerchantId' }, {
    categories: [
      { _id: 'cat_1', merchant_id: '' },
      { _id: 'cat_2' }
    ]
  })

  assert.deepEqual({
    action: result.data.action,
    fixed_count: result.data.fixed_count,
    default_merchant_id: result.data.default_merchant_id
  }, {
    action: 'fixCategoryMerchantId',
    fixed_count: 2,
    default_merchant_id: 'merchant_001'
  })
})

test('response structure is stable', async () => {
  const { result } = await runHealth({ action: 'check' })

  assert.deepEqual(Object.keys(result), ['success', 'code', 'message', 'data'])
  assert.deepEqual(Object.keys(result.data).sort(), [
    'fixable_actions',
    'generated_at',
    'sections',
    'summary'
  ].sort())
})
