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

function getFriendlyError(error = {}) {
  const code = error.code || (error.result && error.result.code)

  if (code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (code === 'INVALID_PARAMS') {
    return '请输入有效的邀请码'
  }

  if (code === 'INVITE_NOT_FOUND') {
    return '邀请码无效'
  }

  if (code === 'INVITE_USED') {
    return '邀请码已被使用'
  }

  if (code === 'INVITE_EXPIRED') {
    return '邀请码已过期'
  }

  if (code === 'INVITE_DISABLED') {
    return '邀请码已禁用'
  }

  if (code === 'MERCHANT_DISABLED') {
    return '商户已禁用'
  }

  return '绑定失败，请稍后重试'
}

async function callRedeemMerchantInvite(code) {
  const response = await wx.cloud.callFunction({
    name: 'redeemMerchantInvite',
    data: {
      code
    }
  })
  const result = response.result || {}

  if (!result.success) {
    const error = new Error(result.message || '绑定失败')
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
    code: '',
    submitting: false,
    success: false,
    merchantName: '',
    merchantId: '',
    roleText: ''
  },

  onLoad() {
    this.setData(getNavigationMetrics())
  },

  handleCodeInput(event) {
    const value = String(event.detail.value || '').trim().toUpperCase()
    this.setData({
      code: value
    })
  },

  async redeemInvite() {
    if (this.data.submitting) {
      return
    }

    const code = this.data.code.trim()
    if (!code) {
      wx.showToast({
        title: '请输入有效的邀请码',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const data = await callRedeemMerchantInvite(code)
      const merchant = data.merchant || {}
      const staff = data.staff || {}
      wx.showToast({
        title: '商户身份绑定成功',
        icon: 'success'
      })
      this.setData({
        submitting: false,
        success: true,
        merchantName: merchant.name || merchant.merchant_id || '',
        merchantId: merchant.merchant_id || '',
        roleText: staff.role_text || (staff.role === 'owner' ? '负责人' : '员工')
      })
    } catch (error) {
      console.warn('[invite-redeem] redeem failed:', error)
      this.setData({
        submitting: false
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  goToMerchantDashboard() {
    wx.reLaunch({
      url: '/pages/merchant/dashboard/dashboard'
    })
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  }
})
