const test = require('node:test')
const assert = require('node:assert/strict')

const { createManageDishHandler } = require('./dish-service')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid || 'staff_openid',
    now: options.now || new Date('2026-06-18T10:00:00.000Z'),
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
        return state.dishes.find((dish) => dish.dish_id === dishId) || null
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
        const record = {
          _id: `doc_${dish.dish_id}`,
          ...dish
        }
        state.dishes.push(record)
        return record
      },
      updateDish: async ({ dish_id, updateData }) => {
        const dish = state.dishes.find((item) => item.dish_id === dish_id)
        if (!dish) {
          return null
        }
        Object.assign(dish, updateData)
        return dish
      },
      updateDishSortList: async (items) => {
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
  assert.equal(state.dishes.some((dish) => dish.dish_id === 'dish_new_1'), true)
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
