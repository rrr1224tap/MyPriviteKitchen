const MOCK_DISHES = [
  {
    _id: 'dish_001',
    category_id: 'new',
    merchant_id: 'merchant_001',
    name: '经典肉酱砂锅米线',
    description: '浓香肉酱配爽滑米线，暖胃又满足',
    price_cent: 2590,
    price_text: '¥25.90',
    image_style: 'width: 750rpx; left: -192rpx; top: -676rpx;',
    tags: ['新品', '18人推荐'],
    status: 'on_sale'
  },
  {
    _id: 'dish_002',
    category_id: 'signature',
    merchant_id: 'merchant_001',
    name: '招牌肥牛石锅拌饭',
    description: '肥牛现炒，锅巴焦香，拌匀更好吃',
    price_cent: 2990,
    price_text: '¥29.90',
    image_style: 'width: 750rpx; left: -192rpx; top: -846rpx;',
    tags: ['招牌', '人气 TOP1'],
    status: 'on_sale'
  },
  {
    _id: 'dish_003',
    category_id: 'set',
    merchant_id: 'merchant_001',
    name: '海带豆腐汤套餐',
    description: '海带豆腐搭配米饭，适合清淡口味',
    price_cent: 1890,
    price_text: '¥18.90',
    image_style: 'width: 1300rpx; left: -359rpx; top: -1768rpx;',
    tags: ['清爽', '轻负担'],
    status: 'on_sale'
  },
  {
    _id: 'dish_004',
    category_id: 'hotpot',
    merchant_id: 'merchant_001',
    name: '瀑布芝士部队火锅',
    description: '热辣浓郁，适合多人分享',
    price_cent: 8800,
    price_text: '¥88.00',
    image_style: 'width: 750rpx; left: -410rpx; top: -412rpx;',
    tags: ['2-4人', '聚餐推荐'],
    status: 'on_sale'
  }
]

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    menuReference: '/images/mock/menu-glass-display.jpg',
    homeReference: '/images/mock/home-glass-display.jpg',
    menuImageAvailable: true,
    homeImageAvailable: true,
    categories: [
      { id: 'all', name: '全部' },
      { id: 'new', name: '春夏新品', badge: 'NEW' },
      { id: 'set', name: '特惠套餐' },
      { id: 'signature', name: '招牌推荐' },
      { id: 'stir', name: '石锅现炒' },
      { id: 'hotpot', name: '锅物' },
      { id: 'drink', name: '饮品' }
    ],
    activeCategory: 'all',
    dishes: MOCK_DISHES,
    cartCount: 2,
    cartAmountCent: 5580,
    cartAmountText: '¥55.80'
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    const navigationHeight = Math.max(44, (menuButton.top - statusBarHeight) * 2 + menuButton.height)

    this.setData({
      statusBarHeight,
      navigationHeight
    })
  },

  handleHomeImageError() {
    this.setData({
      homeImageAvailable: false
    })
  },

  handleMenuImageError() {
    this.setData({
      menuImageAvailable: false
    })
  },

  selectCategory(event) {
    const categoryId = event.currentTarget.dataset.id
    const dishes = categoryId === 'all'
      ? MOCK_DISHES
      : MOCK_DISHES.filter((dish) => dish.category_id === categoryId)

    this.setData({
      activeCategory: categoryId,
      dishes
    })
  },

  openSearch() {
    wx.showToast({
      title: '搜索功能将在后续接入',
      icon: 'none'
    })
  },

  openDish(event) {
    const dishId = event.currentTarget.dataset.id || 'dish_001'

    wx.navigateTo({
      url: `/pages/user/dish-detail/dish-detail?id=${dishId}`
    })
  },

  addDish(event) {
    const dishId = event.currentTarget.dataset.id
    const dish = MOCK_DISHES.find((item) => item._id === dishId)
    const nextCount = this.data.cartCount + 1
    const nextAmount = this.data.cartAmountCent + (dish ? dish.price_cent : 0)

    this.setData({
      cartCount: nextCount,
      cartAmountCent: nextAmount,
      cartAmountText: `¥${(nextAmount / 100).toFixed(2)}`
    })

    wx.showToast({
      title: '已加入购物车',
      icon: 'none'
    })
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    this.goHome()
  },

  goToCart() {
    wx.navigateTo({
      url: '/pages/user/cart/cart'
    })
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/common/launch/launch'
    })
  },

  goToOrders() {
    wx.navigateTo({
      url: '/pages/user/order-list/order-list'
    })
  }
})
