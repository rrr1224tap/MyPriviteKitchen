const test = require('node:test')
const assert = require('node:assert/strict')

const { createGetPrepSummaryHandler } = require('./prep-summary-service')

function makeDate(value) {
  return new Date(value)
}

function createDeps(overrides = {}) {
  const state = {
    openid: overrides.openid === undefined ? 'staff_openid' : overrides.openid,
    now: overrides.now || makeDate('2026-06-24T10:30:00+08:00'),
    merchantStaff: overrides.merchantStaff || [
      {
        merchant_id: 'merchant_001',
        openid: 'staff_openid',
        status: 'active'
      }
    ],
    orders: overrides.orders || [],
    orderItems: overrides.orderItems || [],
    dishes: overrides.dishes || []
  }

  return {
    state,
    deps: {
      getOpenid: () => state.openid,
      now: () => state.now,
      findMerchantStaff: async ({ merchant_id, openid }) => {
        return state.merchantStaff.find((staff) => {
          return staff.merchant_id === merchant_id && staff.openid === openid
        }) || null
      },
      findOrdersByDateRange: async ({ merchant_id, start, end }) => {
        return state.orders.filter((order) => {
          const createdAt = new Date(order.created_at)
          return order.merchant_id === merchant_id && createdAt >= start && createdAt < end
        })
      },
      findOrderItemsByOrderIds: async (orderIds) => {
        return state.orderItems.filter((item) => orderIds.includes(item.order_id))
      },
      findDishesByIds: async (dishIds, merchantId) => {
        return state.dishes.filter((dish) => {
          return dish.merchant_id === merchantId && dishIds.includes(dish.dish_id)
        })
      },
      logError: () => {}
    }
  }
}

function baseOrders() {
  return [
    {
      order_id: 'order_today_1',
      merchant_id: 'merchant_001',
      status: 'pending',
      created_at: makeDate('2026-06-24T09:00:00+08:00')
    },
    {
      order_id: 'order_today_2',
      merchant_id: 'merchant_001',
      status: 'accepted',
      created_at: makeDate('2026-06-24T12:00:00+08:00')
    },
    {
      order_id: 'order_cancelled',
      merchant_id: 'merchant_001',
      status: 'cancelled',
      created_at: makeDate('2026-06-24T13:00:00+08:00')
    },
    {
      order_id: 'order_yesterday',
      merchant_id: 'merchant_001',
      status: 'pending',
      created_at: makeDate('2026-06-23T23:20:00+08:00')
    }
  ]
}

function baseItems() {
  return [
    {
      order_id: 'order_today_1',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 2
    },
    {
      order_id: 'order_today_2',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 1
    },
    {
      order_id: 'order_today_2',
      merchant_id: 'merchant_001',
      dish_id: 'dish_chicken',
      dish_name: '宫保鸡丁饭',
      quantity: 1
    },
    {
      order_id: 'order_cancelled',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 99
    },
    {
      order_id: 'order_yesterday',
      merchant_id: 'merchant_001',
      dish_id: 'dish_beef',
      dish_name: '招牌肥牛石锅拌饭',
      quantity: 3
    }
  ]
}

function baseDishes() {
  return [
    {
      dish_id: 'dish_beef',
      merchant_id: 'merchant_001',
      name: '招牌肥牛石锅拌饭',
      ingredients: [
        { name: '肥牛片', amount: 120, unit: 'g', category: '肉类', enabled: true },
        { name: '米饭', amount: 1, unit: '份', category: '主食', enabled: true },
        { name: '拌饭酱', amount: 30, unit: 'g', category: '调料', enabled: true },
        { name: '隐藏测试食材', amount: 999, unit: 'g', category: '调料', enabled: false }
      ]
    },
    {
      dish_id: 'dish_chicken',
      merchant_id: 'merchant_001',
      name: '宫保鸡丁饭',
      ingredients: [
        { name: '鸡丁', amount: 100, unit: 'g', category: '肉类', enabled: true },
        { name: '米饭', amount: 1, unit: '份', category: '主食', enabled: true },
        { name: '花生', amount: 20, unit: 'g', category: '', enabled: true }
      ]
    }
  ]
}

