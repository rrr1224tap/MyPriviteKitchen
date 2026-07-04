const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const crypto = require('node:crypto')

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

function base64urlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createMerchantAdminToken(options = {}) {
  const secret = options.secret || 'manage-category-test-secret'
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
    nonce: options.nonce || 'manage-category-merchant-admin-nonce'
  }
  const payloadSegment = base64urlEncode(JSON.stringify(payload))
  const signatureSegment = base64urlEncode(
    crypto
      .createHmac('sha256', secret)
      .update(payloadSegment)
      .digest()
  )
  return `${payloadSegment}.${signatureSegment}`
}

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && Array.isArray(value.values)) {
      return value.values.includes(record[key])
    }

    return record[key] === value
  })
}

function createIndexCloudMock(options = {}) {
  const state = {
    openid: options.openid || '',
    categories: options.categories || [
      {
        _id: 'doc_category_001',
        category_id: 'category_001',
        merchant_id: 'merchant_001',
        name: 'Entry Category',
        sort_order: 1,
        status: 'active',
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW
      }
    ],
    merchantStaff: options.merchantStaff || []
  }

  function createQuery(collectionName, query = {}) {
    const queryApi = {
      where(nextQuery) {
        return createQuery(collectionName, nextQuery)
      },
      orderBy() {
        return queryApi
      },
      limit() {
        return queryApi
      },
      async get() {
        const source = collectionName === 'categories' ? state.categories : state.merchantStaff
        return {
          data: source.filter((record) => matchesQuery(record, query))
        }
      },
      async update({ data }) {
        const source = collectionName === 'categories' ? state.categories : state.merchantStaff
        let updated = 0
        source.forEach((record) => {
          if (matchesQuery(record, query)) {
            Object.assign(record, data)
            updated += 1
          }
        })

        return {
          stats: {
            updated
          }
        }
      }
    }

    return queryApi
  }

  const db = {
    command: {
      in: (values) => ({ values })
    },
    collection(collectionName) {
      return {
        where(query) {
          return createQuery(collectionName, query)
        },
        doc(documentId) {
          return {
            async get() {
              const record = state.categories.find((category) => {
                return category._id === documentId || category.category_id === documentId
              })

              if (!record) {
                throw new Error('DOCUMENT_NOT_FOUND')
              }

              return {
                data: record
              }
            }
          }
        },
        async add({ data }) {
          const record = {
            _id: `doc_${data.category_id}`,
            ...data
          }
          state.categories.push(record)
          return {
            _id: record._id
          }
        }
      }
    }
  }

  return {
    state,
    cloud: {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init: () => {},
      database: () => db,
      getWXContext: () => ({
        OPENID: state.openid
      })
    }
  }
}

function loadManageCategoryIndexWithCloudMock(cloudMock) {
  const indexPath = require.resolve('./index')
  delete require.cache[indexPath]

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

test('merchant_admin category list uses merchant_id from token when request omits merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.total, 2)
  assert.equal(result.data.list.every((category) => category.merchant_id === 'merchant_001'), true)
  assert.equal(state.writes, 0)
})

test('merchant_admin category list rejects another requested merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'listCategories',
    merchant_id: 'merchant_002',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_SCOPE_FORBIDDEN')
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
  assert.equal(result.code, 'TOKEN_INVALID')
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
  assert.equal(result.code, 'FORBIDDEN')
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
      admin_token: createWebToken({ now: new Date() })
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
      admin_token: createWebToken({ now: new Date() })
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
      admin_token: createWebToken({ now: new Date() })
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

test('web valid admin token can create category', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'createCategory',
    merchant_id: 'merchant_001',
    name: 'New Category',
    sort_order: 9,
    status: 'active',
    admin_token: createWebToken()
  })

  const created = state.categories.find((category) => category.category_id === 'category_new_1')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.category.category_id, 'category_new_1')
  assert.equal(result.data.category.name, 'New Category')
  assert.equal(result.data.category.sort_order, 9)
  assert.equal(result.data.category.status, 'active')
  assert.equal(result.data.category.merchant_id, 'merchant_001')
  assert.equal(created.name, 'New Category')
  assert.equal(created.merchant_id, 'merchant_001')
  assert.equal(state.writes, 1)
})

