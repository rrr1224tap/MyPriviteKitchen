const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetMenuHandler } = require('./menu-service')

function createMenuHandlerWithDishes(dishes) {
  return createGetMenuHandler({
    findMerchantById: async () => ({
      _id: 'merchant_001',
      merchant_id: 'merchant_001',
      name: 'Test Merchant',
      status: 'active'
    }),
    findCategoriesByMerchantId: async () => [
      {
        _id: 'category_001',
        category_id: 'category_001',
        merchant_id: 'merchant_001',
        name: 'Recommended',
        status: 'active',
        sort_order: 1
      }
    ],
    findDishesByMerchantId: async () => dishes
  })
}

async function getFirstCategoryDishes(dishes) {
  const getMenu = createMenuHandlerWithDishes(dishes)
  const result = await getMenu({ merchant_id: 'merchant_001' })
  assert.equal(result.success, true)
  return result.data.categories[0].dishes
}

function createBaseDish(overrides = {}) {
  return {
    _id: overrides.dish_id || 'dish_001',
    dish_id: overrides.dish_id || 'dish_001',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Test Dish',
    price_cent: 2990,
    status: 'on_sale',
    sort_order: 1,
    ...overrides
  }
}

function createSpecGroups() {
  return [
    {
      group_id: 'size',
      name: 'Size',
      required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      options: [
        {
          option_id: 'normal',
          name: 'Normal',
          price_delta_cent: 0,
          enabled: true,
          sort_order: 1
        }
      ]
    }
  ]
}

function createAddonGroups() {
  return [
    {
      group_id: 'extra',
      name: 'Extra',
      required: false,
      min_select: 0,
      max_select: 3,
      sort_order: 1,
      options: [
        {
          option_id: 'egg',
          name: 'Egg',
          price_delta_cent: 200,
          enabled: true,
          sort_order: 1
        }
      ]
    }
  ]
}

test('getMenu returns active categories and on_sale dishes grouped by category', async () => {
  const getMenu = createGetMenuHandler({
    findMerchantById: async () => ({
      _id: 'merchant_001',
      merchant_id: 'merchant_001',
      name: '三也拌饭',
      status: 'active',
      business_status: 'open'
    }),
    findCategoriesByMerchantId: async () => [
      {
        _id: 'category_002',
        category_id: 'category_002',
        merchant_id: 'merchant_001',
        name: '饮品',
        status: 'active',
        sort_order: 2
      },
      {
        _id: 'category_hidden',
        category_id: 'category_hidden',
        merchant_id: 'merchant_001',
        name: '隐藏分类',
        status: 'disabled',
        sort_order: 3
      },
      {
        _id: 'category_001',
        category_id: 'category_001',
        merchant_id: 'merchant_001',
        name: '招牌推荐',
        enabled: true,
        sort_order: 1
      }
    ],
    findDishesByMerchantId: async () => [
      {
        _id: 'dish_002',
        dish_id: 'dish_002',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '招牌肥牛石锅拌饭',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 12,
        sold_out: false,
        spec_groups: [
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
            ]
          }
        ],
        sort_order: 2
      },
      {
        _id: 'dish_sold_out',
        dish_id: 'dish_sold_out',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '手动售罄餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: false,
        stock_count: 0,
        sold_out: true,
        addon_groups: [
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
            ]
          }
        ],
        sort_order: 3
      },
      {
        _id: 'dish_zero_stock',
        dish_id: 'dish_zero_stock',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '库存售罄餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 0,
        sold_out: false,
        spec_groups: [
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
            ]
          }
        ],
        addon_groups: [
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
            ]
          }
        ],
        sort_order: 4
      },
      {
        _id: 'dish_legacy',
        dish_id: 'dish_legacy',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '历史旧餐品',
        price_cent: 2990,
        status: 'on_sale',
        sort_order: 5
      },
      {
        _id: 'dish_off_sale',
        dish_id: 'dish_off_sale',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '下架餐品',
        price_cent: 1990,
        status: 'off_sale',
        sort_order: 1
      },
      {
        _id: 'dish_hidden_category',
        dish_id: 'dish_hidden_category',
        merchant_id: 'merchant_001',
        category_id: 'category_hidden',
        name: '隐藏分类餐品',
        price_cent: 990,
        status: 'on_sale',
        sort_order: 1
      }
    ]
  })

  const result = await getMenu({ merchant_id: 'merchant_001' })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.merchant.name, '三也拌饭')
  assert.equal(result.data.categories.length, 2)
  assert.equal(result.data.categories[0].category_id, 'category_001')
  assert.deepEqual(
    result.data.categories[0].dishes.map((dish) => dish.dish_id),
    ['dish_002', 'dish_sold_out', 'dish_zero_stock', 'dish_legacy']
  )
  const [normalDish, soldOutDish, zeroStockDish, legacyDish] = result.data.categories[0].dishes
  assert.equal(normalDish.stock_enabled, true)
  assert.equal(normalDish.stock_count, 12)
  assert.equal(normalDish.sold_out, false)
  assert.equal(normalDish.has_options, true)
  assert.equal(Object.prototype.hasOwnProperty.call(normalDish, 'spec_groups'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(normalDish, 'addon_groups'), false)
  assert.equal(soldOutDish.sold_out, true)
  assert.equal(soldOutDish.has_options, true)
  assert.equal(zeroStockDish.stock_enabled, true)
  assert.equal(zeroStockDish.stock_count, 0)
  assert.equal(zeroStockDish.has_options, true)
  assert.equal(legacyDish.stock_enabled, false)
  assert.equal(legacyDish.stock_count, 0)
  assert.equal(legacyDish.sold_out, false)
  assert.equal(legacyDish.has_options, false)
  assert.equal(result.data.categories[1].dishes.length, 0)
})

