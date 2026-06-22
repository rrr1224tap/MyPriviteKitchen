const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney, formatTime } = require('../../../utils/format')

const PAGE_SIZE = 20
const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'

const ORDER_STATUS_META = {
  pending: {
    text: '待商家接单',
    desc: '等待商家接单',
    className: 'pending'
  },
  accepted: {
    text: '商家已接单',
    desc: '商家已接单，等待制作',
    className: 'accepted'
  },
  cooking: {
    text: '制作中',
    desc: '商家正在制作，请稍候',
    className: 'cooking'
  },
  finished: {
    text: '已完成',
    desc: '订单已完成，感谢惠顾',
    className: 'finished'
  },
  cancelled: {
    text: '已取消',
    desc: '订单已取消',
    className: 'cancelled'
  }
}
const UNKNOWN_ORDER_STATUS_META = {
  text: '状态更新中',
  desc: '状态更新中，请稍后刷新',
  className: 'unknown'
}

function getOrderId(order) {
  return order.order_id || order._id || ''
}

function normalizeDateValue(value) {
  if (value && typeof value === 'object' && value.$date) {
    return value.$date
  }
  return value
}

function normalizeSelectedSpecs(selectedSpecs) {
  return Array.isArray(selectedSpecs) ? selectedSpecs : []
}

function normalizeSelectedAddons(selectedAddons) {
  return Array.isArray(selectedAddons) ? selectedAddons : []
}

function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[status] || UNKNOWN_ORDER_STATUS_META
}

function getOrderPageErrorMessage(error = {}) {
  const code = error.code || ''

  if (!code) {
    return '网络不太稳定，请稍后重试'
  }

  return '订单加载失败，请重新加载'
}

function getCancelOrderErrorMessage(error = {}) {
  const code = error.code || (error.result && error.result.code) || ''
  const messageMap = {
    UNAUTHORIZED: '登录状态异常，请重新进入小程序',
    INVALID_PARAMS: '订单信息不完整，请刷新后重试',
    NOT_FOUND: '订单不存在或已被删除',
    FORBIDDEN: '当前账号无法操作该订单',
    STATUS_CONFLICT: '订单状态已变化，当前不可取消，请刷新状态',
    DATABASE_ERROR: '服务暂时不可用，请稍后重试'
  }

  if (!code) {
    return '网络不太稳定，请稍后重试'
  }

  return messageMap[code] || '取消失败，请稍后重试'
}

function formatRefreshTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `最近更新：${hours}:${minutes}`
}

function showToastIfNeeded(error, message) {
  if (error && error.toastShown) {
    return
  }

  wx.showToast({
    title: message,
    icon: 'none'
  })
}

async function callCancelUserOrder(orderId) {
  const response = await wx.cloud.callFunction({
    name: 'cancelUserOrder',
    data: {
      order_id: orderId
    }
  })
  const result = response.result || {}

  if (!result.success) {
    const error = new Error(result.message || '取消失败')
    error.code = result.code || ''
    error.data = result.data || null
    error.result = result
    throw error
  }

  return result.data || {}
}

function formatSelectedSpecs(item = {}) {
  return normalizeSelectedSpecs(item.selected_specs)
    .map((spec) => spec.option_name || spec.name || '')
    .filter(Boolean)
    .join(' / ')
}

function formatSelectedAddons(item = {}) {
  return normalizeSelectedAddons(item.selected_addons).reduce((result, group) => {
    const optionNames = Array.isArray(group.options)
      ? group.options.map((option) => option.option_name || option.name || '').filter(Boolean)
      : []
    return result.concat(optionNames)
  }, []).join('、')
}

function formatItemOptionText(item = {}) {
  return [
    formatSelectedSpecs(item),
    formatSelectedAddons(item)
  ].filter(Boolean).join(' / ')
}

function buildItemSummary(items) {
  if (!Array.isArray(items) || !items.length) {
    return '商品信息暂不可用'
  }

  const names = items.slice(0, 2).map((item) => {
    const name = item.dish_name || item.name || '餐品'
    const quantity = Number(item.quantity) || 0
    const optionText = formatItemOptionText(item)
    const optionSuffix = optionText ? `（${optionText}）` : ''
    return `${name}${optionSuffix} x${quantity}`
  })

  return items.length > 2 ? `${names.join('、')} 等 ${items.length} 件` : names.join('、')
}

