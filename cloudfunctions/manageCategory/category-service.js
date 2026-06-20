const VALID_ACTIONS = ['list', 'create', 'update', 'disable', 'sort']
const VALID_CATEGORY_STATUSES = ['active', 'inactive', 'deleted']

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

function normalizeSortOrder(value) {
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

function getCategoryStatus(category = {}) {
  if (category.status) {
    return category.status
  }
  return category.enabled === false ? 'inactive' : 'active'
}

function formatCategory(category = {}) {
  const status = getCategoryStatus(category)
  return {
    _id: category._id || '',
    category_id: category.category_id || '',
    merchant_id: category.merchant_id || '',
    name: category.name || '',
    sort_order: Number(category.sort_order) || 0,
    status,
    enabled: status === 'active',
    created_at: category.created_at || null,
    updated_at: category.updated_at || null
  }
}

function shouldListCategory(category = {}) {
  return getCategoryStatus(category) !== 'deleted'
}

function buildStatusUpdate(status) {
  return {
    status,
    enabled: status === 'active'
  }
}

function buildHandlerDependencies(dependencies) {
  return {
    getOpenid: dependencies.getOpenid,
    now: dependencies.now || (() => new Date()),
    createCategoryId:
      dependencies.createCategoryId ||
      (() => `category_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    findMerchantStaff: dependencies.findMerchantStaff,
    findCategoriesByMerchantId: dependencies.findCategoriesByMerchantId,
    findCategoryById: dependencies.findCategoryById,
    findCategoriesByIds: dependencies.findCategoriesByIds,
    getNextSortOrder: dependencies.getNextSortOrder,
    createCategory: dependencies.createCategory,
    updateCategory: dependencies.updateCategory,
    updateCategorySortList: dependencies.updateCategorySortList,
    logger: dependencies.logger || console
  }
}

async function assertCategoryBelongsToMerchant(deps, categoryId, merchantId) {
  const category = await deps.findCategoryById(categoryId)
  if (!category) {
    return {
      error: failure('NOT_FOUND', '分类不存在')
    }
  }

  if (category.merchant_id !== merchantId) {
    return {
      error: failure('FORBIDDEN', '不能管理其他商家的分类')
    }
  }

  return {
    category
  }
}

async function handleList(deps, merchantId) {
  let categories
  try {
    categories = await deps.findCategoriesByMerchantId(merchantId)
  } catch (error) {
    deps.logger.error('manageCategory list database error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  const list = (categories || [])
    .filter((category) => category.merchant_id === merchantId)
    .filter(shouldListCategory)
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map(formatCategory)

  return success('获取分类列表成功', {
    list
  })
}

async function handleCreate(deps, merchantId, data) {
  const name = normalizeString(data.name)
  if (!name) {
    return failure('VALIDATION_ERROR', '分类名称不能为空')
  }

  let sortOrder
  if (data.sort_order === undefined || data.sort_order === null || data.sort_order === '') {
    try {
      sortOrder = await deps.getNextSortOrder(merchantId)
    } catch (error) {
      deps.logger.error('manageCategory get next sort order error', error)
      return failure('DATABASE_ERROR', '生成分类排序失败，请稍后重试')
    }
  } else {
    sortOrder = normalizeSortOrder(data.sort_order)
    if (sortOrder === null) {
      return failure('VALIDATION_ERROR', '分类排序必须是非负整数')
    }
  }

  const now = deps.now()
  const category = {
    category_id: deps.createCategoryId(),
    merchant_id: merchantId,
    name,
    sort_order: sortOrder,
    status: 'active',
    enabled: true,
    created_at: now,
    updated_at: now
  }

  try {
    const createdCategory = await deps.createCategory(category)
    return success('新增分类成功', {
      category: formatCategory(createdCategory || category)
    })
  } catch (error) {
    deps.logger.error('manageCategory create database error', error)
    return failure('DATABASE_ERROR', '新增分类失败，请稍后重试')
  }
}

async function handleUpdate(deps, merchantId, categoryId, data) {
  if (!categoryId) {
    return failure('INVALID_PARAMS', '分类 ID 不能为空')
  }

  let categoryResult
  try {
    categoryResult = await assertCategoryBelongsToMerchant(deps, categoryId, merchantId)
  } catch (error) {
    deps.logger.error('manageCategory update query database error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  if (categoryResult.error) {
    return categoryResult.error
  }

  const updateData = {}
  if (data.name !== undefined) {
    const name = normalizeString(data.name)
    if (!name) {
      return failure('VALIDATION_ERROR', '分类名称不能为空')
    }
    updateData.name = name
  }

  if (data.sort_order !== undefined) {
    const sortOrder = normalizeSortOrder(data.sort_order)
    if (sortOrder === null) {
      return failure('VALIDATION_ERROR', '分类排序必须是非负整数')
    }
    updateData.sort_order = sortOrder
  }

  if (data.status !== undefined) {
    const status = normalizeString(data.status)
    if (!VALID_CATEGORY_STATUSES.includes(status)) {
      return failure('VALIDATION_ERROR', '分类状态不合法')
    }
    Object.assign(updateData, buildStatusUpdate(status))
  }

  updateData.updated_at = deps.now()

  try {
    const updatedCategory = await deps.updateCategory({
      category_id: categoryId,
      updateData
    })
    return success('编辑分类成功', {
      category: formatCategory({
        ...categoryResult.category,
        ...(updatedCategory || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageCategory update database error', error)
    return failure('DATABASE_ERROR', '编辑分类失败，请稍后重试')
  }
}

async function handleDisable(deps, merchantId, categoryId) {
  if (!categoryId) {
    return failure('INVALID_PARAMS', '分类 ID 不能为空')
  }

  let categoryResult
  try {
    categoryResult = await assertCategoryBelongsToMerchant(deps, categoryId, merchantId)
  } catch (error) {
    deps.logger.error('manageCategory disable query database error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  if (categoryResult.error) {
    return categoryResult.error
  }

  const updateData = {
    status: 'inactive',
    enabled: false,
    updated_at: deps.now()
  }

  try {
    const updatedCategory = await deps.updateCategory({
      category_id: categoryId,
      updateData
    })
    return success('停用分类成功', {
      category: formatCategory({
        ...categoryResult.category,
        ...(updatedCategory || updateData)
      })
    })
  } catch (error) {
    deps.logger.error('manageCategory disable database error', error)
    return failure('DATABASE_ERROR', '停用分类失败，请稍后重试')
  }
}

async function handleSort(deps, merchantId, data) {
  const sortItems = Array.isArray(data.categories)
    ? data.categories
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.sort_list)
        ? data.sort_list
        : []

  if (!sortItems.length) {
    return failure('INVALID_PARAMS', '分类排序列表不能为空')
  }

  const normalizedItems = []
  for (const item of sortItems) {
    const categoryId = normalizeString(item && item.category_id)
    const sortOrder = normalizeSortOrder(item && item.sort_order)
    if (!categoryId || sortOrder === null) {
      return failure('VALIDATION_ERROR', '分类排序数据不合法')
    }
    normalizedItems.push({
      category_id: categoryId,
      sort_order: sortOrder
    })
  }

  const categoryIds = normalizedItems.map((item) => item.category_id)
  let categories
  try {
    categories = await deps.findCategoriesByIds(categoryIds)
  } catch (error) {
    deps.logger.error('manageCategory sort query database error', error)
    return failure('DATABASE_ERROR', '查询分类失败，请稍后重试')
  }

  if ((categories || []).length !== categoryIds.length) {
    return failure('NOT_FOUND', '存在找不到的分类')
  }

  const hasOtherMerchantCategory = categories.some((category) => category.merchant_id !== merchantId)
  if (hasOtherMerchantCategory) {
    return failure('FORBIDDEN', '不能管理其他商家的分类')
  }

  const now = deps.now()
  const updateItems = normalizedItems.map((item) => ({
    ...item,
    updated_at: now
  }))

  try {
    await deps.updateCategorySortList(updateItems)
    const sortMap = updateItems.reduce((map, item) => {
      map[item.category_id] = item
      return map
    }, {})

    const list = categories
      .map((category) => formatCategory({
        ...category,
        ...(sortMap[category.category_id] || {})
      }))
      .sort((a, b) => a.sort_order - b.sort_order)

    return success('更新分类排序成功', {
      list,
      updated_count: updateItems.length
    })
  } catch (error) {
    deps.logger.error('manageCategory sort database error', error)
    return failure('DATABASE_ERROR', '更新分类排序失败，请稍后重试')
  }
}

function createManageCategoryHandler(dependencies) {
  const deps = buildHandlerDependencies(dependencies)

  return async function manageCategory(event = {}) {
    try {
      const openid = deps.getOpenid ? deps.getOpenid() : ''
      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const merchantId = normalizeString(event.merchant_id)
      const action = normalizeString(event.action)
      const categoryId = normalizeString(event.category_id)
      const data = normalizeData(event.data)

      if (!merchantId || !action) {
        return failure('INVALID_PARAMS', '商家 ID 和操作类型不能为空')
      }

      if (!VALID_ACTIONS.includes(action)) {
        return failure('INVALID_PARAMS', '分类操作类型不合法')
      }

      let staff
      try {
        staff = await deps.findMerchantStaff({
          merchant_id: merchantId,
          openid
        })
      } catch (error) {
        deps.logger.error('manageCategory merchant staff database error', error)
        return failure('DATABASE_ERROR', '校验商家权限失败，请稍后重试')
      }

      if (!isActiveMerchantStaff(staff, merchantId, openid)) {
        return failure('FORBIDDEN', '没有分类管理权限')
      }

      if (action === 'list') {
        return handleList(deps, merchantId)
      }

      if (action === 'create') {
        return handleCreate(deps, merchantId, data)
      }

      if (action === 'update') {
        return handleUpdate(deps, merchantId, categoryId, data)
      }

      if (action === 'disable') {
        return handleDisable(deps, merchantId, categoryId)
      }

      if (action === 'sort') {
        return handleSort(deps, merchantId, data)
      }

      return failure('INVALID_PARAMS', '分类操作类型不合法')
    } catch (error) {
      deps.logger.error('manageCategory server error', error)
      return failure('SERVER_ERROR', '分类管理操作失败，请稍后重试')
    }
  }
}

module.exports = {
  createManageCategoryHandler,
  success,
  failure,
  formatCategory
}
