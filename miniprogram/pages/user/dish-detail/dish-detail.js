const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney } = require('../../../utils/format')

const FALLBACK_IMAGE = '/images/mock/home-glass-display.jpg'
const FALLBACK_IMAGE_STYLE = 'width: 1120rpx; left: -318rpx; top: -126rpx;'
const FALLBACK_INGREDIENTS = ['肥牛', '米饭', '时令蔬菜', '拌饭酱', '鸡蛋']

const FALLBACK_DISH = {
  _id: 'dish_002',
  dish_id: 'dish_002',
  name: '招牌肥牛石锅拌饭',
  price_cent: 2990,
  image: FALLBACK_IMAGE,
  image_style: FALLBACK_IMAGE_STYLE,
  image_mode: 'widthFix',
  tags: ['招牌推荐', '人气 TOP1', '约12分钟'],
  description: '肥牛现炒，锅巴焦香，拌匀更好吃。现炒好味，认真对待每一碗热饭。',
  ingredients: FALLBACK_INGREDIENTS
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : []
}

function toSafePriceCent(value) {
  const priceCent = Number(value)
  return Number.isFinite(priceCent) ? priceCent : 0
}

function getDishId(dish = {}) {
  return dish.dish_id || dish._id || ''
}

function formatIngredient(item) {
  if (typeof item === 'string') {
    return item
  }

  const name = item.name || item.ingredient_name || ''
  const quantity = Number(item.quantity_per_dish)
  const unit = item.unit || ''

  if (!name) {
    return ''
  }

  if (Number.isFinite(quantity) && quantity > 0 && unit) {
    return `${name}${quantity}${unit}`
  }

  return name
}

function normalizeIngredients(ingredients, tags) {
  const realIngredients = Array.isArray(ingredients)
    ? ingredients.map(formatIngredient).filter(Boolean)
    : []

  if (realIngredients.length) {
    return realIngredients
  }

  if (tags.length) {
    return tags.slice(0, 5)
  }

  return FALLBACK_INGREDIENTS
}

function decorateDish(rawDish, detailData = {}) {
  const dish = rawDish || {}
  const priceCent = toSafePriceCent(dish.price_cent)
  const imageUrl = dish.image_url || dish.image || ''
  const hasRealImage = Boolean(imageUrl)
  const tags = normalizeTags(dish.tags)
  const estimatedTime = Number(dish.estimated_time_min)

  if (Number.isFinite(estimatedTime) && estimatedTime > 0) {
    const timeTag = `约${estimatedTime}分钟`
    if (!tags.includes(timeTag)) {
      tags.push(timeTag)
    }
  }

  return {
    _id: getDishId(dish),
    dish_id: getDishId(dish),
    name: dish.name || '未命名餐品',
    price_cent: priceCent,
    price_text: formatMoney(priceCent),
    image: hasRealImage ? imageUrl : FALLBACK_IMAGE,
    image_style: hasRealImage
      ? 'width: 100%; height: 100%; left: 0; top: 0;'
      : dish.image_style || FALLBACK_IMAGE_STYLE,
    image_mode: hasRealImage ? 'aspectFill' : 'widthFix',
    tags,
    description: dish.detail_description || dish.description || '暂无餐品介绍',
    ingredients: normalizeIngredients(detailData.ingredients, tags),
    status: dish.status || 'on_sale',
    category: detailData.category || null
  }
}

function getFallbackDish() {
  return {
    ...FALLBACK_DISH,
    price_text: formatMoney(FALLBACK_DISH.price_cent)
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    pageStatus: 'loading',
    usingFallback: false,
    statusNotice: '正在读取餐品详情',
    dish: getFallbackDish(),
    quantity: 1,
    totalPriceText: formatMoney(FALLBACK_DISH.price_cent),
    imageAvailable: true
  },

  onLoad(options = {}) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    const navigationHeight = Math.max(44, (menuButton.top - statusBarHeight) * 2 + menuButton.height)
    const dishId = options.dish_id || options.id || ''

    this.setData({
      statusBarHeight,
      navigationHeight
    })

    if (!dishId) {
      this.useFallbackDish('缺少餐品ID，已展示示例餐品')
      return
    }

    this.loadDishDetail(dishId)
  },

  async loadDishDetail(dishId) {
    this.setData({
      pageStatus: 'loading',
      statusNotice: '正在读取餐品详情',
      imageAvailable: true
    })

    try {
      const detailData = await callFunction('getDishDetail', {
        dish_id: dishId,
        merchant_id: DEFAULT_MERCHANT_ID
      })
      const dish = decorateDish(detailData.dish, detailData)

      if (!dish.dish_id) {
        this.useFallbackDish('没有找到餐品数据，已展示示例餐品', true, 'empty')
        return
      }

      this.setData({
        pageStatus: 'success',
        usingFallback: false,
        statusNotice: '下单后现做，高峰期请耐心等待',
        dish,
        quantity: 1,
        totalPriceText: dish.price_text
      })
    } catch (error) {
      this.useFallbackDish('餐品详情加载失败，已展示示例餐品', false)
    }
  },

  useFallbackDish(message, shouldToast = true, pageStatus = 'error') {
    const fallbackDish = getFallbackDish()

    this.setData({
      pageStatus,
      usingFallback: true,
      statusNotice: message,
      dish: fallbackDish,
      quantity: 1,
      totalPriceText: fallbackDish.price_text,
      imageAvailable: true
    })

    if (shouldToast) {
      wx.showToast({
        title: message,
        icon: 'none'
      })
    }
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: '/pages/user/menu/menu'
    })
  },

  handleImageError() {
    if (this.data.dish.image === FALLBACK_IMAGE) {
      this.setData({
        imageAvailable: false
      })
      return
    }

    const fallbackDish = {
      ...this.data.dish,
      image: FALLBACK_IMAGE,
      image_style: FALLBACK_IMAGE_STYLE,
      image_mode: 'widthFix'
    }

    this.setData({
      dish: fallbackDish,
      imageAvailable: true
    })
  },

  updateQuantity(quantity) {
    this.setData({
      quantity,
      totalPriceText: formatMoney(this.data.dish.price_cent * quantity)
    })
  },

  decreaseQuantity() {
    if (this.data.quantity > 1) {
      this.updateQuantity(this.data.quantity - 1)
    }
  },

  increaseQuantity() {
    this.updateQuantity(this.data.quantity + 1)
  },

  addToMockCart() {
    wx.showToast({
      title: `已加入 ${this.data.quantity} 份`,
      icon: 'none'
    })
  }
})
