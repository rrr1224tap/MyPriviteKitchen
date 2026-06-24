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

const ACTION_SUCCESS_TEXT = {
  accepted: '已接单',
  cooking: '已开始制作',
  finished: '订单已完成',
  cancelled: '订单已取消'
}

const CANCEL_ORDER_ACTION = {
  text: '取消订单',
  next_status: 'cancelled',
  confirm_title: '确认取消订单？',
  confirm_content: '取消后订单状态将不可回退，请确认是否取消。',
  confirm_text: '确认取消',
  success_text: ACTION_SUCCESS_TEXT.cancelled
}

const CANCELABLE_STATUSES = ['pending', 'accepted']
const STATUS_CONFLICT_CODES = [
  'ORDER_STATUS_INVALID',
  'ORDER_STATUS_FLOW_ERROR',
  'INVALID_STATUS',
  'STATUS_CONFLICT'
]
const REFRESH_FAILED_MESSAGE = '操作成功，但刷新失败，请手动刷新'
const MERCHANT_PERMISSION_TITLE = '需要注册小厨身份'
const MERCHANT_PERMISSION_MESSAGE = '当前账号暂未开通小厨商家身份，请联系管理员注册 / 开通后再进入商家工作台。'

const MERCHANT_ORDER_ERROR_TEXT = {
  FORBIDDEN: MERCHANT_PERMISSION_MESSAGE,
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

function isMerchantPermissionError(errorOrCode) {
  const code = typeof errorOrCode === 'string'
    ? errorOrCode
    : (errorOrCode && errorOrCode.code) || ''

  return code === 'FORBIDDEN'
}

const PICKUP_TYPE_TEXT = {
  pickup: '到店自提',
  self_pickup: '到店自提',
  dine_in: '堂食',
  delivery: '外卖配送'
}
const TUTORIAL_PLATFORM_TEXT = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  other: '其他'
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

function normalizeTutorials(tutorials) {
  if (!Array.isArray(tutorials)) {
    return []
  }

  return tutorials
    .filter((item) => item && typeof item === 'object' && item.enabled !== false)
    .map((item, index) => {
      const platform = item.platform || 'other'
      const title = item.title || `做法参考 ${index + 1}`
      const url = item.url || ''
      return {
        title,
        platform,
        platform_text: TUTORIAL_PLATFORM_TEXT[platform] || TUTORIAL_PLATFORM_TEXT.other,
        url,
        note: item.note || '',
        has_copy: Boolean(url)
      }
    })
    .filter((item) => item.title || item.url || item.note)
    .slice(0, 3)
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
  const tutorials = normalizeTutorials(item.tutorials)

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
    subtotal_text: formatMoney(subtotalCent),
    tutorials,
    has_tutorials: tutorials.length > 0
  }
}

function canCancelOrder(status) {
  return CANCELABLE_STATUSES.includes(status)
}

function getActionConfig(order = {}, nextStatus = '') {
  if (nextStatus === CANCEL_ORDER_ACTION.next_status && order.cancel_action_text) {
    return {
      confirm_title: order.cancel_confirm_title,
      confirm_content: order.cancel_confirm_content,
      confirm_text: order.cancel_confirm_text,
      success_text: order.cancel_success_text
    }
  }

  return {
    confirm_title: order.confirm_title,
    confirm_content: order.confirm_content,
    confirm_text: order.confirm_text,
    success_text: getActionSuccessText(nextStatus)
  }
}

function getActionSuccessText(nextStatus) {
  return ACTION_SUCCESS_TEXT[nextStatus] || '操作成功'
}

