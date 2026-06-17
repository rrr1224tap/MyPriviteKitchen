const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney, formatTime } = require('../../../utils/format')

const PAGE_SIZE = 20
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

function getOrderId(order) {
  return order.order_id || order._id || ''
}

function normalizeDateValue(value) {
  if (value && typeof value === 'object' && value.$date) {
    return value.$date
  }
  return value
}

function buildItemSummary(items) {
  if (!Array.isArray(items) || !items.length) {
    return '暂无商品明细'
  }

  const names = items.slice(0, 2).map((item) => {
    const name = item.dish_name || item.name || '餐品'
    const quantity = Number(item.quantity) || 0
    return `${name} x${quantity}`
  })

  return items.length > 2 ? `${names.join('、')} 等${items.length}件` : names.join('、')
}

function normalizeOrder(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const status = order.status || 'pending'
  const itemCount = Number(order.item_count) || items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return {
    ...order,
    order_id: getOrderId(order),
    order_no: order.order_no || getOrderId(order),
    status,
    status_text: ORDER_STATUS_TEXT[status] || '未知状态',
    status_class: ORDER_STATUS_CLASS[status] || 'cancelled',
    created_time: formatTime(normalizeDateValue(order.created_at)) || '时间待确认',
    item_summary: buildItemSummary(items),
    item_count_text: `${itemCount}件商品`,
    total_amount_text: formatMoney(order.total_amount_cent),
    items
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
    pageSize: PAGE_SIZE
  },

  onLoad() {
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

  onShow() {
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.loadOrders().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadOrders() {
    this.setData({
      pageStatus: 'loading',
      errorMessage: ''
    })

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
        pageStatus: orders.length ? 'success' : 'empty'
      })
    } catch (error) {
      console.error('[order-list] load orders failed:', error)
      this.setData({
        orders: [],
        pageStatus: 'error',
        errorMessage: error.message || '订单加载失败，请稍后重试'
      })
    }
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
  },

  retryLoad() {
    this.loadOrders()
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
  }
})
