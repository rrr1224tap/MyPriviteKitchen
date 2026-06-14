const {
  ORDER_STATUS_TEXT,
  DISH_STATUS_TEXT,
  PAYMENT_STATUS_TEXT
} = require('./constants')

function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`
}

function formatMoney(priceCent) {
  const cent = Number(priceCent)

  if (!Number.isFinite(cent)) {
    return '¥0.00'
  }

  return `¥${(cent / 100).toFixed(2)}`
}

function formatTime(date) {
  if (!date) {
    return ''
  }

  const value = date instanceof Date ? date : new Date(date)

  if (Number.isNaN(value.getTime())) {
    return ''
  }

  const year = value.getFullYear()
  const month = padNumber(value.getMonth() + 1)
  const day = padNumber(value.getDate())
  const hour = padNumber(value.getHours())
  const minute = padNumber(value.getMinutes())

  return `${year}-${month}-${day} ${hour}:${minute}`
}

function formatOrderStatus(status) {
  return ORDER_STATUS_TEXT[status] || '未知状态'
}

function formatDishStatus(status) {
  return DISH_STATUS_TEXT[status] || '未知状态'
}

function formatPaymentStatus(status) {
  return PAYMENT_STATUS_TEXT[status] || '未知状态'
}

module.exports = {
  formatMoney,
  formatTime,
  formatOrderStatus,
  formatDishStatus,
  formatPaymentStatus
}
