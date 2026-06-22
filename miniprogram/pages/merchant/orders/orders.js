const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')
const { formatMoney, formatTime } = require('../../../utils/format')

const PAGE_SIZE = 20
const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'

const STATUS_FILTERS = [
  { key: 'all', label: '全部', status: '' },
  { key: 'pending', label: '待接单', status: 'pending' },
  { key: 'accepted', label: '已接单', status: 'accepted' },
  { key: 'cooking', label: '制作中', status: 'cooking' },
  { key: 'finished', label: '已完成', status: 'finished' },
  { key: 'cancelled', label: '已取消', status: 'cancelled' }
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
    next_status: 'accepted',
    confirm_title: '确认接单？',
    confirm_content: '接单后订单将进入待制作状态。',
    confirm_text: '确认接单'
  },
  accepted: {
    text: '开始制作',
    next_status: 'cooking',
    confirm_title: '确认开始制作？',
    confirm_content: '开始制作后，请及时完成出餐。',
    confirm_text: '开始制作'
  },
  cooking: {
    text: '完成订单',
    next_status: 'finished',
    confirm_title: '确认完成订单？',
    confirm_content: '完成后订单状态将不可回退。',
    confirm_text: '确认完成'
  }
}

const EMPTY_STATUS_TEXT = {
  all: {
    title: '暂无订单',
    desc: '有新订单后会显示在这里'
  },
  pending: {
    title: '暂无待接单订单',
    desc: '新的订单会出现在这里'
  },
  accepted: {
    title: '暂无已接单订单',
    desc: '接单后可以开始制作'
  },
  cooking: {
    title: '暂无制作中订单',
    desc: '开始制作的订单会显示在这里'
  },
  finished: {
    title: '暂无已完成订单',
    desc: '完成的订单会出现在这里'
  },
  cancelled: {
    title: '暂无已取消订单',
    desc: '取消的订单会出现在这里'
  }
}

const MERCHANT_ORDER_ERROR_TEXT = {
  FORBIDDEN: '当前账号没有商家权限，请检查商家人员配置',
  UNAUTHORIZED: '登录状态异常，请重新进入小程序',
  INVALID_PARAMS: '订单信息不完整，请刷新后重试',
  NOT_FOUND: '订单不存在或已被删除',
  ORDER_NOT_FOUND: '订单不存在或已被删除',
  ORDER_STATUS_INVALID: '订单状态已变化，请刷新后重试',
  ORDER_STATUS_FLOW_ERROR: '订单状态已变化，请刷新后重试',
  INVALID_STATUS: '订单状态已变化，请刷新后重试',
  STATUS_CONFLICT: '订单状态已变化，请刷新后重试',
  DATABASE_ERROR: '服务暂时不可用，请稍后重试'
}

function normalizeDateValue(value) {
  if (value && typeof value === 'object' && value.$date) {
    return value.$date
  }
  return value
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
    error.data = result.data || null
    error.result = result
    throw error
  }

  return result.data || {}
}

function getOrderId(order = {}) {
  return order.order_id || order._id || ''
}

function normalizeSelectedSpecs(selectedSpecs) {
  return Array.isArray(selectedSpecs) ? selectedSpecs : []
}

function normalizeSelectedAddons(selectedAddons) {
  return Array.isArray(selectedAddons) ? selectedAddons : []
}

function formatItemOptionText(item = {}) {
  const specText = normalizeSelectedSpecs(item.selected_specs)
    .map((spec) => spec.option_name || spec.name || '')
    .filter(Boolean)
    .join(' / ')
  const addonText = normalizeSelectedAddons(item.selected_addons)
    .reduce((result, group) => {
      const optionNames = Array.isArray(group.options)
        ? group.options
          .map((option) => option.option_name || option.name || '')
          .filter(Boolean)
        : []

      return result.concat(optionNames)
    }, [])
    .join('、')

  return [specText, addonText].filter(Boolean).join(' / ')
}

function buildItemSummary(items) {
  if (!Array.isArray(items) || !items.length) {
    return '暂无商品明细'
  }

  const names = items.slice(0, 2).map((item) => {
    const name = item.dish_name || item.name || '餐品'
    const quantity = Number(item.quantity) || 0
    const optionText = formatItemOptionText(item)
    const optionSuffix = optionText ? `（${optionText}）` : ''
    return `${name}${optionSuffix} x${quantity}`
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
    confirm_title: action ? action.confirm_title : '',
    confirm_content: action ? action.confirm_content : '',
    confirm_text: action ? action.confirm_text : '',
    items
  }
}

function getMerchantOrderErrorMessage(errorOrCode) {
  const code = typeof errorOrCode === 'string'
    ? errorOrCode
    : (errorOrCode && errorOrCode.code) || ''

  if (!code) {
    return '网络不太稳定，请稍后重试'
  }

  return MERCHANT_ORDER_ERROR_TEXT[code] || '操作失败，请稍后重试'
}

function getEmptyStateText(status) {
  const key = status || 'all'
  return EMPTY_STATUS_TEXT[key] || EMPTY_STATUS_TEXT.all
}

function confirmOrderAction(order) {
  return new Promise((resolve) => {
    wx.showModal({
      title: order.confirm_title || '确认操作？',
      content: order.confirm_content || '确认后订单状态将更新。',
      cancelText: '先等等',
      confirmText: order.confirm_text || '确认',
      confirmColor: '#E63B4A',
      success: (result) => {
        resolve(Boolean(result.confirm))
      },
      fail: () => {
        resolve(false)
      }
    })
  })
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
    statusFilters: STATUS_FILTERS,
    activeStatus: '',
    orders: [],
    emptyTitle: EMPTY_STATUS_TEXT.all.title,
    emptyDesc: EMPTY_STATUS_TEXT.all.desc,
    submittingOrderId: '',
    page: 1,
    pageSize: PAGE_SIZE
  },

  onReady() {
    this.setupNavigation()
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
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
      const data = await callMerchantFunction('getMerchantOrders', {
        merchant_id: DEFAULT_MERCHANT_ID,
        status: this.data.activeStatus,
        page: this.data.page,
        page_size: this.data.pageSize
      })
      const list = Array.isArray(data.list) ? data.list : []
      const orders = list.map(normalizeOrder)
      const emptyState = getEmptyStateText(this.data.activeStatus)

      this.setData({
        orders,
        emptyTitle: emptyState.title,
        emptyDesc: emptyState.desc,
        pageStatus: orders.length ? 'success' : 'empty'
      })
    } catch (error) {
      console.error('[merchant-orders] load orders failed:', error)
      this.setData({
        orders: [],
        pageStatus: 'error',
        errorMessage: getMerchantOrderErrorMessage(error)
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

    const order = this.data.orders.find((item) => item.order_id === id) || {}
    const confirmed = await confirmOrderAction(order)

    if (!confirmed) {
      return
    }

    this.setData({
      submittingOrderId: id
    })

    try {
      await callMerchantFunction('updateOrderStatus', {
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
      wx.showToast({
        title: getMerchantOrderErrorMessage(error),
        icon: 'none'
      })
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
