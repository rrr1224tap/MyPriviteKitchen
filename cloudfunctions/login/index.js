const cloud = require('wx-server-sdk')
const { createLoginHandler } = require('./login-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findOne(collectionName, where) {
  const result = await db.collection(collectionName)
    .where(where)
    .limit(1)
    .get()

  return result.data[0] || null
}

const login = createLoginHandler({
  logError(message, error) {
    console.error(message, error)
  },

  getOpenid() {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },

  now() {
    return db.serverDate()
  },

  findUserByOpenid(openid) {
    return findOne('users', { openid })
  },

  async createUser(user) {
    const result = await db.collection('users').add({ data: user })
    return Object.assign({ _id: result._id }, user)
  },

  async updateUser(user, updates) {
    await db.collection('users').doc(user._id).update({ data: updates })
    return Object.assign({}, user, updates)
  },

  findActiveMerchantStaff(openid) {
    return findOne('merchant_staff', {
      openid,
      status: 'active'
    })
  },

  findMerchantById(merchantId) {
    return findOne('merchants', { _id: merchantId })
  }
})

exports.main = login
