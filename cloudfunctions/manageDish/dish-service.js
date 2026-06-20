const VALID_ACTIONS = ['list', 'create', 'update', 'onSale', 'offSale', 'sort']
const VALID_DISH_STATUSES = ['on_sale', 'off_sale', 'sold_out']

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
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null
  }
  return numberValue
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
    logger: dependencies.logger || console
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
    sort_order: sortOrder,
    created_at: now,
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

  if (data.sort_order !== undefined) {
    updateData.sort_order = normalizeSortOrder(data.sort_order)
  }
}

function validateDishData(data, options = {}) {
  if (options.requireCategory && !normalizeString(data.category_id)) {
    return failure('VALIDATION_ERROR', '餐品分类不能为空')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'name') && !normalizeString(data.name)) {
    return failure('VALIDATION_ERROR', '餐品名称不能为空')
  }

  if (options.requireName && !normalizeString(data.name)) {
    return failure('VALIDATION_ERROR', '餐品名称不能为空')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'price_cent')) {
    const priceCent = normalizePriceCent(data.price_cent)
    if (priceCent === null) {
      return failure('VALIDATION_ERROR', '餐品价格必须是非负整数分')
    }
  } else if (options.requirePrice) {
    return failure('VALIDATION_ERROR', '餐品价格不能为空')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'original_price_cent')) {
    const originalPriceCent =
      data.original_price_cent === null || data.original_price_cent === ''
        ? 0
        : normalizePriceCent(data.original_price_cent)
    if (originalPriceCent === null) {
      return failure('VALIDATION_ERROR', '餐品原价必须是非负整数分')
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const status = normalizeString(data.status)
    if (status && !VALID_DISH_STATUSES.includes(status)) {
      return failure('VALIDATION_ERROR', '餐品状态不合法')
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'sort_order')) {
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
    list
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
      dish_id: dishId,
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
      dish_id: dishId,
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
      const openid = deps.getOpenid ? deps.getOpenid() : ''
      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const merchantId = normalizeString(event.merchant_id)
      const action = normalizeString(event.action)
      const dishId = normalizeString(event.dish_id)
      const data = normalizeData(event.data)

      if (!merchantId || !action) {
        return failure('INVALID_PARAMS', '商家 ID 和操作类型不能为空')
      }

      if (!VALID_ACTIONS.includes(action)) {
        return failure('INVALID_PARAMS', '餐品操作类型不合法')
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

      if (action === 'list') {
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
