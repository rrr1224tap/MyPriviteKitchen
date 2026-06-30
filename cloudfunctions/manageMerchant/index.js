const cloud = require('wx-server-sdk')
const { createManageMerchantHandler } = require('./merchant-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findMerchantByMerchantId(merchantId) {
  const byMerchantId = await db.collection('merchants')
    .where({
      merchant_id: merchantId
    })
    .limit(1)
    .get()

  if (byMerchantId.data && byMerchantId.data.length) {
    return byMerchantId.data[0]
  }

  const byDocumentId = await db.collection('merchants')
    .doc(merchantId)
    .get()
    .catch(() => null)

  return byDocumentId && byDocumentId.data ? byDocumentId.data : null
}

exports.main = createManageMerchantHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },

  getSuperAdminOpenids: () => process.env.SUPER_ADMIN_OPENIDS,
  getTokenSecret: () => process.env.WEB_ADMIN_TOKEN_SECRET,

  now: () => new Date(),

  findMerchants: async () => {
    const result = await db.collection('merchants')
      .orderBy('created_at', 'desc')
      .limit(1000)
      .get()

    return result.data || []
  },

  findMerchantByMerchantId,

  createMerchant: async (merchant) => {
    const result = await db.collection('merchants')
      .add({
        data: merchant
      })

    return {
      _id: result._id,
      ...merchant
    }
  },

  updateMerchant: async ({ merchant_id, updateData }) => {
    const result = await db.collection('merchants')
      .where({
        merchant_id
      })
      .update({
        data: updateData
      })

    if (!result.stats || result.stats.updated < 1) {
      throw new Error('MERCHANT_UPDATE_FAILED')
    }

    return {
      merchant_id,
      ...updateData
    }
  },

  logger: console
})
