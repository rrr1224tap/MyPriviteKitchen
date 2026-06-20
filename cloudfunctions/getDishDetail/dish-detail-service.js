const DEFAULT_MERCHANT_ID = 'merchant_001'

function success(message, data) {
  return {
    success: true,
    code: 'SUCCESS',
    message,
    data
  }
}

function failure(code, message) {
  return {
    success: false,
    code,
    message,
    data: null
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function getSortOrder(item) {
  return Number.isFinite(item.sort_order) ? item.sort_order : 0
}

function getStockCount(dish) {
  return Number.isInteger(dish.stock_count) && dish.stock_count >= 0
    ? dish.stock_count
    : 0
}

function formatDish(dish) {
  return {
    _id: dish._id || '',
    dish_id: dish.dish_id || dish._id || '',
    merchant_id: dish.merchant_id || DEFAULT_MERCHANT_ID,
    category_id: dish.category_id || '',
    name: dish.name || '',
    description: dish.description || '',
    detail_description: dish.detail_description || '',
    image_url: dish.image_url || dish.image || '',
    price_cent: Number.isFinite(dish.price_cent) ? dish.price_cent : 0,
    original_price_cent: Number.isFinite(dish.original_price_cent)
      ? dish.original_price_cent
      : 0,
    tags: asList(dish.tags),
    status: dish.status || '',
    stock_enabled: typeof dish.stock_enabled === 'boolean' ? dish.stock_enabled : false,
    stock_count: getStockCount(dish),
    sold_out: typeof dish.sold_out === 'boolean' ? dish.sold_out : false,
    sales_count: Number.isFinite(dish.sales_count) ? dish.sales_count : 0,
    estimated_time_min: Number.isFinite(dish.estimated_time_min)
      ? dish.estimated_time_min
      : 0,
    sort_order: getSortOrder(dish)
  }
}

function formatCategory(category) {
  if (!category) {
    return null
  }

  return {
    _id: category._id || '',
    category_id: category.category_id || category._id || '',
    name: category.name || ''
  }
}

function getIngredientId(ingredient) {
  return ingredient.ingredient_id || ingredient._id || ''
}

function formatIngredients(links, ingredients) {
  const ingredientMap = asList(ingredients).reduce((result, ingredient) => {
    const ingredientId = getIngredientId(ingredient)
    if (ingredientId) {
      result[ingredientId] = ingredient
    }
    return result
  }, {})

  return asList(links).map((link) => {
    const ingredient = ingredientMap[link.ingredient_id] || {}

    return {
      _id: ingredient._id || '',
      ingredient_id: link.ingredient_id || getIngredientId(ingredient),
      name: link.ingredient_name || ingredient.name || '',
      quantity_per_dish: Number.isFinite(link.quantity_per_dish)
        ? link.quantity_per_dish
        : 0,
      unit: link.unit || ingredient.unit || ''
    }
  })
}

function formatProductionStep(step) {
  return {
    _id: step._id || '',
    step_id: step.step_id || step._id || '',
    step_index: Number.isFinite(step.step_index) ? step.step_index : 0,
    title: step.title || '',
    description: step.description || '',
    image_url: step.image_url || step.image || '',
    estimated_minutes: Number.isFinite(step.estimated_minutes)
      ? step.estimated_minutes
      : 0
  }
}

async function safeOptionalList(dependencies, label, query) {
  try {
    return asList(await query())
  } catch (error) {
    if (typeof dependencies.logError === 'function') {
      dependencies.logError(`${label} optional query failed`, error)
    }
    return []
  }
}

function createGetDishDetailHandler(dependencies) {
  return async function getDishDetail(event = {}) {
    try {
      const dishId = normalizeText(event.dish_id)
      const merchantId = normalizeText(event.merchant_id)

      if (!dishId) {
        return failure('INVALID_PARAMS', '餐品 ID 不能为空')
      }

      const dish = await dependencies.findDishById(dishId)

      if (!dish) {
        return failure('NOT_FOUND', '餐品不存在')
      }

      if (merchantId && dish.merchant_id && merchantId !== dish.merchant_id) {
        return failure('NOT_FOUND', '餐品不存在')
      }

      const resolvedMerchantId = dish.merchant_id || merchantId || DEFAULT_MERCHANT_ID
      const resolvedDishId = dish.dish_id || dish._id || dishId

      const category = await dependencies.findCategoryById(
        dish.category_id,
        resolvedMerchantId
      )

      const ingredientLinks = await safeOptionalList(
        dependencies,
        'dish_ingredients',
        () => dependencies.findDishIngredientLinks(resolvedDishId, resolvedMerchantId)
      )

      const ingredientIds = ingredientLinks
        .map((item) => item.ingredient_id)
        .filter(Boolean)

      const ingredients = ingredientIds.length
        ? await safeOptionalList(dependencies, 'ingredients', () =>
            dependencies.findIngredientsByIds(ingredientIds, resolvedMerchantId)
          )
        : []

      const productionSteps = await safeOptionalList(
        dependencies,
        'production_steps',
        () => dependencies.findProductionSteps(resolvedDishId, resolvedMerchantId)
      )

      return success('获取餐品详情成功', {
        dish: formatDish(dish),
        category: formatCategory(category),
        ingredients: formatIngredients(ingredientLinks, ingredients),
        production_steps: productionSteps
          .map(formatProductionStep)
          .sort((left, right) => left.step_index - right.step_index)
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getDishDetail failed', error)
      }
      return failure('SERVER_ERROR', '获取餐品详情失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetDishDetailHandler
}
