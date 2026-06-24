const { login, isMerchantStaff } = require('../../../utils/auth')

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
    backgroundImageAvailable: true,
    pageStatus: 'checking',
    isSuperAdmin: false
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.checkMerchantAccess()
  },

  async checkMerchantAccess() {
    this.setData({
      pageStatus: 'checking',
      isSuperAdmin: false
    })

    try {
      await login()
      const hasMerchantAccess = isMerchantStaff()

      if (!hasMerchantAccess) {
        this.setData({
          pageStatus: 'no_permission',
          isSuperAdmin: false
        })
        return
      }

      const adminProfile = await this.loadAdminProfile()
      this.setData({
        pageStatus: 'success',
        isSuperAdmin: Boolean(adminProfile && adminProfile.is_super_admin)
      })
    } catch (error) {
      console.warn('[merchant-dashboard] check merchant access failed:', error)
      this.setData({
        pageStatus: 'no_permission',
        isSuperAdmin: false
      })
    }
  },

  async loadAdminProfile() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getAdminProfile',
        data: {}
      })
      const response = result && result.result

      if (response && response.success === true) {
        return response.data || null
      }
    } catch (error) {
      console.warn('[merchant-dashboard] load admin profile failed:', error)
    }

    return null
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
    if (this.data.pageStatus !== 'success') {
      return
    }

    wx.navigateTo({
      url: '/pages/merchant/orders/orders'
    })
  },

  goToPrepSummary() {
    if (this.data.pageStatus !== 'success') {
      return
    }

    wx.navigateTo({
      url: '/pages/merchant/prep-summary/prep-summary'
    })
  },

  goToCategories() {
    if (this.data.pageStatus !== 'success') {
      return
    }

    wx.navigateTo({
      url: '/pages/merchant/categories/categories'
    })
  },

  goToDishes() {
    if (this.data.pageStatus !== 'success') {
      return
    }

    wx.navigateTo({
      url: '/pages/merchant/dishes/dishes'
    })
  },

  goToAdminDashboard() {
    if (this.data.pageStatus !== 'success' || !this.data.isSuperAdmin) {
      return
    }

    wx.navigateTo({
      url: '/pages/admin/dashboard/dashboard'
    })
  },

  goToUserHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
