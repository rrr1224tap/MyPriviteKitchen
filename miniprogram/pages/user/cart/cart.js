const { formatMoney } = require('../../../utils/format')
const { DEFAULT_MERCHANT_ID, STORAGE_KEYS } = require('../../../utils/constants')

const DISCOUNT_CENT = 600
const FALLBACK_IMAGE = '/images/placeholders/food-placeholder.svg'
const FALLBACK_BACKGROUND = '/images/mock/home-glass-display.jpg'
const CART_STORAGE_KEY = STORAGE_KEYS.CART_ITEMS || 'cart_items'
const LEGACY_CART_STORAGE_KEY = 'cart'
const FALLBACK_IMAGE_STYLE = 'width: 100%; height: 100%; left: 0; top: 0;'

const CREATE_ORDER_ERROR_TEXT = {
  DISH_SOLD_OUT: '有餐品已售罄，请重新选择',
  STOCK_NOT_ENOUGH: '库存不足，请调整数量后重试',
  DISH_OFF_SALE: '有餐品已下架，请重新选择',
  VALIDATION_ERROR: '规格或加料选择已变化，请重新选择',
  INVALID_PARAMS: '订单信息不完整，请重新选择',
  AMOUNT_ERROR: '订单金额校验失败，请重新选择',
  NOT_FOUND: '有餐品信息不存在，请重新选择',
  DATABASE_ERROR: '服务暂时不可用，请稍后重试'
}
const ORDER_RESELECT_CODES = [
  'DISH_SOLD_OUT',
  'STOCK_NOT_ENOUGH',
  'DISH_OFF_SALE',
  'VALIDATION_ERROR',
  'NOT_FOUND'
]
const ORDER_RESELECT_MESSAGE = '餐品状态或规格已变化，请返回菜单重新选择。'
const ORDER_NETWORK_ERROR_TEXT = '网络不太稳定，请稍后重试'
const ORDER_UNKNOWN_ERROR_TEXT = '下单失败，请稍后重试'

function getFallbackImageStyle(index) {
  return FALLBACK_IMAGE_STYLE
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

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : []
}

function normalizeSelectedSpecs(selectedSpecs) {
  if (!Array.isArray(selectedSpecs)) {
    return []
  }

  return selectedSpecs.map((spec = {}) => ({
    group_id: spec.group_id || '',
    group_name: spec.group_name || '',
    option_id: spec.option_id || '',
    option_name: spec.option_name || spec.name || '',
    price_delta_cent: Math.max(0, toSafeInteger(spec.price_delta_cent, 0))
  })).filter((spec) => spec.group_id && spec.option_id)
}

function normalizeSelectedAddons(selectedAddons) {
  if (!Array.isArray(selectedAddons)) {
    return []
  }

  return selectedAddons.map((group = {}) => {
    const options = Array.isArray(group.options)
      ? group.options.map((option = {}) => ({
          option_id: option.option_id || '',
          option_name: option.option_name || option.name || '',
          price_delta_cent: Math.max(0, toSafeInteger(option.price_delta_cent, 0))
        })).filter((option) => option.option_id)
      : []

    return {
      group_id: group.group_id || '',
      group_name: group.group_name || '',
      options
    }
  }).filter((group) => group.group_id && group.options.length)
}

function getItemKey(item = {}) {
  return item.item_key || item.dish_id || item._id || item.id || ''
}

function normalizeCartItem(item = {}) {
  const dishId = item.dish_id || item._id || item.id || ''
  const itemKey = getItemKey(item)

  if (!dishId || !itemKey) {
    return null
  }

  const unitPriceCent = Math.max(0, toSafeInteger(item.unit_price_cent || item.price_cent, 0))
  const selectedSpecs = normalizeSelectedSpecs(item.selected_specs)
  const selectedAddons = normalizeSelectedAddons(item.selected_addons)

  return {
    ...item,
    item_key: itemKey,
    dish_id: dishId,
    business_dish_id: item.business_dish_id || item.dish_id || '',
    merchant_id: item.merchant_id || DEFAULT_MERCHANT_ID,
    category_id: item.category_id || '',
    name: item.name || '未命名餐品',
    description: item.description || '',
    image_url: item.image_url || item.image || item.display_image || '',
    price_cent: unitPriceCent,
    base_price_cent: Math.max(0, toSafeInteger(item.base_price_cent || item.price_cent, unitPriceCent)),
    unit_price_cent: unitPriceCent,
    original_price_cent: Math.max(0, toSafeInteger(item.original_price_cent, 0)),
    tags: normalizeTags(item.tags),
    selected_specs: selectedSpecs,
    selected_addons: selectedAddons,
    quantity: normalizeQuantity(item.quantity, 1),
    selected: item.selected !== false,
    updated_at: item.updated_at || Date.now()
  }
}

function readStorageItems(key) {
  try {
    const items = wx.getStorageSync(key)
    return Array.isArray(items) ? items : []
  } catch (error) {
    return []
  }
}

