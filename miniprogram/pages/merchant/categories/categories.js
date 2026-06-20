const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')

const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'

const CATEGORY_STATUS_TEXT = {
  active: '启用中',
  inactive: '已停用',
  deleted: '已删除'
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

function getCategoryStatus(category = {}) {
  if (category.status) {
    return category.status
  }

  return category.enabled === false ? 'inactive' : 'active'
}

function normalizeCategory(category = {}) {
  const status = getCategoryStatus(category)

  return {
    ...category,
    category_id: category.category_id || category._id || '',
    name: category.name || '未命名分类',
    sort_order: Number(category.sort_order) || 0,
    status,
    status_text: CATEGORY_STATUS_TEXT[status] || '未知状态',
    status_class: `status-${status}`,
    is_active: status === 'active'
  }
}

function getFriendlyError(error) {
  if (error && error.code === 'FORBIDDEN') {
    return '当前账号没有商家权限'
  }

  return error && error.message ? error.message : '操作失败，请稍后重试'
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: BACKGROUND_IMAGE,
    backgroundImageAvailable: true,
    pageStatus: 'loading',
    errorMessage: '',
    categories: [],
    submitting: false,
    activeCategoryId: ''
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.loadCategories()
  },

  onPullDownRefresh() {
    this.loadCategories().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  setupNavigation() {
    this.setData(getNavigationMetrics())
  },

  handleBackgroundImageError() {
    this.setData({
      backgroundImageAvailable: false
    })
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
  },

  async callManageCategory(payload) {
    return callFunction('manageCategory', {
      merchant_id: DEFAULT_MERCHANT_ID,
      ...payload
    })
  },

  async loadCategories() {
    this.setData({
      pageStatus: 'loading',
      errorMessage: ''
    })

    try {
      const data = await this.callManageCategory({
        action: 'list'
      })
      const categories = (data.list || [])
        .map(normalizeCategory)
        .filter((category) => category.status !== 'deleted')
        .sort((a, b) => a.sort_order - b.sort_order)

      this.setData({
        categories,
        pageStatus: categories.length ? 'success' : 'empty'
      })
    } catch (error) {
      this.setData({
        pageStatus: 'error',
        errorMessage: getFriendlyError(error)
      })
    }
  },

  retryLoad() {
    this.loadCategories()
  },

  handleCreateTap() {
    if (this.data.submitting) {
      return
    }

    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '请输入分类名称',
      confirmText: '新增',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({
            title: '请输入分类名称',
            icon: 'none'
          })
          return
        }

        this.createCategory(name)
      }
    })
  },

  async createCategory(name) {
    const nextSortOrder = this.getNextSortOrder()

    this.setData({
      submitting: true
    })

    try {
      await this.callManageCategory({
        action: 'create',
        data: {
          name,
          sort_order: nextSortOrder
        }
      })
      wx.showToast({
        title: '分类已新增',
        icon: 'success'
      })
      await this.loadCategories()
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  handleEditTap(event) {
    if (this.data.submitting) {
      return
    }

    const categoryId = event.currentTarget.dataset.id
    const category = this.findCategory(categoryId)
    if (!category) {
      return
    }

    wx.showModal({
      title: '编辑分类',
      editable: true,
      placeholderText: category.name,
      confirmText: '保存',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({
            title: '请输入新的分类名称',
            icon: 'none'
          })
          return
        }

        this.updateCategory(category.category_id, {
          name,
          sort_order: category.sort_order,
          status: category.status
        })
      }
    })
  },

  async updateCategory(categoryId, data) {
    this.setData({
      submitting: true,
      activeCategoryId: categoryId
    })

    try {
      await this.callManageCategory({
        action: 'update',
        category_id: categoryId,
        data
      })
      wx.showToast({
        title: '分类已更新',
        icon: 'success'
      })
      await this.loadCategories()
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false,
        activeCategoryId: ''
      })
    }
  },

  handleDisableTap(event) {
    if (this.data.submitting) {
      return
    }

    const categoryId = event.currentTarget.dataset.id
    const category = this.findCategory(categoryId)
    if (!category) {
      return
    }

    wx.showModal({
      title: '停用分类',
      content: `确认停用“${category.name}”吗？停用后不会影响历史订单。`,
      confirmText: '停用',
      confirmColor: '#E63B4A',
      success: (res) => {
        if (res.confirm) {
          this.disableCategory(categoryId)
        }
      }
    })
  },

  async disableCategory(categoryId) {
    this.setData({
      submitting: true,
      activeCategoryId: categoryId
    })

    try {
      await this.callManageCategory({
        action: 'disable',
        category_id: categoryId
      })
      wx.showToast({
        title: '分类已停用',
        icon: 'success'
      })
      await this.loadCategories()
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false,
        activeCategoryId: ''
      })
    }
  },

  handleMoveTap(event) {
    if (this.data.submitting) {
      return
    }

    const index = Number(event.currentTarget.dataset.index)
    const direction = Number(event.currentTarget.dataset.direction)
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= this.data.categories.length) {
      wx.showToast({
        title: '已经到边界了',
        icon: 'none'
      })
      return
    }

    this.sortCategories(index, targetIndex)
  },

  async sortCategories(index, targetIndex) {
    const categories = this.data.categories.slice()
    const current = categories[index]
    categories[index] = categories[targetIndex]
    categories[targetIndex] = current

    const sortList = categories.map((category, nextIndex) => ({
      category_id: category.category_id,
      sort_order: nextIndex + 1
    }))

    this.setData({
      submitting: true,
      activeCategoryId: current.category_id
    })

    try {
      await this.callManageCategory({
        action: 'sort',
        data: {
          categories: sortList
        }
      })
      await this.loadCategories()
      wx.showToast({
        title: '排序已更新',
        icon: 'success'
      })
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false,
        activeCategoryId: ''
      })
    }
  },

  findCategory(categoryId) {
    return this.data.categories.find((category) => category.category_id === categoryId)
  },

  getNextSortOrder() {
    if (!this.data.categories.length) {
      return 1
    }

    return Math.max(...this.data.categories.map((category) => category.sort_order || 0)) + 1
  },

  showOperationError(error) {
    if (error && error.toastShown && error.code !== 'FORBIDDEN') {
      return
    }

    wx.showToast({
      title: getFriendlyError(error),
      icon: 'none'
    })
  }
})
