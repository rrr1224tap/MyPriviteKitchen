const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const crypto = require('node:crypto')

const { createManageDishHandler } = require('./dish-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-06-25T10:00:00.000Z')

function createValidSpecGroups(overrides = {}) {
  return [
    {
      group_id: 'size',
      name: '规格',
      required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      options: [
        {
          option_id: 'normal',
          name: '标准份',
          price_delta_cent: 0,
          enabled: true,
          sort_order: 1
        }
      ],
      ...overrides
    }
  ]
}

function createValidAddonGroups(overrides = {}) {
  return [
    {
      group_id: 'extra',
      name: '加料',
      required: false,
      min_select: 0,
      max_select: 3,
      sort_order: 1,
      options: [
        {
          option_id: 'egg',
          name: '加蛋',
          price_delta_cent: 200,
          enabled: true,
          sort_order: 1
        }
      ],
      ...overrides
    }
  ]
}

function createValidTutorials(count = 1, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    title: `做法参考 ${index + 1}`,
    platform: index % 2 === 0 ? 'douyin' : 'xiaohongshu',
    url: `https://example.com/tutorial-${index + 1}`,
    note: `备注 ${index + 1}`,
    enabled: true,
    sort_order: index + 1,
    ...overrides
  }))
}

function createValidIngredients(count = 1, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    name: index === 0 ? '牛肉片' : `食材 ${index + 1}`,
    amount: index === 0 ? 150 : index + 1,
    unit: index === 0 ? 'g' : '份',
    category: index === 0 ? '肉类' : '其他',
    note: index === 0 ? '可用肥牛卷替代' : '',
    enabled: true,
    sort_order: index + 1,
    ...overrides
  }))
}

function createDependencies(options = {}) {
  const state = {
    openid: options.openid === undefined ? 'staff_openid' : options.openid,
    tokenSecret: options.tokenSecret === undefined ? 'manage-dish-test-secret' : options.tokenSecret,
    now: options.now || FIXED_NOW,
    idIndex: 1,
    writes: 0,
    updateCalls: [],
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
        _id: 'doc_category_001',
        category_id: 'category_001',
        merchant_id: 'merchant_001',
        name: '招牌推荐',
        sort_order: 1,
        status: 'active'
      },
      {
        _id: 'doc_category_other',
        category_id: 'category_other',
        merchant_id: 'merchant_002',
        name: '其他商家分类',
        sort_order: 1,
        status: 'active'
      },
      {
        _id: 'doc_category_inactive',
        category_id: 'category_inactive',
        merchant_id: 'merchant_001',
        name: '停用分类',
        sort_order: 2,
        status: 'inactive'
      },
      {
        _id: 'doc_category_disabled',
        category_id: 'category_disabled',
        merchant_id: 'merchant_001',
        name: '禁用分类',
        sort_order: 3,
        status: 'active',
        enabled: false
      }
    ],
    dishes: options.dishes || [
      {
        _id: 'doc_dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '招牌肥牛石锅拌饭',
        description: '肥牛现炒，锅巴焦香',
        detail_description: '详细介绍',
        image_url: '',
        price_cent: 2990,
        original_price_cent: 3290,
        tags: ['招牌', '热销'],
        status: 'on_sale',
        sort_order: 1
      },
      {
        _id: 'doc_dish_002',
        dish_id: 'dish_002',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '经典肉酱砂锅米线',
        description: '浓香肉酱配米线',
        price_cent: 2590,
        original_price_cent: 0,
        tags: ['新品'],
        status: 'off_sale',
        sort_order: 2
      },
      {
        _id: 'doc_dish_other',
        dish_id: 'dish_other',
        merchant_id: 'merchant_002',
        category_id: 'category_other',
        name: '其他商家餐品',
        price_cent: 1990,
        status: 'on_sale',
        sort_order: 1
      }
    ]
  }

  return {
    state,
    deps: {
      getOpenid: () => state.openid,
      getTokenSecret: () => state.tokenSecret,
      now: () => state.now,
      createDishId: () => `dish_new_${state.idIndex++}`,
      findMerchantStaff: async ({ merchant_id, openid }) => {
        return state.merchantStaff.find((staff) => {
          return staff.merchant_id === merchant_id && staff.openid === openid
        }) || null
      },
      findDishesByMerchantId: async (merchantId) => {
        return state.dishes.filter((dish) => dish.merchant_id === merchantId)
      },
      findDishById: async (dishId) => {
        return state.dishes.find((dish) => {
          return dish.dish_id === dishId || dish._id === dishId
        }) || null
      },
      findDishesByIds: async (dishIds) => {
        return state.dishes.filter((dish) => dishIds.includes(dish.dish_id))
      },
      findCategoryById: async (categoryId) => {
        return state.categories.find((category) => category.category_id === categoryId) || null
      },
      getNextSortOrder: async (merchantId) => {
        const currentMax = state.dishes
          .filter((dish) => dish.merchant_id === merchantId)
          .reduce((max, dish) => Math.max(max, Number(dish.sort_order) || 0), 0)
        return currentMax + 1
      },
      createDish: async (dish) => {
        state.writes += 1
        const record = {
          _id: `doc_${dish.dish_id}`,
          ...dish
        }
        state.dishes.push(record)
        return record
      },
      updateDish: async ({ dish_id, updateData }) => {
        state.writes += 1
        state.updateCalls.push({
          dish_id,
          updateData
        })
        const dish = state.dishes.find((item) => item.dish_id === dish_id)
        if (!dish) {
          return null
        }
        Object.assign(dish, updateData)
        return dish
      },
      updateDishSortList: async (items) => {
        state.writes += 1
        items.forEach((item) => {
          const dish = state.dishes.find((record) => record.dish_id === item.dish_id)
          if (dish) {
            dish.sort_order = item.sort_order
            dish.updated_at = item.updated_at
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
    secret: options.secret || 'manage-dish-test-secret',
    now: options.now || FIXED_NOW,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'manage-dish-test-nonce'
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
  const secret = options.secret || 'manage-dish-test-secret'
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
    nonce: options.nonce || 'manage-dish-merchant-admin-nonce'
  }
  const payloadSegment = base64urlEncode(JSON.stringify(payload))
  const signatureSegment = base64urlEncode(
    crypto.createHmac('sha256', secret).update(payloadSegment).digest()
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
        status: 'active'
      }
    ],
    dishes: options.dishes || [
      {
        _id: 'doc_dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: 'Entry Dish',
        price_cent: 1200,
        status: 'on_sale',
        sort_order: 1
      }
    ],
    merchantStaff: options.merchantStaff || []
  }

  function createQuery(collectionName, query = {}) {
    const queryState = {
      sortField: '',
      sortDirection: 'asc',
      limitSize: null
    }

    const queryApi = {
      where(nextQuery) {
        return createQuery(collectionName, nextQuery)
      },
      orderBy(field, direction) {
        queryState.sortField = field
        queryState.sortDirection = direction
        return queryApi
      },
      limit(size) {
        queryState.limitSize = size
        return queryApi
      },
      async get() {
        const source = collectionName === 'dishes'
          ? state.dishes
          : collectionName === 'categories'
            ? state.categories
            : state.merchantStaff
        let data = source.filter((record) => matchesQuery(record, query))
        if (queryState.sortField) {
          data = data.slice().sort((left, right) => {
            const leftValue = Number(left[queryState.sortField]) || 0
            const rightValue = Number(right[queryState.sortField]) || 0
            return queryState.sortDirection === 'desc'
              ? rightValue - leftValue
              : leftValue - rightValue
          })
        }
        if (queryState.limitSize !== null) {
          data = data.slice(0, queryState.limitSize)
        }
        return { data }
      },
      async update({ data }) {
        const source = collectionName === 'dishes'
          ? state.dishes
          : collectionName === 'categories'
            ? state.categories
            : state.merchantStaff
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
              const source = collectionName === 'dishes' ? state.dishes : state.categories
              const record = source.find((item) => {
                return item._id === documentId ||
                  item.dish_id === documentId ||
                  item.category_id === documentId
              })
              if (!record) {
                throw new Error('DOCUMENT_NOT_FOUND')
              }
              return { data: record }
            }
          }
        },
        async add({ data }) {
          const id = `doc_${data.dish_id || data.category_id || Date.now()}`
          const record = {
            _id: id,
            ...data
          }
          if (collectionName === 'dishes') {
            state.dishes.push(record)
          } else if (collectionName === 'categories') {
            state.categories.push(record)
          }
          return {
            _id: id
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

function loadManageDishIndexWithCloudMock(cloudMock) {
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

test('active merchant staff can list dishes for their merchant only', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.list.map((dish) => dish.dish_id), [
    'dish_001',
    'dish_002'
  ])
  assert.equal(result.data.list[0].stock_enabled, false)
  assert.equal(result.data.list[0].stock_count, 0)
  assert.equal(result.data.list[0].sold_out, false)
  assert.deepEqual(result.data.list[0].spec_groups, [])
  assert.deepEqual(result.data.list[0].addon_groups, [])
  assert.deepEqual(result.data.list[0].tutorials, [])
  assert.deepEqual(result.data.list[0].ingredients, [])
  assert.equal(result.data.list[0].has_options, false)
})

test('web valid admin token can list dishes without openid', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    merchant_id: 'merchant_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.list.map((dish) => dish.dish_id), [
    'dish_001',
    'dish_002'
  ])
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('merchant_admin dish list uses merchant_id from token when request omits merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.list.map((dish) => dish.dish_id), [
    'dish_001',
    'dish_002'
  ])
  assert.equal(result.data.list.every((dish) => dish.merchant_id === 'merchant_001'), true)
  assert.equal(state.writes, 0)
})