function getCartItems() {
  const cartItems = readStorageItems(CART_STORAGE_KEY)
  const legacyItems = cartItems.length ? [] : readStorageItems(LEGACY_CART_STORAGE_KEY)
  const sourceItems = cartItems.length ? cartItems : legacyItems

  return sourceItems.map(normalizeCartItem).filter(Boolean)
}

function saveCartItems(items = []) {
  const nextItems = Array.isArray(items)
    ? items.map(normalizeCartItem).filter(Boolean)
    : []

  try {
    wx.setStorageSync(CART_STORAGE_KEY, nextItems)
  } catch (error) {
    return []
  }

  return nextItems
}

function clearCartStorage() {
  try {
    wx.removeStorageSync(CART_STORAGE_KEY)
    wx.removeStorageSync(LEGACY_CART_STORAGE_KEY)
  } catch (error) {
    saveCartItems([])
  }
}

function updateCartItemQuantity(itemKey, quantity) {
  const nextQuantity = toSafeInteger(quantity, 0)
  const items = getCartItems()

  if (nextQuantity <= 0) {
    return saveCartItems(items.filter((item) => item.item_key !== itemKey))
  }

  return saveCartItems(items.map((item) => {
    if (item.item_key !== itemKey) {
      return item
    }

    return {
      ...item,
      quantity: nextQuantity,
      updated_at: Date.now()
    }
  }))
}

