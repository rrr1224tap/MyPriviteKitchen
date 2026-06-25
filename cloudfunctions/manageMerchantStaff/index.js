const cloud = require('wx-server-sdk')
const { createManageMerchantStaffHandler } = require('./merchant-staff-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findMerchantByMerchantId(merchantId) {
  const result = await db.collection('merchants')
    .where({
      merchant_id: merchantId
    })
    .limit(1)
    .get()

  return result.data && result.data.length ? result.data[0] : null
}

async function findStaffById(staffId) {
  const result = await db.collection('merchant_staff')
    .doc(staffId)
    .get()
    .catch(() => null)

  return result && result.data ? result.data : null
}

async function findInviteByCode(code) {
  const result = await db.collection('merchant_invites')
    .where({
      code
    })
    .limit(1)
    .get()

  return result.data && result.data.length ? result.data[0] : null
}

exports.main = createManageMerchantStaffHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },

  getSuperAdminOpenids: () => process.env.SUPER_ADMIN_OPENIDS,

  now: () => new Date(),

  findMerchantByMerchantId,

  findStaffByMerchantId: async (merchantId) => {
    const result = await db.collection('merchant_staff')
      .where({
        merchant_id: merchantId
      })
      .orderBy('created_at', 'desc')
      .limit(1000)
      .get()

    return result.data || []
  },

  findStaffById,

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

  findInvitesByMerchantId: async (merchantId) => {
    const result = await db.collection('merchant_invites')
      .where({
        merchant_id: merchantId
      })
      .orderBy('created_at', 'desc')
      .limit(1000)
      .get()

    return result.data || []
  },

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
