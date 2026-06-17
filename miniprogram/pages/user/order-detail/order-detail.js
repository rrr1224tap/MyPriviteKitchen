const { callFunction } = require('../../../utils/cloud')
const { formatMoney, formatTime } = require('../../../utils/format')

const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'

const ORDER_STATUS_TEXT = {
  pending: '待接单',
  accepted: '已接单',
  cooking: '制作中',
  finished: '已完成',
  cancelled: '已取消'
}

const ORDER_STATUS_CLASS = {
  pending: 'pending',
  accepted: 'accepted',
  cooking: 'cooking',
  finished: 'finished',
  cancelled: 'cancelled'
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

function getStatusText(status) {
  return ORDER_STATUS_TEXT[status] || '未知状态'
}

function getStatusClass(status) {
  return ORDER_STATUS_CLASS[status] || 'cancelled'
}

function formatOrderItem(item = {}) {
  const quantity = Number(item.quantity) || 0
  const unitPriceCent = Number(item.unit_price_cent || item.price_cent) || 0
  const subtotalCent = Number(item.subtotal_cent) || unitPriceCent * quantity

  return {
    ...item,
    dish_name: item.dish_name || '餐品',
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
        time: order.cancelled_time || '时间待确认',
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
  const activeIndex = orderIndex[status] || 0

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
      time: order.accepted_time || '等待商家接单',
      done: activeIndex >= 1,
      active: activeIndex === 1
    },
    {
      key: 'cooking',
      title: '正在制作中',
      time: order.cooking_time || '等待开始制作',
      done: activeIndex >= 2,
      active: activeIndex === 2
    },
    {
      key: 'finished',
      title: '订单已完成',
      time: order.finished_time || '等待完成',
      done: activeIndex >= 3,
      active: activeIndex === 3
    }
  ]
}

function normalizeOrderDetail(data = {}) {
  const order = data.order || {}
  const status = order.status || 'pending'
  const items = Array.isArray(data.items) ? data.items.map(formatOrderItem) : []
  const createdTime = formatTime(normalizeDateValue(order.created_at))
  const acceptedTime = formatTime(normalizeDateValue(order.accepted_at))
  const cookingTime = formatTime(normalizeDateValue(order.cooking_at))
  const finishedTime = formatTime(normalizeDateValue(order.finished_at))
  const cancelledTime = formatTime(normalizeDateValue(order.cancelled_at))

  const normalizedOrder = {
    ...order,
    order_id: getOrderId(order),
    order_no: order.order_no || getOrderId(order),
    status,
    status_text: getStatusText(status),
    status_class: getStatusClass(status),
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
    progress: []
  },

  onLoad(options = {}) {
    this.setupNavigation()

    const orderId = options.order_id || ''

    if (!orderId) {
      this.setData({
        pageStatus: 'error',
        errorMessage: '缺少订单 ID，请从订单列表进入详情页'
      })
      return
    }

    this.setData({
      orderId
    })
    this.loadOrderDetail(orderId)
  },

  onShow() {
    if (this.data.orderId && this.data.pageStatus !== 'loading') {
      this.loadOrderDetail(this.data.orderId)
    }
  },

  onPullDownRefresh() {
    if (!this.data.orderId) {
      wx.stopPullDownRefresh()
      return
    }

    this.loadOrderDetail(this.data.orderId).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = systemInfo.statusBarHeight || 20
    const navigationHeight = menuButton
      ? menuButton.bottom + menuButton.top - statusBarHeight
      : 44

    this.setData({
      statusBarHeight,
      navigationHeight
    })
  },

  async loadOrderDetail(orderId) {
    this.setData({
      pageStatus: 'loading',
      errorMessage: ''
    })

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
        progress: detail.progress
      })
    } catch (error) {
      console.error('[order-detail] load order detail failed:', error)
      this.setData({
        pageStatus: 'error',
        errorMessage: error.message || '订单详情加载失败，请稍后重试'
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
        errorMessage: '缺少订单 ID，请从订单列表进入详情页'
      })
      return
    }

    this.loadOrderDetail(this.data.orderId)
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
  }
})
