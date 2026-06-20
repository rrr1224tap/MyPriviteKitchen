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

function sortBySortOrder(left, right) {
  return getSortOrder(left) - getSortOrder(right)
}

function isMerchantActive(merchant) {
  if (!merchant) {
    return false
  }

  if (merchant.status && merchant.status !== 'active') {
    return false
  }

  if (merchant.business_status && merchant.business_status !== 'open') {
    return false
  }

  return true
}

function isCategoryActive(category) {
  if (category.status) {
    return category.status === 'active'
  }

  if (Object.prototype.hasOwnProperty.call(category, 'enabled')) {
    return category.enabled === true
  }

  return true
}

function getCategoryId(category) {
  return category.category_id || category._id || ''
}

function formatMerchant(merchant) {
  const businessStatus = merchant.business_status || ''

  return {
    _id: merchant._id || '',
    merchant_id: merchant.merchant_id || merchant._id || DEFAULT_MERCHANT_ID,
    name: merchant.name || '',
    logo: merchant.logo || '',
    notice: merchant.notice || '',
    status: merchant.status || (businessStatus === 'open' ? 'active' : 'active'),
    business_status: businessStatus,
    pickup_enabled: merchant.pickup_enabled !== false,
    dine_in_enabled: merchant.dine_in_enabled !== false
  }
}

function formatDish(dish) {
  return {
    _id: dish._id || '',
    dish_id: dish.dish_id || dish._id || '',
    merchant_id: dish.merchant_id || '',
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

function formatCategory(category, dishes) {
  return {
    _id: category._id || '',
    category_id: getCategoryId(category),
    merchant_id: category.merchant_id || '',
    name: category.name || '',
    sort_order: getSortOrder(category),
    status: category.status || 'active',
    enabled: category.enabled !== false,
    dishes
  }
}

function createGetMenuHandler(dependencies) {
  return async function getMenu(event = {}) {
    try {
      const merchantId = normalizeText(event.merchant_id) || DEFAULT_MERCHANT_ID

      if (!merchantId) {
        return failure('INVALID_PARAMS', '商家 ID 不能为空')
      }

      const merchant = await dependencies.findMerchantById(merchantId)

      if (!isMerchantActive(merchant)) {
        return failure('NOT_FOUND', '商家不存在或未启用')
      }

      const [categoryList, dishList] = await Promise.all([
        dependencies.findCategoriesByMerchantId(merchantId),
        dependencies.findDishesByMerchantId(merchantId)
      ])

      const activeCategories = asList(categoryList)
        .filter(isCategoryActive)
        .sort(sortBySortOrder)

      const activeCategoryIds = new Set(activeCategories.map(getCategoryId))
      const dishesByCategoryId = asList(dishList)
        .filter((dish) => dish.status === 'on_sale')
        .filter((dish) => activeCategoryIds.has(dish.category_id))
        .sort(sortBySortOrder)
        .reduce((result, dish) => {
          const categoryId = dish.category_id || ''
          if (!result[categoryId]) {
            result[categoryId] = []
          }
          result[categoryId].push(formatDish(dish))
          return result
        }, {})

      const categories = activeCategories.map((category) => {
        const categoryId = getCategoryId(category)
        return formatCategory(category, dishesByCategoryId[categoryId] || [])
      })

      return success('获取菜单成功', {
        merchant: formatMerchant(merchant),
        categories
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('getMenu failed', error)
      }
      return failure('SERVER_ERROR', '获取菜单失败，请稍后重试')
    }
  }
}

module.exports = {
  createGetMenuHandler
}
