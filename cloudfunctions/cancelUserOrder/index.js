const cloud = require('wx-server-sdk')
const { createCancelUserOrderHandler } = require('./cancel-user-order-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findOne(collectionName, where) {
  const result = await db.collection(collectionName).where(where).limit(1).get()
  return (result.data && result.data[0]) || null
}

async function findOrderById(orderId) {
  const byOrderId = await findOne('orders', { order_id: orderId })

  if (byOrderId) {
    return byOrderId
  }

  return findOne('orders', { _id: orderId })
}

async function updateOrder(where, updateData) {
  return db
    .collection('orders')
    .where(where)
    .update({
      data: updateData
    })
}

async function cancelOrder({ order_id, user_openid, current_status, updateData }) {
  const byOrderId = await updateOrder({
    order_id,
    user_openid,
    status: current_status
  }, updateData)

  if (byOrderId.stats && byOrderId.stats.updated > 0) {
    return byOrderId
  }

  const byDatabaseId = await updateOrder({
    _id: order_id,
    user_openid,
    status: current_status
  }, updateData)

  if (!byDatabaseId.stats || byDatabaseId.stats.updated <= 0) {
    const error = new Error('order status conflict')
    error.code = 'STATUS_CONFLICT'
    throw error
  }

  return byDatabaseId
}

exports.main = createCancelUserOrderHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  now: () => new Date(),
  findOrderById,
  cancelOrder,
  logError: console.error
})
