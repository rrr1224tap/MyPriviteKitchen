const {
  DEFAULT_MERCHANT_ID,
  MERCHANT_ORDER_STATUS_TEXT
} = require('../../../utils/constants')
const { formatMoney, formatTime } = require('../../../utils/format')

const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'

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

function getStatusText(status) {
  return MERCHANT_ORDER_STATUS_TEXT[status] || '未知状态'
}

function getStatusClass(status) {
  return MERCHANT_ORDER_STATUS_TEXT[status] ? status : 'cancelled'
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
  return normalizeSelectedAddons(item.selected_addons)
    .reduce((result, group) => {
      const optionNames = Array.isArray(group.options)
        ? group.options
          .map((option) => option.option_name || option.name || '')
          .filter(Boolean)
        : []

      return result.concat(optionNames)
    }, [])
    .join('、')
}

function formatOrderItem(item = {}) {
  const quantity = Number(item.quantity) || 0
  const unitPriceCent = Number(item.unit_price_cent || item.price_cent) || 0
  const subtotalCent = Number(item.subtotal_cent) || unitPriceCent * quantity
  const specText = formatSelectedSpecs(item)
  const addonText = formatSelectedAddons(item)

  return {
    ...item,
    order_item_id: item.order_item_id || item._id || item.dish_id || '',
    dish_name: item.dish_name || '餐品',
    quantity,
    selected_specs: normalizeSelectedSpecs(item.selected_specs),
    selected_addons: normalizeSelectedAddons(item.selected_addons),
    spec_text: specText ? `规格：${specText}` : '',
    addon_text: addonText ? `加料：${addonText}` : '',
    unit_price_text: formatMoney(unitPriceCent),
    subtotal_text: formatMoney(subtotalCent)
  }
}

function normalizeOrderDetail(data = {}) {
  const order = data.order || {}
  const status = order.status || 'pending'
  const action = ORDER_ACTIONS[status] || null
  const items = Array.isArray(data.items) ? data.items.map(formatOrderItem) : []
  const itemCount = Number(order.item_count) ||
    items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    order: {
      ...order,
      order_id: getOrderId(order),
      order_no: order.order_no || getOrderId(order),
      status,
      status_text: getStatusText(status),
      status_class: getStatusClass(status),
      created_time: formatTime(normalizeDateValue(order.created_at)) || '时间待确认',
      updated_time: formatTime(normalizeDateValue(order.updated_at)) || '',
      accepted_time: formatTime(normalizeDateValue(order.accepted_at)) || '',
      cooking_time: formatTime(normalizeDateValue(order.cooking_at)) || '',
      finished_time: formatTime(normalizeDateValue(order.finished_at)) || '',
      cancelled_time: formatTime(normalizeDateValue(order.cancelled_at)) || '',
      pickup_type_text: PICKUP_TYPE_TEXT[order.pickup_type] || '到店自提',
      remark_text: order.remark || '无备注',
      item_count_text: `${itemCount}件商品`,
      total_amount_text: formatMoney(order.total_amount_cent),
      action_text: action ? action.text : '',
      next_status: action ? action.next_status : '',
      confirm_title: action ? action.confirm_title : '',
      confirm_content: action ? action.confirm_content : '',
      confirm_text: action ? action.confirm_text : ''
    },
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
    submitting: false
  },

  onLoad(options = {}) {
    this.setupNavigation()

    const orderId = options.order_id || ''

    if (!orderId) {
      this.setData({
        pageStatus: 'error',
        errorMessage: '订单信息不完整，请从商家订单列表重新进入'
      })
      return
    }

    this.setData({
      orderId
    })
    this.loadOrderDetail(orderId)
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

  async loadOrderDetail(orderId = this.data.orderId) {
    if (!orderId) {
      this.setData({
        pageStatus: 'error',
        errorMessage: '订单信息不完整，请从商家订单列表重新进入'
      })
      return
    }

    this.setData({
      pageStatus: 'loading',
      errorMessage: ''
    })

    try {
      const data = await callMerchantFunction('getMerchantOrderDetail', {
        merchant_id: DEFAULT_MERCHANT_ID,
        order_id: orderId
      })

      if (!data || !data.order) {
        this.setData({
          pageStatus: 'empty',
          order: null,
          items: []
        })
        return
      }

      const detail = normalizeOrderDetail(data)

      this.setData({
        pageStatus: 'success',
        order: detail.order,
        items: detail.items
      })
    } catch (error) {
      console.error('[merchant-order-detail] load order detail failed:', error)
      this.setData({
        pageStatus: 'error',
        errorMessage: getMerchantOrderErrorMessage(error)
      })
    }
  },

  async handleOrderAction() {
    const order = this.data.order || {}

    if (!order.order_id || !order.next_status || this.data.submitting) {
      return
    }

    const confirmed = await confirmOrderAction(order)

    if (!confirmed) {
      return
    }

    this.setData({
      submitting: true
    })

    try {
      await callMerchantFunction('updateOrderStatus', {
        merchant_id: DEFAULT_MERCHANT_ID,
        order_id: order.order_id,
        next_status: order.next_status
      })

      wx.showToast({
        title: '操作成功',
        icon: 'success'
      })

      await this.loadOrderDetail(order.order_id)
    } catch (error) {
      console.error('[merchant-order-detail] update status failed:', error)
      wx.showToast({
        title: getMerchantOrderErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
  },

  retryLoad() {
    this.loadOrderDetail()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: '/pages/merchant/orders/orders'
    })
  }
})
