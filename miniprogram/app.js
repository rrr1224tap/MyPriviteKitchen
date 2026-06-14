const { CLOUD_ENV_ID } = require('./utils/constants')

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信基础库不支持云开发，请升级微信开发者工具')
      return
    }

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    })
  },

  globalData: {
    userInfo: null,
    merchantStaff: null,
    merchant: null
  }
})
