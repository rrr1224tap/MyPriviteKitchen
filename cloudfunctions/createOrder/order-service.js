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

function getStockInfo(dish = {}) {
  return {
    stock_enabled: typeof dish.stock_enabled === 'boolean' ? dish.stock_enabled : false,
    stock_count: Number.isInteger(dish.stock_count) && dish.stock_count >= 0
      ? dish.stock_count
      : 0,
    sold_out: typeof dish.sold_out === 'boolean' ? dish.sold_out : false
  }
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

    if (!dishId || !quantity) {
      return null
    }

    itemMap[dishId] = (itemMap[dishId] || 0) + quantity
  }

  return Object.keys(itemMap).map((dishId) => ({
    dish_id: dishId,
    quantity: itemMap[dishId]
  }))
}

function createDishMap(dishes) {
  return (Array.isArray(dishes) ? dishes : []).reduce((result, dish) => {
    const dishId = getDishId(dish)

    if (dishId) {
      result[dishId] = dish
    }

    return result
  }, {})
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
      let totalAmountCent = 0
      let itemCount = 0

      for (const item of items) {
        const dish = dishMap[item.dish_id]

        if (!dish) {
          return failure('NOT_FOUND', '餐品不存在')
        }

        if (dish.merchant_id !== merchantId) {
          return failure('NOT_FOUND', '餐品不存在')
        }

        if (dish.status !== 'on_sale') {
          return failure('DISH_OFF_SALE', '餐品当前不可下单')
        }

        const stockInfo = getStockInfo(dish)

        if (stockInfo.sold_out) {
          return failure('DISH_SOLD_OUT', '餐品已售罄')
        }

        if (stockInfo.stock_enabled && stockInfo.stock_count < item.quantity) {
          return failure('STOCK_NOT_ENOUGH', '餐品库存不足')
        }

        const unitPriceCent = Number(dish.price_cent)
        const subtotalCent = unitPriceCent * item.quantity

        if (!isSafeAmount(unitPriceCent) || !isSafeAmount(subtotalCent)) {
          return failure('AMOUNT_ERROR', '订单金额计算异常')
        }

        totalAmountCent += subtotalCent
        itemCount += item.quantity

        orderItems.push({
          order_item_id: dependencies.generateId('order_item'),
          order_id: orderId,
          order_no: orderNo,
          merchant_id: merchantId,
          dish_id: item.dish_id,
          dish_name: dish.name || '',
          dish_image_url: getDishImage(dish),
          dish_image: getDishImage(dish),
          unit_price_cent: unitPriceCent,
          price_cent: unitPriceCent,
          quantity: item.quantity,
          subtotal_cent: subtotalCent,
          created_at: now
        })

        if (stockInfo.stock_enabled) {
          stockUpdates.push({
            merchant_id: merchantId,
            dish_id: item.dish_id,
            quantity: item.quantity,
            stock_count: stockInfo.stock_count - item.quantity
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
