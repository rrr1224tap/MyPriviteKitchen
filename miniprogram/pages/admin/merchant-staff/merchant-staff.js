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

  const date = value instanceof Date ? value : new Date(value && value.$date ? value.$date : value)
  if (Number.isNaN(date.getTime())) {
    return '暂无'
  }

  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeStaff(staff = {}) {
  const status = staff.status === 'disabled' ? 'disabled' : 'active'
  return {
    ...staff,
    openid_display: staff.masked_openid || '未知成员',
    role_text: staff.role_text || (staff.role === 'owner' ? '负责人' : '员工'),
    status,
    status_text: status === 'active' ? '启用' : '禁用',
    status_class: status === 'active' ? 'is-active' : 'is-disabled',
    created_at_text: formatDateTime(staff.created_at),
    updated_at_text: formatDateTime(staff.updated_at)
  }
}

function normalizeInvite(invite = {}) {
  const status = invite.status || 'unused'
  return {
    ...invite,
    role_text: invite.role_text || (invite.role === 'owner' ? '负责人' : '员工'),
    status,
    status_text: invite.status_text || ({
      unused: '未使用',
      used: '已使用',
      expired: '已过期',
      disabled: '已禁用'
    }[status] || '未知'),
    status_class: status === 'unused' ? 'is-active' : 'is-disabled',
    used_by_display: invite.masked_used_by_openid || '暂无',
    expires_at_text: formatDateTime(invite.expires_at),
    created_at_text: formatDateTime(invite.created_at)
  }
}

function getFriendlyError(error = {}) {
  const code = error.code || (error.result && error.result.code)
  const message = error.message || ''

  if (code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (code === 'FORBIDDEN') {
    return '没有系统管理权限'
  }

  if (code === 'NOT_FOUND') {
    return '商户或数据不存在'
  }

  if (code === 'MERCHANT_DISABLED') {
    return '商户已禁用，不能生成邀请码'
  }

  if (code === 'VALIDATION_ERROR' || code === 'INVALID_PARAMS') {
    return message || '信息不完整，请检查后重试'
  }

  return message || '操作失败，请稍后重试'
}

async function callManageMerchantStaff(action, payload = {}) {
  const response = await wx.cloud.callFunction({
    name: 'manageMerchantStaff',
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
    merchantId: '',
    merchantName: '',
    pageStatus: 'loading',
    errorMessage: '',
    staffList: [],
    inviteList: [],
    inviteRole: 'staff',
    inviteDays: 7,
    loading: false,
    creatingInvite: false,
    operatingId: ''
  },

  onLoad(options = {}) {
    this.setData({
      merchantId: decodeURIComponent(options.merchant_id || ''),
      merchantName: decodeURIComponent(options.name || '')
    })
    this.setupNavigation()
    this.loadAll()
  },

  onPullDownRefresh() {
    this.loadAll({ showLoading: false }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  async loadAll(options = {}) {
    if (!this.data.merchantId) {
      this.setData({
        pageStatus: 'error',
        errorMessage: '缺少商户 ID'
      })
      return false
    }

    const showLoading = options.showLoading !== false && !this.data.staffList.length && !this.data.inviteList.length
    if (showLoading) {
      this.setData({
        pageStatus: 'loading',
        errorMessage: ''
      })
    }

    try {
      const payload = {
        merchant_id: this.data.merchantId
      }
      const staffData = await callManageMerchantStaff('listStaff', payload)
      const inviteData = await callManageMerchantStaff('listInvites', payload)
      const merchant = staffData.merchant || {}

      this.setData({
        merchantName: this.data.merchantName || merchant.name || this.data.merchantId,
        staffList: Array.isArray(staffData.list) ? staffData.list.map(normalizeStaff) : [],
        inviteList: Array.isArray(inviteData.list) ? inviteData.list.map(normalizeInvite) : [],
        pageStatus: 'success'
      })
      return true
    } catch (error) {
      console.warn('[merchant-staff] load failed:', error)
      const code = error.code || (error.result && error.result.code)
      this.setData({
        pageStatus: code === 'FORBIDDEN' ? 'no_permission' : 'error',
        errorMessage: getFriendlyError(error)
      })
      return false
    }
  },

  handleRoleChange(event) {
    const role = event.detail.value === 'owner' ? 'owner' : 'staff'
    this.setData({
      inviteRole: role
    })
  },

  handleDaysInput(event) {
    this.setData({
      inviteDays: event.detail.value
    })
  },

  async createInvite() {
    if (this.data.creatingInvite) {
      return
    }

    this.setData({
      creatingInvite: true
    })

    try {
      const data = await callManageMerchantStaff('createInvite', {
        merchant_id: this.data.merchantId,
        role: this.data.inviteRole,
        expires_days: Number(this.data.inviteDays) || 7
      })
      wx.showToast({
        title: '已生成邀请码',
        icon: 'success'
      })
      this.setData({
        creatingInvite: false
      })
      await this.loadAll({ showLoading: false })
      if (data.invite && data.invite.code) {
        this.copyText(data.invite.code, '邀请码已复制')
      }
    } catch (error) {
      console.warn('[merchant-staff] create invite failed:', error)
      this.setData({
        creatingInvite: false
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  copyInvite(event) {
    const code = event.currentTarget.dataset.code
    this.copyText(code, '邀请码已复制')
  },

  copyText(text, title) {
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
          title,
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

  disableInvite(event) {
    const code = event.currentTarget.dataset.code
    wx.showModal({
      title: '确认禁用邀请码？',
      content: '禁用后该邀请码将不能继续使用。',
      cancelText: '再想想',
      confirmText: '确认禁用',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        await this.updateInviteStatus(code)
      }
    })
  },

  async updateInviteStatus(code) {
    if (this.data.operatingId) {
      return
    }

    this.setData({
      operatingId: code
    })

    try {
      await callManageMerchantStaff('disableInvite', {
        code
      })
      wx.showToast({
        title: '已禁用',
        icon: 'success'
      })
      this.setData({
        operatingId: ''
      })
      await this.loadAll({ showLoading: false })
    } catch (error) {
      this.setData({
        operatingId: ''
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  handleStaffToggle(event) {
    const staffId = event.currentTarget.dataset.id
    const status = event.currentTarget.dataset.status
    const isDisabled = status === 'disabled'
    const action = isDisabled ? 'enableStaff' : 'disableStaff'

    wx.showModal({
      title: isDisabled ? '确认启用成员？' : '确认禁用成员？',
      content: isDisabled ? '启用后该成员可继续进入商家后台。' : '禁用后该成员将不能进入商家后台。',
      cancelText: '再想想',
      confirmText: isDisabled ? '确认启用' : '确认禁用',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        await this.updateStaffStatus(action, staffId)
      }
    })
  },

  async updateStaffStatus(action, staffId) {
    if (this.data.operatingId) {
      return
    }

    this.setData({
      operatingId: staffId
    })

    try {
      await callManageMerchantStaff(action, {
        staff_id: staffId
      })
      wx.showToast({
        title: action === 'enableStaff' ? '已启用' : '已禁用',
        icon: 'success'
      })
      this.setData({
        operatingId: ''
      })
      await this.loadAll({ showLoading: false })
    } catch (error) {
      this.setData({
        operatingId: ''
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  retryLoad() {
    this.loadAll()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: '/pages/admin/merchants/merchants'
    })
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
