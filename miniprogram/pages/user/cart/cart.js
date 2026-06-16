const { formatMoney } = require('../../../utils/format')
const cartUtils = require('../../../utils/cart')

const DISCOUNT_CENT = 600
const FALLBACK_IMAGE = '/images/mock/menu-glass-display.jpg'
const FALLBACK_BACKGROUND = '/images/mock/home-glass-display.jpg'
const FALLBACK_IMAGE_STYLES = [
  'width: 750rpx; left: -192rpx; top: -846rpx;',
  'width: 750rpx; left: -192rpx; top: -676rpx;',
  'width: 1300rpx; left: -359rpx; top: -1768rpx;',
  'width: 750rpx; left: -410rpx; top: -412rpx;'
]

function getFallbackImageStyle(index) {
  return FALLBACK_IMAGE_STYLES[index % FALLBACK_IMAGE_STYLES.length]
}

function decorateItems(items) {
  return items.map((item, index) => {
    const hasRealImage = Boolean(item.image_url)
    const priceCent = Number(item.price_cent) || 0
    const quantity = Number(item.quantity) || 1

    return {
      ...item,
      spec: item.spec || '标准份 · 门店现做',
      image: hasRealImage ? item.image_url : FALLBACK_IMAGE,
      image_style: hasRealImage
        ? 'width: 100%; height: 100%; left: 0; top: 0;'
        : getFallbackImageStyle(index),
      image_mode: hasRealImage ? 'aspectFill' : 'widthFix',
      image_available: true,
      price_text: formatMoney(priceCent),
      subtotal_text: formatMoney(priceCent * quantity)
    }
  })
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
    pickupType: 'pickup'
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
    const items = cartUtils.getCartItems()
    const summary = cartUtils.getCartSummary()
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
    const dishId = event.currentTarget.dataset.id
    const step = Number(event.currentTarget.dataset.step)
    const currentItem = this.data.items.find((item) => item.dish_id === dishId)

    if (!currentItem || !Number.isFinite(step)) {
      return
    }

    cartUtils.updateCartItemQuantity(dishId, currentItem.quantity + step)
    this.refreshCart()
  },

  clearCart() {
    wx.showModal({
      title: '清空购物车',
      content: '确认移除当前已选餐品吗？',
      confirmColor: '#E63B4A',
      success: (result) => {
        if (result.confirm) {
          cartUtils.clearCart()
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
    const dishId = event.currentTarget.dataset.id
    const items = this.data.items.map((item, index) => {
      if (item.dish_id !== dishId) {
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
        image_mode: 'widthFix',
        image_available: true
      }
    })

    this.setData({ items })
  },

  selectPickup(event) {
    this.setData({
      pickupType: event.currentTarget.dataset.type
    })
  },

  goToMenu() {
    wx.reLaunch({
      url: '/pages/user/menu/menu'
    })
  },

  submitMockOrder() {
    if (!this.data.items.length) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '提交订单功能下一步接入',
      icon: 'none'
    })
  }
})
