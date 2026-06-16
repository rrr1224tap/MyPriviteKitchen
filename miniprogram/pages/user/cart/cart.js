const { formatMoney } = require('../../../utils/format')

const DISCOUNT_CENT = 600

const INITIAL_ITEMS = [
  {
    dish_id: 'dish_002',
    name: '招牌肥牛石锅拌饭',
    spec: '标准份 · 门店现做',
    image: '/images/mock/menu-glass-display.jpg',
    image_style: 'width: 750rpx; left: -192rpx; top: -846rpx;',
    price_cent: 2990,
    quantity: 1,
    image_available: true
  },
  {
    dish_id: 'dish_001',
    name: '经典肉酱砂锅米线',
    spec: '标准份 · 门店现做',
    image: '/images/mock/menu-glass-display.jpg',
    image_style: 'width: 750rpx; left: -192rpx; top: -676rpx;',
    price_cent: 2590,
    quantity: 1,
    image_available: true
  }
]

function decorateItems(items) {
  return items.map((item) => Object.assign({}, item, {
    price_text: formatMoney(item.price_cent),
    subtotal_text: formatMoney(item.price_cent * item.quantity)
  }))
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: '/images/mock/home-glass-display.jpg',
    backgroundImageAvailable: true,
    items: decorateItems(INITIAL_ITEMS),
    totalCount: 2,
    subtotalAmountText: formatMoney(5580),
    discountAmountText: formatMoney(DISCOUNT_CENT),
    payableAmountText: formatMoney(4980),
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
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    this.goToMenu()
  },

  updateSummary(items) {
    const summary = items.reduce((result, item) => ({
      totalCount: result.totalCount + item.quantity,
      subtotalAmountCent: result.subtotalAmountCent + item.price_cent * item.quantity
    }), {
      totalCount: 0,
      subtotalAmountCent: 0
    })
    const discountAmountCent = items.length ? Math.min(DISCOUNT_CENT, summary.subtotalAmountCent) : 0
    const payableAmountCent = summary.subtotalAmountCent - discountAmountCent

    this.setData({
      items: decorateItems(items),
      totalCount: summary.totalCount,
      subtotalAmountText: formatMoney(summary.subtotalAmountCent),
      discountAmountText: formatMoney(discountAmountCent),
      payableAmountText: formatMoney(payableAmountCent)
    })
  },

  changeQuantity(event) {
    const dishId = event.currentTarget.dataset.id
    const step = Number(event.currentTarget.dataset.step)
    const nextItems = this.data.items
      .map((item) => item.dish_id === dishId
        ? Object.assign({}, item, { quantity: item.quantity + step })
        : item)
      .filter((item) => item.quantity > 0)

    this.updateSummary(nextItems)
  },

  clearCart() {
    wx.showModal({
      title: '清空购物车',
      content: '确认移除当前已选餐品吗？',
      confirmColor: '#E63B4A',
      success: (result) => {
        if (result.confirm) {
          this.updateSummary([])
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
    const items = this.data.items.map((item) => item.dish_id === dishId
      ? Object.assign({}, item, { image_available: false })
      : item)

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
    wx.showToast({
      title: '提交订单将在后续接入',
      icon: 'none'
    })
  }
})
