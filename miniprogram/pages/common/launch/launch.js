Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    homeReference: '/images/mock/home-glass-display.jpg',
    homeImageAvailable: true
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
    wx.navigateTo({
      url: '/pages/merchant/dashboard/dashboard'
    })
  }
})