test('merchant_admin dish list rejects another requested merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    merchant_id: 'merchant_002',
    admin_token: createMerchantAdminToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_SCOPE_FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('web empty token cannot list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    merchant_id: 'merchant_001',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web tampered token cannot list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    merchant_id: 'merchant_001',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_INVALID')
  assert.equal(state.writes, 0)
})

test('web expired token cannot list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
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

test('web non super admin role cannot list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    merchant_id: 'merchant_001',
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('web admin token in http string body can list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'listDishes',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('web admin token in http object body can list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: {
      action: 'listDishes',
      merchant_id: 'merchant_001',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 2)
  assert.equal(state.writes, 0)
})

test('web admin token in query string parameters can list dishes', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'listDishes',
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
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web list dishes requires merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'listDishes',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web valid admin token can create basic dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    name: 'Tomato Egg',
    category_id: 'category_001',
    price: 18,
    description: 'Home style dish',
    image_url: 'https://example.com/dish.jpg',
    admin_token: createWebToken()
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.dish.dish_id, 'dish_new_1')
  assert.equal(result.data.dish.merchant_id, 'merchant_001')
  assert.equal(result.data.dish.name, 'Tomato Egg')
  assert.equal(result.data.dish.category_id, 'category_001')
  assert.equal(result.data.dish.price_cent, 1800)
  assert.equal(result.data.dish.description, 'Home style dish')
  assert.equal(result.data.dish.image_url, 'https://example.com/dish.jpg')
  assert.equal(result.data.dish.status, 'on_sale')
  assert.equal(createdDish.price_cent, 1800)
  assert.equal(Object.prototype.hasOwnProperty.call(createdDish, 'tutorials'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(createdDish, 'ingredients'), false)
  assert.equal(state.writes, 1)
})

test('index entry accepts web createDish action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      action: 'createDish',
      merchant_id: 'merchant_001',
      name: 'Entry Created Dish',
      category_id: 'category_001',
      price: 22,
      admin_token: createWebToken({ now: new Date() })
    })

    const createdDish = state.dishes.find((dish) => dish.name === 'Entry Created Dish')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(createdDish.merchant_id, 'merchant_001')
    assert.equal(createdDish.price_cent, 2200)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web empty token cannot create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web tampered token cannot create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_INVALID')
  assert.equal(state.writes, 0)
})

test('web expired token cannot create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: createWebToken({
      now: new Date('2026-06-24T10:00:00.000Z'),
      ttlMinutes: 60
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
  assert.equal(state.writes, 0)
})

test('web non super admin role cannot create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('web http string body can create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'createDish',
      merchant_id: 'merchant_001',
      name: 'Body String Dish',
      category_id: 'category_001',
      price: 19,
      admin_token: createWebToken()
    })
  })

  const createdDish = state.dishes.find((dish) => dish.name === 'Body String Dish')
  assert.equal(result.success, true)
  assert.equal(createdDish.price_cent, 1900)
})

test('index entry http string body accepts web createDish action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      body: JSON.stringify({
        action: 'createDish',
        merchant_id: 'merchant_001',
        name: 'Entry Body Dish',
        category_id: 'category_001',
        price: 21,
        admin_token: createWebToken({ now: new Date() })
      })
    })

    const createdDish = state.dishes.find((dish) => dish.name === 'Entry Body Dish')
    assert.equal(result.success, true)
    assert.equal(createdDish.price_cent, 2100)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web http object body can create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: {
      action: 'createDish',
      merchant_id: 'merchant_001',
      name: 'Body Object Dish',
      category_id: 'category_001',
      price: 20,
      admin_token: createWebToken()
    }
  })

  const createdDish = state.dishes.find((dish) => dish.name === 'Body Object Dish')
  assert.equal(result.success, true)
  assert.equal(createdDish.price_cent, 2000)
})

test('web query string parameters can create dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'createDish',
      merchant_id: 'merchant_001',
      name: 'Query Dish',
      category_id: 'category_001',
      price: '23',
      admin_token: createWebToken()
    }
  })

  const createdDish = state.dishes.find((dish) => dish.name === 'Query Dish')
  assert.equal(result.success, true)
  assert.equal(createdDish.price_cent, 2300)
})

