const DEFAULT_PICKUP_TYPE = 'self_pickup'
const ORDER_STATUS_PENDING = 'pending'
const PAYMENT_STATUS_UNPAID = 'unpaid'
const PAYMENT_METHOD_OFFLINE = 'offline'

function success(message, data) {
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

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeQuantity(value) {
  const quantity = Number(value)

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return 0
  }

  return quantity
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function isActiveMerchant(merchant) {
  if (!merchant) {
    return false
  }

  if (merchant.status && merchant.status !== 'active') {
    return false
  }

  if (merchant.business_status && merchant.business_status !== 'open') {
    return false
  }

  return true
}

function getDishId(dish = {}) {
  return dish.dish_id || dish._id || ''
}

function getDishImage(dish = {}) {
  return dish.image_url || dish.image || dish.dish_image_url || dish.dish_image || ''
}

function isSafeAmount(value) {
  return Number.isInteger(value) && value >= 0
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function getStockInfo(dish = {}) {
  return {
    stock_enabled: typeof dish.stock_enabled === 'boolean' ? dish.stock_enabled : false,
    stock_count: Number.isInteger(dish.stock_count) && dish.stock_count >= 0
      ? dish.stock_count
      : 0,
    sold_out: typeof dish.sold_out === 'boolean' ? dish.sold_out : false
  }
}

function normalizeSelectedSpecs(value) {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  return value.map((item) => {
    const groupId = normalizeText(item && item.group_id)
    const optionId = normalizeText(item && item.option_id)

    if (!groupId || !optionId) {
      return null
    }

    return {
      group_id: groupId,
      option_id: optionId
    }
  })
}

function normalizeSelectedAddons(value) {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  return value.map((item) => {
    const groupId = normalizeText(item && item.group_id)

    if (!groupId || !Array.isArray(item && item.option_ids)) {
      return null
    }

    const optionIds = item.option_ids.map(normalizeText)

    if (optionIds.some((optionId) => !optionId)) {
      return null
    }

    return {
      group_id: groupId,
      option_ids: optionIds
    }
  })
}

function sortSelectedSpecs(specs) {
  return [...specs].sort((left, right) =>
    left.group_id.localeCompare(right.group_id) ||
    left.option_id.localeCompare(right.option_id)
  )
}

function sortSelectedAddons(addons) {
  return [...addons]
    .map((addon) => ({
      group_id: addon.group_id,
      option_ids: [...addon.option_ids].sort()
    }))
    .sort((left, right) => left.group_id.localeCompare(right.group_id))
}

function createItemKey(dishId, selectedSpecs, selectedAddons) {
  return JSON.stringify({
    dish_id: dishId,
    selected_specs: sortSelectedSpecs(selectedSpecs),
    selected_addons: sortSelectedAddons(selectedAddons)
  })
}

function createOrderNo(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  const pad = (value, length = 2) => String(value).padStart(length, '0')
  const random = pad(Math.floor(Math.random() * 1000), 3)

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    random
  ].join('')
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  const itemMap = {}

  for (const item of items) {
    const dishId = normalizeText(item && item.dish_id)
    const quantity = normalizeQuantity(item && item.quantity)
    const selectedSpecs = normalizeSelectedSpecs(item && item.selected_specs)
    const selectedAddons = normalizeSelectedAddons(item && item.selected_addons)

    if (!dishId || !quantity || !selectedSpecs || !selectedAddons) {
      return null
    }

    const itemKey = createItemKey(dishId, selectedSpecs, selectedAddons)

    if (!itemMap[itemKey]) {
      itemMap[itemKey] = {
        dish_id: dishId,
        quantity: 0,
        selected_specs: sortSelectedSpecs(selectedSpecs),
        selected_addons: sortSelectedAddons(selectedAddons)
      }
    }

    itemMap[itemKey].quantity += quantity
  }

  return Object.values(itemMap)
}

function createDishMap(dishes) {
  return (Array.isArray(dishes) ? dishes : []).reduce((result, dish) => {
    const dishId = getDishId(dish)

    if (dishId) {
      result[dishId] = dish
    }

    if (dish._id) {
      result[dish._id] = dish
    }

    return result
  }, {})
}

function createMapById(list, idKey) {
  return asList(list).reduce((result, item) => {
    const id = normalizeText(item && item[idKey])
    if (id) {
      result[id] = item
    }
    return result
  }, {})
}

function getOptionPrice(option = {}) {
  return Number.isInteger(option.price_delta_cent) && option.price_delta_cent >= 0
    ? option.price_delta_cent
    : 0
}

function createSelectionResult() {
  return {
    ok: true,
    spec_delta_cent: 0,
    addon_delta_cent: 0,
    selected_specs: [],
    selected_addons: []
  }
}

function failValidation(message) {
  return {
    ok: false,
    code: 'VALIDATION_ERROR',
    message
  }
}

function validateSpecs(dish, selectedSpecs, result) {
  const specGroups = asList(dish.spec_groups)
  const groupMap = createMapById(specGroups, 'group_id')
  const selectedMap = {}

  for (const selected of selectedSpecs) {
    if (selectedMap[selected.group_id]) {
      return failValidation('瑙勬牸閫夋嫨鏃犳晥')
    }

    selectedMap[selected.group_id] = selected.option_id
  }

  for (const group of specGroups) {
    const groupId = normalizeText(group.group_id)

    if (group.required === true && !selectedMap[groupId]) {
      return failValidation('璇烽€夋嫨蹇呴€夎鏍?')
    }
  }

  for (const selected of selectedSpecs) {
    const group = groupMap[selected.group_id]

    if (!group) {
      return failValidation('瑙勬牸閫夋嫨鏃犳晥')
    }

    const optionMap = createMapById(group.options, 'option_id')
    const option = optionMap[selected.option_id]

    if (!option || option.enabled !== true) {
      return failValidation('瑙勬牸閫夋嫨鏃犳晥')
    }

    const priceDeltaCent = getOptionPrice(option)
    result.spec_delta_cent += priceDeltaCent
    result.selected_specs.push({
      group_id: group.group_id || '',
      group_name: group.name || '',
      option_id: option.option_id || '',
      option_name: option.name || '',
      price_delta_cent: priceDeltaCent
    })
  }

  return result
}

function validateAddons(dish, selectedAddons, result) {
  const addonGroups = asList(dish.addon_groups)
  const groupMap = createMapById(addonGroups, 'group_id')
  const selectedMap = {}

  for (const selected of selectedAddons) {
    if (selectedMap[selected.group_id]) {
      return failValidation('鍔犳枡閫夋嫨鏃犳晥')
    }

    const uniqueOptionIds = new Set(selected.option_ids)
    if (uniqueOptionIds.size !== selected.option_ids.length) {
      return failValidation('鍔犳枡閫夋嫨鏃犳晥')
    }

    selectedMap[selected.group_id] = selected.option_ids
  }

  for (const group of addonGroups) {
    const groupId = normalizeText(group.group_id)
    const optionIds = selectedMap[groupId] || []
    const minSelect = isNonNegativeInteger(group.min_select) ? group.min_select : 0
    const maxSelect = isNonNegativeInteger(group.max_select) ? group.max_select : 0

    if (optionIds.length < minSelect || optionIds.length > maxSelect) {
      return failValidation('鍔犳枡閫夋嫨鏁伴噺鏃犳晥')
    }
  }

  for (const selected of selectedAddons) {
    const group = groupMap[selected.group_id]

    if (!group) {
      return failValidation('鍔犳枡閫夋嫨鏃犳晥')
    }

    const optionMap = createMapById(group.options, 'option_id')
    const selectedOptions = []

    for (const optionId of selected.option_ids) {
      const option = optionMap[optionId]

      if (!option || option.enabled !== true) {
        return failValidation('鍔犳枡閫夋嫨鏃犳晥')
      }

      selectedOptions.push(option)
    }

    const sortedOptions = selectedOptions.sort((left, right) =>
      normalizeText(left.option_id).localeCompare(normalizeText(right.option_id))
    )

    const snapshot = {
      group_id: group.group_id || '',
      group_name: group.name || '',
      options: []
    }

    for (const option of sortedOptions) {
      const priceDeltaCent = getOptionPrice(option)
      result.addon_delta_cent += priceDeltaCent
      snapshot.options.push({
        option_id: option.option_id || '',
        option_name: option.name || '',
        price_delta_cent: priceDeltaCent
      })
    }

    result.selected_addons.push(snapshot)
  }

  return result
}

function calculateSelectedOptions(dish, item) {
  const result = createSelectionResult()
  const specResult = validateSpecs(dish, item.selected_specs, result)

  if (!specResult.ok) {
    return specResult
  }

  return validateAddons(dish, item.selected_addons, specResult)
}

function createCreateOrderHandler(dependencies) {
  return async function createOrder(event = {}) {
    try {
      const openid = dependencies.getOpenid()

      if (!openid) {
        return failure('UNAUTHORIZED', '无法获取用户身份')
      }

      const merchantId = normalizeText(event.merchant_id)
      const items = normalizeItems(event.items)

      if (!merchantId) {
        return failure('INVALID_PARAMS', '商家 ID 不能为空')
      }

      if (!items) {
        return failure('INVALID_PARAMS', '订单餐品不能为空，且数量必须为正整数')
      }

      const merchant = await dependencies.findMerchantById(merchantId)

      if (!isActiveMerchant(merchant)) {
        return failure('NOT_FOUND', '商家不存在或未启用')
      }

      const dishIds = items.map((item) => item.dish_id)
      const dishes = await dependencies.findDishesByIds(dishIds, merchantId)
      const dishMap = createDishMap(dishes)
      const now = dependencies.now()
      const orderId = dependencies.generateId('order')
      const orderNo = dependencies.generateOrderNo(now)
      const orderItems = []
      const stockUpdates = []
      const dishQuantityMap = items.reduce((result, item) => {
        result[item.dish_id] = (result[item.dish_id] || 0) + item.quantity
        return result
      }, {})
      let totalAmountCent = 0
      let itemCount = 0

      for (const item of items) {
        const dish = dishMap[item.dish_id]
        const totalDishQuantity = dishQuantityMap[item.dish_id]

        if (!dish) {
          return failure('NOT_FOUND', '餐品不存在')
        }

        if (dish.merchant_id !== merchantId) {
          return failure('NOT_FOUND', '餐品不存在')
        }

        const standardDishId = getDishId(dish)

        if (dish.status !== 'on_sale') {
          return failure('DISH_OFF_SALE', '餐品当前不可下单')
        }

        const stockInfo = getStockInfo(dish)

        if (stockInfo.sold_out) {
          return failure('DISH_SOLD_OUT', '餐品已售罄')
        }

        if (stockInfo.stock_enabled && stockInfo.stock_count < totalDishQuantity) {
          return failure('STOCK_NOT_ENOUGH', '餐品库存不足')
        }

        const selectedOptions = calculateSelectedOptions(dish, item)

        if (!selectedOptions.ok) {
          return failure(selectedOptions.code, selectedOptions.message)
        }

        const basePriceCent = Number(dish.price_cent)
        const specDeltaCent = selectedOptions.spec_delta_cent
        const addonDeltaCent = selectedOptions.addon_delta_cent
        const unitPriceCent = basePriceCent + specDeltaCent + addonDeltaCent
        const subtotalCent = unitPriceCent * item.quantity

        if (
          !isSafeAmount(basePriceCent) ||
          !isSafeAmount(specDeltaCent) ||
          !isSafeAmount(addonDeltaCent) ||
          !isSafeAmount(unitPriceCent) ||
          !isSafeAmount(subtotalCent)
        ) {
          return failure('AMOUNT_ERROR', '订单金额计算异常')
        }

        totalAmountCent += subtotalCent
        itemCount += item.quantity

        orderItems.push({
          order_item_id: dependencies.generateId('order_item'),
          order_id: orderId,
          order_no: orderNo,
          merchant_id: merchantId,
          dish_id: standardDishId,
          dish_name: dish.name || '',
          dish_image_url: getDishImage(dish),
          dish_image: getDishImage(dish),
          unit_price_cent: unitPriceCent,
          price_cent: unitPriceCent,
          base_price_cent: basePriceCent,
          spec_delta_cent: specDeltaCent,
          addon_delta_cent: addonDeltaCent,
          selected_specs: selectedOptions.selected_specs,
          selected_addons: selectedOptions.selected_addons,
          quantity: item.quantity,
          subtotal_cent: subtotalCent,
          created_at: now
        })

        if (stockInfo.stock_enabled && !stockUpdates.some((stockUpdate) =>
          stockUpdate.dish_id === standardDishId
        )) {
          stockUpdates.push({
            merchant_id: merchantId,
            dish_id: standardDishId,
            quantity: totalDishQuantity,
            stock_count: stockInfo.stock_count - totalDishQuantity
          })
        }
      }

      if (!isSafeAmount(totalAmountCent) || totalAmountCent <= 0 || itemCount <= 0) {
        return failure('AMOUNT_ERROR', '订单金额计算异常')
      }

      const order = {
        order_id: orderId,
        order_no: orderNo,
        merchant_id: merchantId,
        openid,
        user_openid: openid,
        status: ORDER_STATUS_PENDING,
        payment_status: PAYMENT_STATUS_UNPAID,
        payment_method: PAYMENT_METHOD_OFFLINE,
        pickup_type: normalizeText(event.pickup_type) || DEFAULT_PICKUP_TYPE,
        remark: normalizeText(event.remark).slice(0, 200),
        item_count: itemCount,
        total_amount_cent: totalAmountCent,
        created_at: now,
        updated_at: now
      }

      try {
        await dependencies.createOrder(order)
        await dependencies.createOrderItems(orderItems)
        if (typeof dependencies.updateDishStock === 'function') {
          await Promise.all(stockUpdates.map((stockUpdate) =>
            dependencies.updateDishStock(stockUpdate)
          ))
        }
      } catch (error) {
        if (typeof dependencies.logError === 'function') {
          dependencies.logError('createOrder database write failed', error)
        }

        return failure('DATABASE_ERROR', '订单写入失败，请稍后重试')
      }

      return success('订单创建成功', {
        order_id: orderId,
        order_no: orderNo,
        status: ORDER_STATUS_PENDING,
        payment_status: PAYMENT_STATUS_UNPAID,
        total_amount_cent: totalAmountCent,
        item_count: itemCount
      })
    } catch (error) {
      if (typeof dependencies.logError === 'function') {
        dependencies.logError('createOrder failed', error)
      }

      return failure('SERVER_ERROR', '订单创建失败，请稍后重试')
    }
  }
}

module.exports = {
  createCreateOrderHandler,
  createOrderNo,
  createId
}
