function getNavigationMetrics() {
  const windowInfo = wx.getWindowInfo
    ? wx.getWindowInfo()
    : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : {})
  const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
  const statusBarHeight = windowInfo.statusBarHeight || 20
  const navigationHeight = menuButton
    ? menuButton.bottom + menuButton.top - statusBarHeight
    : 44

  return {
    statusBarHeight,
    navigationHeight
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: '/images/mock/home-glass-display.jpg',
    backgroundImageAvailable: true
  },

  onReady() {
    this.setupNavigation()
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
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

  goToCategories() {
    wx.navigateTo({
      url: '/pages/merchant/categories/categories'
    })
  },

  goToDishes() {
    wx.navigateTo({
      url: '/pages/merchant/dishes/dishes'
    })
  },

  goToUserHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
