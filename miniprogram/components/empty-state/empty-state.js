Component({
  properties: {
    title: {
      type: String,
      value: '暂无数据'
    },
    desc: {
      type: String,
      value: ''
    },
    iconText: {
      type: String,
      value: ''
    },
    buttonText: {
      type: String,
      value: ''
    },
    showButton: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
