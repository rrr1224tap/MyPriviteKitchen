const test = require('node:test')
const assert = require('node:assert/strict')

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
  assert.equal(result.code, 'UNAUTHORIZED')
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
  assert.equal(result.code, 'UNAUTHORIZED')
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

test('web token cannot call write dish actions in this phase', async () => {
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