test('getMenu returns has_options false for legacy dishes without option groups', async () => {
  const dishes = await getFirstCategoryDishes([
    createBaseDish({ dish_id: 'dish_legacy' })
  ])

  assert.equal(dishes[0].has_options, false)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'spec_groups'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'addon_groups'), false)
})

test('getMenu returns has_options true when a dish has only spec_groups', async () => {
  const dishes = await getFirstCategoryDishes([
    createBaseDish({
      dish_id: 'dish_spec',
      spec_groups: createSpecGroups()
    })
  ])

  assert.equal(dishes[0].has_options, true)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'spec_groups'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'addon_groups'), false)
})

test('getMenu returns has_options true when a dish has only addon_groups', async () => {
  const dishes = await getFirstCategoryDishes([
    createBaseDish({
      dish_id: 'dish_addon',
      addon_groups: createAddonGroups()
    })
  ])

  assert.equal(dishes[0].has_options, true)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'spec_groups'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'addon_groups'), false)
})

test('getMenu returns has_options true when a dish has both spec_groups and addon_groups', async () => {
  const dishes = await getFirstCategoryDishes([
    createBaseDish({
      dish_id: 'dish_both',
      spec_groups: createSpecGroups(),
      addon_groups: createAddonGroups()
    })
  ])

  assert.equal(dishes[0].has_options, true)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'spec_groups'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(dishes[0], 'addon_groups'), false)
})

test('getMenu keeps stock fields, returns sold out dishes, and filters off sale dishes', async () => {
  const dishes = await getFirstCategoryDishes([
    createBaseDish({
      dish_id: 'dish_sold_out',
      stock_enabled: true,
      stock_count: 0,
      sold_out: true
    }),
    createBaseDish({
      dish_id: 'dish_off_sale',
      status: 'off_sale'
    })
  ])

  assert.deepEqual(
    dishes.map((dish) => dish.dish_id),
    ['dish_sold_out']
  )
  assert.equal(dishes[0].stock_enabled, true)
  assert.equal(dishes[0].stock_count, 0)
  assert.equal(dishes[0].sold_out, true)
})

