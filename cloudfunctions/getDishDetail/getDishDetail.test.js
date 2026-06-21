const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetDishDetailHandler } = require('./dish-detail-service')

function createSpecGroups() {
  return [
    {
      group_id: 'spicy',
      name: '辣度',
      required: false,
      min_select: 0,
      max_select: 1,
      sort_order: 2,
      options: [
        {
          option_id: 'hot',
          name: '特辣',
          price_delta_cent: 100,
          enabled: false,
          sort_order: 2
        },
        {
          option_id: 'medium',
          name: '中辣',
          price_delta_cent: 0,
          enabled: true,
          sort_order: 1
        }
      ]
    },
    {
      group_id: 'size',
      name: '规格',
      required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      options: [
        {
          option_id: 'large',
          name: '大份',
          price_delta_cent: 300,
          enabled: true,
          sort_order: 2
        },
        {
          option_id: 'normal',
          name: '标准份',
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
      name: '加料',
      required: false,
      min_select: 0,
      max_select: 3,
      sort_order: 1,
      options: [
        {
          option_id: 'cheese',
          name: '加芝士',
          price_delta_cent: 300,
          enabled: false,
          sort_order: 2
        },
        {
          option_id: 'egg',
          name: '加蛋',
          price_delta_cent: 200,
          enabled: true,
          sort_order: 1
        }
      ]
    }
  ]
}

function createDetailHandlerWithDish(dish) {
  return createGetDishDetailHandler({
    findDishById: async () => dish,
    findCategoryById: async () => null,
    findDishIngredientLinks: async () => [],
    findIngredientsByIds: async () => [],
    findProductionSteps: async () => []
  })
}

async function getFormattedDish(dish) {
  const getDishDetail = createDetailHandlerWithDish(dish)
  const result = await getDishDetail({ dish_id: dish.dish_id || dish._id })
  assert.equal(result.success, true)
  return result.data.dish
}

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
      sold_out: false,
      spec_groups: createSpecGroups(),
      addon_groups: createAddonGroups()
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
  assert.equal(result.data.dish.has_options, true)
  assert.deepEqual(
    result.data.dish.spec_groups.map((group) => group.group_id),
    ['size', 'spicy']
  )
  assert.deepEqual(
    result.data.dish.spec_groups[0].options.map((option) => option.option_id),
    ['normal', 'large']
  )
  assert.deepEqual(
    result.data.dish.spec_groups[1].options.map((option) => option.option_id),
    ['medium']
  )
  assert.deepEqual(
    result.data.dish.addon_groups[0].options.map((option) => option.option_id),
    ['egg']
  )
  assert.equal(result.data.category.name, '招牌推荐')
  assert.equal(result.data.ingredients[0].name, '肥牛')
  assert.deepEqual(
    result.data.production_steps.map((step) => step.step_index),
    [1, 2]
  )
})

test('getDishDetail returns empty option groups and has_options false for legacy dishes', async () => {
  const dish = await getFormattedDish({
    dish_id: 'dish_legacy',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Legacy Dish',
    price_cent: 2990,
    status: 'on_sale'
  })

  assert.deepEqual(dish.spec_groups, [])
  assert.deepEqual(dish.addon_groups, [])
  assert.equal(dish.has_options, false)
})

test('getDishDetail filters disabled options and sorts option groups and options', async () => {
  const dish = await getFormattedDish({
    dish_id: 'dish_options',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Option Dish',
    price_cent: 2990,
    status: 'on_sale',
    spec_groups: createSpecGroups(),
    addon_groups: [
      {
        group_id: 'sauce',
        name: 'Sauce',
        required: false,
        min_select: 0,
        max_select: 1,
        sort_order: 2,
        options: [
          {
            option_id: 'bbq',
            name: 'BBQ',
            price_delta_cent: 100,
            enabled: true,
            sort_order: 2
          },
          {
            option_id: 'tomato',
            name: 'Tomato',
            price_delta_cent: 0,
            enabled: true,
            sort_order: 1
          }
        ]
      },
      {
        group_id: 'extra',
        name: 'Extra',
        required: false,
        min_select: 0,
        max_select: 3,
        sort_order: 1,
        options: [
          {
            option_id: 'cheese',
            name: 'Cheese',
            price_delta_cent: 300,
            enabled: false,
            sort_order: 2
          },
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
  })

  assert.equal(dish.has_options, true)
  assert.deepEqual(
    dish.spec_groups.map((group) => group.group_id),
    ['size', 'spicy']
  )
  assert.deepEqual(
    dish.spec_groups[0].options.map((option) => option.option_id),
    ['normal', 'large']
  )
  assert.deepEqual(
    dish.spec_groups[1].options.map((option) => option.option_id),
    ['medium']
  )
  assert.deepEqual(
    dish.addon_groups.map((group) => group.group_id),
    ['extra', 'sauce']
  )
  assert.deepEqual(
    dish.addon_groups[0].options.map((option) => option.option_id),
    ['egg']
  )
  assert.deepEqual(
    dish.addon_groups[1].options.map((option) => option.option_id),
    ['tomato', 'bbq']
  )
})

test('getDishDetail keeps stock and sold out fields when returning option groups', async () => {
  const dish = await getFormattedDish({
    dish_id: 'dish_stock_options',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Stock Option Dish',
    price_cent: 2990,
    status: 'on_sale',
    stock_enabled: true,
    stock_count: 0,
    sold_out: true,
    spec_groups: createSpecGroups()
  })

  assert.equal(dish.stock_enabled, true)
  assert.equal(dish.stock_count, 0)
  assert.equal(dish.sold_out, true)
  assert.equal(dish.has_options, true)
})

test('getDishDetail can return off_sale dish detail without changing original logic', async () => {
  const dish = await getFormattedDish({
    dish_id: 'dish_off_sale',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Off Sale Dish',
    price_cent: 2990,
    status: 'off_sale',
    spec_groups: createSpecGroups()
  })

  assert.equal(dish.status, 'off_sale')
  assert.equal(dish.has_options, true)
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
  assert.deepEqual(result.data.dish.spec_groups, [])
  assert.deepEqual(result.data.dish.addon_groups, [])
  assert.equal(result.data.dish.has_options, false)
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