test('web create dish requires merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    name: 'Missing Merchant',
    category_id: 'category_001',
    price: 18,
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web create dish validates required basic fields', async () => {
  const cases = [
    {
      title: 'missing name',
      payload: { category_id: 'category_001', price: 18 }
    },
    {
      title: 'empty name',
      payload: { name: '   ', category_id: 'category_001', price: 18 }
    },
    {
      title: 'missing category',
      payload: { name: 'Missing Category', price: 18 }
    },
    {
      title: 'missing price',
      payload: { name: 'Missing Price', category_id: 'category_001' }
    },
    {
      title: 'non numeric price',
      payload: { name: 'Bad Price', category_id: 'category_001', price: 'abc' }
    },
    {
      title: 'negative price',
      payload: { name: 'Negative Price', category_id: 'category_001', price: -1 }
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'createDish',
      merchant_id: 'merchant_001',
      admin_token: createWebToken(),
      ...item.payload
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, 'VALIDATION_ERROR', item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web create dish rejects category from another merchant', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    name: 'Wrong Category',
    category_id: 'category_other',
    price: 18,
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(state.writes, 0)
})

test('web create dish cannot override system or advanced fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const createdAt = new Date('2000-01-01T00:00:00.000Z')
  const updatedAt = new Date('2001-01-01T00:00:00.000Z')

  const result = await handler({
    action: 'createDish',
    merchant_id: 'merchant_001',
    dish_id: 'evil_dish',
    name: 'Protected Fields Dish',
    category_id: 'category_001',
    price: 18,
    created_at: createdAt,
    updated_at: updatedAt,
    data: {
      merchant_id: 'merchant_002',
      dish_id: 'evil_nested',
      created_at: createdAt,
      updated_at: updatedAt,
      tutorials: createValidTutorials(1),
      ingredients: createValidIngredients(1),
      spec_groups: createValidSpecGroups(),
      addon_groups: createValidAddonGroups()
    },
    admin_token: createWebToken()
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.equal(createdDish.merchant_id, 'merchant_001')
  assert.equal(createdDish.dish_id, 'dish_new_1')
  assert.equal(createdDish.created_at, FIXED_NOW)
  assert.equal(createdDish.updated_at, FIXED_NOW)
  assert.equal(Object.prototype.hasOwnProperty.call(createdDish, 'tutorials'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(createdDish, 'ingredients'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(createdDish, 'spec_groups'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(createdDish, 'addon_groups'), false)
})

test('web valid admin token can update basic dish fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    name: 'Updated Tomato Egg',
    category_id: 'category_001',
    price: 19,
    description: 'Updated home style dish',
    image_url: 'https://example.com/updated.jpg',
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.dish.dish_id, 'dish_001')
  assert.equal(result.data.dish.merchant_id, 'merchant_001')
  assert.equal(result.data.dish.name, 'Updated Tomato Egg')
  assert.equal(result.data.dish.category_id, 'category_001')
  assert.equal(result.data.dish.price_cent, 1900)
  assert.equal(result.data.dish.description, 'Updated home style dish')
  assert.equal(result.data.dish.image_url, 'https://example.com/updated.jpg')
  assert.equal(updatedDish.price_cent, 1900)
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(state.writes, 1)
})

test('index entry accepts web updateDish action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      action: 'updateDish',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      name: 'Entry Updated Dish',
      category_id: 'category_001',
      price: 24,
      admin_token: createWebToken({ now: new Date() })
    })

    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(updatedDish.name, 'Entry Updated Dish')
    assert.equal(updatedDish.price_cent, 2400)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web empty token cannot update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web tampered token cannot update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_INVALID')
  assert.equal(state.writes, 0)
})

test('web expired token cannot update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: createWebToken({
      now: new Date('2026-06-24T10:00:00.000Z'),
      ttlMinutes: 60
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
  assert.equal(state.writes, 0)
})

test('web non super admin role cannot update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    name: 'Blocked',
    category_id: 'category_001',
    price: 18,
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('web http string body can update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'updateDish',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      name: 'Body String Updated Dish',
      category_id: 'category_001',
      price: 20,
      admin_token: createWebToken()
    })
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.name, 'Body String Updated Dish')
  assert.equal(updatedDish.price_cent, 2000)
})

test('index entry http string body accepts web updateDish action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      body: JSON.stringify({
        action: 'updateDish',
        merchant_id: 'merchant_001',
        dish_id: 'dish_001',
        name: 'Entry Body Updated Dish',
        category_id: 'category_001',
        price: 25,
        admin_token: createWebToken({ now: new Date() })
      })
    })

    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
    assert.equal(result.success, true)
    assert.equal(updatedDish.name, 'Entry Body Updated Dish')
    assert.equal(updatedDish.price_cent, 2500)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web http object body can update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: {
      action: 'updateDish',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      name: 'Body Object Updated Dish',
      category_id: 'category_001',
      price: 21,
      admin_token: createWebToken()
    }
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.name, 'Body Object Updated Dish')
  assert.equal(updatedDish.price_cent, 2100)
})

test('web query string parameters can update dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'updateDish',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      name: 'Query Updated Dish',
      category_id: 'category_001',
      price: '22',
      admin_token: createWebToken()
    }
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.name, 'Query Updated Dish')
  assert.equal(updatedDish.price_cent, 2200)
})

test('web update dish requires merchant_id and dish_id', async () => {
  const cases = [
    {
      title: 'missing merchant',
      payload: { dish_id: 'dish_001' },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing dish',
      payload: { merchant_id: 'merchant_001' },
      expectedCode: 'INVALID_PARAMS'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDish',
      name: 'Missing Ids',
      category_id: 'category_001',
      price: 18,
      admin_token: createWebToken(),
      ...item.payload
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish validates existing dish ownership', async () => {
  const cases = [
    {
      title: 'missing dish',
      dish_id: 'missing_dish',
      expectedCode: 'NOT_FOUND'
    },
    {
      title: 'other merchant dish',
      dish_id: 'dish_other',
      expectedCode: 'FORBIDDEN'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDish',
      merchant_id: 'merchant_001',
      dish_id: item.dish_id,
      name: 'Wrong Dish',
      category_id: 'category_001',
      price: 18,
      admin_token: createWebToken()
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish validates required basic fields', async () => {
  const cases = [
    {
      title: 'missing name',
      payload: { category_id: 'category_001', price: 18 }
    },
    {
      title: 'empty name',
      payload: { name: '   ', category_id: 'category_001', price: 18 }
    },
    {
      title: 'missing category',
      payload: { name: 'Missing Category', price: 18 }
    },
    {
      title: 'wrong category merchant',
      payload: { name: 'Wrong Category', category_id: 'category_other', price: 18 }
    },
    {
      title: 'missing price',
      payload: { name: 'Missing Price', category_id: 'category_001' }
    },
    {
      title: 'non numeric price',
      payload: { name: 'Bad Price', category_id: 'category_001', price: 'abc' }
    },
    {
      title: 'negative price',
      payload: { name: 'Negative Price', category_id: 'category_001', price: -1 }
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDish',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      admin_token: createWebToken(),
      ...item.payload
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, 'VALIDATION_ERROR', item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish cannot override system or advanced fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const originalDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  const originalCreatedAt = new Date('2020-01-01T00:00:00.000Z')
  originalDish.created_at = originalCreatedAt
  originalDish.status = 'on_sale'
  originalDish.sort_order = 1
  originalDish.tutorials = createValidTutorials(1)
  originalDish.ingredients = createValidIngredients(1)
  originalDish.spec_groups = createValidSpecGroups()
  originalDish.addon_groups = createValidAddonGroups()
  const maliciousCreatedAt = new Date('2000-01-01T00:00:00.000Z')
  const maliciousUpdatedAt = new Date('2001-01-01T00:00:00.000Z')

  const result = await handler({
    action: 'updateDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    name: 'Protected Update Dish',
    category_id: 'category_001',
    price: 18,
    created_at: maliciousCreatedAt,
    updated_at: maliciousUpdatedAt,
    status: 'off_sale',
    sort_order: 99,
    data: {
      merchant_id: 'merchant_002',
      dish_id: 'evil_nested',
      created_at: maliciousCreatedAt,
      updated_at: maliciousUpdatedAt,
      status: 'off_sale',
      sort_order: 99,
      tutorials: [],
      ingredients: [],
      spec_groups: [],
      addon_groups: []
    },
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.merchant_id, 'merchant_001')
  assert.equal(updatedDish.dish_id, 'dish_001')
  assert.equal(updatedDish.created_at, originalCreatedAt)
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(updatedDish.status, 'on_sale')
  assert.equal(updatedDish.sort_order, 1)
  assert.deepEqual(updatedDish.tutorials, createValidTutorials(1))
  assert.deepEqual(updatedDish.ingredients, createValidIngredients(1))
  assert.deepEqual(updatedDish.spec_groups, createValidSpecGroups())
  assert.deepEqual(updatedDish.addon_groups, createValidAddonGroups())
  assert.deepEqual(Object.keys(state.updateCalls[0].updateData).sort(), [
    'category_id',
    'description',
    'image_url',
    'name',
    'price_cent',
    'updated_at'
  ])
})

test('web valid admin token can off sale dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    status: 'off_sale',
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.dish.status, 'off_sale')
  assert.equal(updatedDish.status, 'off_sale')
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(state.writes, 1)
})

test('web valid admin token can on sale dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_002',
    status: 'on_sale',
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_002')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.dish.status, 'on_sale')
  assert.equal(updatedDish.status, 'on_sale')
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(state.writes, 1)
})

test('merchant_admin can soft delete own dish without merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'deleteDish',
    dish_id: 'dish_001',
    admin_token: createMerchantAdminToken()
  })

  const deletedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.dish.dish_id, 'dish_001')
  assert.equal(result.data.dish.is_deleted, true)
  assert.equal(deletedDish.is_deleted, true)
  assert.equal(deletedDish.updated_at, FIXED_NOW)
  assert.equal(state.writes, 1)
  assert.deepEqual(Object.keys(state.updateCalls[0].updateData).sort(), [
    'is_deleted',
    'updated_at'
  ])
})

