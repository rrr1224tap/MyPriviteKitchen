const cloud = require('wx-server-sdk')
const { createGetAdminProfileHandler, parseSuperAdminOpenids } = require('./admin-profile-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = createGetAdminProfileHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },
  getSuperAdminOpenids: () => parseSuperAdminOpenids(process.env.SUPER_ADMIN_OPENIDS),
  logError: console.error
})