test('getMenu matches dishes by category_id when category _id is a database id', async () => {
  const getMenu = createGetMenuHandler({
    findMerchantById: async () => ({
      merchant_id: 'merchant_001',
      name: 'Test Merchant',
      status: 'active'
    }),
    findCategoriesByMerchantId: async () => [
      {
        _id: '5caf1a7c6a31058001246e0566a64a48',
        category_id: 'category_001',
        merchant_id: 'merchant_001',
        name: 'Recommended',
        status: 'active',
        sort_order: 1
      },
      {
        _id: 'disabled_db_id',
        category_id: 'category_disabled',
        merchant_id: 'merchant_001',
        name: 'Disabled',
        status: 'inactive',
        sort_order: 2
      }
    ],
    findDishesByMerchantId: async () => [
      createBaseDish({
        dish_id: 'dish_business_category',
        category_id: 'category_001',
        stock_enabled: true,
        stock_count: 2,
        sold_out: false,
        spec_groups: createSpecGroups()
      }),
      createBaseDish({
        dish_id: 'dish_disabled_category',
        category_id: 'category_disabled'
      }),
      createBaseDish({
        dish_id: 'dish_off_sale',
        category_id: 'category_001',
        status: 'off_sale'
      })
    ]
  })

  const result = await getMenu({ merchant_id: 'merchant_001' })

  assert.equal(result.success, true)
  assert.equal(result.data.categories[0]._id, 'category_001')
  assert.equal(result.data.categories[0].db_id, '5caf1a7c6a31058001246e0566a64a48')
  assert.deepEqual(
    result.data.categories[0].dishes.map((dish) => dish.dish_id),
    ['dish_business_category']
  )
  assert.equal(result.data.categories[0].dishes[0].category_id, 'category_001')
  assert.equal(result.data.categories[0].dishes[0].has_options, true)
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.data.categories[0].dishes[0], 'spec_groups'),
    false
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.data.categories[0].dishes[0], 'addon_groups'),
    false
  )
})

test('getMenu still matches dishes when category only has database _id', async () => {
  const getMenu = createGetMenuHandler({
    findMerchantById: async () => ({
      merchant_id: 'merchant_001',
      name: 'Test Merchant',
      status: 'active'
    }),
    findCategoriesByMerchantId: async () => [
      {
        _id: 'category_db_only',
        merchant_id: 'merchant_001',
        name: 'Legacy Category',
        status: 'active',
        sort_order: 1
      }
    ],
    findDishesByMerchantId: async () => [
      createBaseDish({
        dish_id: 'dish_db_category',
        category_id: 'category_db_only',
        sold_out: true
      })
    ]
  })

  const result = await getMenu({ merchant_id: 'merchant_001' })

  assert.equal(result.success, true)
  assert.equal(result.data.categories[0]._id, 'category_db_only')
  assert.equal(result.data.categories[0].category_id, 'category_db_only')
  assert.deepEqual(
    result.data.categories[0].dishes.map((dish) => dish.dish_id),
    ['dish_db_category']
  )
  assert.equal(result.data.categories[0].dishes[0].sold_out, true)
})

test('getMenu uses merchant_001 when merchant_id is missing', async () => {
  let requestedMerchantId = ''
  const getMenu = createGetMenuHandler({
    findMerchantById: async (merchantId) => {
      requestedMerchantId = merchantId
      return { merchant_id: merchantId, name: '三也拌饭', status: 'active' }
    },
    findCategoriesByMerchantId: async () => [],
    findDishesByMerchantId: async () => []
  })

  const result = await getMenu({})

  assert.equal(result.success, true)
  assert.equal(requestedMerchantId, 'merchant_001')
})

test('getMenu returns NOT_FOUND when merchant is missing', async () => {
  const getMenu = createGetMenuHandler({
    findMerchantById: async () => null,
    findCategoriesByMerchantId: async () => [],
    findDishesByMerchantId: async () => []
  })

  const result = await getMenu({ merchant_id: 'missing' })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('getMenu returns SERVER_ERROR on unexpected dependency error', async () => {
  const getMenu = createGetMenuHandler({
    findMerchantById: async () => {
      throw new Error('database down')
    },
    findCategoriesByMerchantId: async () => [],
    findDishesByMerchantId: async () => [],
    logError: () => {}
  })

  const result = await getMenu({ merchant_id: 'merchant_001' })

  assert.equal(result.success, false)
  assert.equal(result.code, 'SERVER_ERROR')
})
