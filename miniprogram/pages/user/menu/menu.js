const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID, STORAGE_KEYS } = require('../../../utils/constants')
const { formatMoney } = require('../../../utils/format')

const HOME_REFERENCE = '/images/mock/home-glass-display.jpg'
const FOOD_PLACEHOLDER_IMAGE = '/images/placeholders/food-placeholder.svg'
const CART_STORAGE_KEY = STORAGE_KEYS.CART_ITEMS || 'cart_items'
const BRAND_NAME = '朋友们的食堂'
const SHARE_TITLE = '朋友们的食堂｜今日菜单'
const SHARE_IMAGE_URL = '/images/home/home-hero-bibimbap.jpg'

const FALLBACK_IMAGE_STYLES = [
  'width: 750rpx; left: -192rpx; top: -676rpx;',
  'width: 750rpx; left: -192rpx; top: -846rpx;',
  'width: 1300rpx; left: -359rpx; top: -1768rpx;',
  'width: 750rpx; left: -410rpx; top: -412rpx;'
]

const MOCK_CATEGORIES = [
  { id: 'new', name: '春夏新品', badge: 'NEW' },
  { id: 'set', name: '特惠套餐' },
  { id: 'signature', name: '招牌推荐' },
  { id: 'stir', name: '石锅现炒' },
  { id: 'hotpot', name: '锅物' },
  { id: 'drink', name: '饮品' }
]

const MOCK_DISHES = [
  {
    _id: 'dish_001',
    dish_id: 'dish_001',
    category_id: 'new',
    merchant_id: 'merchant_001',
    name: '经典肉酱砂锅米线',
    description: '浓香肉酱配爽滑米线，暖胃又满足',
    price_cent: 2590,
    tags: ['新品', '18人推荐'],
    status: 'on_sale',
    image_style: FALLBACK_IMAGE_STYLES[0]
  },
  {
    _id: 'dish_002',
    dish_id: 'dish_002',
    category_id: 'signature',
    merchant_id: 'merchant_001',
    name: '招牌肥牛石锅拌饭',
    description: '肥牛现炒，锅巴焦香，拌匀更好吃',
    price_cent: 2990,
    tags: ['招牌', '人气 TOP1'],
    status: 'on_sale',
    image_style: FALLBACK_IMAGE_STYLES[1]
  },
  {
    _id: 'dish_003',
    dish_id: 'dish_003',
    category_id: 'set',
    merchant_id: 'merchant_001',
    name: '海带豆腐汤套餐',
    description: '海带豆腐搭配米饭，适合清淡口味',
    price_cent: 1890,
    tags: ['清爽', '轻负担'],
    status: 'on_sale',
    image_style: FALLBACK_IMAGE_STYLES[2]
  },
  {
    _id: 'dish_004',
    dish_id: 'dish_004',
    category_id: 'hotpot',
    merchant_id: 'merchant_001',
    name: '瀑布芝士部队火锅',
    description: '热辣浓郁，适合多人分享',
    price_cent: 8800,
    tags: ['2-4人', '聚餐推荐'],
    status: 'on_sale',
    image_style: FALLBACK_IMAGE_STYLES[3]
  }
]

const FALLBACK_MENU = {
  merchant: {
    merchant_id: DEFAULT_MERCHANT_ID,
    name: BRAND_NAME,
    notice: '今日现炒现做，高峰期请耐心等待',
    business_status: 'open'
  },
  categories: MOCK_CATEGORIES.map((category) => ({
    category_id: category.id,
    name: category.name,
    badge: category.badge || '',
    dishes: MOCK_DISHES.filter((dish) => dish.category_id === category.id)
  }))
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : []
}

function getDishId(dish) {
  return dish._id || dish.dish_id || ''
}

function toSafeInteger(value, fallback = 0) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.floor(numberValue)
}

function normalizeQuantity(quantity, fallback = 1) {
  const safeQuantity = toSafeInteger(quantity, fallback)

  return safeQuantity > 0 ? safeQuantity : fallback
}

function getFallbackImageStyle(index) {
  return 'width: 100%; height: 100%; left: 0; top: 0;'
}

