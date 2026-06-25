const cloud = require('wx-server-sdk')
const { createRedeemMerchantInviteHandler } = require('./redeem-invite-service')

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

async function findMerchantByMerchantId(merchantId) {
  const result = await db.collection('merchants')
    .where({
      merchant_id: merchantId
    })
    .limit(1)
    .get()

  return result.data && result.data.length ? result.data[0] : null
}

async function findStaffByMerchantAndOpenid({ merchant_id, openid }) {
  const result = await db.collection('merchant_staff')
    .where({
      merchant_id,
      openid
    })
    .limit(1)
    .get()

  return result.data && result.data.length ? result.data[0] : null
}

exports.main = createRedeemMerchantInviteHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },

  now: () => new Date(),

  findInviteByCode,

  findMerchantByMerchantId,

  findStaffByMerchantAndOpenid,

  createStaff: async (staff) => {
    const result = await db.collection('merchant_staff')
      .add({
        data: staff
      })

    return {
      _id: result._id,
      ...staff
    }
  },

  updateStaff: async ({ staff_id, updateData }) => {
    await db.collection('merchant_staff')
      .doc(staff_id)
      .update({
        data: updateData
      })

    return {
      _id: staff_id,
      ...updateData
    }
  },

  updateInvite: async ({ code, updateData }) => {
    const invite = await findInviteByCode(code)
    if (!invite || !invite._id) {
      throw new Error('INVITE_NOT_FOUND')
    }

    await db.collection('merchant_invites')
      .doc(invite._id)
      .update({
        data: updateData
      })

    return {
      ...invite,
      ...updateData
    }
  },

  logger: console
})
