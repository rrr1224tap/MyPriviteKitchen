Component({
  properties: {
    status: {
      type: String,
      value: ''
    },
    text: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: 'default'
    }
  },

  data: {
    displayText: ''
  },

  observers: {
    'status, text'(status, text) {
      const textMap = {
        pending: '待接单',
        accepted: '已接单',
        cooking: '制作中',
        finished: '已完成',
        cancelled: '已取消',
        on_sale: '上架中',
        off_sale: '已下架',
        sold_out: '已售罄'
      }

      this.setData({
        displayText: text || textMap[status] || status || '状态'
      })
    }
  }
})