function normalizeStockCount(value) {
  const numberValue = Number(value)

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return 0
  }

  return numberValue
}

function getSoldOutState(dish = {}) {
  const stockEnabled = dish.stock_enabled === true
  const stockCount = normalizeStockCount(dish.stock_count)
  const soldOut = dish.sold_out === true

  return {
    stock_enabled: stockEnabled,
    stock_count: stockCount,
    sold_out: soldOut,
    is_sold_out: soldOut || (stockEnabled && stockCount <= 0)
  }
}

function buildCartDish(dish = {}) {
  const dishId = getDishId(dish)
  const priceCent = Math.max(0, toSafeInteger(dish.price_cent, 0))

  return {
    item_key: dishId,
    dish_id: dishId,
    business_dish_id: dish.business_dish_id || dish.dish_id || '',
    merchant_id: dish.merchant_id || DEFAULT_MERCHANT_ID,
    category_id: dish.category_id || '',
    name: dish.name,
    description: dish.description || '',
    image_url: dish.image_url || dish.display_image || dish.image || '',
    price_cent: priceCent,
    base_price_cent: priceCent,
    unit_price_cent: priceCent,
    original_price_cent: dish.original_price_cent || 0,
    tags: normalizeTags(dish.tags),
    status: dish.status || 'on_sale',
    selected_specs: [],
    selected_addons: []
  }
}

function readCartItems() {
  try {
    const items = wx.getStorageSync(CART_STORAGE_KEY)
    return Array.isArray(items) ? items : []
  } catch (error) {
    return []
  }
}

function saveCartItems(items = []) {
  try {
    wx.setStorageSync(CART_STORAGE_KEY, items)
  } catch (error) {
    return []
  }

  return items
}

function getItemKey(item = {}) {
  return item.item_key || item.dish_id || item._id || item.id || ''
}

function addCartItemByKey(cartItem, quantity = 1) {
  const addQuantity = normalizeQuantity(quantity, 1)
  const currentItems = readCartItems()
  const currentMerchantId = currentItems.length ? currentItems[0].merchant_id : ''
  const nextItems = currentMerchantId && currentMerchantId !== cartItem.merchant_id
    ? []
    : currentItems
  const targetKey = cartItem.item_key || cartItem.dish_id
  const existsIndex = nextItems.findIndex((item) => getItemKey(item) === targetKey)

  if (existsIndex >= 0) {
    const oldItem = nextItems[existsIndex]
    nextItems[existsIndex] = {
      ...oldItem,
      ...cartItem,
      quantity: normalizeQuantity(oldItem.quantity, 1) + addQuantity,
      updated_at: Date.now()
    }
  } else {
    nextItems.push({
      ...cartItem,
      quantity: addQuantity,
      selected: true,
      updated_at: Date.now()
    })
  }

  return saveCartItems(nextItems)
}

function getLocalCartSummary() {
  return readCartItems().filter((item) => item.selected !== false).reduce((summary, item) => {
    const quantity = normalizeQuantity(item.quantity, 1)
    const unitPriceCent = Math.max(0, toSafeInteger(item.unit_price_cent || item.price_cent, 0))

    return {
      total_quantity: summary.total_quantity + quantity,
      total_amount_cent: summary.total_amount_cent + unitPriceCent * quantity
    }
  }, {
    total_quantity: 0,
    total_amount_cent: 0
  })
}

function normalizeDish(dish, categoryId, index) {
  const dishId = getDishId(dish)
  const businessDishId = dish.dish_id || dishId
  const imageUrl = dish.image_url || dish.image || ''
  const hasRealImage = Boolean(imageUrl)
  const priceCent = Number(dish.price_cent)
  const safePriceCent = Number.isFinite(priceCent) ? priceCent : 0
  const soldOutState = getSoldOutState(dish)

  return {
    ...dish,
    _id: dishId,
    dish_id: dishId,
    business_dish_id: businessDishId,
    category_id: dish.category_id || categoryId,
    name: dish.name || '未命名餐品',
    description: dish.description || '暂无餐品介绍',
    price_cent: safePriceCent,
    price_text: formatMoney(safePriceCent),
    tags: normalizeTags(dish.tags),
    status: dish.status || 'on_sale',
    has_options: dish.has_options === true,
    display_image: hasRealImage ? imageUrl : FOOD_PLACEHOLDER_IMAGE,
    image_style: hasRealImage
      ? 'width: 100%; height: 100%; left: 0; top: 0;'
      : getFallbackImageStyle(index),
    image_mode: hasRealImage ? 'aspectFill' : 'aspectFit',
    is_placeholder_image: !hasRealImage,
    ...soldOutState
  }
}

