Component({
  properties: {
    dish: {
      type: Object,
      value: {}
    },
    showAdd: {
      type: Boolean,
      value: true
    },
    actionText: {
      type: String,
      value: '+'
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    priceText: '',
    tags: [],
    status: ''
  },

  observers: {
    dish(dish) {
      const priceCent = Number(dish && dish.price_cent)
      const tags = Array.isArray(dish && dish.tags) ? dish.tags : []

      this.setData({
        priceText: Number.isFinite(priceCent) ? `¥${(priceCent / 100).toFixed(2)}` : '',
        tags,
        status: dish && dish.status ? dish.status : ''
      })
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', {
        dish: this.data.dish
      })
    },

    onAdd() {
      if (this.data.disabled) {
        return
      }

      this.triggerEvent('add', {
        dish: this.data.dish
      })
    }
  }
})
