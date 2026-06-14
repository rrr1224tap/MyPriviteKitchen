const { STORAGE_KEYS } = require('./constants')

function normalizeQuantity(quantity) {
  const value = Number(quantity)

  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.floor(value)
}

function getCart() {
  const cartItems = wx.getStorageSync(STORAGE_KEYS.CART_ITEMS)

  return Array.isArray(cartItems) ? cartItems : []
}

function setCart(cartItems = []) {
  const nextCartItems = Array.isArray(cartItems) ? cartItems : []

  wx.setStorageSync(STORAGE_KEYS.CART_ITEMS, nextCartItems)

  return nextCartItems
}

function calculateCart(cartItems = getCart()) {
  const list = Array.isArray(cartItems) ? cartItems : []

  return list.reduce((result, item) => {
    const quantity = normalizeQuantity(item.quantity)
    const priceCent = Number(item.price_cent) || 0

    return {
      total_count: result.total_count + quantity,
      total_amount_cent: result.total_amount_cent + priceCent * quantity
    }
  }, {
    total_count: 0,
    total_amount_cent: 0
  })
}

function addToCart(dish, quantity = 1) {
  if (!dish || !dish._id) {
    throw new Error('餐品信息不能为空')
  }

  const addQuantity = normalizeQuantity(quantity)

  if (addQuantity < 1) {
    throw new Error('餐品数量不能小于 1')
  }

  const cartItems = getCart()
  const currentMerchantId = cartItems.length > 0 ? cartItems[0].merchant_id : ''

  if (currentMerchantId && currentMerchantId !== dish.merchant_id) {
    throw new Error('购物车只支持同一商家的餐品')
  }

  const existsIndex = cartItems.findIndex((item) => item.dish_id === dish._id)

  if (existsIndex >= 0) {
    cartItems[existsIndex].quantity += addQuantity
  } else {
    cartItems.push({
      dish_id: dish._id,
      merchant_id: dish.merchant_id,
      category_id: dish.category_id,
      name: dish.name,
      image: dish.image || '',
      price_cent: Number(dish.price_cent) || 0,
      quantity: addQuantity,
      stock: Number(dish.stock) || 0,
      status: dish.status
    })
  }

  setCart(cartItems)

  return {
    items: cartItems,
    summary: calculateCart(cartItems)
  }
}

function removeFromCart(dishId) {
  const cartItems = getCart().filter((item) => item.dish_id !== dishId)

  setCart(cartItems)

  return {
    items: cartItems,
    summary: calculateCart(cartItems)
  }
}

function updateCartItem(dishId, quantity) {
  const nextQuantity = normalizeQuantity(quantity)

  if (nextQuantity <= 0) {
    return removeFromCart(dishId)
  }

  const cartItems = getCart().map((item) => {
    if (item.dish_id !== dishId) {
      return item
    }

    return Object.assign({}, item, {
      quantity: nextQuantity
    })
  })

  setCart(cartItems)

  return {
    items: cartItems,
    summary: calculateCart(cartItems)
  }
}

function clearCart() {
  wx.removeStorageSync(STORAGE_KEYS.CART_ITEMS)

  return {
    items: [],
    summary: calculateCart([])
  }
}

module.exports = {
  getCart,
  setCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  calculateCart
}
