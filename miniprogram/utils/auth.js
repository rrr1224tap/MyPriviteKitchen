const { STORAGE_KEYS } = require('./constants')
const { callFunction } = require('./cloud')

async function login(profile = {}) {
  const authInfo = await callFunction('login', {
    nickname: profile.nickname || '',
    avatar_url: profile.avatar_url || profile.avatar || ''
  })

  saveAuthInfo(authInfo)

  return authInfo
}

function saveAuthInfo(authInfo = {}) {
  const user = authInfo.user || null
  const openid = authInfo.openid || ''
  const isMerchant = Boolean(authInfo.is_merchant)
  const merchantStaff = authInfo.merchant_staff || null
  const merchant = authInfo.merchant || null

  wx.setStorageSync(STORAGE_KEYS.USER_INFO, user)
  wx.setStorageSync(STORAGE_KEYS.OPENID, openid)
  wx.setStorageSync(STORAGE_KEYS.IS_MERCHANT, isMerchant)
  wx.setStorageSync(STORAGE_KEYS.MERCHANT_STAFF, merchantStaff)
  wx.setStorageSync(STORAGE_KEYS.MERCHANT_INFO, merchant)
}

function getCurrentUser() {
  return wx.getStorageSync(STORAGE_KEYS.USER_INFO) || null
}

function getOpenid() {
  return wx.getStorageSync(STORAGE_KEYS.OPENID) || ''
}

function getIsMerchant() {
  return Boolean(wx.getStorageSync(STORAGE_KEYS.IS_MERCHANT))
}

function getMerchantStaff() {
  return wx.getStorageSync(STORAGE_KEYS.MERCHANT_STAFF) || null
}

function getCurrentMerchant() {
  return wx.getStorageSync(STORAGE_KEYS.MERCHANT_INFO) || null
}

function isMerchantStaff() {
  const merchantStaff = getMerchantStaff()

  return Boolean(
    getIsMerchant() &&
    merchantStaff &&
    merchantStaff.merchant_id &&
    merchantStaff.status === 'active'
  )
}

function clearAuthInfo() {
  wx.removeStorageSync(STORAGE_KEYS.USER_INFO)
  wx.removeStorageSync(STORAGE_KEYS.OPENID)
  wx.removeStorageSync(STORAGE_KEYS.IS_MERCHANT)
  wx.removeStorageSync(STORAGE_KEYS.MERCHANT_STAFF)
  wx.removeStorageSync(STORAGE_KEYS.MERCHANT_INFO)
}

module.exports = {
  login,
  saveAuthInfo,
  getCurrentUser,
  getOpenid,
  getIsMerchant,
  getMerchantStaff,
  getCurrentMerchant,
  isMerchantStaff,
  clearAuthInfo
}
