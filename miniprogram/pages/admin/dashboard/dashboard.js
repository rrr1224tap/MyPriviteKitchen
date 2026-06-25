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

function getOverviewError(error = {}) {
  const code = error.code || (error.result && error.result.code)

  if (code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (code === 'FORBIDDEN') {
    return '没有系统管理权限'
  }

  if (code === 'DATABASE_ERROR') {
    return '后台数据概览加载失败，请稍后重试'
  }

  return '后台数据概览加载失败，请稍后重试'
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatMoneyCent(value) {
  const cent = safeNumber(value)
  return `¥${(cent / 100).toFixed(2)}`
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function buildOverviewCards(overview = {}) {
  const merchants = overview.merchants || {}
  const staff = overview.staff || {}
  const invites = overview.invites || {}
  const dishes = overview.dishes || {}
  const categories = overview.categories || {}
  const orders = overview.orders || {}

  return [
    {
      title: '商户',
      value: safeNumber(merchants.total),
      desc: `启用 ${safeNumber(merchants.active)} / 禁用 ${safeNumber(merchants.disabled)}`,
      theme: 'red'
    },
    {
      title: '成员',
      value: safeNumber(staff.total),
      desc: `启用 ${safeNumber(staff.active)} / 停用 ${safeNumber(staff.disabled)}`,
      theme: 'orange'
    },
    {
      title: '邀请码',
      value: safeNumber(invites.total),
      desc: `未用 ${safeNumber(invites.unused)} / 过期 ${safeNumber(invites.expired)}`,
      theme: 'orange'
    },
    {
      title: '餐品',
      value: safeNumber(dishes.total),
      desc: `上架 ${safeNumber(dishes.on_sale)} / 缺食材 ${safeNumber(dishes.without_ingredients)}`,
      theme: 'green'
    },
    {
      title: '分类',
      value: safeNumber(categories.total),
      desc: `启用 ${safeNumber(categories.active)} / 停用 ${safeNumber(categories.disabled)}`,
      theme: 'green'
    },
    {
      title: '今日订单',
      value: safeNumber(orders.today_total),
      desc: `有效 ${safeNumber(orders.today_not_cancelled)} / 取消 ${safeNumber(orders.today_cancelled)}`,
      theme: 'red'
    }
  ]
}

function normalizeWarnings(warnings = []) {
  if (!Array.isArray(warnings)) {
    return []
  }

  return warnings.map((item, index) => ({
    id: item.type || `warning_${index}`,
    title: item.title || '需要关注',
    desc: item.desc || '',
    count: safeNumber(item.count)
  }))
}

function normalizeRecentOrders(recent = []) {
  if (!Array.isArray(recent)) {
    return []
  }

  return recent.map((order, index) => ({
    id: order.order_id || order.order_no || `recent_${index}`,
    order_no: order.order_no || order.order_id || '-',
    status_text: order.status_text || order.status || '状态更新中',
    total_amount_text: formatMoneyCent(order.total_amount_cent),
    created_at_text: formatDateTime(order.created_at),
    item_count: safeNumber(order.item_count)
  }))
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    pageStatus: 'loading',
    errorMessage: '',
    profile: null,
    overviewStatus: 'idle',
    overviewErrorMessage: '',
    overviewUpdatedAt: '',
    overviewCards: [],
    warnings: [],
    recentOrders: [],
    modules: [
      {
        title: '商户管理',
        desc: '维护商户基础信息',
        tag: '已开放',
        action: 'merchants'
      },
      {
        title: '数据检查',
        desc: '检查关键数据是否完整',
        tag: '已开放',
        action: 'dataHealth'
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
        desc: '当前页面展示只读系统概览',
        tag: '已展示'
      }
    ]
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.loadAdminProfile()
  },

  onPullDownRefresh() {
    this.loadAdminProfile().finally(() => {
      wx.stopPullDownRefresh()
    })
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

      if (profile.is_super_admin) {
        await this.loadAdminOverview({ showLoading: true })
      } else {
        this.resetOverview()
      }
    } catch (error) {
      console.warn('[admin-dashboard] load admin profile failed:', error)
      this.setData({
        pageStatus: 'error',
        errorMessage: getFriendlyError(error)
      })
    }
  },

  resetOverview() {
    this.setData({
      overviewStatus: 'idle',
      overviewErrorMessage: '',
      overviewUpdatedAt: '',
      overviewCards: [],
      warnings: [],
      recentOrders: []
    })
  },

  async loadAdminOverview(options = {}) {
    if (options.showLoading) {
      this.setData({
        overviewStatus: 'loading',
        overviewErrorMessage: ''
      })
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'getAdminOverview',
        data: {}
      })
      const response = result && result.result

      if (!response || response.success !== true) {
        throw response || new Error('getAdminOverview failed')
      }

      const overview = response.data || {}
      const orders = overview.orders || {}
      this.setData({
        overviewStatus: 'success',
        overviewErrorMessage: '',
        overviewUpdatedAt: formatDateTime(overview.generated_at),
        overviewCards: buildOverviewCards(overview),
        warnings: normalizeWarnings(overview.warnings),
        recentOrders: normalizeRecentOrders(orders.recent)
      })
    } catch (error) {
      console.warn('[admin-dashboard] load admin overview failed:', error)
      const code = error.code || (error.result && error.result.code)
      this.setData({
        pageStatus: code === 'FORBIDDEN' ? 'no_permission' : this.data.pageStatus,
        overviewStatus: 'error',
        overviewErrorMessage: getOverviewError(error)
      })
    }
  },

  refreshOverview() {
    if (this.data.pageStatus !== 'success') {
      this.loadAdminProfile()
      return
    }

    this.loadAdminOverview({ showLoading: true })
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

    if (action === 'dataHealth') {
      wx.navigateTo({
        url: '/pages/admin/data-health/data-health'
      })
      return
    }

    wx.showToast({
      title: '暂未开放',
      icon: 'none'
    })
  }
})
