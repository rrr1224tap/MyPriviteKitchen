const { formatMoney } = require('../../../utils/format')

const MOCK_DISHES = {
  dish_001: {
    _id: 'dish_001',
    name: '经典肉酱砂锅米线',
    price_cent: 2590,
    image: '/images/mock/menu-glass-display.jpg',
    image_style: 'width: 2500rpx; left: -570rpx; top: -2100rpx;',
    tags: ['春夏新品', '18人推荐', '约15分钟'],
    description: '浓香肉酱配爽滑米线，暖胃又满足。砂锅锁住热气，每一口都浓郁入味。',
    ingredients: ['鲜肉酱', '米线', '时令蔬菜', '豆皮', '溏心蛋']
  },
  dish_002: {
    _id: 'dish_002',
    name: '招牌肥牛石锅拌饭',
    price_cent: 2990,
    image: '/images/mock/home-glass-display.jpg',
    image_style: 'width: 1120rpx; left: -318rpx; top: -126rpx;',
    tags: ['招牌推荐', '人气 TOP1', '约12分钟'],
    description: '肥牛现炒，锅巴焦香，拌匀更好吃。现炒好味，认真对待每一碗热饭。',
    ingredients: ['肥牛', '米饭', '时令蔬菜', '拌饭酱', '鸡蛋']
  }
}

function decorateDish(dish) {
  return Object.assign({}, dish, {
    price_text: formatMoney(dish.price_cent)
  })
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    dish: decorateDish(MOCK_DISHES.dish_002),
    quantity: 1,
    totalPriceText: formatMoney(MOCK_DISHES.dish_002.price_cent),
    imageAvailable: true
  },

  onLoad(options = {}) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    const navigationHeight = Math.max(44, (menuButton.top - statusBarHeight) * 2 + menuButton.height)
    const dish = decorateDish(MOCK_DISHES[options.id] || MOCK_DISHES.dish_002)

    this.setData({
      statusBarHeight,
      navigationHeight,
      dish,
      totalPriceText: dish.price_text
    })
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: '/pages/user/menu/menu'
    })
  },

  handleImageError() {
    this.setData({
      imageAvailable: false
    })
  },

  updateQuantity(quantity) {
    this.setData({
      quantity,
      totalPriceText: formatMoney(this.data.dish.price_cent * quantity)
    })
  },

  decreaseQuantity() {
    if (this.data.quantity > 1) {
      this.updateQuantity(this.data.quantity - 1)
    }
  },

  increaseQuantity() {
    this.updateQuantity(this.data.quantity + 1)
  },

  addToMockCart() {
    wx.showToast({
      title: `已加入 ${this.data.quantity} 份`,
      icon: 'none'
    })
  }
})