test('web valid admin token can update category', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'updateCategory',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Updated Category',
    sort_order: 20,
    status: 'disabled',
    admin_token: createWebToken()
  })

  const updated = state.categories.find((category) => category.category_id === 'category_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.category.name, 'Updated Category')
  assert.equal(result.data.category.sort_order, 20)
  assert.equal(result.data.category.status, 'disabled')
  assert.equal(result.data.category.enabled, false)
  assert.equal(updated.name, 'Updated Category')
  assert.equal(updated.status, 'disabled')
  assert.equal(state.writes, 1)
})

test('index entry accepts web createCategory action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-category-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageCategoryIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      action: 'createCategory',
      merchant_id: 'merchant_001',
      name: 'Entry Created',
      sort_order: 7,
      status: 'active',
      admin_token: createWebToken({ now: new Date() })
    })

    const created = state.categories.find((category) => category.name === 'Entry Created')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(created.merchant_id, 'merchant_001')
    assert.equal(created.sort_order, 7)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('index entry accepts web updateCategory action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-category-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageCategoryIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      action: 'updateCategory',
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: 'Entry Updated',
      sort_order: 8,
      status: 'disabled',
      admin_token: createWebToken({ now: new Date() })
    })

    const updated = state.categories.find((category) => category.category_id === 'category_001')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(updated.name, 'Entry Updated')
    assert.equal(updated.sort_order, 8)
    assert.equal(updated.status, 'disabled')
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web empty token cannot create or update category', async () => {
  for (const action of ['createCategory', 'updateCategory']) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageCategoryHandler(deps)

    const result = await handler({
      action,
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: 'Blocked',
      admin_token: ''
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'UNAUTHORIZED')
    assert.equal(state.writes, 0)
  }
})

test('web tampered token cannot create or update category', async () => {
  for (const action of ['createCategory', 'updateCategory']) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageCategoryHandler(deps)

    const result = await handler({
      action,
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: 'Blocked',
      admin_token: `${createWebToken()}x`
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'TOKEN_INVALID')
    assert.equal(state.writes, 0)
  }
})

test('web expired token cannot create or update category', async () => {
  for (const action of ['createCategory', 'updateCategory']) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageCategoryHandler(deps)

    const result = await handler({
      action,
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: 'Blocked',
      admin_token: createWebToken({
        now: new Date('2026-06-24T10:00:00.000Z'),
        ttlMinutes: 60
      })
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'TOKEN_EXPIRED')
    assert.equal(state.writes, 0)
  }
})

test('web non super admin role cannot create or update category', async () => {
  for (const action of ['createCategory', 'updateCategory']) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageCategoryHandler(deps)

    const result = await handler({
      action,
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: 'Blocked',
      admin_token: createWebToken({
        role: 'viewer'
      })
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'FORBIDDEN')
    assert.equal(state.writes, 0)
  }
})

test('web http string body can create and update category', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const created = await handler({
    body: JSON.stringify({
      action: 'createCategory',
      merchant_id: 'merchant_001',
      name: 'Body Category',
      sort_order: 11,
      admin_token: createWebToken()
    })
  })
  const updated = await handler({
    body: JSON.stringify({
      action: 'updateCategory',
      merchant_id: 'merchant_001',
      category_id: 'category_new_1',
      name: 'Body Category Updated',
      sort_order: 12,
      admin_token: createWebToken()
    })
  })

  assert.equal(created.success, true)
  assert.equal(updated.success, true)
  assert.equal(updated.data.category.name, 'Body Category Updated')
  assert.equal(updated.data.category.sort_order, 12)
  assert.equal(state.writes, 2)
})

test('index entry http string body accepts web updateCategory action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-category-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageCategoryIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      body: JSON.stringify({
        action: 'updateCategory',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: 'Entry Body String Updated',
        sort_order: 18,
        admin_token: createWebToken({ now: new Date() })
      })
    })

    const updated = state.categories.find((category) => category.category_id === 'category_001')
    assert.equal(result.success, true)
    assert.equal(updated.name, 'Entry Body String Updated')
    assert.equal(updated.sort_order, 18)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web http object body can create and update category', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const created = await handler({
    body: {
      action: 'createCategory',
      merchant_id: 'merchant_001',
      name: 'Object Category',
      sort_order: 13,
      admin_token: createWebToken()
    }
  })
  const updated = await handler({
    body: {
      action: 'updateCategory',
      merchant_id: 'merchant_001',
      category_id: 'category_new_1',
      name: 'Object Category Updated',
      sort_order: 14,
      admin_token: createWebToken()
    }
  })

  assert.equal(created.success, true)
  assert.equal(updated.success, true)
  assert.equal(updated.data.category.name, 'Object Category Updated')
  assert.equal(updated.data.category.sort_order, 14)
  assert.equal(state.writes, 2)
})