test('merchant_admin cannot soft delete dish from another merchant', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'deleteDish',
    dish_id: 'dish_other',
    admin_token: createMerchantAdminToken()
  })

  const otherDish = state.dishes.find((dish) => dish.dish_id === 'dish_other')
  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(otherDish.is_deleted, undefined)
  assert.equal(state.writes, 0)
})

test('super_admin web token cannot delete dish', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'deleteDish',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('list dishes filters soft deleted dishes', async () => {
  const { deps } = createDependencies({
    dishes: [
      {
        dish_id: 'dish_visible',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: 'Visible Dish',
        price_cent: 1800,
        status: 'on_sale',
        sort_order: 1
      },
      {
        dish_id: 'dish_deleted',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: 'Deleted Dish',
        price_cent: 1800,
        status: 'off_sale',
        sort_order: 2,
        is_deleted: true
      }
    ]
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
  assert.equal(result.data.list[0].dish_id, 'dish_visible')
})

test('index entry accepts web updateDishStatus action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)

  try {
    const result = await handler({
      action: 'updateDishStatus',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      status: 'off_sale',
      admin_token: createWebToken({ now: new Date() })
    })

    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.equal(updatedDish.status, 'off_sale')
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web invalid json body for updateDishStatus does not crash', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web empty token cannot update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    status: 'off_sale',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.writes, 0)
})

test('web tampered token cannot update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    status: 'off_sale',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_INVALID')
  assert.equal(state.writes, 0)
})

test('web expired token cannot update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    status: 'off_sale',
    admin_token: createWebToken({
      now: new Date('2026-06-24T10:00:00.000Z'),
      ttlMinutes: 60
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
  assert.equal(state.writes, 0)
})

test('web non super admin role cannot update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    status: 'off_sale',
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.writes, 0)
})

test('web http string body can update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'updateDishStatus',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      status: 'off_sale',
      admin_token: createWebToken()
    })
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.status, 'off_sale')
})

test('web http object body can update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: {
      action: 'updateDishStatus',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      status: 'off_sale',
      admin_token: createWebToken()
    }
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.status, 'off_sale')
})

test('web query string parameters can update dish status', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'updateDishStatus',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      status: 'off_sale',
      admin_token: createWebToken()
    }
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.status, 'off_sale')
})

