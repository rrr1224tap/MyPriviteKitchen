const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetMenuHandler } = require('./menu-service')

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
  assert.equal(soldOutDish.sold_out, true)
  assert.equal(zeroStockDish.stock_enabled, true)
  assert.equal(zeroStockDish.stock_count, 0)
  assert.equal(legacyDish.stock_enabled, false)
  assert.equal(legacyDish.stock_count, 0)
  assert.equal(legacyDish.sold_out, false)
  assert.equal(result.data.categories[1].dishes.length, 0)
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
