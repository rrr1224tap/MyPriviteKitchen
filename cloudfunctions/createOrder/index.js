const cloud = require('wx-server-sdk')
const {
  createCreateOrderHandler,
  createId,
  createOrderNo
} = require('./order-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function findMerchantById(merchantId) {
  const result = await db.collection('merchants')
    .where({
      merchant_id: merchantId
    })
    .limit(1)
    .get()

  return result.data && result.data[0] ? result.data[0] : null
}

async function findDishesByIds(dishIds, merchantId) {
  const uniqueDishIds = Array.from(new Set(dishIds)).filter(Boolean)

  if (!uniqueDishIds.length) {
    return []
  }

  const result = await db.collection('dishes')
    .where({
      merchant_id: merchantId,
      dish_id: _.in(uniqueDishIds)
    })
    .limit(1000)
    .get()

  return result.data || []
}

async function createOrder(order) {
  const result = await db.collection('orders').add({
    data: order
  })

  return Object.assign({ _id: result._id }, order)
}

async function createOrderItems(orderItems) {
  await Promise.all(orderItems.map((item) => db.collection('order_items').add({
    data: item
  })))

  return orderItems
}

const createOrderHandler = createCreateOrderHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  now: () => new Date(),
  generateId: createId,
  generateOrderNo: createOrderNo,
  findMerchantById,
  findDishesByIds,
  createOrder,
  createOrderItems,
  logError: console.error
})

exports.main = async (event) => createOrderHandler(event)
