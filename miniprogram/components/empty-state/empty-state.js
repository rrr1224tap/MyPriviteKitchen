Component({
  properties: {
    title: {
      type: String,
      value: '暂时还没有内容'
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
