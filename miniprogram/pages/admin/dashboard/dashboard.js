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

function getFriendlyError(error = {}) {
  const code = error.code || (error.result && error.result.code)

  if (code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (code === 'DATABASE_ERROR') {
    return '系统管理身份加载失败，请稍后重试'
  }

  return '系统管理身份加载失败，请稍后重试'
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    pageStatus: 'loading',
    errorMessage: '',
    profile: null,
    modules: [
      {
        title: '商户管理',
        desc: '维护商户基础信息',
        tag: '已开放',
        action: 'merchants'
      },
      {
        title: '商户成员',
        desc: '后续用于管理商家人员身份',
        tag: '待开放'
      },
      {
        title: '邀请码',
        desc: '后续用于生成和核销商家邀请码',
        tag: '待开放'
      },
      {
        title: '数据概览',
        desc: '后续用于查看系统级经营概览',
        tag: '待开放'
      }
    ]
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.loadAdminProfile()
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  async loadAdminProfile() {
    this.setData({
      pageStatus: 'loading',
      errorMessage: ''
    })

    try {
      const result = await wx.cloud.callFunction({
        name: 'getAdminProfile',
        data: {}
      })
      const response = result && result.result

      if (!response || response.success !== true) {
        throw response || new Error('getAdminProfile failed')
      }

      const profile = response.data || {}
      this.setData({
        profile,
        pageStatus: profile.is_super_admin ? 'success' : 'no_permission'
      })
    } catch (error) {
      console.warn('[admin-dashboard] load admin profile failed:', error)
      this.setData({
        pageStatus: 'error',
        errorMessage: getFriendlyError(error)
      })
    }
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    this.goMerchantDashboard()
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  },

  goMerchantDashboard() {
    wx.redirectTo({
      url: '/pages/merchant/dashboard/dashboard'
    })
  },

  handleModuleTap(event) {
    const action = event.currentTarget.dataset.action
    if (action === 'merchants') {
      wx.navigateTo({
        url: '/pages/admin/merchants/merchants'
      })
      return
    }

    wx.showToast({
      title: '暂未开放',
      icon: 'none'
    })
  }
})
