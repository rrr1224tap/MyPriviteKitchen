const VALID_ACTIONS = ['list', 'listDishes', 'create', 'createDish', 'update', 'updateDish', 'updateDishStatus', 'onSale', 'offSale', 'sort']
const WEB_ALLOWED_ACTIONS = ['listDishes', 'createDish', 'updateDish', 'updateDishStatus']
const VALID_DISH_STATUSES = ['on_sale', 'off_sale']
const VALID_TUTORIAL_PLATFORMS = ['douyin', 'xiaohongshu', 'bilibili', 'other']
const MAX_TUTORIAL_COUNT = 3
const { verifyWebAdminToken } = require('./web-admin-token-helper')

function success(message, data = {}) {
  return {
    success: true,
    code: 'SUCCESS',
    message,
    data
  }
}

function failure(code, message) {
  return {
    success: false,
    code,
    message,
    data: null
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeData(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function parseJsonBody(body) {
  if (!body) {
    return {}
  }

  if (typeof body === 'object' && !Array.isArray(body)) {
    return body
  }

  if (typeof body !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(body)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

function normalizeEventPayload(event = {}) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return {}
  }

  if (Object.prototype.hasOwnProperty.call(event, 'action') ||
    Object.prototype.hasOwnProperty.call(event, 'admin_token')) {
    return event
  }

  const bodyPayload = parseJsonBody(event.body)
  if (Object.keys(bodyPayload).length > 0) {
    return bodyPayload
  }

  const queryPayload = event.queryStringParameters
  if (queryPayload && typeof queryPayload === 'object' && !Array.isArray(queryPayload)) {
    return queryPayload
  }

  return {}
}

const DISH_DATA_FIELDS = [
  'category_id',
  'name',
  'description',
  'detail_description',
  'image_url',
  'image',
  'price_cent',
  'original_price_cent',
  'tags',
  'status',
  'stock_enabled',
  'stock_count',
  'sold_out',
  'spec_groups',
  'addon_groups',
  'tutorials',
  'ingredients',
  'sort_order'
]

function normalizeEventData(event = {}) {
  const rootData = {}
  DISH_DATA_FIELDS.forEach((field) => {
    if (hasOwn(event, field)) {
      rootData[field] = event[field]
    }
  })

  return {
    ...rootData,
    ...normalizeData(event.dish),
    ...normalizeData(event.data)
  }
}

function getPayloadValue(event, field) {
  if (hasOwn(event, field)) {
    return event[field]
  }

  const data = normalizeData(event.data)
  if (hasOwn(data, field)) {
    return data[field]
  }

  const dish = normalizeData(event.dish)
  if (hasOwn(dish, field)) {
    return dish[field]
  }

  return undefined
}

function normalizePriceYuanToCent(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null
  }

  return Math.round(numberValue * 100)
}

function normalizeWebDishBasicData(event = {}) {
  const data = {}

  if (getPayloadValue(event, 'name') !== undefined) {
    data.name = getPayloadValue(event, 'name')
  }

  if (getPayloadValue(event, 'category_id') !== undefined) {
    data.category_id = getPayloadValue(event, 'category_id')
  }

  if (getPayloadValue(event, 'description') !== undefined) {
    data.description = getPayloadValue(event, 'description')
  }

  const imageUrl = getPayloadValue(event, 'image_url')
  const image = getPayloadValue(event, 'image')
  if (imageUrl !== undefined || image !== undefined) {
    data.image_url = imageUrl !== undefined ? imageUrl : image
  }

  const price = getPayloadValue(event, 'price')
  const priceCent = getPayloadValue(event, 'price_cent')
  if (price !== undefined || priceCent !== undefined) {
    data.price_cent = price !== undefined
      ? normalizePriceYuanToCent(price)
      : normalizePriceCent(priceCent)
  }

  return data
}

function normalizeWebDishCreateData(event = {}) {
  return normalizeWebDishBasicData(event)
}

function normalizeWebDishUpdateData(event = {}) {
  return normalizeWebDishBasicData(event)
}

function normalizeWebDishStatusData(event = {}) {
  const status = getPayloadValue(event, 'status')
  return {
    status: status === undefined ? undefined : status
  }
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
}

function normalizeSortOrder(value) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null
  }
  return numberValue
}

function normalizePriceCent(value) {
  if (value === null || value === '') {
    return null
  }

  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null
  }
  return numberValue
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeStockCount(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null
  }
  return value
}

function normalizeBooleanDefault(value, defaultValue) {
  return typeof value === 'boolean' ? value : defaultValue
}

function normalizeOptionGroupList(value) {
  return Array.isArray(value) ? value : []
}

function normalizeTutorialPlatform(value) {
  const platform = normalizeString(value)
  return VALID_TUTORIAL_PLATFORMS.includes(platform) ? platform : 'other'
}

