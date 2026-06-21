const test = require('node:test')
const assert = require('node:assert/strict')

const { createCreateOrderHandler } = require('./order-service')

const NOW = new Date('2026-06-17T10:30:00.000Z')

function createDependencies(overrides = {}) {
  const calls = {
    order: null,
    orderItems: null,
    stockUpdates: []
  }

  const dependencies = {
    logError: () => {},
    getOpenid: () => 'openid_user_001',
    now: () => NOW,
    generateId: (prefix) => `${prefix}_fixed_001`,
    generateOrderNo: () => '20260617103000123',
    findMerchantById: async () => ({
      _id: 'merchant_001',
      merchant_id: 'merchant_001',
      name: '测试门店',
      status: 'active',
      business_status: 'open'
    }),
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '招牌肥牛石锅拌饭',
        image_url: 'beef-rice.png',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 99,
        sold_out: false
      },
      {
        _id: 'dish_002',
        dish_id: 'dish_002',
        merchant_id: 'merchant_001',
        category_id: 'category_001',
        name: '经典肉酱砂锅米线',
        image: 'noodle.png',
        price_cent: 2590,
        status: 'on_sale',
        stock_enabled: false,
        stock_count: 0,
        sold_out: false
      }
    ],
    createOrder: async (order) => {
      calls.order = order
      return Object.assign({ _id: order.order_id }, order)
    },
    createOrderItems: async (items) => {
      calls.orderItems = items
      return items
    },
    updateDishStock: async ({ dish_id, stock_count }) => {
      calls.stockUpdates.push({ dish_id, stock_count })
      return { dish_id, stock_count }
    },
    ...overrides
  }

  return { dependencies, calls }
}

function createOptionDish(overrides = {}) {
  return {
    _id: 'dish_option',
    dish_id: 'dish_option',
    merchant_id: 'merchant_001',
    category_id: 'category_001',
    name: 'Option Dish',
    image_url: 'option.png',
    price_cent: 2000,
    status: 'on_sale',
    stock_enabled: true,
    stock_count: 20,
    sold_out: false,
    spec_groups: [
      {
        group_id: 'size',
        name: 'Size',
        required: true,
        min_select: 1,
        max_select: 1,
        sort_order: 1,
        options: [
          {
            option_id: 'normal',
            name: 'Normal',
            price_delta_cent: 0,
            enabled: true,
            sort_order: 1
          },
          {
            option_id: 'large',
            name: 'Large',
            price_delta_cent: 300,
            enabled: true,
            sort_order: 2
          },
          {
            option_id: 'hidden',
            name: 'Hidden',
            price_delta_cent: 100,
            enabled: false,
            sort_order: 3
          }
        ]
      }
    ],
    addon_groups: [
      {
        group_id: 'extra',
        name: 'Extra',
        required: false,
        min_select: 0,
        max_select: 2,
        sort_order: 1,
        options: [
          {
            option_id: 'egg',
            name: 'Egg',
            price_delta_cent: 200,
            enabled: true,
            sort_order: 1
          },
          {
            option_id: 'meat',
            name: 'Meat',
            price_delta_cent: 500,
            enabled: true,
            sort_order: 2
          },
          {
            option_id: 'cheese',
            name: 'Cheese',
            price_delta_cent: 300,
            enabled: false,
            sort_order: 3
          }
        ]
      }
    ],
    ...overrides
  }
}

function createOptionDependencies(dishOverrides = {}) {
  return createDependencies({
    findDishesByIds: async () => [
      createOptionDish(dishOverrides)
    ]
  })
}

test('creates an order and order item snapshots using database dish prices', async () => {
  const { dependencies, calls } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 2, price_cent: 1 },
      { dish_id: 'dish_002', quantity: 1, price_cent: 1 }
    ],
    remark: '少辣',
    pickup_type: 'self_pickup',
    openid: 'fake_openid'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.order_id, 'order_fixed_001')
  assert.equal(result.data.order_no, '20260617103000123')
  assert.equal(result.data.status, 'pending')
  assert.equal(result.data.total_amount_cent, 8570)
  assert.equal(result.data.item_count, 3)

  assert.equal(calls.order.openid, 'openid_user_001')
  assert.equal(calls.order.user_openid, 'openid_user_001')
  assert.equal(calls.order.total_amount_cent, 8570)
  assert.equal(calls.order.payment_status, 'unpaid')
  assert.equal(calls.order.payment_method, 'offline')
  assert.equal(calls.order.status, 'pending')

  assert.equal(calls.orderItems.length, 2)
  assert.equal(calls.orderItems[0].dish_name, '招牌肥牛石锅拌饭')
  assert.equal(calls.orderItems[0].unit_price_cent, 2990)
  assert.equal(calls.orderItems[0].price_cent, 2990)
  assert.equal(calls.orderItems[0].quantity, 2)
  assert.equal(calls.orderItems[0].subtotal_cent, 5980)
  assert.equal(calls.orderItems[1].subtotal_cent, 2590)
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_001', stock_count: 97 }
  ])
})

