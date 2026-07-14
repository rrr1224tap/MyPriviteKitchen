const { login, isMerchantStaff } = require('../../../utils/auth')

const SHARE_TITLE = '朋友们的食堂｜看看今天吃什么'
const SHARE_IMAGE_URL = '/images/home/home-hero-bibimbap.jpg'

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

    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    })
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