test('web update dish status validates required params and status', async () => {
  const cases = [
    {
      title: 'missing merchant',
      payload: { dish_id: 'dish_001', status: 'off_sale' },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing dish',
      payload: { merchant_id: 'merchant_001', status: 'off_sale' },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing status',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001' },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'invalid status',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001', status: 'disabled' },
      expectedCode: 'VALIDATION_ERROR'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishStatus',
      admin_token: createWebToken(),
      ...item.payload
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish status validates existing dish ownership', async () => {
  const cases = [
    {
      title: 'missing dish',
      dish_id: 'missing_dish',
      expectedCode: 'NOT_FOUND'
    },
    {
      title: 'other merchant dish',
      dish_id: 'dish_other',
      expectedCode: 'FORBIDDEN'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishStatus',
      merchant_id: 'merchant_001',
      dish_id: item.dish_id,
      status: 'off_sale',
      admin_token: createWebToken()
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish status only updates status and updated_at', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const originalDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  const originalCreatedAt = new Date('2020-01-01T00:00:00.000Z')
  originalDish.created_at = originalCreatedAt
  originalDish.status = 'on_sale'
  originalDish.name = 'Original Name'
  originalDish.category_id = 'category_001'
  originalDish.price_cent = 2990
  originalDish.description = 'Original Description'
  originalDish.image_url = 'https://example.com/original.jpg'
  originalDish.tutorials = createValidTutorials(1)
  originalDish.ingredients = createValidIngredients(1)
  originalDish.spec_groups = createValidSpecGroups()
  originalDish.addon_groups = createValidAddonGroups()

  const result = await handler({
    action: 'updateDishStatus',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    status: 'off_sale',
    name: 'Injected Name',
    category_id: 'category_other',
    price_cent: 1,
    description: 'Injected Description',
    image_url: 'https://example.com/injected.jpg',
    created_at: new Date('2000-01-01T00:00:00.000Z'),
    data: {
      merchant_id: 'merchant_002',
      dish_id: 'evil_dish',
      name: 'Nested Name',
      category_id: 'category_other',
      price_cent: 2,
      tutorials: [],
      ingredients: [],
      spec_groups: [],
      addon_groups: []
    },
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(updatedDish.merchant_id, 'merchant_001')
  assert.equal(updatedDish.dish_id, 'dish_001')
  assert.equal(updatedDish.status, 'off_sale')
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(updatedDish.created_at, originalCreatedAt)
  assert.equal(updatedDish.name, 'Original Name')
  assert.equal(updatedDish.category_id, 'category_001')
  assert.equal(updatedDish.price_cent, 2990)
  assert.equal(updatedDish.description, 'Original Description')
  assert.equal(updatedDish.image_url, 'https://example.com/original.jpg')
  assert.deepEqual(updatedDish.tutorials, createValidTutorials(1))
  assert.deepEqual(updatedDish.ingredients, createValidIngredients(1))
  assert.deepEqual(updatedDish.spec_groups, createValidSpecGroups())
  assert.deepEqual(updatedDish.addon_groups, createValidAddonGroups())
  assert.deepEqual(Object.keys(state.updateCalls[0].updateData).sort(), [
    'status',
    'updated_at'
  ])
})

test('web valid admin token can update dish tutorials', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const tutorials = createValidTutorials(2)

  const result = await handler({
    action: 'updateDishTutorials',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    tutorials,
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.dish.tutorials, tutorials)
  assert.deepEqual(updatedDish.tutorials, tutorials)
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(state.writes, 1)
})

test('web valid admin token can clear dish tutorials with empty array', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const originalDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  originalDish.tutorials = createValidTutorials(2)

  const result = await handler({
    action: 'updateDishTutorials',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    tutorials: [],
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.tutorials, [])
  assert.deepEqual(updatedDish.tutorials, [])
  assert.equal(updatedDish.updated_at, FIXED_NOW)
})

test('index entry accepts web updateDishTutorials action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)
  const tutorials = createValidTutorials(1)

  try {
    const result = await handler({
      action: 'updateDishTutorials',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      tutorials,
      admin_token: createWebToken({ now: new Date() })
    })

    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.deepEqual(updatedDish.tutorials, tutorials)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web token validation rejects updateDishTutorials writes', async () => {
  const cases = [
    {
      title: 'empty token',
      token: '',
      expectedCode: 'UNAUTHORIZED'
    },
    {
      title: 'tampered token',
      token: `${createWebToken()}x`,
      expectedCode: 'TOKEN_INVALID'
    },
    {
      title: 'expired token',
      token: createWebToken({
        now: new Date('2026-06-24T10:00:00.000Z'),
        ttlMinutes: 60
      }),
      expectedCode: 'TOKEN_EXPIRED'
    },
    {
      title: 'non super admin',
      token: createWebToken({
        role: 'viewer'
      }),
      expectedCode: 'FORBIDDEN'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishTutorials',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      tutorials: createValidTutorials(1),
      admin_token: item.token
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web http payloads can update dish tutorials', async () => {
  const cases = [
    {
      title: 'body string',
      buildEvent: (tutorials) => ({
        body: JSON.stringify({
          action: 'updateDishTutorials',
          merchant_id: 'merchant_001',
          dish_id: 'dish_001',
          tutorials,
          admin_token: createWebToken()
        })
      })
    },
    {
      title: 'body object',
      buildEvent: (tutorials) => ({
        body: {
          action: 'updateDishTutorials',
          merchant_id: 'merchant_001',
          dish_id: 'dish_001',
          tutorials,
          admin_token: createWebToken()
        }
      })
    },
    {
      title: 'query string parameters',
      buildEvent: (tutorials) => ({
        queryStringParameters: {
          action: 'updateDishTutorials',
          merchant_id: 'merchant_001',
          dish_id: 'dish_001',
          tutorials: JSON.stringify(tutorials),
          admin_token: createWebToken()
        }
      })
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)
    const tutorials = createValidTutorials(1, {
      title: item.title
    })

    const result = await handler(item.buildEvent(tutorials))
    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')

    assert.equal(result.success, true, item.title)
    assert.deepEqual(updatedDish.tutorials, tutorials, item.title)
  }
})

test('web invalid json body for updateDishTutorials does not crash', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web update dish tutorials validates required params and tutorial data', async () => {
  const cases = [
    {
      title: 'missing merchant',
      payload: { dish_id: 'dish_001', tutorials: createValidTutorials(1) },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing dish',
      payload: { merchant_id: 'merchant_001', tutorials: createValidTutorials(1) },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing tutorials',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001' },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'tutorials not array',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001', tutorials: {} },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'too many tutorials',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001', tutorials: createValidTutorials(4) },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'invalid tutorial item',
      payload: {
        merchant_id: 'merchant_001',
        dish_id: 'dish_001',
        tutorials: createValidTutorials(1, { platform: 'wechat' })
      },
      expectedCode: 'VALIDATION_ERROR'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishTutorials',
      admin_token: createWebToken(),
      ...item.payload
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish tutorials validates existing dish ownership', async () => {
  const cases = [
    {
      title: 'missing dish',
      dish_id: 'missing_dish',
      expectedCode: 'NOT_FOUND'
    },
    {
      title: 'other merchant dish',
      dish_id: 'dish_other',
      expectedCode: 'FORBIDDEN'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishTutorials',
      merchant_id: 'merchant_001',
      dish_id: item.dish_id,
      tutorials: createValidTutorials(1),
      admin_token: createWebToken()
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish tutorials only updates tutorials and updated_at', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const originalDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  const originalCreatedAt = new Date('2020-01-01T00:00:00.000Z')
  originalDish.created_at = originalCreatedAt
  originalDish.status = 'on_sale'
  originalDish.name = 'Original Name'
  originalDish.category_id = 'category_001'
  originalDish.price_cent = 2990
  originalDish.description = 'Original Description'
  originalDish.image_url = 'https://example.com/original.jpg'
  originalDish.ingredients = createValidIngredients(1)
  originalDish.spec_groups = createValidSpecGroups()
  originalDish.addon_groups = createValidAddonGroups()
  const tutorials = createValidTutorials(1, {
    title: 'Only Tutorials'
  })

  const result = await handler({
    action: 'updateDishTutorials',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    tutorials,
    name: 'Injected Name',
    category_id: 'category_other',
    price_cent: 1,
    description: 'Injected Description',
    image_url: 'https://example.com/injected.jpg',
    status: 'off_sale',
    sort_order: 99,
    created_at: new Date('2000-01-01T00:00:00.000Z'),
    data: {
      merchant_id: 'merchant_002',
      dish_id: 'evil_dish',
      name: 'Nested Name',
      category_id: 'category_other',
      price_cent: 2,
      ingredients: [],
      spec_groups: [],
      addon_groups: []
    },
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(updatedDish.tutorials, tutorials)
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(updatedDish.merchant_id, 'merchant_001')
  assert.equal(updatedDish.dish_id, 'dish_001')
  assert.equal(updatedDish.created_at, originalCreatedAt)
  assert.equal(updatedDish.status, 'on_sale')
  assert.equal(updatedDish.name, 'Original Name')
  assert.equal(updatedDish.category_id, 'category_001')
  assert.equal(updatedDish.price_cent, 2990)
  assert.equal(updatedDish.description, 'Original Description')
  assert.equal(updatedDish.image_url, 'https://example.com/original.jpg')
  assert.deepEqual(updatedDish.ingredients, createValidIngredients(1))
  assert.deepEqual(updatedDish.spec_groups, createValidSpecGroups())
  assert.deepEqual(updatedDish.addon_groups, createValidAddonGroups())
  assert.deepEqual(Object.keys(state.updateCalls[0].updateData).sort(), [
    'tutorials',
    'updated_at'
  ])
})

test('web valid admin token can update dish ingredients', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const ingredients = createValidIngredients(2)

  const result = await handler({
    action: 'updateDishIngredients',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    ingredients,
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.dish.ingredients, ingredients)
  assert.deepEqual(updatedDish.ingredients, ingredients)
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(state.writes, 1)
})

test('web valid admin token can clear dish ingredients with empty array', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const originalDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  originalDish.ingredients = createValidIngredients(2)

  const result = await handler({
    action: 'updateDishIngredients',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    ingredients: [],
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.ingredients, [])
  assert.deepEqual(updatedDish.ingredients, [])
  assert.equal(updatedDish.updated_at, FIXED_NOW)
})

test('index entry accepts web updateDishIngredients action', async () => {
  const previousSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = 'manage-dish-test-secret'
  const { state, cloud } = createIndexCloudMock()
  const handler = loadManageDishIndexWithCloudMock(cloud)
  const ingredients = createValidIngredients(1)

  try {
    const result = await handler({
      action: 'updateDishIngredients',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      ingredients,
      admin_token: createWebToken({ now: new Date() })
    })

    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
    assert.equal(result.success, true)
    assert.equal(result.code, 'SUCCESS')
    assert.deepEqual(updatedDish.ingredients, ingredients)
  } finally {
    process.env.WEB_ADMIN_TOKEN_SECRET = previousSecret
  }
})

test('web token validation rejects updateDishIngredients writes', async () => {
  const cases = [
    {
      title: 'empty token',
      token: '',
      expectedCode: 'UNAUTHORIZED'
    },
    {
      title: 'tampered token',
      token: `${createWebToken()}x`,
      expectedCode: 'TOKEN_INVALID'
    },
    {
      title: 'expired token',
      token: createWebToken({
        now: new Date('2026-06-24T10:00:00.000Z'),
        ttlMinutes: 60
      }),
      expectedCode: 'TOKEN_EXPIRED'
    },
    {
      title: 'non super admin',
      token: createWebToken({
        role: 'viewer'
      }),
      expectedCode: 'FORBIDDEN'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishIngredients',
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      ingredients: createValidIngredients(1),
      admin_token: item.token
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web http payloads can update dish ingredients', async () => {
  const cases = [
    {
      title: 'body string',
      buildEvent: (ingredients) => ({
        body: JSON.stringify({
          action: 'updateDishIngredients',
          merchant_id: 'merchant_001',
          dish_id: 'dish_001',
          ingredients,
          admin_token: createWebToken()
        })
      })
    },
    {
      title: 'body object',
      buildEvent: (ingredients) => ({
        body: {
          action: 'updateDishIngredients',
          merchant_id: 'merchant_001',
          dish_id: 'dish_001',
          ingredients,
          admin_token: createWebToken()
        }
      })
    },
    {
      title: 'query string parameters',
      buildEvent: (ingredients) => ({
        queryStringParameters: {
          action: 'updateDishIngredients',
          merchant_id: 'merchant_001',
          dish_id: 'dish_001',
          ingredients: JSON.stringify(ingredients),
          admin_token: createWebToken()
        }
      })
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)
    const ingredients = createValidIngredients(1, {
      name: item.title
    })

    const result = await handler(item.buildEvent(ingredients))
    const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')

    assert.equal(result.success, true, item.title)
    assert.deepEqual(updatedDish.ingredients, ingredients, item.title)
  }
})

test('web invalid json body for updateDishIngredients does not crash', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.writes, 0)
})

test('web update dish ingredients validates required params and ingredient data', async () => {
  const cases = [
    {
      title: 'missing merchant',
      payload: { dish_id: 'dish_001', ingredients: createValidIngredients(1) },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing dish',
      payload: { merchant_id: 'merchant_001', ingredients: createValidIngredients(1) },
      expectedCode: 'INVALID_PARAMS'
    },
    {
      title: 'missing ingredients',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001' },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'ingredients not array',
      payload: { merchant_id: 'merchant_001', dish_id: 'dish_001', ingredients: {} },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'empty name',
      payload: {
        merchant_id: 'merchant_001',
        dish_id: 'dish_001',
        ingredients: createValidIngredients(1, { name: '   ' })
      },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'negative amount',
      payload: {
        merchant_id: 'merchant_001',
        dish_id: 'dish_001',
        ingredients: createValidIngredients(1, { amount: -1 })
      },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'non numeric amount',
      payload: {
        merchant_id: 'merchant_001',
        dish_id: 'dish_001',
        ingredients: createValidIngredients(1, { amount: 'bad' })
      },
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      title: 'invalid enabled',
      payload: {
        merchant_id: 'merchant_001',
        dish_id: 'dish_001',
        ingredients: createValidIngredients(1, { enabled: 'true' })
      },
      expectedCode: 'VALIDATION_ERROR'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishIngredients',
      admin_token: createWebToken(),
      ...item.payload
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish ingredients validates existing dish ownership', async () => {
  const cases = [
    {
      title: 'missing dish',
      dish_id: 'missing_dish',
      expectedCode: 'NOT_FOUND'
    },
    {
      title: 'other merchant dish',
      dish_id: 'dish_other',
      expectedCode: 'FORBIDDEN'
    }
  ]

  for (const item of cases) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action: 'updateDishIngredients',
      merchant_id: 'merchant_001',
      dish_id: item.dish_id,
      ingredients: createValidIngredients(1),
      admin_token: createWebToken()
    })

    assert.equal(result.success, false, item.title)
    assert.equal(result.code, item.expectedCode, item.title)
    assert.equal(state.writes, 0, item.title)
  }
})

test('web update dish ingredients only updates ingredients and updated_at', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageDishHandler(deps)
  const originalDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  const originalCreatedAt = new Date('2020-01-01T00:00:00.000Z')
  originalDish.created_at = originalCreatedAt
  originalDish.status = 'on_sale'
  originalDish.name = 'Original Name'
  originalDish.category_id = 'category_001'
  originalDish.price_cent = 2990
  originalDish.description = 'Original Description'
  originalDish.image_url = 'https://example.com/original.jpg'
  originalDish.tutorials = createValidTutorials(1)
  originalDish.spec_groups = createValidSpecGroups()
  originalDish.addon_groups = createValidAddonGroups()
  const ingredients = createValidIngredients(1, {
    name: 'Only Ingredients'
  })

  const result = await handler({
    action: 'updateDishIngredients',
    merchant_id: 'merchant_001',
    dish_id: 'dish_001',
    ingredients,
    name: 'Injected Name',
    category_id: 'category_other',
    price_cent: 1,
    description: 'Injected Description',
    image_url: 'https://example.com/injected.jpg',
    status: 'off_sale',
    sort_order: 99,
    created_at: new Date('2000-01-01T00:00:00.000Z'),
    data: {
      merchant_id: 'merchant_002',
      dish_id: 'evil_dish',
      name: 'Nested Name',
      category_id: 'category_other',
      price_cent: 2,
      tutorials: [],
      spec_groups: [],
      addon_groups: []
    },
    admin_token: createWebToken()
  })

  const updatedDish = state.dishes.find((dish) => dish.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(updatedDish.ingredients, ingredients)
  assert.equal(updatedDish.updated_at, FIXED_NOW)
  assert.equal(updatedDish.merchant_id, 'merchant_001')
  assert.equal(updatedDish.dish_id, 'dish_001')
  assert.equal(updatedDish.created_at, originalCreatedAt)
  assert.equal(updatedDish.status, 'on_sale')
  assert.equal(updatedDish.name, 'Original Name')
  assert.equal(updatedDish.category_id, 'category_001')
  assert.equal(updatedDish.price_cent, 2990)
  assert.equal(updatedDish.description, 'Original Description')
  assert.equal(updatedDish.image_url, 'https://example.com/original.jpg')
  assert.deepEqual(updatedDish.tutorials, createValidTutorials(1))
  assert.deepEqual(updatedDish.spec_groups, createValidSpecGroups())
  assert.deepEqual(updatedDish.addon_groups, createValidAddonGroups())
  assert.deepEqual(Object.keys(state.updateCalls[0].updateData).sort(), [
    'ingredients',
    'updated_at'
  ])
})

test('web token cannot call unexposed dish write actions in this phase', async () => {
  const writeActions = ['create', 'update', 'onSale', 'offSale', 'sort']

  for (const action of writeActions) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageDishHandler(deps)

    const result = await handler({
      action,
      merchant_id: 'merchant_001',
      dish_id: 'dish_001',
      data: {
        category_id: 'category_001',
        name: 'Blocked',
        price_cent: 1990,
        dishes: [
          {
            dish_id: 'dish_001',
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

test('user without active merchant staff permission cannot manage dishes', async () => {
  const { deps } = createDependencies({
    merchantStaff: []
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('create adds an on_sale dish with database price in cents', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '海带豆腐汤套餐',
      description: '清爽轻负担',
      price_cent: 1890,
      tags: ['清爽']
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.dish.dish_id, 'dish_new_1')
  assert.equal(result.data.dish.price_cent, 1890)
  assert.equal(result.data.dish.status, 'on_sale')
  assert.equal(result.data.dish.stock_enabled, false)
  assert.equal(result.data.dish.stock_count, 0)
  assert.equal(result.data.dish.sold_out, false)
  assert.deepEqual(result.data.dish.spec_groups, [])
  assert.deepEqual(result.data.dish.addon_groups, [])
  assert.deepEqual(result.data.dish.tutorials, [])
  assert.deepEqual(result.data.dish.ingredients, [])
  assert.equal(result.data.dish.has_options, false)
  assert.equal(state.dishes.some((dish) => dish.dish_id === 'dish_new_1'), true)
  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.deepEqual(createdDish.spec_groups, [])
  assert.deepEqual(createdDish.addon_groups, [])
  assert.deepEqual(createdDish.tutorials, [])
  assert.deepEqual(createdDish.ingredients, [])
})

test('create saves valid spec_groups and addon_groups', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const specGroups = createValidSpecGroups()
  const addonGroups = createValidAddonGroups()

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '可选规格拌饭',
      price_cent: 2990,
      spec_groups: specGroups,
      addon_groups: addonGroups
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.spec_groups, specGroups)
  assert.deepEqual(result.data.dish.addon_groups, addonGroups)
  assert.equal(result.data.dish.has_options, true)
  assert.deepEqual(createdDish.spec_groups, specGroups)
  assert.deepEqual(createdDish.addon_groups, addonGroups)
})

test('create saves one tutorial reference', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const tutorials = createValidTutorials(1)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '带教程餐品',
      price_cent: 2990,
      tutorials
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.tutorials.length, 1)
  assert.equal(result.data.dish.tutorials[0].platform, 'douyin')
  assert.deepEqual(createdDish.tutorials, result.data.dish.tutorials)
})

test('create saves up to three tutorial references', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const tutorials = createValidTutorials(3)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '三条教程餐品',
      price_cent: 2990,
      tutorials
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.tutorials.length, 3)
  assert.equal(createdDish.tutorials.length, 3)
})

test('create saves dish ingredients without affecting options or tutorials', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const specGroups = createValidSpecGroups()
  const addonGroups = createValidAddonGroups()
  const tutorials = createValidTutorials(1)
  const ingredients = createValidIngredients(2)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '带食材配置餐品',
      price_cent: 2990,
      spec_groups: specGroups,
      addon_groups: addonGroups,
      tutorials,
      ingredients
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.ingredients, ingredients)
  assert.deepEqual(result.data.dish.spec_groups, specGroups)
  assert.deepEqual(result.data.dish.addon_groups, addonGroups)
  assert.equal(result.data.dish.tutorials.length, 1)
  assert.deepEqual(createdDish.ingredients, ingredients)
})

test('create filters empty ingredients and normalizes optional ingredient fields', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '过滤空食材餐品',
      price_cent: 2990,
      ingredients: [
        {},
        {
          name: '  鸡蛋  ',
          amount: '1.5',
          unit: ' 个 ',
          category: '',
          note: '  可不加  ',
          enabled: false
        }
      ]
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.ingredients, [
    {
      name: '鸡蛋',
      amount: 1.5,
      unit: '个',
      category: '其他',
      note: '可不加',
      enabled: false,
      sort_order: 1
    }
  ])
  assert.deepEqual(createdDish.ingredients, result.data.dish.ingredients)
})

test('create fails when ingredients is not an array', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '错误食材餐品',
      price_cent: 2990,
      ingredients: {}
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create filters empty tutorials and fills default title', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '默认标题教程餐品',
      price_cent: 2990,
      tutorials: [
        { title: '', platform: 'bilibili', url: 'BV123', note: '', enabled: true },
        { title: '', platform: 'douyin', url: '', note: '', enabled: true }
      ]
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.tutorials.length, 1)
  assert.equal(result.data.dish.tutorials[0].title, '做法参考 1')
  assert.equal(result.data.dish.tutorials[0].platform, 'bilibili')
  assert.deepEqual(createdDish.tutorials, result.data.dish.tutorials)
})

test('create fails when tutorials is not an array', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '教程字段错误餐品',
      price_cent: 1990,
      tutorials: {}
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when tutorials exceed three meaningful entries', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '教程过多餐品',
      price_cent: 1990,
      tutorials: createValidTutorials(4)
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create accepts stock fields when values are valid', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '限量拌饭',
      price_cent: 2990,
      stock_enabled: true,
      stock_count: 8,
      sold_out: true
    }
  })

  const createdDish = state.dishes.find((dish) => dish.dish_id === 'dish_new_1')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.stock_enabled, true)
  assert.equal(result.data.dish.stock_count, 8)
  assert.equal(result.data.dish.sold_out, true)
  assert.equal(createdDish.stock_enabled, true)
  assert.equal(createdDish.stock_count, 8)
  assert.equal(createdDish.sold_out, true)
})

test('create fails when stock_enabled is not boolean', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '库存开关错误餐品',
      price_cent: 1990,
      stock_enabled: 'true'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when stock_count is not a non-negative integer', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '库存数量错误餐品',
      price_cent: 1990,
      stock_count: -1
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when sold_out is not boolean', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '售罄开关错误餐品',
      price_cent: 1990,
      sold_out: 'false'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when category belongs to another merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_other',
      name: '越权餐品',
      price_cent: 1990
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(result.message, '分类不可用，不能绑定餐品')
})

