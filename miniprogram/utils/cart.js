const { DEFAULT_MERCHANT_ID, STORAGE_KEYS } = require('./constants')

const CART_STORAGE_KEY = STORAGE_KEYS.CART_ITEMS || 'cart_items'

function toSafeInteger(value, fallback = 0) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.floor(numberValue)
}

function normalizeQuantity(quantity, fallback = 1) {
  const safeQuantity = toSafeInteger(quantity, fallback)

  return safeQuantity > 0 ? safeQuantity : fallback
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : []
}

function getDishId(dish = {}) {
  return dish.dish_id || dish._id || dish.id || ''
}

function normalizeCartItem(item = {}) {
  const dishId = getDishId(item)

  if (!dishId) {
    return null
  }

  return {
    dish_id: dishId,
    merchant_id: item.merchant_id || DEFAULT_MERCHANT_ID,
    category_id: item.category_id || '',
    name: item.name || '未命名餐品',
    description: item.description || '',
    image_url: item.image_url || item.image || item.display_image || '',
    price_cent: Math.max(0, toSafeInteger(item.price_cent, 0)),
    original_price_cent: Math.max(0, toSafeInteger(item.original_price_cent, 0)),
    tags: normalizeTags(item.tags),
    quantity: normalizeQuantity(item.quantity, 1),
    selected: item.selected !== false,
    updated_at: item.updated_at || Date.now()
  }
}

function getCartItems() {
  try {
    const cartItems = wx.getStorageSync(CART_STORAGE_KEY)

    if (!Array.isArray(cartItems)) {
      return []
    }

    return cartItems.map(normalizeCartItem).filter(Boolean)
  } catch (error) {
    return []
  }
}

function saveCartItems(items = []) {
  const nextItems = Array.isArray(items)
    ? items.map(normalizeCartItem).filter(Boolean)
    : []

  try {
    wx.setStorageSync(CART_STORAGE_KEY, nextItems)
  } catch (error) {
    return []
  }

  return nextItems
}

function addCartItem(dish, quantity = 1) {
  const addQuantity = normalizeQuantity(quantity, 1)
  const cartItem = normalizeCartItem({
    ...dish,
    quantity: addQuantity,
    updated_at: Date.now()
  })

  if (!cartItem) {
    return getCartItems()
  }

  const currentItems = getCartItems()
  const currentMerchantId = currentItems.length ? currentItems[0].merchant_id : ''
  const nextItems = currentMerchantId && currentMerchantId !== cartItem.merchant_id
    ? []
    : currentItems
  const existsIndex = nextItems.findIndex((item) => item.dish_id === cartItem.dish_id)

  if (existsIndex >= 0) {
    const oldItem = nextItems[existsIndex]
    nextItems[existsIndex] = {
      ...oldItem,
      ...cartItem,
      quantity: oldItem.quantity + addQuantity,
      updated_at: Date.now()
    }
  } else {
    nextItems.push(cartItem)
  }

  return saveCartItems(nextItems)
}

function updateCartItemQuantity(dishId, quantity) {
  const nextQuantity = toSafeInteger(quantity, 0)

  if (nextQuantity <= 0) {
    return removeCartItem(dishId)
  }

  const nextItems = getCartItems().map((item) => {
    if (item.dish_id !== dishId) {
      return item
    }

    return {
      ...item,
      quantity: nextQuantity,
      updated_at: Date.now()
    }
  })

  return saveCartItems(nextItems)
}

function removeCartItem(dishId) {
  return saveCartItems(getCartItems().filter((item) => item.dish_id !== dishId))
}

function clearCart() {
  try {
    wx.removeStorageSync(CART_STORAGE_KEY)
  } catch (error) {
    saveCartItems([])
  }

  return []
}

function getCartSummary() {
  const selectedItems = getCartItems().filter((item) => item.selected !== false)

  return selectedItems.reduce((summary, item) => {
    const quantity = normalizeQuantity(item.quantity, 1)
    const priceCent = Math.max(0, toSafeInteger(item.price_cent, 0))

    return {
      total_quantity: summary.total_quantity + quantity,
      total_amount_cent: summary.total_amount_cent + priceCent * quantity,
      selected_items: summary.selected_items.concat({
        ...item,
        quantity,
        price_cent: priceCent
      })
    }
  }, {
    total_quantity: 0,
    total_amount_cent: 0,
    selected_items: []
  })
}

function getCart() {
  return getCartItems()
}

function setCart(items = []) {
  return saveCartItems(items)
}

function calculateCart(items = getCartItems()) {
  const list = Array.isArray(items)
    ? items.map(normalizeCartItem).filter(Boolean)
    : []

  return list.reduce((summary, item) => ({
    total_count: summary.total_count + item.quantity,
    total_amount_cent: summary.total_amount_cent + item.price_cent * item.quantity
  }), {
    total_count: 0,
    total_amount_cent: 0
  })
}

function addToCart(dish, quantity = 1) {
  const items = addCartItem(dish, quantity)

  return {
    items,
    summary: calculateCart(items)
  }
}

function removeFromCart(dishId) {
  const items = removeCartItem(dishId)

  return {
    items,
    summary: calculateCart(items)
  }
}

function updateCartItem(dishId, quantity) {
  const items = updateCartItemQuantity(dishId, quantity)

  return {
    items,
    summary: calculateCart(items)
  }
}

module.exports = {
  getCartItems,
  saveCartItems,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  getCartSummary,
  getCart,
  setCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  calculateCart
}
