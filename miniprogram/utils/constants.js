const DEFAULT_MERCHANT_ID = 'merchant_001'

// 云开发环境 ID，由微信开发者工具“云开发”控制台提供。
const CLOUD_ENV_ID = 'cloud1-d1gg2kdq762389ea4'

const STORAGE_KEYS = {
  CART_ITEMS: 'cart_items',
  USER_INFO: 'user_info',
  OPENID: 'openid',
  IS_MERCHANT: 'is_merchant',
  MERCHANT_STAFF: 'merchant_staff',
  MERCHANT_INFO: 'merchant_info'
}

const ORDER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  COOKING: 'cooking',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
}

const DISH_STATUS = {
  ON_SALE: 'on_sale',
  OFF_SALE: 'off_sale',
  SOLD_OUT: 'sold_out'
}

const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  REFUNDED: 'refunded',
  CLOSED: 'closed'
}

const PAYMENT_METHOD = {
  OFFLINE: 'offline'
}

const ORDER_STATUS_TEXT = {
  [ORDER_STATUS.PENDING]: '待小厨接单',
  [ORDER_STATUS.ACCEPTED]: '小厨已接单',
  [ORDER_STATUS.COOKING]: '制作中',
  [ORDER_STATUS.FINISHED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消'
}

const MERCHANT_ORDER_STATUS_TEXT = {
  [ORDER_STATUS.PENDING]: '待接单',
  [ORDER_STATUS.ACCEPTED]: '已接单',
  [ORDER_STATUS.COOKING]: '制作中',
  [ORDER_STATUS.FINISHED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消'
}

const DISH_STATUS_TEXT = {
  [DISH_STATUS.ON_SALE]: '上架中',
  [DISH_STATUS.OFF_SALE]: '已下架',
  [DISH_STATUS.SOLD_OUT]: '已售罄'
}

const PAYMENT_STATUS_TEXT = {
  [PAYMENT_STATUS.UNPAID]: '未支付',
  [PAYMENT_STATUS.PAID]: '已支付',
  [PAYMENT_STATUS.REFUNDED]: '已退款',
  [PAYMENT_STATUS.CLOSED]: '已关闭'
}

module.exports = {
  DEFAULT_MERCHANT_ID,
  CLOUD_ENV_ID,
  STORAGE_KEYS,
  ORDER_STATUS,
  DISH_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  ORDER_STATUS_TEXT,
  MERCHANT_ORDER_STATUS_TEXT,
  DISH_STATUS_TEXT,
  PAYMENT_STATUS_TEXT
}
