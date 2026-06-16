const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney } = require('../../../utils/format')

const MENU_REFERENCE = '/images/mock/menu-glass-display.jpg'
const HOME_REFERENCE = '/images/mock/home-glass-display.jpg'

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
    name: '三也拌饭',
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
  return dish.dish_id || dish._id || ''
}

function getFallbackImageStyle(index) {
  return FALLBACK_IMAGE_STYLES[index % FALLBACK_IMAGE_STYLES.length]
}

function normalizeDish(dish, categoryId, index) {
  const dishId = getDishId(dish)
  const imageUrl = dish.image_url || dish.image || ''
  const hasRealImage = Boolean(imageUrl)
  const priceCent = Number(dish.price_cent)
  const safePriceCent = Number.isFinite(priceCent) ? priceCent : 0

  return {
    ...dish,
    _id: dishId,
    dish_id: dishId,
    category_id: dish.category_id || categoryId,
    name: dish.name || '未命名餐品',
    description: dish.description || '暂无餐品介绍',
    price_cent: safePriceCent,
    price_text: formatMoney(safePriceCent),
    tags: normalizeTags(dish.tags),
    status: dish.status || 'on_sale',
    display_image: hasRealImage ? imageUrl : MENU_REFERENCE,
    image_style: hasRealImage
      ? 'width: 100%; height: 100%; left: 0; top: 0;'
      : dish.image_style || getFallbackImageStyle(index),
    image_mode: hasRealImage ? 'aspectFill' : 'widthFix'
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
    name: merchant.name || '三也拌饭',
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
    emptyTitle: categories.length ? '当前暂无可点餐品' : '菜单还没有准备好',
    emptyDesc: categories.length ? '请稍后再来看看' : '请先在数据库中添加分类和餐品'
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    menuReference: MENU_REFERENCE,
    homeReference: HOME_REFERENCE,
    menuImageAvailable: true,
    homeImageAvailable: true,
    pageStatus: 'loading',
    usingFallback: false,
    merchant: normalizeMerchant(FALLBACK_MENU.merchant),
    categories: [],
    categoryDishesMap: {},
    activeCategory: '',
    dishes: [],
    allDishes: [],
    emptyTitle: '菜单加载中',
    emptyDesc: '正在读取门店餐品',
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

    this.loadMenu()
  },

  onPullDownRefresh() {
    this.loadMenu().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadMenu() {
    this.setData({
      pageStatus: 'loading',
      emptyTitle: '菜单加载中',
      emptyDesc: '正在读取门店餐品'
    })

    try {
      const menuData = await callFunction('getMenu', {
        merchant_id: DEFAULT_MERCHANT_ID
      })
      const menuState = buildMenuState(menuData)

      this.setData({
        ...menuState,
        usingFallback: false
      })
    } catch (error) {
      const fallbackState = buildMenuState(FALLBACK_MENU)

      this.setData({
        ...fallbackState,
        pageStatus: 'success',
        usingFallback: true
      })
    }
  },

  handleHomeImageError() {
    this.setData({
      homeImageAvailable: false
    })
  },

  handleMenuImageError() {
    this.setData({
      menuImageAvailable: false
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
        display_image: MENU_REFERENCE,
        image_style: getFallbackImageStyle(index),
        image_mode: 'widthFix'
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
    const nextCount = this.data.cartCount + 1
    const nextAmount = this.data.cartAmountCent + (dish ? dish.price_cent : 0)

    this.setData({
      cartCount: nextCount,
      cartAmountCent: nextAmount,
      cartAmountText: formatMoney(nextAmount)
    })

    wx.showToast({
      title: '已加入购物车',
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
