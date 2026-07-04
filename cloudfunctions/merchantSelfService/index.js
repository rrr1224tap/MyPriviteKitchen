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

async function findMerchantBySlug(merchantSlug) {
  const bySlug = await db.collection('merchants')
    .where({
      merchant_slug: merchantSlug
    })
    .limit(1)
    .get()

  if (bySlug.data && bySlug.data.length) {
    return bySlug.data[0]
  }

  const byId = await db.collection('merchants')
    .where({
      merchant_id: merchantSlug
    })
    .limit(1)
    .get()

  return byId.data && byId.data.length ? byId.data[0] : null
}

async function findStaffByLoginName({ merchant_id, login_name }) {
  const result = await db.collection('merchant_staff')
    .where({
      merchant_id,
      login_name
    })
    .limit(1)
    .get()

  return result.data && result.data.length ? result.data[0] : null
}

async function findStaffById(staffId) {
  const result = await db.collection('merchant_staff')
    .where({
      staff_id: staffId
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

  findMerchantBySlug,

  findStaffByLoginName,

  createMerchantForSignup: async (merchant) => {
    const result = await db.collection('merchants')
      .add({
        data: merchant
      })

    return {
      _id: result._id,
      ...merchant
    }
  },

  createOwnerStaff: async (staff) => {
    const result = await db.collection('merchant_staff')
      .add({
        data: staff
      })

    return {
      _id: result._id,
      ...staff
    }
  },

  updateStaffLoginAt: async ({ staff_id, updateData }) => {
    const result = await db.collection('merchant_staff')
      .where({
        staff_id
      })
      .update({
        data: updateData
      })

    if (!result.stats || result.stats.updated < 1) {
      return null
    }

    return findStaffById(staff_id)
  },

  markInviteUsed: async ({ code, updateData }) => {
    const result = await db.collection('merchant_invites')
      .where({
        code,
        status: 'unused'
      })
      .update({
        data: updateData
      })

    if (!result.stats || result.stats.updated < 1) {
      return null
    }

    return findInviteByCode(code)
  },

  disableMerchantForSignup: async (merchantId) => {
    await db.collection('merchants')
      .where({
        merchant_id: merchantId
      })
      .update({
        data: {
          status: 'disabled',
          updated_at: new Date()
        }
      })
  },

  disableStaffForSignup: async (staffId) => {
    await db.collection('merchant_staff')
      .where({
        staff_id: staffId
      })
      .update({
        data: {
          status: 'disabled',
          account_status: 'disabled',
          updated_at: new Date()
        }
      })
  },

  getMerchantTokenTtlMinutes: () => process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES,

  logger: console
})
