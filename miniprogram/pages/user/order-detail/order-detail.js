const { callFunction } = require('../../../utils/cloud')
const { formatMoney, formatTime } = require('../../../utils/format')

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

const PICKUP_TYPE_TEXT = {
  pickup: '到店自提',
  self_pickup: '到店自提',
  dine_in: '堂食',
  delivery: '外卖配送'
}

function normalizeDateValue(value) {
  if (value && typeof value === 'object' && value.$date) {
    return value.$date
  }
  return value
}

function getOrderId(order) {
  return order.order_id || order._id || ''
}

function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[status] || UNKNOWN_ORDER_STATUS_META
}

function getOrderPageErrorMessage(error = {}) {
  const code = error.code || ''

  if (!code) {
    return '网络不太稳定，请稍后重试'
  }

  return '订单信息暂时不可用，请稍后重试'
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

function normalizeSelectedSpecs(selectedSpecs) {
  return Array.isArray(selectedSpecs) ? selectedSpecs : []
}

function normalizeSelectedAddons(selectedAddons) {
  return Array.isArray(selectedAddons) ? selectedAddons : []
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

function formatOrderItem(item = {}, index = 0) {
  const quantity = Number(item.quantity) || 0
  const unitPriceCent = Number(item.unit_price_cent || item.price_cent) || 0
  const subtotalCent = Number(item.subtotal_cent) || unitPriceCent * quantity
  const specText = formatSelectedSpecs(item)
  const addonText = formatSelectedAddons(item)

  return {
    ...item,
    item_key: item.order_item_id || item._id || item.item_key || item.dish_id || `item_${index}`,
    dish_name: item.dish_name || '餐品',
    selected_specs: normalizeSelectedSpecs(item.selected_specs),
    selected_addons: normalizeSelectedAddons(item.selected_addons),
    spec_text: specText ? `规格：${specText}` : '',
    addon_text: addonText ? `加料：${addonText}` : '',
    has_options: Boolean(specText || addonText),
    quantity,
    unit_price_text: formatMoney(unitPriceCent),
    subtotal_text: formatMoney(subtotalCent)
  }
}

function buildProgress(order) {
  const status = order.status

  if (status === 'cancelled') {
    return [
      {
        key: 'pending',
        title: '订单已提交',
        time: order.created_time,
        done: true,
        active: false
      },
      {
        key: 'cancelled',
        title: '订单已取消',
        time: order.cancelled_time || '等待更新',
        done: true,
        active: true
      }
    ]
  }

  const orderIndex = {
    pending: 0,
    accepted: 1,
    cooking: 2,
    finished: 3
  }

  if (!Object.prototype.hasOwnProperty.call(orderIndex, status)) {
    return [
      {
        key: 'unknown',
        title: '状态更新中',
        time: '请稍后刷新',
        done: true,
        active: true
      }
    ]
  }

  const activeIndex = orderIndex[status]

  return [
    {
      key: 'pending',
      title: '订单已提交',
      time: order.created_time,
      done: activeIndex >= 0,
      active: activeIndex === 0
    },
    {
      key: 'accepted',
      title: '商家已接单',
      time: order.accepted_time || '等待更新',
      done: activeIndex >= 1,
      active: activeIndex === 1
    },
    {
      key: 'cooking',
      title: '正在制作中',
      time: order.cooking_time || '等待更新',
      done: activeIndex >= 2,
      active: activeIndex === 2
    },
    {
      key: 'finished',
      title: '订单已完成',
      time: order.finished_time || '等待更新',
      done: activeIndex >= 3,
      active: activeIndex === 3
    }
  ]
}

function normalizeOrderDetail(data = {}) {
  const order = data.order || {}
  const status = order.status || ''
  const statusMeta = getOrderStatusMeta(status)
  const rawItems = Array.isArray(data.items)
    ? data.items
    : (Array.isArray(order.items) ? order.items : [])
  const items = rawItems.map(formatOrderItem)
  const createdTime = formatTime(normalizeDateValue(order.created_at))
  const acceptedTime = formatTime(normalizeDateValue(order.accepted_at))
  const cookingTime = formatTime(normalizeDateValue(order.cooking_at))
  const finishedTime = formatTime(normalizeDateValue(order.finished_at))
  const cancelledTime = formatTime(normalizeDateValue(order.cancelled_at))

  const normalizedOrder = {
    ...order,
    order_id: getOrderId(order),
    order_no: order.order_no || getOrderId(order) || '待确认',
    status,
    status_text: statusMeta.text,
    status_desc: statusMeta.desc,
    status_class: statusMeta.className,
    can_cancel: status === 'pending',
    created_time: createdTime || '时间待确认',
    accepted_time: acceptedTime,
    cooking_time: cookingTime,
    finished_time: finishedTime,
    cancelled_time: cancelledTime,
    pickup_type_text: PICKUP_TYPE_TEXT[order.pickup_type] || '到店自提',
    remark_text: order.remark || '无备注',
    item_count_text: `${Number(order.item_count) || items.reduce((sum, item) => sum + item.quantity, 0)}件商品`,
    total_amount_text: formatMoney(order.total_amount_cent)
  }

  return {
    order: normalizedOrder,
    items,
    progress: buildProgress(normalizedOrder)
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
    errorMessage: '',
    orderId: '',
    order: null,
    items: [],
    progress: [],
    cancelling: false,
    isRefreshing: false,
    lastUpdatedText: '',
    refreshMessage: ''
  },

  onLoad(options = {}) {
    const orderId = options.order_id || ''

    if (!orderId) {
      this.setData({
        pageStatus: 'error',
        errorMessage: '订单信息暂时不可用，请从订单列表重新进入'
      })
      return
    }

    this.setData({
      orderId
    })
    this.loadOrderDetail(orderId)
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    if (this.data.orderId && this.data.pageStatus !== 'loading') {
      this.loadOrderDetail(this.data.orderId, {
        showLoading: false
      })
    }
  },

  onPullDownRefresh() {
    if (!this.data.orderId) {
      wx.stopPullDownRefresh()
      return
    }

    this.loadOrderDetail(this.data.orderId, {
      showLoading: false
    }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  async loadOrderDetail(orderId, options = {}) {
    const hasCurrentOrder = Boolean(this.data.order)
    const showBlockingLoading = options.showLoading !== false && !hasCurrentOrder

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
      const data = await callFunction('getOrderDetail', {
        order_id: orderId
      })

      if (!data || !data.order) {
        this.setData({
          pageStatus: 'empty',
          order: null,
          items: [],
          progress: []
        })
        return
      }

      const detail = normalizeOrderDetail(data)

      this.setData({
        pageStatus: 'success',
        order: detail.order,
        items: detail.items,
        progress: detail.progress,
        lastUpdatedText: formatRefreshTime()
      })
    } catch (error) {
      console.error('[order-detail] load order detail failed:', error)
      const message = getOrderPageErrorMessage(error)

      if (hasCurrentOrder || !showBlockingLoading) {
        this.setData({
          refreshMessage: message
        })
        showToastIfNeeded(error, message)
      } else {
        this.setData({
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
    if (!this.data.orderId) {
      this.setData({
        pageStatus: 'error',
        errorMessage: '订单信息暂时不可用，请从订单列表重新进入'
      })
      return
    }

    this.loadOrderDetail(this.data.orderId, {
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
      url: '/pages/user/order-list/order-list'
    })
  },

  goToMenu() {
    wx.navigateTo({
      url: '/pages/user/menu/menu'
    })
  },

  refreshOrderStatus() {
    if (!this.data.orderId || this.data.isRefreshing || this.data.cancelling) {
      return
    }

    this.loadOrderDetail(this.data.orderId, {
      showLoading: false
    })
  },

  confirmCancelOrder() {
    if (!this.data.order || !this.data.order.can_cancel || this.data.cancelling) {
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
          this.cancelOrder()
        }
      }
    })
  },

  async cancelOrder() {
    const orderId = this.data.orderId || (this.data.order && this.data.order.order_id)

    if (!orderId || this.data.cancelling || this.data.isRefreshing) {
      return
    }

    this.setData({
      cancelling: true
    })

    try {
      await callCancelUserOrder(orderId)
      wx.showToast({
        title: '订单已取消',
        icon: 'success'
      })
      await this.loadOrderDetail(orderId, {
        showLoading: false
      })
    } catch (error) {
      console.error('[order-detail] cancel order failed:', error)
      wx.showToast({
        title: getCancelOrderErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        cancelling: false
      })
    }
  }
})
