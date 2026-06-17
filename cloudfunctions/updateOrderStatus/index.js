const cloud = require('wx-server-sdk')
const { createUpdateOrderStatusHandler } = require('./order-status-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findMerchantStaff({ merchant_id, openid }) {
  const result = await db
    .collection('merchant_staff')
    .where({
      merchant_id,
      openid,
      status: 'active'
    })
    .limit(1)
    .get()

  return (result.data && result.data[0]) || null
}

async function findOrderById(orderId) {
  const result = await db
    .collection('orders')
    .where({
      order_id: orderId
    })
    .limit(1)
    .get()

  return (result.data && result.data[0]) || null
}

async function updateOrderStatus({ order_id, updateData }) {
  const result = await db
    .collection('orders')
    .where({
      order_id
    })
    .update({
      data: updateData
    })

  if (!result.stats || result.stats.updated <= 0) {
    throw new Error('order update failed')
  }

  return result
}

exports.main = createUpdateOrderStatusHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  now: () => new Date(),
  findMerchantStaff,
  findOrderById,
  updateOrderStatus,
  logError: console.error
})