test('returns INVALID_PARAMS when items is empty', async () => {
  const { dependencies } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: []
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('returns INVALID_PARAMS when quantity is invalid', async () => {
  const { dependencies } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 0 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('returns NOT_FOUND when a dish is missing', async () => {
  const { dependencies } = createDependencies({
    findDishesByIds: async () => []
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_404', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('returns DISH_OFF_SALE when a dish is not on sale', async () => {
  const { dependencies } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '下架餐品',
        price_cent: 2990,
        status: 'off_sale',
        stock: 99
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DISH_OFF_SALE')
})

test('returns DISH_SOLD_OUT when dish is manually sold out', async () => {
  const { dependencies } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '售罄餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: false,
        stock_count: 0,
        sold_out: true
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DISH_SOLD_OUT')
})

test('returns STOCK_NOT_ENOUGH when enabled stock is lower than quantity', async () => {
  const { dependencies } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '库存不足餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 1,
        sold_out: false
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 2 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STOCK_NOT_ENOUGH')
})

test('creates order and deducts stock to zero when stock equals quantity', async () => {
  const { dependencies, calls } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '刚好库存餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 2,
        sold_out: false
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 2 }
    ]
  })

  assert.equal(result.success, true)
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_001', stock_count: 0 }
  ])
})

test('creates order and deducts stock when stock is greater than quantity', async () => {
  const { dependencies, calls } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '充足库存餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 5,
        sold_out: false
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 2 }
    ]
  })

  assert.equal(result.success, true)
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_001', stock_count: 3 }
  ])
})

test('creates order without stock deduction when stock is disabled', async () => {
  const { dependencies, calls } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '不限库存餐品',
        price_cent: 2990,
        status: 'on_sale',
        stock_enabled: false,
        stock_count: 1,
        sold_out: false
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 2 }
    ]
  })

  assert.equal(result.success, true)
  assert.deepEqual(calls.stockUpdates, [])
})

test('creates order for legacy dish without stock fields as unlimited stock', async () => {
  const { dependencies, calls } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '历史旧餐品',
        price_cent: 2990,
        status: 'on_sale'
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 99 }
    ]
  })

  assert.equal(result.success, true)
  assert.deepEqual(calls.stockUpdates, [])
})

test('creates order for legacy dish without option groups using old item structure', async () => {
  const { dependencies, calls } = createDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, true)
  assert.deepEqual(calls.orderItems[0].selected_specs, [])
  assert.deepEqual(calls.orderItems[0].selected_addons, [])
  assert.equal(calls.orderItems[0].base_price_cent, 2990)
  assert.equal(calls.orderItems[0].spec_delta_cent, 0)
  assert.equal(calls.orderItems[0].addon_delta_cent, 0)
  assert.equal(calls.orderItems[0].unit_price_cent, 2990)
})

test('returns VALIDATION_ERROR when required spec is missing', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_option', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected spec group does not exist', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'taste', option_id: 'large' }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected spec option does not exist', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'huge' }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected spec option is disabled', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'hidden' }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected addon group does not exist', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ],
        selected_addons: [
          { group_id: 'sauce', option_ids: ['egg'] }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected addon option does not exist', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['drink'] }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected addon option is disabled', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['cheese'] }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected addon option_ids contain duplicates', async () => {
  const { dependencies } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg', 'egg'] }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('returns VALIDATION_ERROR when selected addon count exceeds max_select', async () => {
  const { dependencies } = createOptionDependencies({
    addon_groups: [
      {
        group_id: 'extra',
        name: 'Extra',
        required: false,
        min_select: 0,
        max_select: 1,
        options: [
          { option_id: 'egg', name: 'Egg', price_delta_cent: 200, enabled: true },
          { option_id: 'meat', name: 'Meat', price_delta_cent: 500, enabled: true }
        ]
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg', 'meat'] }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('creates order with valid specs and addons using database prices and snapshots', async () => {
  const { dependencies, calls } = createOptionDependencies()
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    total_amount_cent: 1,
    items: [
      {
        dish_id: 'dish_option',
        quantity: 2,
        unit_price_cent: 1,
        subtotal_cent: 1,
        spec_delta_cent: 1,
        addon_delta_cent: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'large' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg', 'meat'] }
        ]
      }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total_amount_cent, 6000)
  assert.equal(calls.order.total_amount_cent, 6000)
  assert.equal(calls.orderItems.length, 1)
  assert.equal(calls.orderItems[0].base_price_cent, 2000)
  assert.equal(calls.orderItems[0].spec_delta_cent, 300)
  assert.equal(calls.orderItems[0].addon_delta_cent, 700)
  assert.equal(calls.orderItems[0].unit_price_cent, 3000)
  assert.equal(calls.orderItems[0].price_cent, 3000)
  assert.equal(calls.orderItems[0].subtotal_cent, 6000)
  assert.deepEqual(calls.orderItems[0].selected_specs, [
    {
      group_id: 'size',
      group_name: 'Size',
      option_id: 'large',
      option_name: 'Large',
      price_delta_cent: 300
    }
  ])
  assert.deepEqual(calls.orderItems[0].selected_addons, [
    {
      group_id: 'extra',
      group_name: 'Extra',
      options: [
        {
          option_id: 'egg',
          option_name: 'Egg',
          price_delta_cent: 200
        },
        {
          option_id: 'meat',
          option_name: 'Meat',
          price_delta_cent: 500
        }
      ]
    }
  ])
})

test('creates order when item dish_id uses database _id and writes stable dish snapshot', async () => {
  const { dependencies, calls } = createOptionDependencies({
    _id: 'db_dish_option_001',
    dish_id: 'dish_option',
    stock_count: 5
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'db_dish_option_001',
        quantity: 2,
        unit_price_cent: 1,
        subtotal_cent: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'large' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg'] }
        ]
      }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total_amount_cent, 5000)
  assert.equal(calls.orderItems.length, 1)
  assert.equal(calls.orderItems[0].dish_id, 'dish_option')
  assert.equal(calls.orderItems[0].unit_price_cent, 2500)
  assert.equal(calls.orderItems[0].subtotal_cent, 5000)
  assert.deepEqual(calls.orderItems[0].selected_specs, [
    {
      group_id: 'size',
      group_name: 'Size',
      option_id: 'large',
      option_name: 'Large',
      price_delta_cent: 300
    }
  ])
  assert.deepEqual(calls.orderItems[0].selected_addons, [
    {
      group_id: 'extra',
      group_name: 'Extra',
      options: [
        {
          option_id: 'egg',
          option_name: 'Egg',
          price_delta_cent: 200
        }
      ]
    }
  ])
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_option', stock_count: 3 }
  ])
})

