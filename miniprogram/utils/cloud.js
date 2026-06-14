async function callFunction(name, data = {}) {
  if (!name) {
    throw new Error('云函数名称不能为空')
  }

  try {
    const res = await wx.cloud.callFunction({
      name,
      data
    })
    const result = res.result || {}

    if (!result.success) {
      const message = result.message || '操作失败'

      wx.showToast({
        title: message,
        icon: 'none'
      })

      const error = new Error(message)
      error.toastShown = true
      throw error
    }

    return result.data
  } catch (error) {
    const message = error && error.message ? error.message : '网络异常'

    if (!error || !error.toastShown) {
      wx.showToast({
        title: message,
        icon: 'none'
      })
    }

    throw error
  }
}

module.exports = {
  callFunction
}
