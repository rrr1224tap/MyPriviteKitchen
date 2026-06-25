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
    return '-'
  }

  let dateValue = value
  if (value && typeof value === 'object' && value.$date) {
    dateValue = value.$date
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getFriendlyError(error = {}) {
  const code = error.code || (error.result && error.result.code)

  if (code === 'UNAUTHORIZED') {
    return '登录状态异常，请重新进入小程序'
  }

  if (code === 'FORBIDDEN') {
    return '没有系统管理权限'
  }

  if (code === 'INVALID_PARAMS') {
    return '数据检查操作不完整，请刷新后重试'
  }

  if (code === 'DATABASE_ERROR') {
    return '数据检查暂时不可用，请稍后重试'
  }

  return '数据检查失败，请稍后重试'
}

async function callDataHealth(action, payload = {}) {
  const response = await wx.cloud.callFunction({
    name: 'checkAdminDataHealth',
    data: {
      action,
      payload
    }
  })
  const result = response.result || {}

  if (!result.success) {
    const error = new Error(result.message || '数据检查失败')
    error.code = result.code || ''
    error.result = result
    throw error
  }

  return result.data || {}
}

function normalizeIssue(issue = {}) {
  const level = issue.level === 'error' ? 'error' : 'warning'
  const action = issue.action || ''
  return {
    ...issue,
    count: safeNumber(issue.count),
    level,
    level_text: level === 'error' ? '错误' : '提醒',
    level_class: level === 'error' ? 'is-error' : 'is-warning',
    show_fix_button: action === 'fixDishMerchantId' || action === 'fixCategoryMerchantId'
  }
}

function normalizeSections(sections = []) {
  if (!Array.isArray(sections)) {
    return []
  }

  return sections.map((section) => {
    const issues = Array.isArray(section.issues) ? section.issues.map(normalizeIssue) : []
    return {
      ...section,
      issues,
      issue_count: issues.reduce((total, issue) => total + safeNumber(issue.count), 0),
      status_text: issues.length ? `${issues.length} 类问题` : '通过',
      status_class: issues.length ? 'has-issues' : 'is-good'
    }
  })
}

function normalizeFixableActions(actions = []) {
  if (!Array.isArray(actions)) {
    return []
  }

  return actions.map((item) => ({
    action: item.action || '',
    title: item.title || item.action || '轻量修复',
    count: safeNumber(item.count)
  })).filter((item) => (
    item.count > 0 &&
    (item.action === 'fixDishMerchantId' || item.action === 'fixCategoryMerchantId')
  ))
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    pageStatus: 'loading',
    errorMessage: '',
    refreshing: false,
    operatingAction: '',
    generatedAtText: '',
    summary: {
      total_issues: 0,
      error_count: 0,
      warning_count: 0,
      fixable_count: 0
    },
    sections: [],
    fixableActions: []
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.loadHealth()
  },

  onPullDownRefresh() {
    this.loadHealth({ showLoading: false }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  async loadHealth(options = {}) {
    const showLoading = options.showLoading !== false && !this.data.sections.length

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
      const data = await callDataHealth('check')
      const summary = data.summary || {}
      this.setData({
        pageStatus: 'success',
        refreshing: false,
        generatedAtText: formatDateTime(data.generated_at),
        summary: {
          total_issues: safeNumber(summary.total_issues),
          error_count: safeNumber(summary.error_count),
          warning_count: safeNumber(summary.warning_count),
          fixable_count: safeNumber(summary.fixable_count)
        },
        sections: normalizeSections(data.sections),
        fixableActions: normalizeFixableActions(data.fixable_actions)
      })
      return true
    } catch (error) {
      console.warn('[admin-data-health] load failed:', error)
      const code = error.code || (error.result && error.result.code)
      this.setData({
        pageStatus: code === 'FORBIDDEN' ? 'no_permission' : 'error',
        errorMessage: getFriendlyError(error),
        refreshing: false
      })
      return false
    }
  },

  handleFix(event) {
    const action = event.currentTarget.dataset.action
    if (!action || this.data.operatingAction) {
      return
    }

    wx.showModal({
      title: '确认轻量修复？',
      content: '该操作只会给缺失 merchant_id 的数据补默认商户 ID，不会修改已有 merchant_id。是否继续？',
      cancelText: '再想想',
      confirmText: '确认修复',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        await this.runFix(action)
      }
    })
  },

  async runFix(action) {
    this.setData({
      operatingAction: action
    })

    try {
      const data = await callDataHealth(action)
      wx.showToast({
        title: `已修复 ${safeNumber(data.fixed_count)} 条`,
        icon: 'success'
      })
      this.setData({
        operatingAction: ''
      })
      await this.loadHealth({ showLoading: false })
    } catch (error) {
      console.warn('[admin-data-health] fix failed:', error)
      this.setData({
        operatingAction: ''
      })
      wx.showToast({
        title: getFriendlyError(error),
        icon: 'none'
      })
    }
  },

  retryLoad() {
    this.loadHealth()
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
