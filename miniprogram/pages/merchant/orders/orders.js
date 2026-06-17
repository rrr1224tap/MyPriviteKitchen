const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney, formatTime } = require('../../../utils/format')

const PAGE_SIZE = 20
const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'

const STATUS_FILTERS = [
  { key: 'all', label: '全部', status: '' },
  { key: 'pending', label: '待接单', status: 'pending' },
  { key: 'accepted', label: '已接单', status: 'accepted' },
  { key: 'cooking', label: '制作中', status: 'cooking' },
  { key: 'finished', label: '已完成', status: 'finished' }
]

const ORDER_STATUS_TEXT = {
  pending: '待接单',
  accepted: '已接单',
  cooking: '制作中',
  finished: '已完成',
  cancelled: '已取消'
}

const ORDER_ACTIONS = {
  pending: {
    text: '接单',
    next_status: 'accepted'
  },
  accepted: {
    text: '开始制作',
    next_status: 'cooking'
  },
  cooking: {
    text: '完成订单',
    next_status: 'finished'
  }
}

function normalizeDateValue(value) {
  if (value && typeof value === 'object' && value.$date) {
    return value.$date
  }
  return value
}

function getOrderId(order = {}) {
  return order.order_id || order._id || ''
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

function normalizeOrder(order = {}) {
  const items = Array.isArray(order.items) ? order.items : []
  const status = order.status || 'pending'
  const action = ORDER_ACTIONS[status] || null
  const itemCount = Number(order.item_count) ||
    items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return {
    ...order,
    order_id: getOrderId(order),
    order_no: order.order_no || getOrderId(order),
    status,
    status_text: ORDER_STATUS_TEXT[status] || '未知状态',
    status_class: ORDER_STATUS_TEXT[status] ? status : 'cancelled',
    created_time: formatTime(normalizeDateValue(order.created_at)) || '时间待确认',
    item_summary: buildItemSummary(items),
    item_count_text: `${itemCount}件商品`,
    total_amount_text: formatMoney(order.total_amount_cent),
    remark_text: order.remark || '',
    action_text: action ? action.text : '',
    next_status: action ? action.next_status : '',
    items
  }
}

function getForbiddenMessage(error) {
  if (error && error.code === 'FORBIDDEN') {
    return '当前账号没有商家权限，请先配置 merchant_staff'
  }
  return ''
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: BACKGROUND_IMAGE,
    backgroundImageAvailable: true,
    pageStatus: 'loading',
    errorMessage: '',
    statusFilters: STATUS_FILTERS,
    activeStatus: '',
    orders: [],
    submittingOrderId: '',
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
      const data = await callFunction('getMerchantOrders', {
        merchant_id: DEFAULT_MERCHANT_ID,
        status: this.data.activeStatus,
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
      console.error('[merchant-orders] load orders failed:', error)
      this.setData({
        orders: [],
        pageStatus: 'error',
        errorMessage: getForbiddenMessage(error) ||
          error.message ||
          '商家订单加载失败，请稍后重试'
      })
    }
  },

  handleFilterTap(event) {
    const status = event.currentTarget.dataset.status || ''

    if (status === this.data.activeStatus) {
      return
    }

    this.setData({
      activeStatus: status,
      page: 1
    })
    this.loadOrders()
  },

  handleOrderTap(event) {
    const orderId = event.currentTarget.dataset.id || ''

    if (!orderId) {
      return
    }

    wx.navigateTo({
      url: `/pages/merchant/order-detail/order-detail?order_id=${orderId}`
    })
  },

  async handleOrderAction(event) {
    const { id, nextStatus } = event.currentTarget.dataset

    if (!id || !nextStatus || this.data.submittingOrderId) {
      return
    }

    this.setData({
      submittingOrderId: id
    })

    try {
      await callFunction('updateOrderStatus', {
        merchant_id: DEFAULT_MERCHANT_ID,
        order_id: id,
        next_status: nextStatus
      })

      wx.showToast({
        title: '操作成功',
        icon: 'success'
      })

      await this.loadOrders()
    } catch (error) {
      console.error('[merchant-orders] update status failed:', error)
      const message = getForbiddenMessage(error) ||
        error.message ||
        '订单状态更新失败'

      if (!error.toastShown || error.code === 'FORBIDDEN') {
        wx.showToast({
          title: message,
          icon: 'none'
        })
      }
    } finally {
      this.setData({
        submittingOrderId: ''
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

    wx.redirectTo({
      url: '/pages/merchant/dashboard/dashboard'
    })
  }
})
