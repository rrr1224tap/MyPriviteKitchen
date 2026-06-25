const cloud = require('wx-server-sdk')
const {
  createCheckAdminDataHealthHandler
} = require('./admin-data-health-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const DEFAULT_PAGE_SIZE = 1000

async function getCollectionList(name, options = {}) {
  let query = db.collection(name)

  if (options.orderBy) {
    query = query.orderBy(options.orderBy.field, options.orderBy.direction)
  }

  const result = await query.limit(options.limit || DEFAULT_PAGE_SIZE).get()
  return result.data || []
}

function missingMerchantId(record = {}) {
  return !record.merchant_id || !String(record.merchant_id).trim()
}

async function fixMissingMerchantId(collectionName, payload = {}) {
  const records = await getCollectionList(collectionName)
  const targets = records.filter((record) => record && record._id && missingMerchantId(record))

  for (const record of targets) {
    await db.collection(collectionName)
      .doc(record._id)
      .update({
        data: {
          merchant_id: payload.merchant_id,
          updated_at: payload.updated_at || new Date()
        }
      })
  }

  return targets.length
}

exports.main = createCheckAdminDataHealthHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  getSuperAdminOpenids: () => process.env.SUPER_ADMIN_OPENIDS,
  getDefaultMerchantId: () => process.env.DEFAULT_MERCHANT_ID || 'merchant_001',
  now: () => new Date(),
  findMerchants: () => getCollectionList('merchants'),
  findStaff: () => getCollectionList('merchant_staff'),
  findInvites: () => getCollectionList('merchant_invites'),
  findDishes: () => getCollectionList('dishes'),
  findCategories: () => getCollectionList('categories'),
  findOrders: () => getCollectionList('orders', {
    orderBy: {
      field: 'created_at',
      direction: 'desc'
    }
  }),
  findOrderItems: () => getCollectionList('order_items'),
  fixDishMerchantId: (payload) => fixMissingMerchantId('dishes', payload),
  fixCategoryMerchantId: (payload) => fixMissingMerchantId('categories', payload),
  logger: console
})
