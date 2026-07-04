const cloud = require('wx-server-sdk')
const { createGetPrepSummaryHandler } = require('./prep-summary-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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

async function findOrdersByDateRange({ merchant_id, start, end }) {
  const result = await db
    .collection('orders')
    .where({
      merchant_id,
      created_at: _.gte(start).and(_.lt(end))
    })
    .limit(1000)
    .get()

  return result.data || []
}

async function findOrderItemsByOrderIds(orderIds) {
  const ids = Array.from(new Set(orderIds)).filter(Boolean)
  if (!ids.length) {
    return []
  }

  const result = await db
    .collection('order_items')
    .where({
      order_id: _.in(ids)
    })
    .limit(1000)
    .get()

  return result.data || []
}

async function findDishesByIds(dishIds, merchantId) {
  const ids = Array.from(new Set(dishIds)).filter(Boolean)
  if (!ids.length) {
    return []
  }

  const result = await db
    .collection('dishes')
    .where({
      merchant_id: merchantId,
      dish_id: _.in(ids)
    })
    .limit(1000)
    .get()

  return result.data || []
}

exports.main = createGetPrepSummaryHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  now: () => new Date(),
  getTokenSecret: () => process.env.WEB_ADMIN_TOKEN_SECRET || '',
  findMerchantStaff,
  findOrdersByDateRange,
  findOrderItemsByOrderIds,
  findDishesByIds,
  logError: console.error
})