function normalizeOrderDetail(data = {}) {
  const order = data.order || {}
  const status = order.status || 'pending'
  const action = ORDER_ACTIONS[status] || null
  const cancelAction = canCancelOrder(status) ? CANCEL_ORDER_ACTION : null
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
      confirm_text: action ? action.confirm_text : '',
      has_action: Boolean(action || cancelAction),
      cancel_action_text: cancelAction ? cancelAction.text : '',
      cancel_next_status: cancelAction ? cancelAction.next_status : '',
      cancel_confirm_title: cancelAction ? cancelAction.confirm_title : '',
      cancel_confirm_content: cancelAction ? cancelAction.confirm_content : '',
      cancel_confirm_text: cancelAction ? cancelAction.confirm_text : '',
      cancel_success_text: cancelAction ? cancelAction.success_text : ''
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

function isStatusConflictError(error = {}) {
  const code = error.code || ''
  return STATUS_CONFLICT_CODES.includes(code)
}

function confirmOrderAction(order) {
  return new Promise((resolve) => {
    wx.showModal({
      title: order.confirm_title || '确认操作？',
      content: order.confirm_content || '确认后订单状态将更新。',
      cancelText: '再想想',
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
    errorTitle: '',
    errorMessage: '',
    isPermissionError: false,
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
        errorTitle: '订单详情加载失败',
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

  async loadOrderDetail(orderId = this.data.orderId, options = {}) {
    if (!orderId) {
      this.setData({
        pageStatus: 'error',
        errorTitle: '订单详情加载失败',
        errorMessage: '订单信息不完整，请从商家订单列表重新进入'
      })
      return false
    }

    const hasCurrentOrder = Boolean(this.data.order)
    const showBlockingLoading = options.showLoading === true ||
      (options.showLoading !== false && !hasCurrentOrder)

    this.setData({
      errorTitle: '',
      errorMessage: '',
      isPermissionError: false
    })

    if (showBlockingLoading) {
      this.setData({
        pageStatus: 'loading'
      })
    }

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
        return true
      }

      const detail = normalizeOrderDetail(data)

      this.setData({
        pageStatus: 'success',
        order: detail.order,
        items: detail.items
      })
      return true
    } catch (error) {
      console.error('[merchant-order-detail] load order detail failed:', error)

      if (options.silentError) {
        return false
      }

      if (hasCurrentOrder && !showBlockingLoading) {
        wx.showToast({
          title: getMerchantOrderErrorMessage(error),
          icon: 'none'
        })
        return false
      }

      this.setData({
        pageStatus: 'error',
        errorTitle: isMerchantPermissionError(error) ? MERCHANT_PERMISSION_TITLE : '订单详情加载失败',
        errorMessage: getMerchantOrderErrorMessage(error),
        isPermissionError: isMerchantPermissionError(error)
      })
      return false
    }
  },

  async handleOrderAction(event = {}) {
    const order = this.data.order || {}
    const nextStatus = event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.nextStatus || order.next_status
      : order.next_status

    if (!order.order_id || !nextStatus || this.data.submitting) {
      return
    }

    const actionConfig = getActionConfig(order, nextStatus)
    const confirmed = await confirmOrderAction(actionConfig)

    if (!confirmed) {
      return
    }

    this.setData({
      submitting: true
    })

    try {
      try {
        await callMerchantFunction('updateOrderStatus', {
          merchant_id: DEFAULT_MERCHANT_ID,
          order_id: order.order_id,
          next_status: nextStatus
        })
      } catch (error) {
        console.error('[merchant-order-detail] update status failed:', error)
        wx.showToast({
          title: getMerchantOrderErrorMessage(error),
          icon: 'none'
        })

        if (isStatusConflictError(error)) {
          await this.loadOrderDetail(order.order_id, {
            showLoading: false,
            silentError: true
          })
        }

        return
      }

      const refreshed = await this.loadOrderDetail(order.order_id, {
        showLoading: false,
        silentError: true
      })

      wx.showToast({
        title: refreshed ? actionConfig.success_text : REFRESH_FAILED_MESSAGE,
        icon: refreshed ? 'success' : 'none'
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
  },

  handleCopyTutorial(event) {
    const url = event.currentTarget.dataset.url || ''
    if (!url) {
      wx.showToast({
        title: '暂无可复制内容',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          title: '已复制，请打开对应平台查看',
          icon: 'none'
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

  goToUserHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
