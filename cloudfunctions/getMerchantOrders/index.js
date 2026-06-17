const cloud = require('wx-server-sdk')
const { createGetMerchantOrdersHandler } = require('./merchant-orders-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

function buildOrderWhere(filters = {}) {
  const where = {
    merchant_id: filters.merchant_id
  }

  if (filters.status) {
    where.status = filters.status
  }

  return where
}

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

async function findMerchantOrders({ merchant_id, status, page, page_size }) {
  const where = buildOrderWhere({ merchant_id, status })
  const skip = (page - 1) * page_size
  const collection = db.collection('orders').where(where)

  const [listResult, countResult] = await Promise.all([
    collection
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(page_size)
      .get(),
    collection.count()
  ])

  return {
    list: listResult.data || [],
    total: countResult.total || 0
  }
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

exports.main = createGetMerchantOrdersHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  findMerchantStaff,
  findMerchantOrders,
  findOrderItemsByOrderIds,
  logError: console.error
})