function normalizeTutorialList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null
      }

      const title = normalizeString(item.title)
      const url = normalizeString(item.url)
      const note = normalizeString(item.note)

      if (!title && !url && !note) {
        return null
      }

      return {
        title: title || `做法参考 ${index + 1}`,
        platform: normalizeTutorialPlatform(item.platform),
        url,
        note,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        sort_order: isNonNegativeNumber(item.sort_order)
          ? Number(item.sort_order)
          : index + 1
      }
    })
    .filter(Boolean)
    .slice(0, MAX_TUTORIAL_COUNT)
}

function normalizeIngredientAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

function normalizeIngredientList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null
      }

      const name = normalizeString(item.name)
      if (!name) {
        return null
      }

      return {
        name,
        amount: normalizeIngredientAmount(item.amount),
        unit: normalizeString(item.unit),
        category: normalizeString(item.category) || '其他',
        note: normalizeString(item.note),
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        sort_order: isNonNegativeNumber(item.sort_order)
          ? Number(item.sort_order)
          : index + 1
      }
    })
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      sort_order: index + 1
    }))
}

function hasOptions(dish = {}) {
  return normalizeOptionGroupList(dish.spec_groups).length > 0 ||
    normalizeOptionGroupList(dish.addon_groups).length > 0
}

function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateOptionGroupList(groups, type, usedGroupIds) {
  if (!Array.isArray(groups)) {
    return failure('VALIDATION_ERROR', type === 'spec'
      ? '规格配置必须是数组'
      : '加料配置必须是数组')
  }

  for (const group of groups) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      return failure('VALIDATION_ERROR', '规格加料配置不合法')
    }

    const groupId = normalizeString(group.group_id)
    if (!groupId) {
      return failure('VALIDATION_ERROR', '规格加料组 ID 不能为空')
    }

    if (usedGroupIds.has(groupId)) {
      return failure('VALIDATION_ERROR', '规格加料组 ID 不能重复')
    }
    usedGroupIds.add(groupId)

    if (!normalizeString(group.name)) {
      return failure('VALIDATION_ERROR', '规格加料组名称不能为空')
    }

    if (typeof group.required !== 'boolean') {
      return failure('VALIDATION_ERROR', '规格加料必选字段必须是布尔值')
    }

    if (!isNonNegativeInteger(group.min_select)) {
      return failure('VALIDATION_ERROR', '规格加料最小选择数必须是非负整数')
    }

    if (!isNonNegativeInteger(group.max_select)) {
      return failure('VALIDATION_ERROR', '规格加料最大选择数必须是非负整数')
    }

    if (group.max_select < group.min_select) {
      return failure('VALIDATION_ERROR', '规格加料最大选择数不能小于最小选择数')
    }

    if (type === 'spec' && group.max_select !== 1) {
      return failure('VALIDATION_ERROR', '规格组第一阶段只支持单选')
    }

    if (type === 'spec' && group.required && group.min_select !== 1) {
      return failure('VALIDATION_ERROR', '必选规格必须选择 1 项')
    }

    if (!isNonNegativeNumber(group.sort_order)) {
      return failure('VALIDATION_ERROR', '规格加料排序必须是数字')
    }

    if (!Array.isArray(group.options)) {
      return failure('VALIDATION_ERROR', '规格加料选项必须是数组')
    }

    const usedOptionIds = new Set()
    for (const option of group.options) {
      if (!option || typeof option !== 'object' || Array.isArray(option)) {
        return failure('VALIDATION_ERROR', '规格加料选项不合法')
      }

      const optionId = normalizeString(option.option_id)
      if (!optionId) {
        return failure('VALIDATION_ERROR', '规格加料选项 ID 不能为空')
      }

      if (usedOptionIds.has(optionId)) {
        return failure('VALIDATION_ERROR', '同一规格加料组内选项 ID 不能重复')
      }
      usedOptionIds.add(optionId)

      if (!normalizeString(option.name)) {
        return failure('VALIDATION_ERROR', '规格加料选项名称不能为空')
      }

      if (!isNonNegativeInteger(option.price_delta_cent)) {
        return failure('VALIDATION_ERROR', '规格加料加价必须是非负整数分')
      }

      if (typeof option.enabled !== 'boolean') {
        return failure('VALIDATION_ERROR', '规格加料选项启用字段必须是布尔值')
      }

      if (!isNonNegativeNumber(option.sort_order)) {
        return failure('VALIDATION_ERROR', '规格加料选项排序必须是数字')
      }
    }
  }

  return null
}

function validateOptionGroups(specGroups = [], addonGroups = []) {
  const usedGroupIds = new Set()
  return validateOptionGroupList(specGroups, 'spec', usedGroupIds) ||
    validateOptionGroupList(addonGroups, 'addon', usedGroupIds)
}

