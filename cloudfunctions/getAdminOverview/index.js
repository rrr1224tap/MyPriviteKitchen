const cloud = require('wx-server-sdk')
const {
  createGetAdminOverviewHandler
} = require('./admin-overview-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function getCollectionList(name, options = {}) {
  let query = db.collection(name)

  if (options.orderBy) {
    query = query.orderBy(options.orderBy.field, options.orderBy.direction)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const result = await query.get()
  return result.data || []
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const handler = createGetAdminOverviewHandler({
    getOpenid: () => wxContext.OPENID,
    getSuperAdminOpenids: () => process.env.SUPER_ADMIN_OPENIDS,
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
      },
      limit: 200
    }),
    logger: console
  })

  return handler(event)
}
