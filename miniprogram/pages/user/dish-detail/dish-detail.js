const { callFunction } = require('../../../utils/cloud')
const { DEFAULT_MERCHANT_ID, STORAGE_KEYS } = require('../../../utils/constants')
const { formatMoney } = require('../../../utils/format')

const FALLBACK_IMAGE = '/images/placeholders/food-placeholder.svg'
const FALLBACK_IMAGE_STYLE = 'width: 100%; height: 100%; left: 0; top: 0;'
const FALLBACK_INGREDIENTS = ['肥牛', '米饭', '时令蔬菜', '拌饭酱', '鸡蛋']
const CART_STORAGE_KEY = STORAGE_KEYS.CART_ITEMS || 'cart_items'
const DETAIL_ERROR_TEXT = {
  title: '小厨推荐加载失败',
  missingId: '缺少菜品信息，请返回今日菜单重新选择',
  loadFailed: '服务暂时不可用，请稍后重试',
  notFound: '没有找到这道菜，请返回今日菜单重新选择',
  notReady: '菜品信息还没加载好，请返回今日菜单重新选择'
}

const FALLBACK_DISH = {
  _id: 'dish_002',
  dish_id: 'dish_002',
  business_dish_id: 'dish_002',
  name: '招牌肥牛石锅拌饭',
  price_cent: 2990,
  base_price_cent: 2990,
  image: FALLBACK_IMAGE,
  image_style: FALLBACK_IMAGE_STYLE,
  image_mode: 'aspectFit',
  is_placeholder_image: true,
  tags: ['招牌推荐', '人气 TOP1', '约12分钟'],
  description: '肥牛现炒，锅巴焦香，拌匀更好吃。现点现做，认真对待每一碗热饭。',
  ingredients: FALLBACK_INGREDIENTS,
  spec_groups: [],
  addon_groups: [],
  has_options: false
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : []
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toSafePriceCent(value) {
  const priceCent = Number(value)
  return Number.isInteger(priceCent) && priceCent >= 0 ? priceCent : 0
}

function toPositiveQuantity(value) {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

function getDishId(dish = {}) {
  return dish._id || dish.dish_id || ''
}

function normalizeStockCount(value) {
  const numberValue = Number(value)

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return 0
  }

  return numberValue
}

function getSoldOutState(dish = {}) {
  const stockEnabled = dish.stock_enabled === true
  const stockCount = normalizeStockCount(dish.stock_count)
  const soldOut = dish.sold_out === true

  return {
    stock_enabled: stockEnabled,
    stock_count: stockCount,
    sold_out: soldOut,
    is_sold_out: soldOut || (stockEnabled && stockCount <= 0)
  }
}

function normalizeOption(option = {}) {
  const optionId = normalizeText(option.option_id)

  if (!optionId || option.enabled !== true) {
    return null
  }

  const priceDeltaCent = toSafePriceCent(option.price_delta_cent)

  return {
    option_id: optionId,
    name: option.name || '',
    option_name: option.name || '',
    price_delta_cent: priceDeltaCent,
    price_delta_text: priceDeltaCent > 0 ? `+${formatMoney(priceDeltaCent)}` : '',
    enabled: true,
    sort_order: Number.isFinite(option.sort_order) ? option.sort_order : 0,
    is_selected: false
  }
}

function normalizeOptionGroups(groups = []) {
  if (!Array.isArray(groups)) {
    return []
  }

  return groups.map((group = {}) => {
    const groupId = normalizeText(group.group_id)
    const options = Array.isArray(group.options)
      ? group.options.map(normalizeOption).filter(Boolean)
      : []

    if (!groupId || !options.length) {
      return null
    }

    return {
      group_id: groupId,
      name: group.name || '',
      group_name: group.name || '',
      required: group.required === true,
      min_select: Number.isInteger(group.min_select) && group.min_select >= 0
        ? group.min_select
        : 0,
      max_select: Number.isInteger(group.max_select) && group.max_select >= 0
        ? group.max_select
        : 0,
      sort_order: Number.isFinite(group.sort_order) ? group.sort_order : 0,
      options
    }
  }).filter(Boolean).sort((left, right) => left.sort_order - right.sort_order)
}

function createInitialSpecMap(specGroups = []) {
  return specGroups.reduce((result, group) => {
    if (group.required && group.options.length) {
      result[group.group_id] = group.options[0].option_id
    }
    return result
  }, {})
}

function decorateSpecGroups(specGroups = [], selectedSpecMap = {}) {
  return specGroups.map((group) => ({
    ...group,
    options: group.options.map((option) => ({
      ...option,
      is_selected: selectedSpecMap[group.group_id] === option.option_id
    }))
  }))
}

function decorateAddonGroups(addonGroups = [], selectedAddonMap = {}) {
  return addonGroups.map((group) => {
    const selectedIds = selectedAddonMap[group.group_id] || []

    return {
      ...group,
      options: group.options.map((option) => ({
        ...option,
        is_selected: selectedIds.includes(option.option_id)
      }))
    }
  })
}

function createOptionMap(groups = []) {
  return groups.reduce((result, group) => {
    result[group.group_id] = group.options.reduce((optionMap, option) => {
      optionMap[option.option_id] = option
      return optionMap
    }, {})
    return result
  }, {})
}

function buildSelectedSpecs(specGroups = [], selectedSpecMap = {}) {
  const optionMap = createOptionMap(specGroups)

  return Object.keys(selectedSpecMap).sort().map((groupId) => {
    const group = specGroups.find((item) => item.group_id === groupId)
    const optionId = selectedSpecMap[groupId]
    const option = optionMap[groupId] && optionMap[groupId][optionId]

    if (!group || !option) {
      return null
    }

    return {
      group_id: group.group_id,
      group_name: group.name,
      option_id: option.option_id,
      option_name: option.name,
      price_delta_cent: option.price_delta_cent
    }
  }).filter(Boolean)
}

function buildSelectedAddons(addonGroups = [], selectedAddonMap = {}) {
  const optionMap = createOptionMap(addonGroups)

  return Object.keys(selectedAddonMap).sort().map((groupId) => {
    const group = addonGroups.find((item) => item.group_id === groupId)
    const selectedIds = Array.isArray(selectedAddonMap[groupId])
      ? [...selectedAddonMap[groupId]].sort()
      : []

    if (!group || !selectedIds.length) {
      return null
    }

    const options = selectedIds.map((optionId) => {
      const option = optionMap[groupId] && optionMap[groupId][optionId]

      if (!option) {
        return null
      }

      return {
        option_id: option.option_id,
        option_name: option.name,
        price_delta_cent: option.price_delta_cent
      }
    }).filter(Boolean)

    if (!options.length) {
      return null
    }

    return {
      group_id: group.group_id,
      group_name: group.name,
      options
    }
  }).filter(Boolean)
}

function sumSpecDelta(selectedSpecs = []) {
  return selectedSpecs.reduce((sum, item) => sum + toSafePriceCent(item.price_delta_cent), 0)
}

function sumAddonDelta(selectedAddons = []) {
  return selectedAddons.reduce((sum, group) => {
    const groupTotal = Array.isArray(group.options)
      ? group.options.reduce((optionSum, option) =>
          optionSum + toSafePriceCent(option.price_delta_cent), 0)
      : 0
    return sum + groupTotal
  }, 0)
}

function createItemKey(dishId, selectedSpecs = [], selectedAddons = []) {
  const specParts = selectedSpecs
    .map((item) => `spec:${item.group_id}=${item.option_id}`)
    .sort()
  const addonParts = selectedAddons
    .map((group) => {
      const optionIds = Array.isArray(group.options)
        ? group.options.map((option) => option.option_id).sort().join(',')
        : ''
      return `addon:${group.group_id}=${optionIds}`
    })
    .sort()

  return [dishId].concat(specParts, addonParts).filter(Boolean).join('|')
}

function getRawCartItems() {
  try {
    const items = wx.getStorageSync(CART_STORAGE_KEY)
    return Array.isArray(items) ? items : []
  } catch (error) {
    return []
  }
}

function saveRawCartItems(items = []) {
  try {
    wx.setStorageSync(CART_STORAGE_KEY, items)
  } catch (error) {
    return []
  }

  return items
}

function addCartItemByKey(cartItem, quantity) {
  const addQuantity = toPositiveQuantity(quantity)
  const currentItems = getRawCartItems()
  const currentMerchantId = currentItems.length ? currentItems[0].merchant_id : ''
  const nextItems = currentMerchantId && currentMerchantId !== cartItem.merchant_id
    ? []
    : currentItems
  const targetKey = cartItem.item_key || cartItem.dish_id
  const existsIndex = nextItems.findIndex((item) => (item.item_key || item.dish_id) === targetKey)

  if (existsIndex >= 0) {
    const oldItem = nextItems[existsIndex]
    nextItems[existsIndex] = {
      ...oldItem,
      ...cartItem,
      quantity: toPositiveQuantity(oldItem.quantity) + addQuantity,
      updated_at: Date.now()
    }
  } else {
    nextItems.push({
      ...cartItem,
      quantity: addQuantity,
      selected: true,
      updated_at: Date.now()
    })
  }

  return saveRawCartItems(nextItems)
}

function formatIngredient(item) {
  if (typeof item === 'string') {
    return item
  }

  const name = item.name || item.ingredient_name || ''
  const quantity = Number(item.quantity_per_dish)
  const unit = item.unit || ''

  if (!name) {
    return ''
  }

  if (Number.isFinite(quantity) && quantity > 0 && unit) {
    return `${name}${quantity}${unit}`
  }

  return name
}

function normalizeIngredients(ingredients, tags) {
  const realIngredients = Array.isArray(ingredients)
    ? ingredients.map(formatIngredient).filter(Boolean)
    : []

  if (realIngredients.length) {
    return realIngredients
  }

  if (tags.length) {
    return tags.slice(0, 5)
  }

  return FALLBACK_INGREDIENTS
}

function decorateDish(rawDish, detailData = {}) {
  const dish = rawDish || {}
  const priceCent = toSafePriceCent(dish.price_cent)
  const imageUrl = dish.image_url || dish.image || ''
  const hasRealImage = Boolean(imageUrl)
  const tags = normalizeTags(dish.tags)
  const estimatedTime = Number(dish.estimated_time_min)
  const soldOutState = getSoldOutState(dish)
  const specGroups = normalizeOptionGroups(dish.spec_groups)
  const addonGroups = normalizeOptionGroups(dish.addon_groups)
  const dishId = getDishId(dish)
  const businessDishId = dish.dish_id || dishId

  if (Number.isFinite(estimatedTime) && estimatedTime > 0) {
    const timeTag = `约${estimatedTime}分钟`
    if (!tags.includes(timeTag)) {
      tags.push(timeTag)
    }
  }

  return {
    _id: dish._id || dishId,
    dish_id: dishId,
    business_dish_id: businessDishId,
    merchant_id: dish.merchant_id || DEFAULT_MERCHANT_ID,
    category_id: dish.category_id || (detailData.category && detailData.category.category_id) || '',
    name: dish.name || '未命名餐品',
    price_cent: priceCent,
    base_price_cent: priceCent,
    price_text: formatMoney(priceCent),
    image: hasRealImage ? imageUrl : FALLBACK_IMAGE,
    image_url: imageUrl,
    image_style: hasRealImage
      ? 'width: 100%; height: 100%; left: 0; top: 0;'
      : FALLBACK_IMAGE_STYLE,
    image_mode: hasRealImage ? 'aspectFill' : 'aspectFit',
    is_placeholder_image: !hasRealImage,
    tags,
    description: dish.detail_description || dish.description || '暂无菜品介绍',
    ingredients: normalizeIngredients(detailData.ingredients, tags),
    status: dish.status || 'on_sale',
    category: detailData.category || null,
    spec_groups: specGroups,
    addon_groups: addonGroups,
    has_options: dish.has_options === true || specGroups.length > 0 || addonGroups.length > 0,
    ...soldOutState
  }
}

function createSelectionState(dish) {
  const selectedSpecMap = createInitialSpecMap(dish.spec_groups)
  const selectedAddonMap = {}
  const selectedSpecs = buildSelectedSpecs(dish.spec_groups, selectedSpecMap)
  const selectedAddons = buildSelectedAddons(dish.addon_groups, selectedAddonMap)
  const unitPriceCent = dish.price_cent + sumSpecDelta(selectedSpecs) + sumAddonDelta(selectedAddons)

  return {
    selectedSpecMap,
    selectedAddonMap,
    specGroups: decorateSpecGroups(dish.spec_groups, selectedSpecMap),
    addonGroups: decorateAddonGroups(dish.addon_groups, selectedAddonMap),
    selectedSpecs,
    selectedAddons,
    unitPriceCent,
    unitPriceText: formatMoney(unitPriceCent)
  }
}

function getFallbackDish() {
  const soldOutState = getSoldOutState(FALLBACK_DISH)
  const dish = {
    ...FALLBACK_DISH,
    ...soldOutState,
    price_text: formatMoney(FALLBACK_DISH.price_cent)
  }

  return dish
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    pageStatus: 'loading',
    usingFallback: false,
    dishId: '',
    statusNotice: '正在读取小厨推荐',
    errorTitle: '',
    errorMessage: '',
    canRetry: false,
    dish: getFallbackDish(),
    specGroups: [],
    addonGroups: [],
    selectedSpecMap: {},
    selectedAddonMap: {},
    selectedSpecs: [],
    selectedAddons: [],
    unitPriceCent: FALLBACK_DISH.price_cent,
    unitPriceText: formatMoney(FALLBACK_DISH.price_cent),
    quantity: 1,
    totalPriceText: formatMoney(FALLBACK_DISH.price_cent),
    imageAvailable: true
  },

  onLoad(options = {}) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    const navigationHeight = Math.max(44, (menuButton.top - statusBarHeight) * 2 + menuButton.height)
    const dishId = options.dish_id || options.id || ''

    this.setData({
      statusBarHeight,
      navigationHeight,
      dishId
    })

    if (!dishId) {
      this.showErrorState({
        message: DETAIL_ERROR_TEXT.missingId,
        canRetry: false
      })
      return
    }

    this.loadDishDetail(dishId)
  },

  async loadDishDetail(dishId = this.data.dishId) {
    if (!dishId) {
      this.showErrorState({
        message: DETAIL_ERROR_TEXT.missingId,
        canRetry: false
      })
      return
    }

    this.setData({
      pageStatus: 'loading',
      usingFallback: false,
      statusNotice: '正在读取小厨推荐',
      errorTitle: '',
      errorMessage: '',
      canRetry: false,
      imageAvailable: true
    })

    try {
      const detailData = await callFunction('getDishDetail', {
        dish_id: dishId,
        merchant_id: DEFAULT_MERCHANT_ID
      })
      const rawDish = detailData && detailData.dish

      if (!rawDish) {
        this.showErrorState({
          message: DETAIL_ERROR_TEXT.notFound,
          canRetry: false
        })
        return
      }

      const dish = decorateDish(rawDish, detailData)

      if (!dish.dish_id) {
        this.showErrorState({
          message: DETAIL_ERROR_TEXT.notFound,
          canRetry: false
        })
        return
      }

      const selectionState = createSelectionState(dish)

      this.setData({
        pageStatus: 'success',
        usingFallback: false,
        errorTitle: '',
        errorMessage: '',
        canRetry: false,
        statusNotice: '跟小厨说一声后现做，高峰期请耐心等待',
        dish,
        quantity: 1,
        totalPriceText: selectionState.unitPriceText,
        ...selectionState
      })
    } catch (error) {
      this.showErrorState({
        message: DETAIL_ERROR_TEXT.loadFailed,
        canRetry: true
      })
    }
  },

  showErrorState({ title = DETAIL_ERROR_TEXT.title, message, canRetry = false }) {
    this.setData({
      pageStatus: 'error',
      usingFallback: false,
      statusNotice: message,
      errorTitle: title,
      errorMessage: message,
      canRetry,
      dish: null,
      specGroups: [],
      addonGroups: [],
      selectedSpecMap: {},
      selectedAddonMap: {},
      selectedSpecs: [],
      selectedAddons: [],
      unitPriceCent: 0,
      unitPriceText: formatMoney(0),
      quantity: 1,
      totalPriceText: formatMoney(0),
      imageAvailable: false
    })
  },

  retryLoad() {
    if (!this.data.dishId) {
      this.showErrorState({
        message: DETAIL_ERROR_TEXT.missingId,
        canRetry: false
      })
      return
    }

    this.loadDishDetail(this.data.dishId)
  },

  goToMenu() {
    wx.reLaunch({
      url: '/pages/user/menu/menu'
    })
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: '/pages/user/menu/menu'
    })
  },

  handleImageError() {
    if (!this.data.dish) {
      this.setData({
        imageAvailable: false
      })
      return
    }

    if (this.data.dish.image === FALLBACK_IMAGE) {
      this.setData({
        imageAvailable: false
      })
      return
    }

    const fallbackDish = {
      ...this.data.dish,
      image: FALLBACK_IMAGE,
      image_style: FALLBACK_IMAGE_STYLE,
      image_mode: 'aspectFit',
      is_placeholder_image: true
    }

    this.setData({
      dish: fallbackDish,
      imageAvailable: true
    })
  },

  refreshOptionState(selectedSpecMap, selectedAddonMap) {
    const dish = this.data.dish

    if (!dish || this.data.pageStatus !== 'success') {
      return
    }

    const selectedSpecs = buildSelectedSpecs(dish.spec_groups, selectedSpecMap)
    const selectedAddons = buildSelectedAddons(dish.addon_groups, selectedAddonMap)
    const unitPriceCent = dish.price_cent + sumSpecDelta(selectedSpecs) + sumAddonDelta(selectedAddons)

    this.setData({
      selectedSpecMap,
      selectedAddonMap,
      selectedSpecs,
      selectedAddons,
      specGroups: decorateSpecGroups(dish.spec_groups, selectedSpecMap),
      addonGroups: decorateAddonGroups(dish.addon_groups, selectedAddonMap),
      unitPriceCent,
      unitPriceText: formatMoney(unitPriceCent),
      totalPriceText: formatMoney(unitPriceCent * this.data.quantity)
    })
  },

  selectSpecOption(event) {
    const { groupId, optionId } = event.currentTarget.dataset

    if (!groupId || !optionId) {
      return
    }

    this.refreshOptionState({
      ...this.data.selectedSpecMap,
      [groupId]: optionId
    }, this.data.selectedAddonMap)
  },

  toggleAddonOption(event) {
    const { groupId, optionId } = event.currentTarget.dataset

    if (!groupId || !optionId) {
      return
    }

    const group = this.data.addonGroups.find((item) => item.group_id === groupId)
    const currentIds = this.data.selectedAddonMap[groupId] || []
    const isSelected = currentIds.includes(optionId)
    const nextIds = isSelected
      ? currentIds.filter((id) => id !== optionId)
      : currentIds.concat(optionId)
    const maxSelect = group && Number.isInteger(group.max_select) ? group.max_select : 0

    if (!isSelected && nextIds.length > maxSelect) {
      wx.showToast({
        title: `最多选择 ${maxSelect} 项`,
        icon: 'none'
      })
      return
    }

    this.refreshOptionState(this.data.selectedSpecMap, {
      ...this.data.selectedAddonMap,
      [groupId]: nextIds
    })
  },

  updateQuantity(quantity) {
    this.setData({
      quantity,
      totalPriceText: formatMoney(this.data.unitPriceCent * quantity)
    })
  },

  decreaseQuantity() {
    if (this.data.pageStatus !== 'success') {
      return
    }

    if (this.data.quantity > 1) {
      this.updateQuantity(this.data.quantity - 1)
    }
  },

  increaseQuantity() {
    if (this.data.pageStatus !== 'success' || !this.data.dish || !getDishId(this.data.dish)) {
      wx.showToast({
        title: DETAIL_ERROR_TEXT.notReady,
        icon: 'none'
      })
      return
    }

    if (this.data.dish.is_sold_out) {
      wx.showToast({
        title: '该餐品已售罄',
        icon: 'none'
      })
      return
    }

    this.updateQuantity(this.data.quantity + 1)
  },

  validateSelections() {
    if (this.data.pageStatus !== 'success' || !this.data.dish) {
      return {
        valid: false,
        message: DETAIL_ERROR_TEXT.notReady
      }
    }

    const missingSpec = this.data.specGroups.find((group) =>
      group.required && !this.data.selectedSpecMap[group.group_id]
    )

    if (missingSpec) {
      return {
        valid: false,
        message: `请选择${missingSpec.name || '必选规格'}`
      }
    }

    const invalidAddon = this.data.addonGroups.find((group) => {
      const selectedCount = (this.data.selectedAddonMap[group.group_id] || []).length
      return selectedCount < group.min_select
    })

    if (invalidAddon) {
      return {
        valid: false,
        message: `${invalidAddon.name || '加料'}至少选择 ${invalidAddon.min_select} 项`
      }
    }

    return {
      valid: true,
      message: ''
    }
  },

  buildCartItem() {
    const dish = this.data.dish
    const selectedSpecs = this.data.selectedSpecs
    const selectedAddons = this.data.selectedAddons
    const dishId = dish.dish_id || dish._id
    const itemKey = createItemKey(dishId, selectedSpecs, selectedAddons)

    return {
      item_key: itemKey,
      dish_id: dishId,
      business_dish_id: dish.business_dish_id || dish.dish_id,
      merchant_id: dish.merchant_id || DEFAULT_MERCHANT_ID,
      category_id: dish.category_id || '',
      name: dish.name,
      description: dish.description || '',
      image_url: dish.image_url || dish.image || '',
      price_cent: this.data.unitPriceCent,
      base_price_cent: dish.base_price_cent || dish.price_cent,
      unit_price_cent: this.data.unitPriceCent,
      original_price_cent: dish.original_price_cent || 0,
      tags: normalizeTags(dish.tags),
      status: dish.status || 'on_sale',
      selected_specs: selectedSpecs,
      selected_addons: selectedAddons
    }
  },

  addToCart() {
    if (this.data.pageStatus !== 'success' || !this.data.dish || !getDishId(this.data.dish)) {
      wx.showToast({
        title: DETAIL_ERROR_TEXT.notReady,
        icon: 'none'
      })
      return
    }

    if (this.data.dish.is_sold_out) {
      wx.showToast({
        title: '该餐品已售罄',
        icon: 'none'
      })
      return
    }

    const validation = this.validateSelections()

    if (!validation.valid) {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
      return
    }

    addCartItemByKey(this.buildCartItem(), this.data.quantity)

    wx.showToast({
      title: '已放进小篮子',
      icon: 'none'
    })
  }
})