test('create fails when category is inactive', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_inactive',
      name: '停用分类餐品',
      price_cent: 1990
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(result.message, '分类不可用，不能绑定餐品')
})

test('create fails when category enabled is false', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_disabled',
      name: '禁用分类餐品',
      price_cent: 1990
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(result.message, '分类不可用，不能绑定餐品')
})

test('update changes a dish that belongs to the requested merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      name: '本店招牌肥牛拌饭',
      price_cent: 3190,
      tags: ['招牌推荐']
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.dish.name, '本店招牌肥牛拌饭')
  assert.equal(result.data.dish.price_cent, 3190)
  assert.deepEqual(result.data.dish.tags, ['招牌推荐'])
})

test('update can modify tutorial title and platform', async () => {
  const { state, deps } = createDependencies({
    dishes: [
      {
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '已有教程餐品',
        price_cent: 2990,
        status: 'on_sale',
        sort_order: 1,
        tutorials: createValidTutorials(1)
      }
    ]
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      tutorials: [
        {
          title: '新版做法',
          platform: 'bilibili',
          url: 'BV999',
          note: '重点看火候',
          enabled: true,
          sort_order: 1
        }
      ]
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.tutorials[0].title, '新版做法')
  assert.equal(result.data.dish.tutorials[0].platform, 'bilibili')
  assert.deepEqual(dish.tutorials, result.data.dish.tutorials)
})

test('update can delete tutorials by saving an empty list', async () => {
  const { state, deps } = createDependencies({
    dishes: [
      {
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '可删除教程餐品',
        price_cent: 2990,
        status: 'on_sale',
        sort_order: 1,
        tutorials: createValidTutorials(2)
      }
    ]
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      tutorials: []
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.tutorials, [])
  assert.deepEqual(dish.tutorials, [])
})

test('update can modify and delete ingredients', async () => {
  const { state, deps } = createDependencies({
    dishes: [
      {
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '已有食材餐品',
        price_cent: 2990,
        status: 'on_sale',
        sort_order: 1,
        ingredients: createValidIngredients(2)
      }
    ]
  })
  const handler = createManageDishHandler(deps)
  const nextIngredients = [
    {
      name: '牛肉片',
      amount: 180,
      unit: 'g',
      category: '肉类',
      note: '加量',
      enabled: true,
      sort_order: 1
    }
  ]

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      ingredients: nextIngredients
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.ingredients, nextIngredients)
  assert.deepEqual(dish.ingredients, nextIngredients)
})

test('update saves valid spec_groups and addon_groups', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const specGroups = createValidSpecGroups({
    group_id: 'spicy',
    name: '辣度',
    options: [
      {
        option_id: 'medium',
        name: '中辣',
        price_delta_cent: 100,
        enabled: true,
        sort_order: 1
      }
    ]
  })
  const addonGroups = createValidAddonGroups()

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      spec_groups: specGroups,
      addon_groups: addonGroups
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.spec_groups, specGroups)
  assert.deepEqual(result.data.dish.addon_groups, addonGroups)
  assert.equal(result.data.dish.has_options, true)
  assert.deepEqual(dish.spec_groups, specGroups)
  assert.deepEqual(dish.addon_groups, addonGroups)
})

