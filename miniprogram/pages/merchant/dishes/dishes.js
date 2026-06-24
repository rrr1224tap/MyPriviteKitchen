const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID } = require('../../../utils/constants')

const BACKGROUND_IMAGE = '/images/mock/home-glass-display.jpg'
const FOOD_PLACEHOLDER_IMAGE = '/images/placeholders/food-placeholder.svg'
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

const MAX_TUTORIAL_COUNT = 3
const TUTORIAL_PLATFORM_OPTIONS = [
  { label: '抖音', value: 'douyin' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: 'B站', value: 'bilibili' },
  { label: '其他', value: 'other' }
]

function createLocalId(prefix) {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now()}_${random}`
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

function normalizeTutorialPlatform(value) {
  const platform = normalizeString(value)
  return TUTORIAL_PLATFORM_OPTIONS.some((option) => option.value === platform)
    ? platform
    : 'other'
}

function getTutorialPlatformIndex(platform) {
  const value = normalizeTutorialPlatform(platform)
  const index = TUTORIAL_PLATFORM_OPTIONS.findIndex((option) => option.value === value)
  return index >= 0 ? index : TUTORIAL_PLATFORM_OPTIONS.length - 1
}

function createTutorialItem(item = {}, index = 0) {
  const platform = normalizeTutorialPlatform(item.platform)
  const platformIndex = getTutorialPlatformIndex(platform)
  return {
    title: normalizeString(item.title),
    platform,
    platform_index: platformIndex,
    platform_text: TUTORIAL_PLATFORM_OPTIONS[platformIndex].label,
    url: normalizeString(item.url),
    note: normalizeString(item.note),
    enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    sort_order: Number(item.sort_order) || index + 1
  }
}

function normalizeTutorials(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => createTutorialItem(item, index))
    .filter((item) => item.title || item.url || item.note)
    .slice(0, MAX_TUTORIAL_COUNT)
}

function normalizeSelectCount(value, fallback) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : fallback
}

function getOptionGroupField(type) {
  return type === 'addon' ? 'addon_groups' : 'spec_groups'
}

function createOptionItem(item = {}, index = 0, type = 'spec') {
  const priceText = normalizeString(item.price_delta_yuan)
  return {
    option_id: normalizeString(item.option_id) || createLocalId(`${type}_option`),
    name: normalizeString(item.name),
    price_delta_yuan: priceText || centsToYuan(item.price_delta_cent),
    enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    sort_order: Number(item.sort_order) || index + 1
  }
}

function createOptionGroup(type = 'spec', index = 0, group = {}) {
  const isSpec = type === 'spec'
  const options = Array.isArray(group.options)
    ? group.options.map((option, optionIndex) => createOptionItem(option, optionIndex, type))
    : []

  return {
    group_id: normalizeString(group.group_id) || createLocalId(`${type}_group`),
    name: normalizeString(group.name),
    required: typeof group.required === 'boolean' ? group.required : isSpec,
    min_select: normalizeSelectCount(group.min_select, isSpec ? 1 : 0),
    max_select: normalizeSelectCount(group.max_select, isSpec ? 1 : 3),
    sort_order: Number(group.sort_order) || index + 1,
    options
  }
}

function normalizeOptionGroups(groups, type = 'spec') {
  if (!Array.isArray(groups)) {
    return []
  }

  return groups.map((group, index) => createOptionGroup(type, index, group))
}

function normalizeIngredientAmount(value) {
  const text = String(value === undefined || value === null ? '' : value).trim()
  if (!text) {
    return ''
  }

  const numberValue = Number(text)
  return Number.isFinite(numberValue) && numberValue >= 0 ? String(numberValue) : '0'
}

function createIngredientItem(item = {}, index = 0) {
  return {
    name: normalizeString(item.name),
    amount: normalizeIngredientAmount(item.amount),
    unit: normalizeString(item.unit),
    category: normalizeString(item.category) || '其他',
    note: normalizeString(item.note),
    enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    sort_order: Number(item.sort_order) || index + 1
  }
}

function normalizeIngredients(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => createIngredientItem(item, index))
    .filter((item) => item.name)
    .map((item, index) => ({
      ...item,
      sort_order: index + 1
    }))
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
    image_failed: false,
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
    spec_groups: normalizeOptionGroups(dish.spec_groups, 'spec'),
    addon_groups: normalizeOptionGroups(dish.addon_groups, 'addon'),
    tutorials: normalizeTutorials(dish.tutorials),
    ingredients: normalizeIngredients(dish.ingredients),
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
    spec_groups: [],
    addon_groups: [],
    tutorials: [],
    ingredients: [],
    sort_order: String(sortOrder)
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    backgroundImage: BACKGROUND_IMAGE,
    foodPlaceholderImage: FOOD_PLACEHOLDER_IMAGE,
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
    tutorialPlatformOptions: TUTORIAL_PLATFORM_OPTIONS,
    formCategoryOptions: [],
    formCategoryIndex: 0,
    uploadingImage: false,
    formImageAvailable: true
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

  handleDishImageError(event) {
    const dishId = event.currentTarget.dataset.id
    if (!dishId) {
      return
    }

    this.setData({
      dishes: this.data.dishes.map((dish) => {
        if (dish.dish_id !== dishId) {
          return dish
        }

        return {
          ...dish,
          image_failed: true
        }
      })
    })
  },

  handleFormImageError() {
    this.setData({
      formImageAvailable: false
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
      formImageAvailable: true,
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
      formImageAvailable: true,
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
        spec_groups: normalizeOptionGroups(dish.spec_groups, 'spec'),
        addon_groups: normalizeOptionGroups(dish.addon_groups, 'addon'),
        tutorials: normalizeTutorials(dish.tutorials),
        ingredients: normalizeIngredients(dish.ingredients),
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
        'formData.image_url': result.fileID,
        formImageAvailable: true
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
    const nextData = {
      [`formData.${field}`]: value
    }

    if (field === 'image_url') {
      nextData.formImageAvailable = true
    }

    this.setData(nextData)
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

  getFormOptionGroups(type) {
    const field = getOptionGroupField(type)
    return Array.isArray(this.data.formData[field])
      ? this.data.formData[field].map((group) => ({
        ...group,
        options: Array.isArray(group.options) ? group.options.slice() : []
      }))
      : []
  },

  handleAddOptionGroup(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groups = this.getFormOptionGroups(type)
    groups.push(createOptionGroup(type, groups.length))
    this.setData({
      [`formData.${field}`]: groups
    })
  },

  handleRemoveOptionGroup(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const groups = this.getFormOptionGroups(type)

    if (groupIndex < 0 || groupIndex >= groups.length) {
      return
    }

    groups.splice(groupIndex, 1)
    this.setData({
      [`formData.${field}`]: groups.map((group, index) => createOptionGroup(type, index, {
        ...group,
        sort_order: index + 1
      }))
    })
  },

  handleOptionGroupInput(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const inputField = event.currentTarget.dataset.field
    const groups = this.getFormOptionGroups(type)

    if (!groups[groupIndex] || !inputField) {
      return
    }

    groups[groupIndex] = createOptionGroup(type, groupIndex, {
      ...groups[groupIndex],
      [inputField]: event.detail.value
    })
    this.setData({
      [`formData.${field}`]: groups
    })
  },

  handleAddOption(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const groups = this.getFormOptionGroups(type)

    if (!groups[groupIndex]) {
      return
    }

    const options = Array.isArray(groups[groupIndex].options)
      ? groups[groupIndex].options.slice()
      : []
    options.push(createOptionItem({}, options.length, type))
    groups[groupIndex] = createOptionGroup(type, groupIndex, {
      ...groups[groupIndex],
      options
    })
    this.setData({
      [`formData.${field}`]: groups
    })
  },

  handleRemoveOption(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const optionIndex = Number(event.currentTarget.dataset.optionIndex)
    const groups = this.getFormOptionGroups(type)

    if (!groups[groupIndex] || optionIndex < 0 || optionIndex >= groups[groupIndex].options.length) {
      return
    }

    const options = groups[groupIndex].options.slice()
    options.splice(optionIndex, 1)
    groups[groupIndex] = createOptionGroup(type, groupIndex, {
      ...groups[groupIndex],
      options: options.map((option, index) => createOptionItem(option, index, type))
    })
    this.setData({
      [`formData.${field}`]: groups
    })
  },

  handleOptionInput(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const optionIndex = Number(event.currentTarget.dataset.optionIndex)
    const inputField = event.currentTarget.dataset.field
    const groups = this.getFormOptionGroups(type)

    if (!groups[groupIndex] || !groups[groupIndex].options[optionIndex] || !inputField) {
      return
    }

    const options = groups[groupIndex].options.slice()
    options[optionIndex] = createOptionItem({
      ...options[optionIndex],
      [inputField]: event.detail.value
    }, optionIndex, type)
    groups[groupIndex] = createOptionGroup(type, groupIndex, {
      ...groups[groupIndex],
      options
    })
    this.setData({
      [`formData.${field}`]: groups
    })
  },

  handleOptionSwitchChange(event) {
    const type = event.currentTarget.dataset.type === 'addon' ? 'addon' : 'spec'
    const field = getOptionGroupField(type)
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const optionIndex = Number(event.currentTarget.dataset.optionIndex)
    const groups = this.getFormOptionGroups(type)

    if (!groups[groupIndex] || !groups[groupIndex].options[optionIndex]) {
      return
    }

    const options = groups[groupIndex].options.slice()
    options[optionIndex] = createOptionItem({
      ...options[optionIndex],
      enabled: event.detail.value
    }, optionIndex, type)
    groups[groupIndex] = createOptionGroup(type, groupIndex, {
      ...groups[groupIndex],
      options
    })
    this.setData({
      [`formData.${field}`]: groups
    })
  },

  handleAddIngredient() {
    const ingredients = Array.isArray(this.data.formData.ingredients)
      ? this.data.formData.ingredients.slice()
      : []

    ingredients.push(createIngredientItem({}, ingredients.length))
    this.setData({
      'formData.ingredients': ingredients
    })
  },

  handleRemoveIngredient(event) {
    const index = Number(event.currentTarget.dataset.index)
    const ingredients = Array.isArray(this.data.formData.ingredients)
      ? this.data.formData.ingredients.slice()
      : []

    if (index < 0 || index >= ingredients.length) {
      return
    }

    ingredients.splice(index, 1)
    this.setData({
      'formData.ingredients': ingredients.map((item, nextIndex) => createIngredientItem({
        ...item,
        sort_order: nextIndex + 1
      }, nextIndex))
    })
  },

  handleIngredientInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const ingredients = Array.isArray(this.data.formData.ingredients)
      ? this.data.formData.ingredients.slice()
      : []

    if (!ingredients[index] || !field) {
      return
    }

    ingredients[index] = createIngredientItem({
      ...ingredients[index],
      [field]: event.detail.value
    }, index)

    this.setData({
      'formData.ingredients': ingredients
    })
  },

  handleIngredientSwitchChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const ingredients = Array.isArray(this.data.formData.ingredients)
      ? this.data.formData.ingredients.slice()
      : []

    if (!ingredients[index]) {
      return
    }

    ingredients[index] = createIngredientItem({
      ...ingredients[index],
      enabled: event.detail.value
    }, index)

    this.setData({
      'formData.ingredients': ingredients
    })
  },

  handleAddTutorial() {
    const tutorials = Array.isArray(this.data.formData.tutorials)
      ? this.data.formData.tutorials.slice()
      : []

    if (tutorials.length >= MAX_TUTORIAL_COUNT) {
      wx.showToast({
        title: '做法参考最多 3 条',
        icon: 'none'
      })
      return
    }

    tutorials.push(createTutorialItem({}, tutorials.length))
    this.setData({
      'formData.tutorials': tutorials
    })
  },

  handleRemoveTutorial(event) {
    const index = Number(event.currentTarget.dataset.index)
    const tutorials = Array.isArray(this.data.formData.tutorials)
      ? this.data.formData.tutorials.slice()
      : []

    if (index < 0 || index >= tutorials.length) {
      return
    }

    tutorials.splice(index, 1)
    this.setData({
      'formData.tutorials': tutorials.map((item, nextIndex) => createTutorialItem({
        ...item,
        sort_order: nextIndex + 1
      }, nextIndex))
    })
  },

  handleTutorialInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const tutorials = Array.isArray(this.data.formData.tutorials)
      ? this.data.formData.tutorials.slice()
      : []

    if (!tutorials[index] || !field) {
      return
    }

    tutorials[index] = createTutorialItem({
      ...tutorials[index],
      [field]: event.detail.value
    }, index)

    this.setData({
      'formData.tutorials': tutorials
    })
  },

  handleTutorialPlatformChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const optionIndex = Number(event.detail.value)
    const option = TUTORIAL_PLATFORM_OPTIONS[optionIndex]
    const tutorials = Array.isArray(this.data.formData.tutorials)
      ? this.data.formData.tutorials.slice()
      : []

    if (!tutorials[index] || !option) {
      return
    }

    tutorials[index] = createTutorialItem({
      ...tutorials[index],
      platform: option.value
    }, index)

    this.setData({
      'formData.tutorials': tutorials
    })
  },

  handleTutorialSwitchChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const tutorials = Array.isArray(this.data.formData.tutorials)
      ? this.data.formData.tutorials.slice()
      : []

    if (!tutorials[index]) {
      return
    }

    tutorials[index] = createTutorialItem({
      ...tutorials[index],
      enabled: event.detail.value
    }, index)

    this.setData({
      'formData.tutorials': tutorials
    })
  },

  normalizeFormTutorials(tutorials) {
    return normalizeTutorials(tutorials).map((item, index) => ({
      title: item.title || `做法参考 ${index + 1}`,
      platform: item.platform,
      url: item.url,
      note: item.note,
      enabled: item.enabled,
      sort_order: index + 1
    }))
  },

  normalizeFormIngredients(ingredients) {
    return normalizeIngredients(ingredients).map((item, index) => ({
      name: item.name,
      amount: Number(item.amount) || 0,
      unit: item.unit,
      category: item.category || '其他',
      note: item.note,
      enabled: item.enabled,
      sort_order: index + 1
    }))
  },

  normalizeFormOptionGroups(groups, type = 'spec') {
    const isSpec = type === 'spec'
    const normalizedGroups = normalizeOptionGroups(groups, type)
    const result = []

    for (const group of normalizedGroups) {
      const groupName = normalizeString(group.name)
      const optionPayload = []

      for (const option of group.options) {
        const optionName = normalizeString(option.name)
        const priceText = normalizeString(option.price_delta_yuan)
        const priceCent = yuanToCent(priceText, { allowEmpty: true })

        if (priceCent === null) {
          return { error: isSpec ? '请输入正确的规格加价' : '请输入正确的加料加价' }
        }

        if (!optionName && priceCent === 0) {
          continue
        }

        if (!optionName) {
          return { error: isSpec ? '请输入规格项名称' : '请输入加料项名称' }
        }

        optionPayload.push({
          option_id: option.option_id,
          name: optionName,
          price_delta_cent: priceCent,
          enabled: Boolean(option.enabled),
          sort_order: optionPayload.length + 1
        })
      }

      if (!groupName && !optionPayload.length) {
        continue
      }

      if (!groupName) {
        return { error: isSpec ? '请输入规格组名称' : '请输入加料组名称' }
      }

      const maxSelect = isSpec ? 1 : normalizeSelectCount(group.max_select, 3)
      result.push({
        group_id: group.group_id,
        name: groupName,
        required: isSpec,
        min_select: isSpec ? 1 : 0,
        max_select: isSpec ? 1 : maxSelect,
        sort_order: result.length + 1,
        options: optionPayload
      })
    }

    return { data: result }
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

    const specGroups = this.normalizeFormOptionGroups(formData.spec_groups, 'spec')
    if (specGroups.error) {
      return specGroups
    }

    const addonGroups = this.normalizeFormOptionGroups(formData.addon_groups, 'addon')
    if (addonGroups.error) {
      return addonGroups
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
        spec_groups: specGroups.data,
        addon_groups: addonGroups.data,
        ingredients: this.normalizeFormIngredients(formData.ingredients),
        tutorials: this.normalizeFormTutorials(formData.tutorials),
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
