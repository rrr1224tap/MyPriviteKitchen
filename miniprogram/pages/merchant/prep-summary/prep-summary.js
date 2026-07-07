const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')

const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'
const MERCHANT_PERMISSION_TITLE = '需要注册食堂身份'
const MERCHANT_PERMISSION_MESSAGE = '当前账号暂未开通食堂身份，请联系管理员注册 / 开通后再进入商家工作台。'

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

function isPermissionError(error = {}) {
  return error.code === 'FORBIDDEN'
}

function getErrorMessage(error = {}) {
  if (error.code === 'FORBIDDEN') {
    return MERCHANT_PERMISSION_MESSAGE
  }

  if (error.code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (error.code === 'INVALID_PARAMS') {
    return '商家信息不完整，请返回首页后重试'
  }

  return '备料清单加载失败，请稍后重试'
}

async function callMerchantFunction(name, data) {
  const response = await wx.cloud.callFunction({
    name,
    data
  })
  const result = response.result || {}

  if (!result.success) {
    const error = new Error(result.message || '操作失败')
    error.code = result.code || ''
    error.result = result
    throw error
  }

  return result.data || {}
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: BACKGROUND_IMAGE,
    backgroundImageAvailable: true,
    pageStatus: 'loading',
    errorTitle: '',
    errorMessage: '',
    isPermissionError: false,
    summary: {
      date: '',
      order_count: 0,
      item_count: 0,
      dish_count: 0,
      ingredient_count: 0,
      groups: [],
      copy_text: ''
    },
    refreshing: false
  },

  onLoad() {
    this.setupNavigation()
    this.loadPrepSummary()
  },

  onPullDownRefresh() {
    this.loadPrepSummary({ showLoading: false }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  async loadPrepSummary(options = {}) {
    const showLoading = options.showLoading !== false && !this.data.summary.date

    this.setData({
      errorTitle: '',
      errorMessage: '',
      isPermissionError: false,
      refreshing: !showLoading
    })

    if (showLoading) {
      this.setData({
        pageStatus: 'loading'
      })
    }

    try {
      const summary = await callMerchantFunction('getPrepSummary', {
        merchant_id: DEFAULT_MERCHANT_ID
      })
      const orderCount = Number(summary.order_count) || 0
      const ingredientCount = Number(summary.ingredient_count) || 0
      let pageStatus = 'success'

      if (!orderCount) {
        pageStatus = 'empty_orders'
      } else if (!ingredientCount) {
        pageStatus = 'empty_ingredients'
      }

      this.setData({
        pageStatus,
        summary: {
          date: summary.date || '',
          order_count: orderCount,
          item_count: Number(summary.item_count) || 0,
          dish_count: Number(summary.dish_count) || 0,
          ingredient_count: ingredientCount,
          groups: Array.isArray(summary.groups) ? summary.groups : [],
          copy_text: summary.copy_text || ''
        },
        refreshing: false
      })
      return true
    } catch (error) {
      console.error('[prep-summary] load failed:', error)
      this.setData({
        pageStatus: 'error',
        errorTitle: isPermissionError(error) ? MERCHANT_PERMISSION_TITLE : '备料清单加载失败',
        errorMessage: getErrorMessage(error),
        isPermissionError: isPermissionError(error),
        refreshing: false
      })
      return false
    }
  },

  handleRefresh() {
    if (this.data.refreshing) {
      return
    }

    this.loadPrepSummary({ showLoading: false })
  },

  handleCopySummary() {
    const text = this.data.summary.copy_text || ''
    if (!text) {
      wx.showToast({
        title: '暂无可复制内容',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制采购清单',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
  },

  retryLoad() {
    this.loadPrepSummary()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: '/pages/merchant/dashboard/dashboard'
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
