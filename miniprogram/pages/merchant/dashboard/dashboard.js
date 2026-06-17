Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: '/images/mock/home-glass-display.jpg',
    backgroundImageAvailable: true
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = systemInfo.statusBarHeight || 20
    const navigationHeight = menuButton
      ? menuButton.bottom + menuButton.top - statusBarHeight
      : 44

    this.setData({
      statusBarHeight,
      navigationHeight
    })
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  },

  goToOrders() {
    wx.navigateTo({
      url: '/pages/merchant/orders/orders'
    })
  },

  goToUserHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