function normalizeOrder(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const status = order.status || ''
  const statusMeta = getOrderStatusMeta(status)
  const itemCount = Number(order.item_count) || items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return {
    ...order,
    order_id: getOrderId(order),
    order_no: order.order_no || getOrderId(order) || '待确认',
    status,
    status_text: statusMeta.text,
    status_desc: statusMeta.desc,
    status_class: statusMeta.className,
    can_cancel: status === 'pending',
    created_time: formatTime(normalizeDateValue(order.created_at)) || '时间待确认',
    item_summary: buildItemSummary(items),
    item_count_text: `${itemCount}件商品`,
    total_amount_text: formatMoney(order.total_amount_cent),
    items
  }
}

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
    backgroundImage: BACKGROUND_IMAGE,
    backgroundImageAvailable: true,
    pageStatus: 'loading',
    orders: [],
    errorMessage: '',
    page: 1,
    pageSize: PAGE_SIZE,
    cancellingOrderId: '',
    isRefreshing: false,
    lastUpdatedText: '',
    refreshMessage: ''
  },

  onReady() {
    this.setupNavigation()
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  onShow() {
    const hasLoaded = this.data.pageStatus !== 'loading'
    this.loadOrders({
      showLoading: !hasLoaded
    })
  },

  onPullDownRefresh() {
    this.loadOrders({
      showLoading: false
    }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadOrders(options = {}) {
    const hasCurrentOrders = this.data.orders.length > 0
    const showBlockingLoading = options.showLoading !== false && !hasCurrentOrders

    this.setData({
      errorMessage: '',
      refreshMessage: '',
      isRefreshing: !showBlockingLoading
    })

    if (showBlockingLoading) {
      this.setData({
        pageStatus: 'loading'
      })
    }

    try {
      const data = await callFunction('getUserOrders', {
        merchant_id: DEFAULT_MERCHANT_ID,
        page: this.data.page,
        page_size: this.data.pageSize
      })

      const list = Array.isArray(data.list) ? data.list : []
      const orders = list.map(normalizeOrder)

      this.setData({
        orders,
        pageStatus: orders.length ? 'success' : 'empty',
        lastUpdatedText: formatRefreshTime()
      })
    } catch (error) {
      console.error('[order-list] load orders failed:', error)
      const message = getOrderPageErrorMessage(error)

      if (hasCurrentOrders || !showBlockingLoading) {
        this.setData({
          refreshMessage: message
        })
        showToastIfNeeded(error, message)
      } else {
        this.setData({
          orders: [],
          pageStatus: 'error',
          errorMessage: message
        })
      }
    } finally {
      this.setData({
        isRefreshing: false
      })
    }
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
  },

  retryLoad() {
    this.loadOrders({
      showLoading: true
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

  goToMenu() {
    wx.navigateTo({
      url: '/pages/user/menu/menu'
    })
  },

  openOrder(event) {
    const orderId = event.currentTarget.dataset.id
    if (!orderId) {
      wx.showToast({
        title: '订单信息不完整',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/user/order-detail/order-detail?order_id=${encodeURIComponent(orderId)}`
    })
  },

  confirmCancelOrder(event) {
    const orderId = event.currentTarget.dataset.id

    if (!orderId || this.data.cancellingOrderId) {
      return
    }

    wx.showModal({
      title: '确认取消订单？',
      content: '订单取消后不可恢复，请确认是否取消。',
      cancelText: '再想想',
      confirmText: '确认取消',
      confirmColor: '#e63b4a',
      success: (res) => {
        if (res.confirm) {
          this.cancelOrder(orderId)
        }
      }
    })
  },

  async cancelOrder(orderId) {
    this.setData({
      cancellingOrderId: orderId
    })

    try {
      await callCancelUserOrder(orderId)
      wx.showToast({
        title: '订单已取消',
        icon: 'success'
      })
      await this.loadOrders({
        showLoading: false
      })
    } catch (error) {
      console.error('[order-list] cancel order failed:', error)
      wx.showToast({
        title: getCancelOrderErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        cancellingOrderId: ''
      })
    }
  }
})