test('keeps different specs or addons as different order items and deducts stock by dish total', async () => {
  const { dependencies, calls } = createOptionDependencies({
    stock_count: 10
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'large' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg'] }
        ]
      },
      {
        dish_id: 'dish_option',
        quantity: 2,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg'] }
        ]
      }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(calls.orderItems.length, 2)
  assert.deepEqual(
    calls.orderItems.map((item) => item.quantity),
    [1, 2]
  )
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_option', stock_count: 7 }
  ])
})

test('merges same dish specs and addons regardless of addon option order', async () => {
  const { dependencies, calls } = createOptionDependencies({
    stock_count: 10
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'large' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['meat', 'egg'] }
        ]
      },
      {
        dish_id: 'dish_option',
        quantity: 2,
        selected_specs: [
          { group_id: 'size', option_id: 'large' }
        ],
        selected_addons: [
          { group_id: 'extra', option_ids: ['egg', 'meat'] }
        ]
      }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(calls.orderItems.length, 1)
  assert.equal(calls.orderItems[0].quantity, 3)
  assert.equal(calls.orderItems[0].subtotal_cent, 9000)
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_option', stock_count: 7 }
  ])
})

test('validates stock by total dish quantity across different option combinations', async () => {
  const { dependencies } = createOptionDependencies({
    stock_count: 2
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      {
        dish_id: 'dish_option',
        quantity: 1,
        selected_specs: [
          { group_id: 'size', option_id: 'large' }
        ]
      },
      {
        dish_id: 'dish_option',
        quantity: 2,
        selected_specs: [
          { group_id: 'size', option_id: 'normal' }
        ]
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'STOCK_NOT_ENOUGH')
})

test('merges duplicate dish_id before stock validation and deduction', async () => {
  const { dependencies, calls } = createDependencies({
    findDishesByIds: async () => [
      {
        _id: 'dish_001',
        dish_id: 'dish_001',
        merchant_id: 'merchant_001',
        name: '重复餐品',
        price_cent: 1000,
        status: 'on_sale',
        stock_enabled: true,
        stock_count: 3,
        sold_out: false
      }
    ]
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 },
      { dish_id: 'dish_001', quantity: 2 }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(result.data.item_count, 3)
  assert.equal(result.data.total_amount_cent, 3000)
  assert.equal(calls.orderItems.length, 1)
  assert.equal(calls.orderItems[0].quantity, 3)
  assert.deepEqual(calls.stockUpdates, [
    { dish_id: 'dish_001', stock_count: 0 }
  ])
})

test('returns UNAUTHORIZED when cloud openid is unavailable', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('returns DATABASE_ERROR when order write fails', async () => {
  const { dependencies } = createDependencies({
    createOrder: async () => {
      throw new Error('write failed')
    }
  })
  const createOrder = createCreateOrderHandler(dependencies)

  const result = await createOrder({
    merchant_id: 'merchant_001',
    items: [
      { dish_id: 'dish_001', quantity: 1 }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'DATABASE_ERROR')
  assert.equal(result.data, null)
})
