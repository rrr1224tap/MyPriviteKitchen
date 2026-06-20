const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetDishDetailHandler } = require('./dish-detail-service')

test('getDishDetail returns dish detail with category, ingredients, and production steps', async () => {
  const getDishDetail = createGetDishDetailHandler({
    findDishById: async () => ({
      _id: 'dish_001',
      dish_id: 'dish_001',
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: '招牌肥牛石锅拌饭',
      description: '肥牛现炒，锅巴焦香，拌匀更好吃',
      detail_description: '现炒好味，认真对待每一碗热饭。',
      image_url: '',
      price_cent: 2990,
      original_price_cent: 3290,
      tags: ['招牌推荐', '人气TOP1'],
      status: 'on_sale',
      stock_enabled: true,
      stock_count: 8,
      sold_out: false
    }),
    findCategoryById: async () => ({
      _id: 'category_001',
      category_id: 'category_001',
      name: '招牌推荐'
    }),
    findDishIngredientLinks: async () => [
      {
        dish_id: 'dish_001',
        ingredient_id: 'ingredient_001',
        quantity_per_dish: 120,
        unit: 'g'
      }
    ],
    findIngredientsByIds: async () => [
      {
        _id: 'ingredient_001',
        ingredient_id: 'ingredient_001',
        name: '肥牛',
        unit: 'g',
        status: 'active'
      }
    ],
    findProductionSteps: async () => [
      { step_index: 2, title: '出餐', description: '装碗出餐' },
      { step_index: 1, title: '现炒', description: '肥牛现炒' }
    ]
  })

  const result = await getDishDetail({
    dish_id: 'dish_001',
    merchant_id: 'merchant_001'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.dish.name, '招牌肥牛石锅拌饭')
  assert.equal(result.data.dish.stock_enabled, true)
  assert.equal(result.data.dish.stock_count, 8)
  assert.equal(result.data.dish.sold_out, false)
  assert.equal(result.data.category.name, '招牌推荐')
  assert.equal(result.data.ingredients[0].name, '肥牛')
  assert.deepEqual(
    result.data.production_steps.map((step) => step.step_index),
    [1, 2]
  )
})

test('getDishDetail keeps optional collections as empty arrays when optional queries fail', async () => {
  const getDishDetail = createGetDishDetailHandler({
    findDishById: async () => ({
      dish_id: 'dish_001',
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: '招牌肥牛石锅拌饭',
      price_cent: 2990,
      status: 'on_sale'
    }),
    findCategoryById: async () => null,
    findDishIngredientLinks: async () => {
      throw new Error('collection not found')
    },
    findIngredientsByIds: async () => {
      throw new Error('collection not found')
    },
    findProductionSteps: async () => {
      throw new Error('collection not found')
    },
    logError: () => {}
  })

  const result = await getDishDetail({ dish_id: 'dish_001' })

  assert.equal(result.success, true)
  assert.equal(result.data.dish.stock_enabled, false)
  assert.equal(result.data.dish.stock_count, 0)
  assert.equal(result.data.dish.sold_out, false)
  assert.deepEqual(result.data.ingredients, [])
  assert.deepEqual(result.data.production_steps, [])
})

test('getDishDetail returns sold out on_sale dish detail without writing database', async () => {
  let writeCalled = false
  const getDishDetail = createGetDishDetailHandler({
    findDishById: async () => ({
      dish_id: 'dish_sold_out',
      merchant_id: 'merchant_001',
      category_id: 'category_001',
      name: '手动售罄餐品',
      price_cent: 2990,
      status: 'on_sale',
      stock_enabled: false,
      stock_count: 0,
      sold_out: true
    }),
    findCategoryById: async () => null,
    findDishIngredientLinks: async () => [],
    findIngredientsByIds: async () => [],
    findProductionSteps: async () => [],
    updateDish: async () => {
      writeCalled = true
    }
  })

  const result = await getDishDetail({ dish_id: 'dish_sold_out' })

  assert.equal(result.success, true)
  assert.equal(result.data.dish.sold_out, true)
  assert.equal(writeCalled, false)
})

test('getDishDetail returns INVALID_PARAMS when dish_id is missing', async () => {
  const getDishDetail = createGetDishDetailHandler({
    findDishById: async () => null,
    findCategoryById: async () => null,
    findDishIngredientLinks: async () => [],
    findIngredientsByIds: async () => [],
    findProductionSteps: async () => []
  })

  const result = await getDishDetail({})

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('getDishDetail returns NOT_FOUND when dish is missing', async () => {
  const getDishDetail = createGetDishDetailHandler({
    findDishById: async () => null,
    findCategoryById: async () => null,
    findDishIngredientLinks: async () => [],
    findIngredientsByIds: async () => [],
    findProductionSteps: async () => []
  })

  const result = await getDishDetail({ dish_id: 'missing' })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})