test('update root option groups can be read back from list', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const specGroups = createValidSpecGroups()
  const addonGroups = createValidAddonGroups()

  const updateResult = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    spec_groups: specGroups,
    addon_groups: addonGroups
  })

  const listResult = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })
  const item = listResult.data.list.find((dish) => dish.dish_id === 'dish_001')

  assert.equal(updateResult.success, true)
  assert.equal(listResult.success, true)
  assert.equal(item.spec_groups.length, 1)
  assert.equal(item.addon_groups.length, 1)
  assert.equal(item.has_options, true)
})

test('update nested dish option groups by document id can be read back from list', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)
  const specGroups = createValidSpecGroups()
  const addonGroups = createValidAddonGroups()

  const updateResult = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'doc_dish_001',
    dish: {
      spec_groups: specGroups,
      addon_groups: addonGroups
    }
  })

  const listResult = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })
  const item = listResult.data.list.find((dish) => dish.dish_id === 'dish_001')
  const forbiddenFields = ['action', 'merchant_id', 'dish_id', 'dish', '_id', 'created_at', 'stock']
  const updateData = state.updateCalls[0].updateData

  assert.equal(updateResult.success, true)
  assert.equal(state.updateCalls[0].dish_id, 'dish_001')
  assert.equal(listResult.success, true)
  assert.equal(item.spec_groups.length, 1)
  assert.equal(item.addon_groups.length, 1)
  assert.equal(item.has_options, true)
  forbiddenFields.forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(updateData, field), false)
  })
})