function validateTutorialList(value) {
  if (!Array.isArray(value)) {
    return failure('VALIDATION_ERROR', '做法参考必须是数组')
  }

  const meaningfulTutorials = value.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false
    }

    return Boolean(
      normalizeString(item.title) ||
      normalizeString(item.url) ||
      normalizeString(item.note)
    )
  })

  if (meaningfulTutorials.length > MAX_TUTORIAL_COUNT) {
    return failure('VALIDATION_ERROR', '做法参考最多配置 3 条')
  }

  for (const item of meaningfulTutorials) {
    if (item.platform !== undefined && !VALID_TUTORIAL_PLATFORMS.includes(normalizeString(item.platform))) {
      return failure('VALIDATION_ERROR', '做法参考平台类型不合法')
    }

    if (normalizeString(item.title).length > 30) {
      return failure('VALIDATION_ERROR', '做法参考标题不能超过 30 字')
    }

    if (normalizeString(item.url).length > 500) {
      return failure('VALIDATION_ERROR', '做法参考链接或口令不能超过 500 字')
    }

    if (normalizeString(item.note).length > 80) {
      return failure('VALIDATION_ERROR', '做法参考备注不能超过 80 字')
    }

    if (item.enabled !== undefined && typeof item.enabled !== 'boolean') {
      return failure('VALIDATION_ERROR', '做法参考启用状态必须是布尔值')
    }
  }

  return null
}

function validateIngredientList(value) {
  if (!Array.isArray(value)) {
    return failure('VALIDATION_ERROR', '食材配置必须是数组')
  }

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return failure('VALIDATION_ERROR', '食材配置不合法')
    }

    const name = normalizeString(item.name)
    if (!name) {
      continue
    }

    if (name.length > 30) {
      return failure('VALIDATION_ERROR', '食材名称不能超过 30 字')
    }

    if (normalizeString(item.unit).length > 10) {
      return failure('VALIDATION_ERROR', '食材单位不能超过 10 字')
    }

    if (normalizeString(item.category).length > 12) {
      return failure('VALIDATION_ERROR', '食材分类不能超过 12 字')
    }

    if (normalizeString(item.note).length > 80) {
      return failure('VALIDATION_ERROR', '食材备注不能超过 80 字')
    }

    if (item.enabled !== undefined && typeof item.enabled !== 'boolean') {
      return failure('VALIDATION_ERROR', '食材启用状态必须是布尔值')
    }
  }

  return null
}

function isActiveMerchantStaff(staff, merchantId, openid) {
  return Boolean(
    staff &&
      staff.merchant_id === merchantId &&
      staff.openid === openid &&
      staff.status === 'active'
  )
}

function isCategoryUsable(category = {}) {
  if (category.enabled === false) {
    return false
  }

  if (category.status && category.status !== 'active') {
    return false
  }

  return true
}

function formatDish(dish = {}) {
  return {
    _id: dish._id || '',
    dish_id: dish.dish_id || '',
    merchant_id: dish.merchant_id || '',
    category_id: dish.category_id || '',
    name: dish.name || '',
    description: dish.description || '',
    detail_description: dish.detail_description || '',
    image_url: dish.image_url || dish.image || '',
    price_cent: Number.isInteger(dish.price_cent) ? dish.price_cent : 0,
    original_price_cent: Number.isInteger(dish.original_price_cent)
      ? dish.original_price_cent
      : 0,
    tags: normalizeTags(dish.tags),
    status: dish.status || 'off_sale',
    stock_enabled: normalizeBooleanDefault(dish.stock_enabled, false),
    stock_count: normalizeStockCount(dish.stock_count) === null
      ? 0
      : normalizeStockCount(dish.stock_count),
    sold_out: normalizeBooleanDefault(dish.sold_out, false),
    spec_groups: normalizeOptionGroupList(dish.spec_groups),
    addon_groups: normalizeOptionGroupList(dish.addon_groups),
    tutorials: normalizeTutorialList(dish.tutorials),
    ingredients: normalizeIngredientList(dish.ingredients),
    has_options: hasOptions(dish),
    sort_order: Number(dish.sort_order) || 0,
    created_at: dish.created_at || null,
    updated_at: dish.updated_at || null
  }
}