test('index entry http object body accepts web updateCategory action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-category-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageCategoryIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      body: {
        action: 'updateCategory',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: 'Entry Body Object Updated',
        sort_order: 19,
        admin_token: createWebToken({ now: new Date() })
      }
    })

    const updated = state.categories.find((category) => category.category_id === 'category_001')
    assert.equal(result.success, true)
    assert.equal(updated.name, 'Entry Body Object Updated')
    assert.equal(updated.sort_order, 19)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web query string parameters can create and update category', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const created = await handler({
    queryStringParameters: {
      action: 'createCategory',
      merchant_id: 'merchant_001',
      name: 'Query Category',
      sort_order: '15',
      admin_token: createWebToken()
    }
  })
  const updated = await handler({
    queryStringParameters: {
      action: 'updateCategory',
      merchant_id: 'merchant_001',
      category_id: 'category_new_1',
      name: 'Query Category Updated',
      sort_order: '16',
      admin_token: createWebToken()
    }
  })

  assert.equal(created.success, true)
  assert.equal(updated.success, true)
  assert.equal(updated.data.category.name, 'Query Category Updated')
  assert.equal(updated.data.category.sort_order, 16)
  assert.equal(state.writes, 2)
})

test('index entry query string parameters accepts web updateCategory action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-category-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageCategoryIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      queryStringParameters: {
        action: 'updateCategory',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: 'Entry Query Updated',
        sort_order: '21',
        admin_token: createWebToken({ now: new Date() })
      }
    })

    const updated = state.categories.find((category) => category.category_id === 'category_001')
    assert.equal(result.success, true)
    assert.equal(updated.name, 'Entry Query Updated')
    assert.equal(updated.sort_order, 21)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web create category requires name', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'createCategory',
    merchant_id: 'merchant_001',
    name: '  ',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(state.writes, 0)
})

test('web update category requires category_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'updateCategory',
    merchant_id: 'merchant_001',
    name: 'Missing id',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web update missing category fails', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'updateCategory',
    merchant_id: 'merchant_001',
    category_id: 'missing_category',
    name: 'Missing category',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
  assert.equal(state.writes, 0)
})

test('index entry invalid action still returns invalid category action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-category-test-secret'
  const { cloud } = createIndexCloudMock()
  const handler = loadManageCategoryIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      action: 'renameCategory',
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: 'Invalid action',
      admin_token: createWebToken()
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'INVALID_PARAMS')
    assert.equal(result.message, '分类操作类型不合法')
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web cannot update category from another merchant', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const result = await handler({
    action: 'updateCategory',
    merchant_id: 'merchant_001',
    category_id: 'category_other',
    name: 'Other merchant category',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('web create and update cannot override system fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageCategoryHandler(deps)

  const created = await handler({
    action: 'createCategory',
    merchant_id: 'merchant_001',
    category_id: 'evil_category',
    name: 'System Field Create',
    created_at: new Date('2000-01-01T00:00:00.000Z'),
    updated_at: new Date('2000-01-01T00:00:00.000Z'),
    data: {
      merchant_id: 'merchant_002',
      category_id: 'evil_nested'
    },
    admin_token: createWebToken()
  })
  const updated = await handler({
    action: 'updateCategory',
    merchant_id: 'merchant_001',
    category_id: 'category_new_1',
    name: 'System Field Update',
    created_at: new Date('1999-01-01T00:00:00.000Z'),
    updated_at: new Date('1999-01-01T00:00:00.000Z'),
    data: {
      merchant_id: 'merchant_002',
      category_id: 'evil_nested_update'
    },
    admin_token: createWebToken()
  })

  const category = state.categories.find((item) => item.category_id === 'category_new_1')
  assert.equal(created.success, true)
  assert.equal(updated.success, true)
  assert.equal(category.category_id, 'category_new_1')
  assert.equal(category.merchant_id, 'merchant_001')
  assert.equal(category.created_at, FIXED_NOW)
  assert.equal(category.updated_at, FIXED_NOW)
  assert.equal(state.writes, 2)
})

test('web token cannot call disabled or sort category actions', async () => {
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