test('update without option groups does not clear existing option groups', async () => {
  const specGroups = createValidSpecGroups()
  const addonGroups = createValidAddonGroups()
  const { state, deps } = createDependencies({
    dishes: [
      {
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '已有规格餐品',
        price_cent: 2990,
        status: 'on_sale',
        sort_order: 1,
        spec_groups: specGroups,
        addon_groups: addonGroups
      }
    ]
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      name: '更新名称'
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.deepEqual(result.data.dish.spec_groups, specGroups)
  assert.deepEqual(result.data.dish.addon_groups, addonGroups)
  assert.deepEqual(dish.spec_groups, specGroups)
  assert.deepEqual(dish.addon_groups, addonGroups)
})

test('list returns has_options true when dish has specs or addons', async () => {
  const { deps } = createDependencies({
    dishes: [
      {
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '可选规格餐品',
        price_cent: 2990,
        status: 'on_sale',
        sort_order: 1,
        spec_groups: createValidSpecGroups(),
        addon_groups: []
      }
    ]
  })
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'list'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list[0].has_options, true)
  assert.deepEqual(result.data.list[0].addon_groups, [])
})

test('create fails when spec_groups is not an array', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '规格错误餐品',
      price_cent: 1990,
      spec_groups: {}
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when addon_groups is not an array', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '加料错误餐品',
      price_cent: 1990,
      addon_groups: {}
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when group_id is empty', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '空规格组餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({ group_id: '' })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when group_id is duplicated', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '重复规格组餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups().concat(createValidSpecGroups())
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when group name is empty', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '空组名餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({ name: '' })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when required is not boolean', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '必选错误餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({ required: 'true' })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when options is not an array', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '选项错误餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({ options: {} })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when option_id is empty', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '空选项餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({
        options: [{ option_id: '', name: '标准份', price_delta_cent: 0, enabled: true, sort_order: 1 }]
      })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when option_id is duplicated inside one group', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '重复选项餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({
        options: [
          { option_id: 'normal', name: '标准份', price_delta_cent: 0, enabled: true, sort_order: 1 },
          { option_id: 'normal', name: '大份', price_delta_cent: 300, enabled: true, sort_order: 2 }
        ]
      })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when option name is empty', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '空选项名餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({
        options: [{ option_id: 'normal', name: '', price_delta_cent: 0, enabled: true, sort_order: 1 }]
      })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when price_delta_cent is negative', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '负加价餐品',
      price_cent: 1990,
      addon_groups: createValidAddonGroups({
        options: [{ option_id: 'egg', name: '加蛋', price_delta_cent: -1, enabled: true, sort_order: 1 }]
      })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when price_delta_cent is not an integer', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '小数加价餐品',
      price_cent: 1990,
      addon_groups: createValidAddonGroups({
        options: [{ option_id: 'egg', name: '加蛋', price_delta_cent: 1.5, enabled: true, sort_order: 1 }]
      })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when enabled is not boolean', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '启用错误餐品',
      price_cent: 1990,
      addon_groups: createValidAddonGroups({
        options: [{ option_id: 'egg', name: '加蛋', price_delta_cent: 200, enabled: 'true', sort_order: 1 }]
      })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when max_select is smaller than min_select', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '选择数量错误餐品',
      price_cent: 1990,
      addon_groups: createValidAddonGroups({ min_select: 2, max_select: 1 })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when spec max_select is not 1', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '多选规格餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({ max_select: 2 })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('create fails when sort_order is not a number', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '排序错误餐品',
      price_cent: 1990,
      spec_groups: createValidSpecGroups({ sort_order: '1' })
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('update stock_enabled succeeds', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      stock_enabled: true
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.stock_enabled, true)
  assert.equal(dish.stock_enabled, true)
})

test('update stock_count succeeds', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      stock_count: 12
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.stock_count, 12)
  assert.equal(dish.stock_count, 12)
})

test('update sold_out succeeds', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      sold_out: true
    }
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(result.data.dish.sold_out, true)
  assert.equal(dish.sold_out, true)
})

test('update fails when stock_count is invalid', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      stock_count: 2.5
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('update status sold_out fails validation', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      status: 'sold_out'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('update fails when moving dish to inactive category', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      category_id: 'category_inactive'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(result.message, '分类不可用，不能绑定餐品')
})

test('update succeeds when moving dish to active category', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_001',
    data: {
      category_id: 'category_001'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.dish.category_id, 'category_001')
})

test('onSale marks a dish on sale', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'onSale',
    dish_id: 'dish_002'
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_002')
  assert.equal(result.success, true)
  assert.equal(dish.status, 'on_sale')
})

test('offSale marks a dish off sale', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'offSale',
    dish_id: 'dish_001'
  })

  const dish = state.dishes.find((item) => item.dish_id === 'dish_001')
  assert.equal(result.success, true)
  assert.equal(dish.status, 'off_sale')
})

test('sort updates sort_order for dishes in the same merchant', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'sort',
    data: {
      dishes: [
        { dish_id: 'dish_001', sort_order: 20 },
        { dish_id: 'dish_002', sort_order: 10 }
      ]
    }
  })

  const first = state.dishes.find((item) => item.dish_id === 'dish_001')
  const second = state.dishes.find((item) => item.dish_id === 'dish_002')
  assert.equal(result.success, true)
  assert.equal(first.sort_order, 20)
  assert.equal(second.sort_order, 10)
})

test('cannot manage dishes that belong to another merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'update',
    dish_id: 'dish_other',
    data: {
      name: '越权修改'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('non-integer price_cent fails validation', async () => {
  const { deps } = createDependencies()
  const handler = createManageDishHandler(deps)

  const result = await handler({
    merchant_id: 'merchant_001',
    action: 'create',
    data: {
      category_id: 'category_001',
      name: '错误价格餐品',
      price_cent: 19.9
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})
