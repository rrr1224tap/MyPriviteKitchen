const cloud = require('wx-server-sdk')
const { createGetMenuHandler } = require('./menu-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findOne(collectionName, where) {
  const result = await db.collection(collectionName).where(where).limit(1).get()
  return result.data[0] || null
}

async function findMerchantById(merchantId) {
  const byDocumentId = await findOne('merchants', { _id: merchantId })

  if (byDocumentId) {
    return byDocumentId
  }

  return findOne('merchants', { merchant_id: merchantId })
}

async function findCategoriesByMerchantId(merchantId) {
  const result = await db
    .collection('categories')
    .where({ merchant_id: merchantId })
    .orderBy('sort_order', 'asc')
    .limit(1000)
    .get()

  return result.data || []
}

async function findDishesByMerchantId(merchantId) {
  const result = await db
    .collection('dishes')
    .where({ merchant_id: merchantId })
    .orderBy('sort_order', 'asc')
    .limit(1000)
    .get()

  return result.data || []
}

exports.main = createGetMenuHandler({
  findMerchantById,
  findCategoriesByMerchantId,
  findDishesByMerchantId,
  logError: console.error
})