function normalizeCategory(category) {
  const id = category.category_id || category._id || category.id || ''

  return {
    id,
    name: category.name || '未命名分类',
    badge: category.badge || ''
  }
}

function normalizeMerchant(merchant = {}) {
  return {
    name: BRAND_NAME,
    branch: merchant.branch_name || merchant.branch || '星都里店',
    notice: merchant.notice || '今日现炒现做，高峰期请耐心等待',
    statusText: merchant.business_status === 'closed'
      ? '休息中 · 请稍后再来'
      : '营业中 · 预计 15 分钟出餐'
  }
}

function buildMenuState(menuData) {
  const categories = []
  const categoryDishesMap = {}
  const allDishes = []

  ;(menuData.categories || []).forEach((category, categoryIndex) => {
    const normalizedCategory = normalizeCategory(category)

    if (!normalizedCategory.id) {
      return
    }

    const dishes = (category.dishes || []).map((dish, dishIndex) => {
      const normalizedDish = normalizeDish(
        dish,
        normalizedCategory.id,
        categoryIndex + dishIndex
      )
      allDishes.push(normalizedDish)
      return normalizedDish
    })

    categories.push(normalizedCategory)
    categoryDishesMap[normalizedCategory.id] = dishes
  })

  const firstCategoryWithDishes = categories.find((category) => {
    return (categoryDishesMap[category.id] || []).length > 0
  })
  const activeCategory = firstCategoryWithDishes
    ? firstCategoryWithDishes.id
    : (categories[0] && categories[0].id) || ''

  return {
    merchant: normalizeMerchant(menuData.merchant),
    categories,
    categoryDishesMap,
    allDishes,
    activeCategory,
    dishes: categoryDishesMap[activeCategory] || [],
    pageStatus: categories.length && allDishes.length ? 'success' : 'empty',
    emptyTitle: categories.length ? '今天暂时没有可点的菜' : '今日菜单还没有准备好',
    emptyDesc: categories.length ? '晚点再来看看食堂上新了没' : '食堂还在准备菜单'
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    homeReference: HOME_REFERENCE,
    homeImageAvailable: true,
    pageStatus: 'loading',
    usingFallback: false,
    merchant: normalizeMerchant(FALLBACK_MENU.merchant),
    categories: [],
    categoryDishesMap: {},
    activeCategory: '',
    dishes: [],
    allDishes: [],
    emptyTitle: '今日菜单加载中',
    emptyDesc: '正在看看食堂今天准备了什么',
    fallbackNoticeTitle: '',
    fallbackNoticeDesc: '',
    cartCount: 0,
    cartAmountCent: 0,
    cartAmountText: formatMoney(0)
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    const navigationHeight = Math.max(44, (menuButton.top - statusBarHeight) * 2 + menuButton.height)

    this.setData({
      statusBarHeight,
      navigationHeight
    })

    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    })

    this.loadMenu()
  },

  onShareAppMessage() {
    return {
      title: SHARE_TITLE,
      path: '/pages/user/menu/menu',
      imageUrl: SHARE_IMAGE_URL
    }
  },

  onShareTimeline() {
    return {
      title: SHARE_TITLE,
      query: '',
      imageUrl: SHARE_IMAGE_URL
    }
  },

  onShow() {
    this.refreshCartSummary()
  },

  onPullDownRefresh() {
    this.loadMenu().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadMenu() {
    this.setData({
      pageStatus: 'loading',
      usingFallback: false,
      fallbackNoticeTitle: '',
      fallbackNoticeDesc: '',
      emptyTitle: '今日菜单加载中',
      emptyDesc: '正在看看食堂今天准备了什么'
    })

    try {
      const menuData = await callFunction('getMenu', {
        merchant_id: DEFAULT_MERCHANT_ID
      })
      const menuState = buildMenuState(menuData)

      this.setData({
        ...menuState,
        usingFallback: false,
        fallbackNoticeTitle: '',
        fallbackNoticeDesc: ''
      })
    } catch (error) {
      const fallbackState = buildMenuState(FALLBACK_MENU)
      const hasFallbackMenu = fallbackState.categories.length && fallbackState.allDishes.length

      if (!hasFallbackMenu) {
        this.setData({
          merchant: normalizeMerchant(FALLBACK_MENU.merchant),
          categories: [],
          categoryDishesMap: {},
          allDishes: [],
          activeCategory: '',
          dishes: [],
          pageStatus: 'error',
          usingFallback: false,
          fallbackNoticeTitle: '',
          fallbackNoticeDesc: '',
          emptyTitle: '今日菜单加载失败',
          emptyDesc: '服务暂时不可用，请稍后重试'
        })
        return
      }

      this.setData({
        ...fallbackState,
        pageStatus: 'success',
        usingFallback: true,
        fallbackNoticeTitle: '当前为示例菜单',
        fallbackNoticeDesc: '今日菜单暂时没取到，可点击重试'
      })
    }
  },

  retryLoad() {
    this.loadMenu()
  },

  refreshCartSummary() {
    const summary = getLocalCartSummary()

    this.setData({
      cartCount: summary.total_quantity,
      cartAmountCent: summary.total_amount_cent,
      cartAmountText: formatMoney(summary.total_amount_cent)
    })
  },

  handleHomeImageError() {
    this.setData({
      homeImageAvailable: false
    })
  },

  handleDishImageError(event) {
    const dishId = event.currentTarget.dataset.id
    const updateDish = (dish, index) => {
      if (dish._id !== dishId) {
        return dish
      }

      return {
        ...dish,
        display_image: FOOD_PLACEHOLDER_IMAGE,
        image_style: getFallbackImageStyle(index),
        image_mode: 'aspectFit',
        is_placeholder_image: true
      }
    }

    const allDishes = this.data.allDishes.map(updateDish)
    const categoryDishesMap = Object.keys(this.data.categoryDishesMap).reduce((result, categoryId) => {
      result[categoryId] = this.data.categoryDishesMap[categoryId].map(updateDish)
      return result
    }, {})

    this.setData({
      allDishes,
      categoryDishesMap,
      dishes: categoryDishesMap[this.data.activeCategory] || []
    })
  },

  selectCategory(event) {
    const categoryId = event.currentTarget.dataset.id
    const dishes = this.data.categoryDishesMap[categoryId] || []

    this.setData({
      activeCategory: categoryId,
      dishes
    })
  },

  openSearch() {
    wx.showToast({
      title: '搜索功能将在后续接入',
      icon: 'none'
    })
  },

  openDish(event) {
    const dishId = event.currentTarget.dataset.id || 'dish_001'

    wx.navigateTo({
      url: `/pages/user/dish-detail/dish-detail?dish_id=${encodeURIComponent(dishId)}`
    })
  },

  addDish(event) {
    const dishId = event.currentTarget.dataset.id
    const dish = this.data.allDishes.find((item) => item._id === dishId)

    if (!dish) {
      wx.showToast({
        title: '餐品信息异常，请稍后重试',
        icon: 'none'
      })
      return
    }

    if (dish.is_sold_out) {
      wx.showToast({
        title: '该餐品已售罄',
        icon: 'none'
      })
      return
    }

    if (dish.has_options) {
      this.openDish({
        currentTarget: {
          dataset: {
            id: dish._id
          }
        }
      })
      return
    }

    addCartItemByKey(buildCartDish(dish), 1)
    this.refreshCartSummary()

    wx.showToast({
        title: '已放进小篮子',
      icon: 'none'
    })
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    this.goHome()
  },

  goToCart() {
    wx.navigateTo({
      url: '/pages/user/cart/cart'
    })
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  },

  goToOrders() {
    wx.navigateTo({
      url: '/pages/user/order-list/order-list'
    })
  }
})