function getCartSummary(items = getCartItems()) {
  return items.filter((item) => item.selected !== false).reduce((summary, item) => {
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

function buildSpecText(selectedSpecs = []) {
  const optionNames = selectedSpecs.map((spec) => spec.option_name).filter(Boolean)

  return optionNames.length ? `规格：${optionNames.join('、')}` : ''
}

function buildAddonText(selectedAddons = []) {
  const optionNames = selectedAddons.reduce((result, group) => {
    const names = Array.isArray(group.options)
      ? group.options.map((option) => option.option_name).filter(Boolean)
      : []
    return result.concat(names)
  }, [])

  return optionNames.length ? `加料：${optionNames.join('、')}` : ''
}

function decorateItems(items) {
  return items.map((item, index) => {
    const hasRealImage = Boolean(item.image_url)
    const unitPriceCent = Math.max(0, toSafeInteger(item.unit_price_cent || item.price_cent, 0))
    const quantity = normalizeQuantity(item.quantity, 1)

    return {
      ...item,
      image: hasRealImage ? item.image_url : FALLBACK_IMAGE,
      image_style: hasRealImage
        ? 'width: 100%; height: 100%; left: 0; top: 0;'
        : getFallbackImageStyle(index),
      image_mode: hasRealImage ? 'aspectFill' : 'aspectFit',
      image_available: true,
      is_placeholder_image: !hasRealImage,
      spec_text: buildSpecText(item.selected_specs),
      addon_text: buildAddonText(item.selected_addons),
      price_text: formatMoney(unitPriceCent),
      subtotal_text: formatMoney(unitPriceCent * quantity)
    }
  })
}

function buildCreateOrderSpecs(selectedSpecs = []) {
  return selectedSpecs.map((spec) => ({
    group_id: spec.group_id,
    option_id: spec.option_id
  })).filter((spec) => spec.group_id && spec.option_id)
}

function buildCreateOrderAddons(selectedAddons = []) {
  return selectedAddons.map((group) => ({
    group_id: group.group_id,
    option_ids: Array.isArray(group.options)
      ? group.options.map((option) => option.option_id).filter(Boolean)
      : []
  })).filter((group) => group.group_id && group.option_ids.length)
}

function getOrderErrorCode(error = {}) {
  return error.code || ''
}

function getOrderErrorMessage(code) {
  return CREATE_ORDER_ERROR_TEXT[code] || ORDER_UNKNOWN_ERROR_TEXT
}

function shouldGuideToMenu(code) {
  return ORDER_RESELECT_CODES.includes(code)
}

async function callCreateOrder(payload) {
  const response = await wx.cloud.callFunction({
    name: 'createOrder',
    data: payload
  })
  const result = response.result || {}

  if (!result.success) {
    const error = new Error(result.message || ORDER_UNKNOWN_ERROR_TEXT)
    error.code = result.code || ''
    error.data = result.data || null
    error.result = result
    throw error
  }

  return result.data || {}
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: FALLBACK_BACKGROUND,
    backgroundImageAvailable: true,
    items: [],
    totalCount: 0,
    subtotalAmountText: formatMoney(0),
    discountAmountText: formatMoney(0),
    payableAmountText: formatMoney(0),
    pickupType: 'pickup',
    submitting: false
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

    this.refreshCart()
  },

  onShow() {
    this.refreshCart()
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    this.goToMenu()
  },

  refreshCart() {
    const items = getCartItems()
    const summary = getCartSummary(items)
    const discountAmountCent = summary.total_amount_cent
      ? Math.min(DISCOUNT_CENT, summary.total_amount_cent)
      : 0
    const payableAmountCent = summary.total_amount_cent - discountAmountCent

    this.setData({
      items: decorateItems(items),
      totalCount: summary.total_quantity,
      subtotalAmountText: formatMoney(summary.total_amount_cent),
      discountAmountText: formatMoney(discountAmountCent),
      payableAmountText: formatMoney(payableAmountCent)
    })
  },

  changeQuantity(event) {
    if (this.data.submitting) {
      return
    }

    const itemKey = event.currentTarget.dataset.key
    const step = Number(event.currentTarget.dataset.step)
    const currentItem = this.data.items.find((item) => item.item_key === itemKey)

    if (!currentItem || !Number.isFinite(step)) {
      return
    }

    updateCartItemQuantity(itemKey, currentItem.quantity + step)
    this.refreshCart()
  },

  removeItem(event) {
    if (this.data.submitting) {
      return
    }

    const itemKey = event.currentTarget.dataset.key

    if (!itemKey) {
      return
    }

    updateCartItemQuantity(itemKey, 0)
    this.refreshCart()
  },

  clearCart() {
    if (this.data.submitting) {
      return
    }

    wx.showModal({
      title: '清空购物车',
      content: '确认移除当前已选餐品吗？',
      confirmColor: '#E63B4A',
      success: (result) => {
        if (result.confirm) {
          clearCartStorage()
          this.refreshCart()
        }
      }
    })
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
  },

  handleItemImageError(event) {
    const itemKey = event.currentTarget.dataset.key
    const items = this.data.items.map((item, index) => {
      if (item.item_key !== itemKey) {
        return item
      }

      if (item.image === FALLBACK_IMAGE) {
        return {
          ...item,
          image_available: false
        }
      }

      return {
        ...item,
        image: FALLBACK_IMAGE,
        image_style: getFallbackImageStyle(index),
        image_mode: 'aspectFit',
        image_available: true,
        is_placeholder_image: true
      }
    })

    this.setData({ items })
  },

  selectPickup(event) {
    if (this.data.submitting) {
      return
    }

    this.setData({
      pickupType: event.currentTarget.dataset.type
    })
  },

  getCreateOrderPickupType() {
    if (this.data.pickupType === 'dine') {
      return 'dine_in'
    }

    return 'self_pickup'
  },

  buildCreateOrderPayload() {
    const cartItems = getCartItems()
    const items = cartItems
      .map((item) => ({
        dish_id: item.dish_id,
        quantity: normalizeQuantity(item.quantity, 0),
        selected_specs: buildCreateOrderSpecs(item.selected_specs),
        selected_addons: buildCreateOrderAddons(item.selected_addons)
      }))
      .filter((item) => item.dish_id && Number.isInteger(item.quantity) && item.quantity > 0)
    const merchantId = cartItems[0] && cartItems[0].merchant_id
      ? cartItems[0].merchant_id
      : DEFAULT_MERCHANT_ID

    return {
      merchant_id: merchantId,
      items,
      remark: '',
      pickup_type: this.getCreateOrderPickupType()
    }
  },

  goToMenu() {
    wx.reLaunch({
      url: '/pages/user/menu/menu'
    })
  },

  goToOrders() {
    wx.navigateTo({
      url: '/pages/user/order-list/order-list'
    })
  },

  showSubmitError(error) {
    const code = getOrderErrorCode(error)

    if (!code) {
      wx.showToast({
        title: ORDER_NETWORK_ERROR_TEXT,
        icon: 'none'
      })
      return
    }

    if (shouldGuideToMenu(code)) {
      wx.showModal({
        title: '下单失败',
        content: ORDER_RESELECT_MESSAGE,
        cancelText: '我知道了',
        confirmText: '去菜单',
        confirmColor: '#E63B4A',
        success: (result) => {
          if (result.confirm) {
            this.goToMenu()
          }
        }
      })
      return
    }

    wx.showToast({
      title: getOrderErrorMessage(code),
      icon: 'none'
    })
  },

  async submitOrder() {
    if (this.data.submitting) {
      return
    }

    const payload = this.buildCreateOrderPayload()

    if (!payload.items.length) {
      wx.showToast({
        title: '购物车还是空的，先去点餐吧',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const order = await callCreateOrder(payload)

      clearCartStorage()
      this.refreshCart()

      wx.showModal({
        title: '下单成功',
        content: `订单号：${order.order_no || order.order_id || ''}`,
        cancelText: '继续点餐',
        confirmText: '查看订单',
        confirmColor: '#E63B4A',
        success: (result) => {
          if (result.confirm) {
            this.goToOrders()
          } else if (result.cancel) {
            this.goToMenu()
          }
        }
      })
    } catch (error) {
      console.error('submit order failed', error)
      this.showSubmitError(error)
    } finally {
      this.setData({
        submitting: false
      })
    }
  }
})
