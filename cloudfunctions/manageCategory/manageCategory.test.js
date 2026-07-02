const test = require('node:test')
const assert = require('node:assert/strict')

const { createManageCategoryHandler } = require('./category-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-06-25T10:00:00.000Z')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid || 'staff_openid',
    tokenSecret: options.tokenSecret === undefined ? 'manage-category-test-secret' : options.tokenSecret,
    now: options.now || FIXED_NOW,
    writes: 0,
    idIndex: 1,
    merchantStaff: options.merchantStaff || [
      {
        merchant_id: 'merchant_001',
        openid: 'staff_openid',
        role: 'owner',
        status: 'active'
      }
    ],
    categories: options.categories || [
      {
        _id: 'doc_category_002',
        category_id: 'category_002',
        merchant_id: 'merchant_001',
        name: '特惠套餐',
        sort_order: 2,
        status: 'active'
      },
      {
        _id: 'doc_category_001',
        category_id: 'category_001',
        merchant_id: 'merchant_001',
        name: '招牌推荐',
        sort_order: 1,
        status: 'active'
      },
      {
        _id: 'doc_category_deleted',
        category_id: 'category_deleted',
        merchant_id: 'merchant_001',
        name: '已删除分类',
        sort_order: 3,
        status: 'deleted'
      },
      {
        _id: 'doc_category_other',
        category_id: 'category_other',
        merchant_id: 'merchant_002',
        name: '其他商家分类',
        sort_order: 1,
        status: 'active'
      }
    ]
  }

  return {
    state,
    deps: {
      getOpenid: () => state.openid,
      getTokenSecret: () => state.tokenSecret,
      now: () => state.now,
      createCategoryId: () => `category_new_${state.idIndex++}`,
      findMerchantStaff: async ({ merchant_id, openid }) => {
        return state.merchantStaff.find((staff) => {
          return staff.merchant_id === merchant_id && staff.openid === openid
        }) || null
      },
      findCategoriesByMerchantId: async (merchantId) => {
        return state.categories.filter((category) => category.merchant_id === merchantId)
      },
      findCategoryById: async (categoryId) => {
        return state.categories.find((category) => category.category_id === categoryId) || null
      },
      findCategoriesByIds: async (categoryIds) => {
        return state.categories.filter((category) => categoryIds.includes(category.category_id))
      },
      getNextSortOrder: async (merchantId) => {
        const currentMax = state.categories
          .filter((category) => category.merchant_id === merchantId)
          .reduce((max, category) => Math.max(max, Number(category.sort_order) || 0), 0)
        return currentMax + 1
      },
      createCategory: async (category) => {
        state.writes += 1
        const record = {
          _id: `doc_${category.category_id}`,
          ...category
        }
        state.categories.push(record)
        return record
      },
      updateCategory: async ({ category_id, updateData }) => {
        state.writes += 1
        const category = state.categories.find((item) => item.category_id === category_id)
        if (!category) {
          return null
        }
        Object.assign(category, updateData)
        return category
      },
      updateCategorySortList: async (items) => {
        state.writes += 1
        items.forEach((item) => {
          const category = state.categories.find((record) => record.category_id === item.category_id)
          if (category) {
            category.sort_order = item.sort_order
            category.updated_at = item.updated_at
          }
        })
        return items.length
      },
      logger: {
        error: () => {}
      }
    }
  }
}

function createWebToken(options = {}) {
  return createSignedToken({
    role: options.role || 'super_admin',
    secret: options.secret || 'manage-category-test-secret',
    now: options.now || FIXED_NOW,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'manage-category-test-nonce'
  }).token
}

test('active merchant staff can list categories for their merchant only', async () => {
  const { deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.list.map((category) => category.category_id), [
    'category_001',
    'category_002'
  ])
})

test('web valid admin token can list categories without openid', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.list.map((category) => category.category_id), [
    'category_001',
    'category_002'
  ])
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('web empty token cannot list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    merchant_id: 'merchant_001',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web tampered token cannot list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    merchant_id: 'merchant_001',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web expired token cannot list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({
      now: new Date('2026-06-24T10:00:00.000Z'),
      ttlMinutes: 60
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
  assert.equal(state.writes, 0)
})

test('web non super admin role cannot list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web admin token in http string body can list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'listCategories',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('web admin token in http object body can list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    body: {
      action: 'listCategories',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('web admin token in query string parameters can list categories', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'listCategories',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('invalid http body json does not crash', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web list categories requires merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web token cannot call write category actions in this phase', async () => {
  const writeActions = ['create', 'update', 'disable', 'sort']

  for (const action of writeActions) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageCategoryHandler(deps)

    const result = await handler({
      action,
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      data: {
        name: 'Blocked',
        categories: [
          {
            category_id: 'category_001',
            sort_order: 9
          }
        ]
      },
      admin_token: createWebToken()
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'FORBIDDEN')
    assert.equal(state.writes, 0)
  }
})

test('user without active merchant staff permission cannot manage categories', async () => {
  const { deps } = createDependencies({
    merchantStaff: []
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('create adds an active category with generated id and timestamps', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      name: '石锅现炒',
      sort_order: 8
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.category.category_id, 'category_new_1')
  assert.equal(result.data.category.name, '石锅现炒')
  assert.equal(result.data.category.status, 'active')
  assert.equal(result.data.category.enabled, true)
  assert.equal(result.data.category.sort_order, 8)
  assert.equal(state.categories.some((category) => category.category_id === 'category_new_1'), true)
})

test('update changes only categories that belong to the requested merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    category_id: 'category_001',
    data: {
      name: '本店招牌',
      sort_order: 5,
      status: 'inactive'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.category.name, '本店招牌')
  assert.equal(result.data.category.sort_order, 5)
  assert.equal(result.data.category.status, 'inactive')
  assert.equal(result.data.category.enabled, false)
})

test('disable marks category inactive without deleting it', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'disable',
    category_id: 'category_001'
  })

  const category = state.categories.find((item) => item.category_id === 'category_001')
  assert.equal(result.success, true)
  assert.equal(category.status, 'inactive')
  assert.equal(category.enabled, false)
})

test('sort updates sort_order for categories in the same merchant', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'sort',
    data: {
      categories: [
        { category_id: 'category_001', sort_order: 20 },
        { category_id: 'category_002', sort_order: 10 }
      ]
    }
  })

  const first = state.categories.find((item) => item.category_id === 'category_001')
  const second = state.categories.find((item) => item.category_id === 'category_002')
  assert.equal(result.success, true)
  assert.equal(first.sort_order, 20)
  assert.equal(second.sort_order, 10)
})

test('cannot manage categories that belong to another merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    category_id: 'category_other',
    data: {
      name: '越权修改'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('missing required parameters fail with validation error', async () => {
  const { deps } = createDependencies()
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      name: ''
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})
