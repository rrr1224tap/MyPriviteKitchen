const cloud = require('wx-server-sdk')
const { createWebAdminAuthHandler } = require('./web-admin-auth-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = createWebAdminAuthHandler({
  getPasscodeHash: () => process.env.WEB_ADMIN_PASSCODE_HASH,
  getPasscode: () => process.env.WEB_ADMIN_PASSCODE,
  getTokenSecret: () => process.env.WEB_ADMIN_TOKEN_SECRET,
  getTokenTtlMinutes: () => process.env.WEB_ADMIN_TOKEN_TTL_MINUTES,
  now: () => new Date(),
  logger: console
})
