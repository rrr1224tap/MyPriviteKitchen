const cloud = require('wx-server-sdk')
const { createMerchantSelfServiceHandler } = require('./merchant-self-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findInviteByCode(code) {
  const result = await db.collection('merchant_invites')
    .where({
      code
    })
    .limit(1)
    .get()

  return result.data && result.data.length ? result.data[0] : null
}

exports.main = createMerchantSelfServiceHandler({
  getTokenSecret: () => process.env.WEB_ADMIN_TOKEN_SECRET,

  now: () => new Date(),

  findInviteByCode,

  createInvite: async (invite) => {
    const result = await db.collection('merchant_invites')
      .add({
        data: invite
      })

    return {
      _id: result._id,
      ...invite
    }
  },

  logger: console
})
