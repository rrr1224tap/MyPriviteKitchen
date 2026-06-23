const { login, isMerchantStaff } = require('../../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    homeReference: '/images/home/home-hero-bibimbap.jpg',
    homeImageAvailable: true,
    showMerchantEntry: false
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
