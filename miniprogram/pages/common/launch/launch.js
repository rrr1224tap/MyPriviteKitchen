const { login, isMerchantStaff } = require('../../../utils/auth')
const { callFunction } = require('../../../utils/cloud')
const { addCartItem } = require('../../../utils/cart')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney } = require('../../../utils/format')

const SHARE_TITLE = '朋友们的食堂｜看看今天吃什么'
const SHARE_IMAGE_URL = '/images/home/home-hero-bibimbap.jpg'
const FOOD_PLACEHOLDER_IMAGE = '/images/placeholders/food-placeholder.svg'
const RECOMMEND_BADGES = ['招牌', '人气', '推荐']
const RECOMMEND_BADGE_CLASSES = [
  'recommend-badge-red',
  'recommend-badge-orange',
  'recommend-badge-green'
]

function normalizeStockCount(value) {
  const numberValue = Number(value)

  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0
}

function isDishAvailable(dish = {}) {
  if (dish.status !== 'on_sale' || dish.sold_out === true) {
    return false
  }

  return dish.stock_enabled !== true || normalizeStockCount(dish.stock_count) > 0
}

function normalizeRecommendation(dish = {}, index = 0) {
  const dishId = dish.dish_id || dish._id || ''
  const imageUrl = dish.image_url || dish.image || ''
  const tags = Array.isArray(dish.tags) ? dish.tags.filter(Boolean) : []
  const priceCent = Number(dish.price_cent)
  const safePriceCent = Number.isFinite(priceCent) ? Math.max(0, Math.floor(priceCent)) : 0

  return {
    ...dish,
    _id: dishId,
    dish_id: dishId,
    merchant_id: dish.merchant_id || DEFAULT_MERCHANT_ID,
    name: dish.name || '未命名餐品',
    description: dish.description || '今日现做，趁热更好吃',
    image_url: imageUrl,
    display_image: imageUrl || FOOD_PLACEHOLDER_IMAGE,
    image_mode: imageUrl ? 'aspectFill' : 'aspectFit',
    is_placeholder_image: !imageUrl,
    price_cent: safePriceCent,
    price_text: formatMoney(safePriceCent),
    badge_text: tags[0] || RECOMMEND_BADGES[index] || '推荐',
    badge_class: RECOMMEND_BADGE_CLASSES[index] || 'recommend-badge-red',
    has_options: dish.has_options === true
  }
}

function buildRecommendations(menuData = {}) {
  const dishes = []

  ;(menuData.categories || []).forEach((category) => {
    ;(category.dishes || []).forEach((dish) => {
      if (dishes.length >= 3 || !isDishAvailable(dish)) {
        return
      }

      const recommendation = normalizeRecommendation(dish, dishes.length)

      if (recommendation.dish_id) {
        dishes.push(recommendation)
      }
    })
  })

  return dishes
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    homeReference: '/images/home/home-hero-bibimbap.jpg',
    homeImageAvailable: true,
    showMerchantEntry: false,
    recommendStatus: 'loading',
    recommendedDishes: []
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

    this.loadRecommendations()
  },

  onShareAppMessage() {
    return {
      title: SHARE_TITLE,
      path: '/pages/common/launch/launch',
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
    this.refreshMerchantEntry()
  },

  async refreshMerchantEntry() {
    try {
      await login()
      this.setData({
        showMerchantEntry: isMerchantStaff()
      })
    } catch (error) {
      console.warn('[launch] refresh merchant identity failed:', error)
      this.setData({
        showMerchantEntry: false
      })
    }
  },

  async loadRecommendations() {
    this.setData({
      recommendStatus: 'loading'
    })

    try {
      const menuData = await callFunction('getMenu', {
        merchant_id: DEFAULT_MERCHANT_ID
      })
      const recommendedDishes = buildRecommendations(menuData)

      this.setData({
        recommendStatus: recommendedDishes.length ? 'success' : 'empty',
        recommendedDishes
      })
    } catch (error) {
      console.warn('[launch] load recommendations failed:', error)
      this.setData({
        recommendStatus: 'error',
        recommendedDishes: []
      })
    }
  },

  handleRecommendImageError(event) {
    const dishId = event.currentTarget.dataset.id
    const recommendedDishes = this.data.recommendedDishes.map((dish) => {
      if (dish.dish_id !== dishId) {
        return dish
      }

      return {
        ...dish,
        display_image: FOOD_PLACEHOLDER_IMAGE,
        image_mode: 'aspectFit',
        is_placeholder_image: true
      }
    })

    this.setData({ recommendedDishes })
  },

  openRecommendedDish(event) {
    const dishId = event.currentTarget.dataset.id

    if (!dishId) {
      return
    }

    wx.navigateTo({
      url: `/pages/user/dish-detail/dish-detail?dish_id=${encodeURIComponent(dishId)}`
    })
  },

  addRecommendedDish(event) {
    const dishId = event.currentTarget.dataset.id
    const dish = this.data.recommendedDishes.find((item) => item.dish_id === dishId)

    if (!dish) {
      wx.showToast({
        title: '餐品信息异常，请稍后重试',
        icon: 'none'
      })
      return
    }

    if (dish.has_options) {
      this.openRecommendedDish({
        currentTarget: {
          dataset: { id: dishId }
        }
      })
      return
    }

    addCartItem(dish, 1)
    wx.showToast({
      title: '已放进小篮子',
      icon: 'none'
    })
  },

  handleHomeImageError() {
    this.setData({
      homeImageAvailable: false
    })
  },

  goToMenu() {
    wx.navigateTo({
      url: '/pages/user/menu/menu'
    })
  },

  goToOrders() {
    wx.navigateTo({
      url: '/pages/user/order-list/order-list'
    })
  },

  goToMerchant() {
    if (!this.data.showMerchantEntry) {
      return
    }

    wx.navigateTo({
      url: '/pages/merchant/dashboard/dashboard'
    })
  }
})