async function runSummary(overrides = {}, event = { merchant_id: 'merchant_001' }) {
  const { deps } = createDeps(overrides)
  const handler = createGetPrepSummaryHandler(deps)
  return handler(event)
}

test('returns FORBIDDEN when user is not active merchant staff', async () => {
  const result = await runSummary({
    merchantStaff: []
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('returns UNAUTHORIZED when openid is missing', async () => {
  const result = await runSummary({
    openid: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('returns empty summary when today has no orders', async () => {
  const result = await runSummary({
    orders: [],
    orderItems: [],
    dishes: []
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 0)
  assert.equal(result.data.item_count, 0)
  assert.equal(result.data.ingredient_count, 0)
  assert.deepEqual(result.data.groups, [])
})

test('excludes cancelled orders and orders outside today', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 2)
  assert.equal(result.data.item_count, 4)
  assert.equal(result.data.dish_count, 2)
})

test('aggregates enabled ingredients by name and unit with quantity multiplication', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })
  const allItems = result.data.groups.flatMap((group) => group.items)
  const beef = allItems.find((item) => item.name === '肥牛片')
  const rice = allItems.find((item) => item.name === '米饭')
  const disabled = allItems.find((item) => item.name === '隐藏测试食材')

  assert.equal(beef.amount, 360)
  assert.equal(beef.unit, 'g')
  assert.equal(rice.amount, 4)
  assert.equal(rice.unit, '份')
  assert.equal(disabled, undefined)
})

test('does not merge ingredients with same name but different unit', async () => {
  const result = await runSummary({
    orders: [
      {
        order_id: 'order_today_1',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: 'dish_mix', dish_name: '测试餐品', quantity: 1 }
    ],
    dishes: [
      {
        dish_id: 'dish_mix',
        merchant_id: 'merchant_001',
        name: '测试餐品',
        ingredients: [
          { name: '葱花', amount: 10, unit: 'g', category: '调料', enabled: true },
          { name: '葱花', amount: 1, unit: '把', category: '调料', enabled: true }
        ]
      }
    ]
  })
  const allItems = result.data.groups.flatMap((group) => group.items)

  assert.equal(allItems.filter((item) => item.name === '葱花').length, 2)
})

test('groups missing category into other', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })
  const otherGroup = result.data.groups.find((group) => group.category === '其他')

  assert.ok(otherGroup)
  assert.equal(otherGroup.items[0].name, '花生')
})

test('old dishes without ingredients do not fail', async () => {
  const result = await runSummary({
    orders: [
      {
        order_id: 'order_today_1',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: 'old_dish', dish_name: '老餐品', quantity: 1 }
    ],
    dishes: [
      { dish_id: 'old_dish', merchant_id: 'merchant_001', name: '老餐品' }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.order_count, 1)
  assert.equal(result.data.ingredient_count, 0)
  assert.deepEqual(result.data.groups, [])
})

test('items without dish_id and invalid quantity are ignored safely', async () => {
  const result = await runSummary({
    orders: [
      {
        order_id: 'order_today_1',
        merchant_id: 'merchant_001',
        status: 'pending',
        created_at: makeDate('2026-06-24T09:00:00+08:00')
      }
    ],
    orderItems: [
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: '', dish_name: '缺失餐品', quantity: 1 },
      { order_id: 'order_today_1', merchant_id: 'merchant_001', dish_id: 'dish_beef', dish_name: '招牌肥牛石锅拌饭', quantity: 'bad' }
    ],
    dishes: baseDishes()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.item_count, 0)
  assert.equal(result.data.ingredient_count, 0)
})

test('copy text contains ingredient amount and source dish', async () => {
  const result = await runSummary({
    orders: baseOrders(),
    orderItems: baseItems(),
    dishes: baseDishes()
  })

  assert.match(result.data.copy_text, /肥牛片 360g/)
  assert.match(result.data.copy_text, /招牌肥牛石锅拌饭 x3/)
  assert.match(result.data.copy_text, /米饭 4份/)
})
