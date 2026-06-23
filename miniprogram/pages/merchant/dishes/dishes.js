const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')

const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'
const MERCHANT_PERMISSION_TITLE = '需要注册小厨身份'
const MERCHANT_PERMISSION_MESSAGE = '当前账号暂未开通小厨商家身份，请联系管理员注册 / 开通后再进入商家工作台。'

const DISH_STATUS_TEXT = {
  on_sale: '上架中',
  off_sale: '已下架'
}

const STATUS_FILTERS = [
  { label: '全部', value: '' },
  { label: '上架', value: 'on_sale' },
  { label: '下架', value: 'off_sale' }
]

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

function centsToYuan(value) {
  const cent = Number(value)
  if (!Number.isInteger(cent) || cent < 0) {
    return '0.00'
  }

  return (cent / 100).toFixed(2)
}

function yuanToCent(value, options = {}) {
  const text = String(value === undefined || value === null ? '' : value).trim()
  if (!text && options.allowEmpty) {
    return 0
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null
  }

  const [yuan, cent = ''] = text.split('.')
  return Number(yuan) * 100 + Number(cent.padEnd(2, '0'))
}

function normalizeStockCount(value) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null
  }
  return numberValue
}

function getStockDisplay(dish = {}) {
  const stockEnabled = typeof dish.stock_enabled === 'boolean' ? dish.stock_enabled : false
  const stockCount = normalizeStockCount(dish.stock_count) === null ? 0 : normalizeStockCount(dish.stock_count)
  const soldOut = typeof dish.sold_out === 'boolean' ? dish.sold_out : false

  if (soldOut) {
    return {
      stock_enabled: stockEnabled,
      stock_count: stockCount,
      sold_out: soldOut,
      stock_text: '手动售罄',
      stock_class: 'stock-sold-out'
    }
  }

  if (stockEnabled && stockCount <= 0) {
    return {
      stock_enabled: stockEnabled,
      stock_count: stockCount,
      sold_out: soldOut,
      stock_text: '已售罄',
      stock_class: 'stock-empty'
    }
  }

  if (stockEnabled) {
    return {
      stock_enabled: stockEnabled,
      stock_count: stockCount,
      sold_out: soldOut,
      stock_text: `剩余 ${stockCount} 份`,
      stock_class: 'stock-limited'
    }
  }

  return {
    stock_enabled: stockEnabled,
    stock_count: stockCount,
    sold_out: soldOut,
    stock_text: '不限库存',
    stock_class: 'stock-unlimited'
  }
}

function getImageExtension(filePath = '') {
  const match = String(filePath).match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
  const extension = match ? match[1].toLowerCase() : 'jpg'
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg'
}

function getDishImageCloudPath(filePath) {
  const random = Math.random().toString(36).slice(2, 8)
  return `dish-images/${DEFAULT_MERCHANT_ID}/${Date.now()}_${random}.${getImageExtension(filePath)}`
}

function chooseDishImageFile() {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0]
          resolve(file ? file.tempFilePath : '')
        },
        fail: reject
      })
      return
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        resolve(res.tempFilePaths && res.tempFilePaths[0] ? res.tempFilePaths[0] : '')
      },
      fail: reject
    })
  })
}

function uploadDishImageFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: getDishImageCloudPath(filePath),
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

function isCancelError(error) {
  const message = error && (error.errMsg || error.message || '')
  return message.indexOf('cancel') >= 0
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTagsText(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean).join('，') : ''
}

