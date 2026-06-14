Component({
  properties: {
    order: {
      type: Object,
      value: {}
    },
    showActions: {
      type: Boolean,
      value: false
    },
    actions: {
      type: Array,
      value: []
    }
  },

  data: {
    amountText: '',
    createdAtText: '',
    statusText: ''
  },

  observers: {
    order(order) {
      const amountCent = Number(order && order.total_amount_cent)

      this.setData({
        amountText: Number.isFinite(amountCent) ? `¥${(amountCent / 100).toFixed(2)}` : '',
        createdAtText: this.formatTime(order && order.created_at),
        statusText: this.getStatusText(order && order.status)
      })
    }
  },

  methods: {
    formatTime(date) {
      if (!date) {
        return ''
      }

      const value = date instanceof Date ? date : new Date(date)

      if (Number.isNaN(value.getTime())) {
        return ''
      }

      const pad = (num) => (num < 10 ? `0${num}` : `${num}`)

      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`
    },

    getStatusText(status) {
      const textMap = {
        pending: '待接单',
        accepted: '已接单',
        cooking: '制作中',
        finished: '已完成',
        cancelled: '已取消'
      }

      return textMap[status] || ''
    },

    onTap() {
      this.triggerEvent('tap', {
        order: this.data.order
      })
    },

    onAction(event) {
      const action = event.currentTarget.dataset.action

      this.triggerEvent('action', {
        action,
        order: this.data.order
      })
    },

    noop() {
    }
  }
})