function buildHandlerDependencies(dependencies) {
  return {
    getOpenid: dependencies.getOpenid,
    now: dependencies.now || (() => new Date()),
    createDishId:
      dependencies.createDishId ||
      (() => `dish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    findMerchantStaff: dependencies.findMerchantStaff,
    findDishesByMerchantId: dependencies.findDishesByMerchantId,
    findDishById: dependencies.findDishById,
    findDishesByIds: dependencies.findDishesByIds,
    findCategoryById: dependencies.findCategoryById,
    getNextSortOrder: dependencies.getNextSortOrder,
    createDish: dependencies.createDish,
    updateDish: dependencies.updateDish,
    updateDishSortList: dependencies.updateDishSortList,
    getTokenSecret: dependencies.getTokenSecret,
    logger: dependencies.logger || console
  }
}

function isWebAdminRequest(event = {}) {
  return Boolean(event && Object.prototype.hasOwnProperty.call(event, 'admin_token'))
}

function assertWebAdmin(event, action, deps) {
  const verifyResult = verifyWebAdminToken(event.admin_token, {
    secret: deps.getTokenSecret ? deps.getTokenSecret() : process.env.WEB_ADMIN_TOKEN_SECRET,
    now: deps.now()
  })

  if (!verifyResult.ok) {
    return {
      error: failure(
        verifyResult.code,
        verifyResult.code === 'TOKEN_EXPIRED' ? '登录状态已过期' : '登录状态无效或已过期'
      )
    }
  }

  if (!WEB_ALLOWED_ACTIONS.includes(action)) {
    return {
      error: failure('FORBIDDEN', 'Web 后台当前仅开放餐品列表读取')
    }
  }

  return {
    is_web_admin: true,
    role: verifyResult.role
  }
}

async function assertDishBelongsToMerchant(deps, dishId, merchantId) {
  const dish = await deps.findDishById(dishId)
  if (!dish) {
    return {
      error: failure('NOT_FOUND', '餐品不存在')
    }
  }

  if (dish.merchant_id !== merchantId) {
    return {
      error: failure('FORBIDDEN', '不能管理其他商家的餐品')
    }
  }

  return {
    dish
  }
}

async function assertCategoryBelongsToMerchant(deps, categoryId, merchantId) {
  const category = await deps.findCategoryById(categoryId)
  if (!category) {
    return {
      error: failure('VALIDATION_ERROR', '分类不可用，不能绑定餐品')
    }
  }

  if (category.merchant_id !== merchantId) {
    return {
      error: failure('VALIDATION_ERROR', '分类不可用，不能绑定餐品')
    }
  }

  if (!isCategoryUsable(category)) {
    return {
      error: failure('VALIDATION_ERROR', '分类不可用，不能绑定餐品')
    }
  }

  return {
    category
  }
}

function buildDishCreateData(deps, merchantId, data, now, dishId, sortOrder) {
  const status = normalizeString(data.status) || 'on_sale'
  return {
    dish_id: dishId,
    merchant_id: merchantId,
    category_id: normalizeString(data.category_id),
    name: normalizeString(data.name),
    description: normalizeString(data.description),
    detail_description: normalizeString(data.detail_description),
    image_url: normalizeString(data.image_url || data.image),
    price_cent: normalizePriceCent(data.price_cent),
    original_price_cent:
      data.original_price_cent === undefined ||
      data.original_price_cent === null ||
      data.original_price_cent === ''
        ? 0
        : normalizePriceCent(data.original_price_cent),
    tags: normalizeTags(data.tags),
    status,
    stock_enabled: hasOwn(data, 'stock_enabled') ? data.stock_enabled : false,
    stock_count: hasOwn(data, 'stock_count') ? normalizeStockCount(data.stock_count) : 0,
    sold_out: hasOwn(data, 'sold_out') ? data.sold_out : false,
    spec_groups: hasOwn(data, 'spec_groups') ? data.spec_groups : [],
    addon_groups: hasOwn(data, 'addon_groups') ? data.addon_groups : [],
    tutorials: hasOwn(data, 'tutorials') ? normalizeTutorialList(data.tutorials) : [],
    ingredients: hasOwn(data, 'ingredients') ? normalizeIngredientList(data.ingredients) : [],
    sort_order: sortOrder,
    created_at: now,
    updated_at: now
  }
}

function buildWebDishCreateData(merchantId, data, now, dishId, sortOrder) {
  return {
    dish_id: dishId,
    merchant_id: merchantId,
    category_id: normalizeString(data.category_id),
    name: normalizeString(data.name),
    description: normalizeString(data.description),
    image_url: normalizeString(data.image_url),
    price_cent: normalizePriceCent(data.price_cent),
    original_price_cent: 0,
    tags: [],
    status: 'on_sale',
    stock_enabled: false,
    stock_count: 0,
    sold_out: false,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now
  }
}

function buildWebDishUpdateData(data, now) {
  return {
    category_id: normalizeString(data.category_id),
    name: normalizeString(data.name),
    description: normalizeString(data.description),
    image_url: normalizeString(data.image_url),
    price_cent: normalizePriceCent(data.price_cent),
    updated_at: now
  }
}

function applyDishUpdateData(updateData, data) {
  if (data.category_id !== undefined) {
    updateData.category_id = normalizeString(data.category_id)
  }

  if (data.name !== undefined) {
    updateData.name = normalizeString(data.name)
  }

  if (data.description !== undefined) {
    updateData.description = normalizeString(data.description)
  }

  if (data.detail_description !== undefined) {
    updateData.detail_description = normalizeString(data.detail_description)
  }

  if (data.image_url !== undefined || data.image !== undefined) {
    updateData.image_url = normalizeString(data.image_url || data.image)
  }

  if (data.price_cent !== undefined) {
    updateData.price_cent = normalizePriceCent(data.price_cent)
  }

  if (data.original_price_cent !== undefined) {
    updateData.original_price_cent =
      data.original_price_cent === null || data.original_price_cent === ''
        ? 0
        : normalizePriceCent(data.original_price_cent)
  }

  if (data.tags !== undefined) {
    updateData.tags = normalizeTags(data.tags)
  }

  if (data.status !== undefined) {
    updateData.status = normalizeString(data.status)
  }

  if (hasOwn(data, 'stock_enabled')) {
    updateData.stock_enabled = data.stock_enabled
  }

  if (hasOwn(data, 'stock_count')) {
    updateData.stock_count = normalizeStockCount(data.stock_count)
  }

  if (hasOwn(data, 'sold_out')) {
    updateData.sold_out = data.sold_out
  }

  if (hasOwn(data, 'spec_groups')) {
    updateData.spec_groups = data.spec_groups
  }

  if (hasOwn(data, 'addon_groups')) {
    updateData.addon_groups = data.addon_groups
  }

  if (hasOwn(data, 'tutorials')) {
    updateData.tutorials = normalizeTutorialList(data.tutorials)
  }

  if (hasOwn(data, 'ingredients')) {
    updateData.ingredients = normalizeIngredientList(data.ingredients)
  }

  if (data.sort_order !== undefined) {
    updateData.sort_order = normalizeSortOrder(data.sort_order)
  }
}

function validateDishData(data, options = {}) {
  if (options.requireCategory && !normalizeString(data.category_id)) {
    return failure('VALIDATION_ERROR', '餐品分类不能为空')
  }

  if (hasOwn(data, 'name') && !normalizeString(data.name)) {
    return failure('VALIDATION_ERROR', '餐品名称不能为空')
  }

  if (options.requireName && !normalizeString(data.name)) {
    return failure('VALIDATION_ERROR', '餐品名称不能为空')
  }

  if (hasOwn(data, 'price_cent')) {
    const priceCent = normalizePriceCent(data.price_cent)
    if (priceCent === null) {
      return failure('VALIDATION_ERROR', '餐品价格必须是非负整数分')
    }
  } else if (options.requirePrice) {
    return failure('VALIDATION_ERROR', '餐品价格不能为空')
  }

  if (hasOwn(data, 'original_price_cent')) {
    const originalPriceCent =
      data.original_price_cent === null || data.original_price_cent === ''
        ? 0
        : normalizePriceCent(data.original_price_cent)
    if (originalPriceCent === null) {
      return failure('VALIDATION_ERROR', '餐品原价必须是非负整数分')
    }
  }

  if (hasOwn(data, 'status')) {
    const status = normalizeString(data.status)
    if (status && !VALID_DISH_STATUSES.includes(status)) {
      return failure('VALIDATION_ERROR', '餐品状态不合法')
    }
  }

  if (hasOwn(data, 'stock_enabled') && typeof data.stock_enabled !== 'boolean') {
    return failure('VALIDATION_ERROR', '库存开关必须是布尔值')
  }

  if (hasOwn(data, 'stock_count') && normalizeStockCount(data.stock_count) === null) {
    return failure('VALIDATION_ERROR', '库存数量必须是非负整数')
  }

  if (hasOwn(data, 'sold_out') && typeof data.sold_out !== 'boolean') {
    return failure('VALIDATION_ERROR', '售罄开关必须是布尔值')
  }

  if (hasOwn(data, 'tutorials')) {
    const tutorialError = validateTutorialList(data.tutorials)
    if (tutorialError) {
      return tutorialError
    }
  }

  if (hasOwn(data, 'ingredients')) {
    const ingredientError = validateIngredientList(data.ingredients)
    if (ingredientError) {
      return ingredientError
    }
  }

  if (hasOwn(data, 'spec_groups') || hasOwn(data, 'addon_groups')) {
    const optionGroupsError = validateOptionGroups(
      hasOwn(data, 'spec_groups') ? data.spec_groups : [],
      hasOwn(data, 'addon_groups') ? data.addon_groups : []
    )
    if (optionGroupsError) {
      return optionGroupsError
    }
  }

  if (hasOwn(data, 'sort_order')) {
    const sortOrder = normalizeSortOrder(data.sort_order)
    if (sortOrder === null) {
      return failure('VALIDATION_ERROR', '餐品排序必须是非负整数')
    }
  }

  return null
}

async function handleList(deps, merchantId, data) {
  let dishes
  try {
    dishes = await deps.findDishesByMerchantId(merchantId)
  } catch (error) {
    deps.logger.error('manageDish list database error', error)
    return failure('DATABASE_ERROR', '查询餐品失败，请稍后重试')
  }

  const categoryId = normalizeString(data.category_id)
  const status = normalizeString(data.status)

  if (status && !VALID_DISH_STATUSES.includes(status)) {
    return failure('VALIDATION_ERROR', '餐品状态不合法')
  }

  const list = (dishes || [])
    .filter((dish) => dish.merchant_id === merchantId)
    .filter((dish) => !categoryId || dish.category_id === categoryId)
    .filter((dish) => !status || dish.status === status)
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map(formatDish)

  return success('获取餐品列表成功', {
    list,
    total: list.length
  })
}

async function handleCreate(deps, merchantId, data) {
  const validationError = validateDishData(data, {
    requireCategory: true,
    requireName: true,
    requirePrice: true
  })
  if (validationError) {
    return validationError
  }

  let categoryResult
  try {
    categoryResult = await assertCategoryBelongsToMerchant(
      deps,
      normalizeString(data.category_id),
      merchantId
    )
  } catch (error) {
    deps.logger.error('manageDish create category query error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  if (categoryResult.error) {
    return categoryResult.error
  }

  let sortOrder
  if (data.sort_order === undefined || data.sort_order === null || data.sort_order === '') {
    try {
      sortOrder = await deps.getNextSortOrder(merchantId)
    } catch (error) {
      deps.logger.error('manageDish get next sort order error', error)
      return failure('DATABASE_ERROR', '生成餐品排序失败，请稍后重试')
    }
  } else {
    sortOrder = normalizeSortOrder(data.sort_order)
  }

  if (sortOrder === null) {
    return failure('VALIDATION_ERROR', '餐品排序必须是非负整数')
  }

  const now = deps.now()
  const dish = buildDishCreateData(
    deps,
    merchantId,
    data,
    now,
    deps.createDishId(),
    sortOrder
  )

  try {
    const createdDish = await deps.createDish(dish)
    return success('新增餐品成功', {
      dish: formatDish(createdDish || dish)
    })
  } catch (error) {
    deps.logger.error('manageDish create database error', error)
    return failure('DATABASE_ERROR', '新增餐品失败，请稍后重试')
  }
}

async function handleWebCreate(deps, merchantId, data) {
  const validationError = validateDishData(data, {
    requireCategory: true,
    requireName: true,
    requirePrice: true
  })
  if (validationError) {
    return validationError
  }

  let categoryResult
  try {
    categoryResult = await assertCategoryBelongsToMerchant(
      deps,
      normalizeString(data.category_id),
      merchantId
    )
  } catch (error) {
    deps.logger.error('manageDish web create category query error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  if (categoryResult.error) {
    return categoryResult.error
  }

  let sortOrder
  try {
    sortOrder = await deps.getNextSortOrder(merchantId)
  } catch (error) {
    deps.logger.error('manageDish web get next sort order error', error)
    return failure('DATABASE_ERROR', '生成餐品排序失败，请稍后重试')
  }

  const now = deps.now()
  const dish = buildWebDishCreateData(
    merchantId,
    data,
    now,
    deps.createDishId(),
    sortOrder
  )

  try {
    const createdDish = await deps.createDish(dish)
    return success('新增餐品成功', {
      dish: formatDish(createdDish || dish)
    })
  } catch (error) {
    deps.logger.error('manageDish web create database error', error)
    return failure('DATABASE_ERROR', '新增餐品失败，请稍后重试')
  }
}

async function handleWebUpdate(deps, merchantId, dishId, data) {
  if (!dishId) {
    return failure('INVALID_PARAMS', '餐品 ID 不能为空')
  }

  const validationError = validateDishData(data, {
    requireCategory: true,
    requireName: true,
    requirePrice: true
  })
  if (validationError) {
    return validationError
  }

  let dishResult
  try {
    dishResult = await assertDishBelongsToMerchant(deps, dishId, merchantId)
  } catch (error) {
    deps.logger.error('manageDish web update query database error', error)
    return failure('DATABASE_ERROR', '查询餐品失败，请稍后重试')
  }

  if (dishResult.error) {
    return dishResult.error
  }

  let categoryResult
  try {
    categoryResult = await assertCategoryBelongsToMerchant(
      deps,
      normalizeString(data.category_id),
      merchantId
    )
  } catch (error) {
    deps.logger.error('manageDish web update category query error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  if (categoryResult.error) {
    return categoryResult.error
  }

  const updateData = buildWebDishUpdateData(data, deps.now())

  try {
    const updatedDish = await deps.updateDish({
      dish_id: dishResult.dish.dish_id || dishId,
      updateData
    })
    return success('编辑餐品成功', {
      dish: formatDish({
        ...dishResult.dish,
        ...(updatedDish || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageDish web update database error', error)
    return failure('DATABASE_ERROR', '编辑餐品失败，请稍后重试')
  }
}

async function handleWebStatusUpdate(deps, merchantId, dishId, data) {
  if (!dishId) {
    return failure('INVALID_PARAMS', '餐品 ID 不能为空')
  }

  const status = normalizeString(data.status)
  if (!status) {
    return failure('VALIDATION_ERROR', '餐品状态不能为空')
  }

  if (!VALID_DISH_STATUSES.includes(status)) {
    return failure('VALIDATION_ERROR', '餐品状态不合法')
  }

  return handleStatusUpdate(deps, merchantId, dishId, status)
}

async function handleUpdate(deps, merchantId, dishId, data) {
  if (!dishId) {
    return failure('INVALID_PARAMS', '餐品 ID 不能为空')
  }

  const validationError = validateDishData(data)
  if (validationError) {
    return validationError
  }

  let dishResult
  try {
    dishResult = await assertDishBelongsToMerchant(deps, dishId, merchantId)
  } catch (error) {
    deps.logger.error('manageDish update query database error', error)
    return failure('DATABASE_ERROR', '查询餐品失败，请稍后重试')
  }

  if (dishResult.error) {
    return dishResult.error
  }

  if (hasOwn(data, 'spec_groups') || hasOwn(data, 'addon_groups')) {
    const optionGroupsError = validateOptionGroups(
      hasOwn(data, 'spec_groups')
        ? data.spec_groups
        : normalizeOptionGroupList(dishResult.dish.spec_groups),
      hasOwn(data, 'addon_groups')
        ? data.addon_groups
        : normalizeOptionGroupList(dishResult.dish.addon_groups)
    )
    if (optionGroupsError) {
      return optionGroupsError
    }
  }

  if (data.category_id !== undefined) {
    let categoryResult
    try {
      categoryResult = await assertCategoryBelongsToMerchant(
        deps,
        normalizeString(data.category_id),
        merchantId
      )
    } catch (error) {
      deps.logger.error('manageDish update category query error', error)
      return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
    }

    if (categoryResult.error) {
      return categoryResult.error
    }
  }

  const updateData = {}
  applyDishUpdateData(updateData, data)
  updateData.updated_at = deps.now()

  try {
    const updatedDish = await deps.updateDish({
      dish_id: dishResult.dish.dish_id || dishId,
      updateData
    })
    return success('编辑餐品成功', {
      dish: formatDish({
        ...dishResult.dish,
        ...(updatedDish || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageDish update database error', error)
    return failure('DATABASE_ERROR', '编辑餐品失败，请稍后重试')
  }
}

async function handleStatusUpdate(deps, merchantId, dishId, status) {
  if (!dishId) {
    return failure('INVALID_PARAMS', '餐品 ID 不能为空')
  }

  let dishResult
  try {
    dishResult = await assertDishBelongsToMerchant(deps, dishId, merchantId)
  } catch (error) {
    deps.logger.error('manageDish status query database error', error)
    return failure('DATABASE_ERROR', '查询餐品失败，请稍后重试')
  }

  if (dishResult.error) {
    return dishResult.error
  }

  const updateData = {
    status,
    updated_at: deps.now()
  }

  try {
    const updatedDish = await deps.updateDish({
      dish_id: dishResult.dish.dish_id || dishId,
      updateData
    })
    return success(status === 'on_sale' ? '餐品已上架' : '餐品已下架', {
      dish: formatDish({
        ...dishResult.dish,
        ...(updatedDish || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageDish status database error', error)
    return failure('DATABASE_ERROR', '更新餐品状态失败，请稍后重试')
  }
}

async function handleSort(deps, merchantId, data) {
  const sortItems = Array.isArray(data.dishes)
    ? data.dishes
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.sort_list)
        ? data.sort_list
        : []

  if (!sortItems.length) {
    return failure('INVALID_PARAMS', '餐品排序列表不能为空')
  }

  const normalizedItems = []
  for (const item of sortItems) {
    const dishId = normalizeString(item && item.dish_id)
    const sortOrder = normalizeSortOrder(item && item.sort_order)
    if (!dishId || sortOrder === null) {
      return failure('VALIDATION_ERROR', '餐品排序数据不合法')
    }
    normalizedItems.push({
      dish_id: dishId,
      sort_order: sortOrder
    })
  }

  const dishIds = normalizedItems.map((item) => item.dish_id)
  let dishes
  try {
    dishes = await deps.findDishesByIds(dishIds)
  } catch (error) {
    deps.logger.error('manageDish sort query database error', error)
    return failure('DATABASE_ERROR', '查询餐品失败，请稍后重试')
  }

  if ((dishes || []).length !== dishIds.length) {
    return failure('NOT_FOUND', '存在找不到的餐品')
  }

  const hasOtherMerchantDish = dishes.some((dish) => dish.merchant_id !== merchantId)
  if (hasOtherMerchantDish) {
    return failure('FORBIDDEN', '不能管理其他商家的餐品')
  }

  const now = deps.now()
  const updateItems = normalizedItems.map((item) => ({
    ...item,
    updated_at: now
  }))

  try {
    await deps.updateDishSortList(updateItems)
    const sortMap = updateItems.reduce((map, item) => {
      map[item.dish_id] = item
      return map
    }, {})

    const list = dishes
      .map((dish) => formatDish({
        ...dish,
        ...(sortMap[dish.dish_id] || {})
      }))
      .sort((a, b) => a.sort_order - b.sort_order)

    return success('更新餐品排序成功', {
      list,
      updated_count: updateItems.length
    })
  } catch (error) {
    deps.logger.error('manageDish sort database error', error)
    return failure('DATABASE_ERROR', '更新餐品排序失败，请稍后重试')
  }
}

function createManageDishHandler(dependencies) {
  const deps = buildHandlerDependencies(dependencies)

  return async function manageDish(event = {}) {
    try {
      const normalizedEvent = normalizeEventPayload(event)
      const openid = deps.getOpenid ? deps.getOpenid() : ''
      const merchantId = normalizeString(normalizedEvent.merchant_id)
      const action = normalizeString(normalizedEvent.action)
      const dishId = normalizeString(normalizedEvent.dish_id)
      const data = normalizeEventData(normalizedEvent)

      if (!merchantId || !action) {
        return failure('INVALID_PARAMS', '商家 ID 和操作类型不能为空')
      }

      if (!VALID_ACTIONS.includes(action)) {
        return failure('INVALID_PARAMS', '餐品操作类型不合法')
      }

      if (isWebAdminRequest(normalizedEvent)) {
        const webAdminResult = assertWebAdmin(normalizedEvent, action, deps)
        if (webAdminResult.error) {
          return webAdminResult.error
        }

        if (action === 'listDishes') {
          return handleList(deps, merchantId, data)
        }

        if (action === 'createDish') {
          return handleWebCreate(deps, merchantId, normalizeWebDishCreateData(normalizedEvent))
        }

        if (action === 'updateDish') {
          return handleWebUpdate(
            deps,
            merchantId,
            dishId,
            normalizeWebDishUpdateData(normalizedEvent)
          )
        }

        if (action === 'updateDishStatus') {
          return handleWebStatusUpdate(
            deps,
            merchantId,
            dishId,
            normalizeWebDishStatusData(normalizedEvent)
          )
        }

        return failure('FORBIDDEN', 'Web 后台当前仅开放餐品列表读取、新增餐品、编辑餐品基础信息和上下架')
      }

      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      let staff
      try {
        staff = await deps.findMerchantStaff({
          merchant_id: merchantId,
          openid
        })
      } catch (error) {
        deps.logger.error('manageDish merchant staff database error', error)
        return failure('DATABASE_ERROR', '校验商家权限失败，请稍后重试')
      }

      if (!isActiveMerchantStaff(staff, merchantId, openid)) {
        return failure('FORBIDDEN', '没有餐品管理权限')
      }

      if (action === 'list' || action === 'listDishes') {
        return handleList(deps, merchantId, data)
      }

      if (action === 'create') {
        return handleCreate(deps, merchantId, data)
      }

      if (action === 'update') {
        return handleUpdate(deps, merchantId, dishId, data)
      }

      if (action === 'onSale') {
        return handleStatusUpdate(deps, merchantId, dishId, 'on_sale')
      }

      if (action === 'offSale') {
        return handleStatusUpdate(deps, merchantId, dishId, 'off_sale')
      }

      if (action === 'sort') {
        return handleSort(deps, merchantId, data)
      }

      return failure('INVALID_PARAMS', '餐品操作类型不合法')
    } catch (error) {
      deps.logger.error('manageDish server error', error)
      return failure('SERVER_ERROR', '餐品管理操作失败，请稍后重试')
    }
  }
}

module.exports = {
  createManageDishHandler,
  success,
  failure,
  formatDish
}
