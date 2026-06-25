const EMPTY_FORM = {
  merchant_id: '',
  name: '',
  short_name: '',
  owner_openid: '',
  notice: ''
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

function formatDateTime(value) {
  if (!value) {
    return '暂无'
  }

  let dateValue = value
  if (value && typeof value === 'object' && value.$date) {
    dateValue = value.$date
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return '暂无'
  }

  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeMerchant(merchant = {}) {
  const status = merchant.status === 'disabled' ? 'disabled' : 'active'
  return {
    ...merchant,
    status,
    status_text: status === 'active' ? '启用' : '禁用',
    status_class: status === 'active' ? 'is-active' : 'is-disabled',
    owner_display: merchant.masked_owner_openid || '未填写',
    updated_at_text: formatDateTime(merchant.updated_at)
  }
}

function getFriendlyError(error = {}) {
  const code = error.code || (error.result && error.result.code)

  if (code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (code === 'FORBIDDEN') {
    return '没有系统管理权限'
  }

  if (code === 'ALREADY_EXISTS') {
    return '商户 ID 已存在，请换一个 ID'
  }

  if (code === 'INVALID_PARAMS' || code === 'VALIDATION_ERROR') {
    return error.message || '商户信息不完整，请检查后重试'
  }

  if (code === 'NOT_FOUND') {
    return '商户不存在或已被删除'
  }

  if (code === 'DATABASE_ERROR') {
    return '服务暂时不可用，请稍后重试'
  }

  return error.message || '操作失败，请稍后重试'
}

async function callManageMerchant(action, payload = {}) {
  const response = await wx.cloud.callFunction({
    name: 'manageMerchant',
    data: {
      action,
      payload
    }
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
    pageStatus: 'loading',
    errorMessage: '',
    merchants: [],
    refreshing: false,
    formVisible: false,
    formMode: 'create',
    formTitle: '新增商户',
    formData: { ...EMPTY_FORM },
    saving: false,
    operatingMerchantId: ''
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.loadMerchants()
  },

  onPullDownRefresh() {
    this.loadMerchants({ showLoading: false }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  async loadMerchants(options = {}) {
    const showLoading = options.showLoading !== false && !this.data.merchants.length

    if (showLoading) {
      this.setData({
        pageStatus: 'loading',
        errorMessage: ''
      })
    } else {
      this.setData({
        refreshing: true,
        errorMessage: ''
      })
    }

    try {
      const data = await callManageMerchant('list')
      const merchants = Array.isArray(data.list) ? data.list.map(normalizeMerchant) : []
      this.setData({
        merchants,
        pageStatus: merchants.length ? 'success' : 'empty',
        refreshing: false
      })
      return true
    } catch (error) {
      console.warn('[admin-merchants] load merchants failed:', error)
      const code = error.code || (error.result && error.result.code)
      this.setData({
        pageStatus: code === 'FORBIDDEN' ? 'no_permission' : 'error',
        errorMessage: getFriendlyError(error),
        refreshing: false
      })
      return false
    }
  },

  openCreateForm() {
    this.setData({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增商户',
      formData: { ...EMPTY_FORM }
    })
  },

  openEditForm(event) {
    const merchantId = event.currentTarget.dataset.id
    const merchant = this.data.merchants.find((item) => item.merchant_id === merchantId)
    if (!merchant) {
      wx.showToast({
        title: '商户不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      formVisible: true,
      formMode: 'edit',
      formTitle: '编辑商户',
      formData: {
        merchant_id: merchant.merchant_id || '',
        name: merchant.name || '',
        short_name: merchant.short_name || '',
        owner_openid: merchant.owner_openid || '',
        notice: merchant.notice || ''
      }
    })
  },

  closeForm() {
    if (this.data.saving) {
      return
    }

    this.setData({
      formVisible: false,
      formData: { ...EMPTY_FORM }
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }

    this.setData({
      [`formData.${field}`]: event.detail.value
    })
  },

  noop() {},

  async submitForm() {
    if (this.data.saving) {
      return
    }

    const formData = this.data.formData || {}
    if (!formData.merchant_id || !formData.name) {
      wx.showToast({
        title: '请填写商户 ID 和商户名称',
        icon: 'none'
      })
      return
    }

    this.setData({
      saving: true
    })

    try {
      const action = this.data.formMode === 'edit' ? 'update' : 'create'
      await callManageMerchant(action, formData)
      wx.showToast({
        title: this.data.formMode === 'edit' ? '已保存' : '已创建',
        icon: 'success'
      })
      this.setData({
        formVisible: false,
        saving: false,
        formData: { ...EMPTY_FORM }
      })
      await this.loadMerchants({ showLoading: false })
    } catch (error) {
      console.warn('[admin-merchants] submit merchant failed:', error)
      this.setData({
        saving: false
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  handleToggleStatus(event) {
    const merchantId = event.currentTarget.dataset.id
    const status = event.currentTarget.dataset.status
    const isDisabled = status === 'disabled'
    const action = isDisabled ? 'enable' : 'disable'
    const title = isDisabled ? '确认启用商户？' : '确认禁用商户？'
    const content = isDisabled
      ? '启用后该商户会恢复可用状态。'
      : '禁用后该商户会被标记为不可用，后续接入多商户时会受此状态影响。'

    wx.showModal({
      title,
      content,
      cancelText: '再想想',
      confirmText: isDisabled ? '确认启用' : '确认禁用',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        await this.updateMerchantStatus(action, merchantId)
      }
    })
  },

  goToStaff(event) {
    const merchantId = event.currentTarget.dataset.id
    const merchantName = event.currentTarget.dataset.name || ''
    if (!merchantId) {
      return
    }

    wx.navigateTo({
      url: `/pages/admin/merchant-staff/merchant-staff?merchant_id=${encodeURIComponent(merchantId)}&name=${encodeURIComponent(merchantName)}`
    })
  },

  async updateMerchantStatus(action, merchantId) {
    if (this.data.operatingMerchantId) {
      return
    }

    this.setData({
      operatingMerchantId: merchantId
    })

    try {
      await callManageMerchant(action, {
        merchant_id: merchantId
      })
      wx.showToast({
        title: action === 'enable' ? '已启用' : '已禁用',
        icon: 'success'
      })
      this.setData({
        operatingMerchantId: ''
      })
      await this.loadMerchants({ showLoading: false })
    } catch (error) {
      console.warn('[admin-merchants] update status failed:', error)
      this.setData({
        operatingMerchantId: ''
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  retryLoad() {
    this.loadMerchants()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: '/pages/admin/dashboard/dashboard'
    })
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