function parseTags(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getFriendlyError(error) {
  if (error && error.code === 'FORBIDDEN') {
    return MERCHANT_PERMISSION_MESSAGE
  }

  return error && error.message ? error.message : '操作失败，请稍后重试'
}

function isMerchantPermissionError(error) {
  return Boolean(error && error.code === 'FORBIDDEN')
}

function normalizeCategory(category = {}) {
  return {
    ...category,
    category_id: category.category_id || category._id || '',
    name: category.name || '未命名分类',
    sort_order: Number(category.sort_order) || 0,
    status: category.status || (category.enabled === false ? 'inactive' : 'active')
  }
}

function buildCategoryMap(categories) {
  return categories.reduce((map, category) => {
    map[category.category_id] = category
    return map
  }, {})
}

function normalizeDish(dish = {}, categoryMap = {}) {
  const status = dish.status || 'off_sale'
  const category = categoryMap[dish.category_id] || {}
  const stockDisplay = getStockDisplay(dish)

  return {
    ...dish,
    dish_id: dish.dish_id || dish._id || '',
    category_id: dish.category_id || '',
    category_name: category.name || '未分类',
    name: dish.name || '未命名餐品',
    description: dish.description || '',
    detail_description: dish.detail_description || '',
    image_url: dish.image_url || dish.image || '',
    price_cent: Number.isInteger(dish.price_cent) ? dish.price_cent : 0,
    original_price_cent: Number.isInteger(dish.original_price_cent)
      ? dish.original_price_cent
      : 0,
    price_yuan: centsToYuan(dish.price_cent),
    original_price_yuan: Number.isInteger(dish.original_price_cent) && dish.original_price_cent > 0
      ? centsToYuan(dish.original_price_cent)
      : '',
    tags: Array.isArray(dish.tags) ? dish.tags : [],
    tags_text: normalizeTagsText(dish.tags),
    status,
    status_text: DISH_STATUS_TEXT[status] || '未知状态',
    status_class: `status-${status}`,
    ...stockDisplay,
    sort_order: Number(dish.sort_order) || 0
  }
}

function createEmptyForm(categoryId = '', categoryName = '', sortOrder = 1) {
  return {
    name: '',
    category_id: categoryId,
    category_name: categoryName,
    description: '',
    detail_description: '',
    image_url: '',
    price_yuan: '',
    original_price_yuan: '',
    tags_text: '',
    stock_enabled: false,
    stock_count: '0',
    sold_out: false,
    sort_order: String(sortOrder)
  }
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
    dishes: [],
    categories: [],
    categoryFilters: [{ category_id: '', name: '全部分类' }],
    activeCategoryId: '',
    statusFilters: STATUS_FILTERS,
    activeStatus: '',
    submitting: false,
    activeDishId: '',
    formVisible: false,
    formMode: 'create',
    formTitle: '新增餐品',
    formDishId: '',
    formData: createEmptyForm(),
    formCategoryOptions: [],
    formCategoryIndex: 0,
    uploadingImage: false
  },

  onReady() {
    this.setupNavigation()
  },

  onShow() {
    this.loadPageData()
  },

  onPullDownRefresh() {
    this.loadPageData().finally(() => {
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

  callManageDish(payload) {
    return callFunction('manageDish', {
      merchant_id: DEFAULT_MERCHANT_ID,
      ...payload
    })
  },

  callManageCategory(payload) {
    return callFunction('manageCategory', {
      merchant_id: DEFAULT_MERCHANT_ID,
      ...payload
    })
  },

  async loadPageData() {
    this.setData({
      pageStatus: 'loading',
      errorTitle: '',
      errorMessage: '',
      isPermissionError: false
    })

    try {
      const [categoryData, dishData] = await Promise.all([
        this.callManageCategory({ action: 'list' }),
        this.callManageDish({
          action: 'list',
          data: this.getListFilters()
        })
      ])

      const categories = (categoryData.list || [])
        .map(normalizeCategory)
        .filter((category) => category.status !== 'deleted')
        .sort((left, right) => left.sort_order - right.sort_order)
      const categoryMap = buildCategoryMap(categories)
      const dishes = (dishData.list || [])
        .map((dish) => normalizeDish(dish, categoryMap))
        .sort((left, right) => left.sort_order - right.sort_order)

      this.setData({
        categories,
        categoryFilters: [
          { category_id: '', name: '全部分类' },
          ...categories
        ],
        formCategoryOptions: categories.filter((category) => category.status === 'active'),
        dishes,
        pageStatus: dishes.length ? 'success' : 'empty'
      })
    } catch (error) {
      this.setData({
        pageStatus: 'error',
        errorTitle: isMerchantPermissionError(error) ? MERCHANT_PERMISSION_TITLE : '餐品加载失败',
        errorMessage: getFriendlyError(error),
        isPermissionError: isMerchantPermissionError(error)
      })
    }
  },

  async loadDishes() {
    try {
      const data = await this.callManageDish({
        action: 'list',
        data: this.getListFilters()
      })
      const categoryMap = buildCategoryMap(this.data.categories)
      const dishes = (data.list || [])
        .map((dish) => normalizeDish(dish, categoryMap))
        .sort((left, right) => left.sort_order - right.sort_order)

      this.setData({
        dishes,
        pageStatus: dishes.length ? 'success' : 'empty',
        errorTitle: '',
        errorMessage: '',
        isPermissionError: false
      })
    } catch (error) {
      this.setData({
        pageStatus: 'error',
        errorTitle: isMerchantPermissionError(error) ? MERCHANT_PERMISSION_TITLE : '餐品加载失败',
        errorMessage: getFriendlyError(error),
        isPermissionError: isMerchantPermissionError(error)
      })
    }
  },

  getListFilters() {
    const data = {}
    if (this.data.activeCategoryId) {
      data.category_id = this.data.activeCategoryId
    }
    if (this.data.activeStatus) {
      data.status = this.data.activeStatus
    }
    return data
  },

  retryLoad() {
    this.loadPageData()
  },

  goToUserHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  },

  handleCategoryFilterTap(event) {
    const categoryId = event.currentTarget.dataset.id || ''
    this.setData({
      activeCategoryId: categoryId
    })
    this.loadDishes()
  },

  handleStatusFilterTap(event) {
    const status = event.currentTarget.dataset.status || ''
    this.setData({
      activeStatus: status
    })
    this.loadDishes()
  },

  handleCreateTap() {
    if (!this.data.formCategoryOptions.length) {
      wx.showToast({
        title: '请先新增启用分类',
        icon: 'none'
      })
      return
    }

    const firstCategory = this.data.formCategoryOptions[0]
    this.setData({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增餐品',
      formDishId: '',
      formCategoryIndex: 0,
      formData: createEmptyForm(
        firstCategory.category_id,
        firstCategory.name,
        this.getNextSortOrder()
      )
    })
  },

  handleEditTap(event) {
    const dishId = event.currentTarget.dataset.id
    const dish = this.findDish(dishId)
    if (!dish) {
      return
    }

    const categoryIndex = Math.max(
      this.data.formCategoryOptions.findIndex((category) => category.category_id === dish.category_id),
      0
    )

    this.setData({
      formVisible: true,
      formMode: 'update',
      formTitle: '编辑餐品',
      formDishId: dish.dish_id,
      formCategoryIndex: categoryIndex,
      formData: {
        name: dish.name,
        category_id: dish.category_id,
        category_name: dish.category_name,
        description: dish.description,
        detail_description: dish.detail_description,
        image_url: dish.image_url,
        price_yuan: dish.price_yuan,
        original_price_yuan: dish.original_price_yuan,
        tags_text: dish.tags_text,
        stock_enabled: dish.stock_enabled,
        stock_count: String(dish.stock_count),
        sold_out: dish.sold_out,
        sort_order: String(dish.sort_order)
      }
    })
  },

  closeForm() {
    if (this.data.submitting || this.data.uploadingImage) {
      return
    }

    this.setData({
      formVisible: false
    })
  },

  async chooseDishImage() {
    if (this.data.uploadingImage) {
      return
    }

    let tempFilePath = ''
    try {
      tempFilePath = await chooseDishImageFile()
    } catch (error) {
      if (!isCancelError(error)) {
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
      return
    }

    if (!tempFilePath) {
      return
    }

    this.setData({
      uploadingImage: true
    })
    wx.showLoading({
      title: '上传中...',
      mask: true
    })

    try {
      const result = await uploadDishImageFile(tempFilePath)
      if (!result || !result.fileID) {
        throw new Error('No fileID returned')
      }

      this.setData({
        'formData.image_url': result.fileID
      })
      wx.hideLoading()
      wx.showToast({
        title: '图片已上传',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      console.error('upload dish image failed', error)
      wx.showToast({
        title: '图片上传失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        uploadingImage: false
      })
    }
  },

  previewFormImage() {
    const imageUrl = this.data.formData.image_url
    if (!imageUrl) {
      return
    }

    wx.previewImage({
      current: imageUrl,
      urls: [imageUrl]
    })
  },

  handleFormInput(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
  },

  handleFormSwitchChange(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
  },

  handleFormCategoryChange(event) {
    const index = Number(event.detail.value)
    const category = this.data.formCategoryOptions[index]
    if (!category) {
      return
    }

    this.setData({
      formCategoryIndex: index,
      'formData.category_id': category.category_id,
      'formData.category_name': category.name
    })
  },

  async submitForm() {
    if (this.data.submitting) {
      return
    }

    if (this.data.uploadingImage) {
      wx.showToast({
        title: '图片上传中',
        icon: 'none'
      })
      return
    }

    const payload = this.buildDishPayload()
    if (payload.error) {
      wx.showToast({
        title: payload.error,
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      if (this.data.formMode === 'create') {
        await this.callManageDish({
          action: 'create',
          data: payload.data
        })
        wx.showToast({
          title: '餐品已新增',
          icon: 'success'
        })
      } else {
        await this.callManageDish({
          action: 'update',
          dish_id: this.data.formDishId,
          data: payload.data
        })
        wx.showToast({
          title: '餐品已更新',
          icon: 'success'
        })
      }

      this.setData({
        formVisible: false
      })
      await this.loadPageData()
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  buildDishPayload() {
    const formData = this.data.formData
    const name = normalizeString(formData.name)
    const categoryId = normalizeString(formData.category_id)
    const priceCent = yuanToCent(formData.price_yuan)
    const originalPriceCent = yuanToCent(formData.original_price_yuan, {
      allowEmpty: true
    })
    const stockCount = normalizeStockCount(formData.stock_count)
    const sortOrder = Number(formData.sort_order)

    if (!name) {
      return { error: '请输入餐品名称' }
    }

    if (!categoryId) {
      return { error: '请选择所属分类' }
    }

    if (priceCent === null || priceCent <= 0) {
      return { error: '请输入正确售价' }
    }

    if (originalPriceCent === null) {
      return { error: '请输入正确原价' }
    }

    if (stockCount === null) {
      return { error: '库存数量必须是非负整数' }
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return { error: '排序必须是非负整数' }
    }

    return {
      data: {
        category_id: categoryId,
        name,
        description: normalizeString(formData.description),
        detail_description: normalizeString(formData.detail_description),
        image_url: normalizeString(formData.image_url),
        price_cent: priceCent,
        original_price_cent: originalPriceCent,
        tags: parseTags(formData.tags_text),
        stock_enabled: Boolean(formData.stock_enabled),
        stock_count: stockCount,
        sold_out: Boolean(formData.sold_out),
        sort_order: sortOrder
      }
    }
  },

  handleStatusTap(event) {
    if (this.data.submitting) {
      return
    }

    const dishId = event.currentTarget.dataset.id
    const action = event.currentTarget.dataset.action
    const dish = this.findDish(dishId)
    if (!dish || !action) {
      return
    }

    const text = action === 'onSale' ? '上架' : '下架'
    wx.showModal({
      title: `${text}餐品`,
      content: `确认${text}“${dish.name}”吗？`,
      confirmText: text,
      confirmColor: '#E63B4A',
      success: (res) => {
        if (res.confirm) {
          this.updateDishStatus(dishId, action)
        }
      }
    })
  },

  async updateDishStatus(dishId, action) {
    this.setData({
      submitting: true,
      activeDishId: dishId
    })

    try {
      await this.callManageDish({
        action,
        dish_id: dishId
      })
      wx.showToast({
        title: action === 'onSale' ? '餐品已上架' : '餐品已下架',
        icon: 'success'
      })
      await this.loadPageData()
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false,
        activeDishId: ''
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

    if (targetIndex < 0 || targetIndex >= this.data.dishes.length) {
      wx.showToast({
        title: '已经到边界了',
        icon: 'none'
      })
      return
    }

    this.sortDishes(index, targetIndex)
  },

  async sortDishes(index, targetIndex) {
    const dishes = this.data.dishes.slice()
    const current = dishes[index]
    dishes[index] = dishes[targetIndex]
    dishes[targetIndex] = current

    const sortList = dishes.map((dish, nextIndex) => ({
      dish_id: dish.dish_id,
      sort_order: nextIndex + 1
    }))

    this.setData({
      submitting: true,
      activeDishId: current.dish_id
    })

    try {
      await this.callManageDish({
        action: 'sort',
        data: {
          dishes: sortList
        }
      })
      wx.showToast({
        title: '排序已更新',
        icon: 'success'
      })
      await this.loadPageData()
    } catch (error) {
      this.showOperationError(error)
    } finally {
      this.setData({
        submitting: false,
        activeDishId: ''
      })
    }
  },

  findDish(dishId) {
    return this.data.dishes.find((dish) => dish.dish_id === dishId)
  },

  getNextSortOrder() {
    if (!this.data.dishes.length) {
      return 1
    }

    return Math.max(...this.data.dishes.map((dish) => dish.sort_order || 0)) + 1
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
