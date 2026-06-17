const cloud = require('wx-server-sdk')
const {
  createGetMerchantOrderDetailHandler
} = require('./merchant-order-detail-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findOne(collectionName, where) {
  const result = await db.collection(collectionName).where(where).limit(1).get()
  return (result.data && result.data[0]) || null
}

async function findMerchantStaff({ merchant_id, openid }) {
  return findOne('merchant_staff', {
    merchant_id,
    openid,
    status: 'active'
  })
}

async function findOrderById(orderId) {
  const byOrderId = await findOne('orders', { order_id: orderId })

  if (byOrderId) {
    return byOrderId
  }

  return findOne('orders', { _id: orderId })
}

async function findOrderItemsByOrderId(orderId, merchantId) {
  const result = await db
    .collection('order_items')
    .where({
      order_id: orderId,
      merchant_id: merchantId
    })
    .limit(1000)
    .get()

  return result.data || []
}

exports.main = createGetMerchantOrderDetailHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  findMerchantStaff,
  findOrderById,
  findOrderItemsByOrderId,
  logError: console.error
})
