const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  createGetAdminOverviewHandler
} = require('./admin-overview-service')

const FIXED_NOW = new Date('2026-06-25T10:30:00.000Z')
const YESTERDAY = new Date('2026-06-24T10:00:00.000Z')
const TOMORROW = new Date('2026-06-26T00:00:00.000Z')

function createDeps(overrides = {}) {
  const data = {
    merchants: [],
    staff: [],
    invites: [],
    dishes: [],
    categories: [],
    orders: [],
    ...overrides.data
  }
  const calls = {
    write: 0
  }

  return {
    deps: {
      getOpenid: () => overrides.openid === undefined ? 'admin_openid' : overrides.openid,
      getSuperAdminOpenids: () => overrides.superAdminOpenids === undefined ? 'admin_openid' : overrides.superAdminOpenids,
      now: () => overrides.now || FIXED_NOW,
      findMerchants: async () => data.merchants,
      findStaff: async () => data.staff,
      findInvites: async () => data.invites,
      findDishes: async () => data.dishes,
      findCategories: async () => data.categories,
      findOrders: async () => data.orders,
      updateAnything: async () => {
        calls.write += 1
      },
      logger: {
        error() {}
      }
    },
    calls
  }
}

async function getOverview(overrides = {}) {
  const { deps, calls } = createDeps(overrides)
  const handler = createGetAdminOverviewHandler(deps)
  const result = await handler({})
  return {
    result,
    calls
  }
}

test('super admin can get stable empty overview', async () => {
  const { result } = await getOverview()

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.deepEqual(result.data.merchants, {
    total: 0,
    active: 0,
    disabled: 0
  })
  assert.deepEqual(result.data.staff, {
    total: 0,
    active: 0,
    disabled: 0,
    owner: 0,
    staff: 0
  })
  assert.deepEqual(result.data.invites, {
    total: 0,
    unused: 0,
    used: 0,
    disabled: 0,
    expired: 0
  })
  assert.deepEqual(result.data.orders.recent, [])
  assert.deepEqual(result.data.warnings, [])
})

test('non super admin cannot get overview', async () => {
  const { result } = await getOverview({
    openid: 'normal_openid',
    superAdminOpenids: 'admin_openid'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(result.data, null)
})

test('missing openid returns unauthorized', async () => {
  const { result } = await getOverview({
    openid: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('counts merchants by active and disabled status', async () => {
  const { result } = await getOverview({
    data: {
      merchants: [
        { merchant_id: 'm1', status: 'active' },
        { merchant_id: 'm2', status: 'disabled' },
        { merchant_id: 'm3' }
      ]
    }
  })

  assert.equal(result.data.merchants.total, 3)
  assert.equal(result.data.merchants.active, 2)
  assert.equal(result.data.merchants.disabled, 1)
})

test('counts merchant staff role and status', async () => {
  const { result } = await getOverview({
    data: {
      staff: [
        { role: 'owner', status: 'active' },
        { role: 'staff', status: 'active' },
        { role: 'staff', status: 'disabled' },
        { role: 'owner', status: 'disabled' }
      ]
    }
  })

  assert.equal(result.data.staff.total, 4)
  assert.equal(result.data.staff.active, 2)
  assert.equal(result.data.staff.disabled, 2)
  assert.equal(result.data.staff.owner, 2)
  assert.equal(result.data.staff.staff, 2)
})

test('counts invite statuses and treats expired unused invites as expired without writing', async () => {
  const { result, calls } = await getOverview({
    data: {
      invites: [
        { code: 'A', status: 'unused', expires_at: TOMORROW },
        { code: 'B', status: 'used', expires_at: TOMORROW },
        { code: 'C', status: 'disabled', expires_at: TOMORROW },
        { code: 'D', status: 'expired', expires_at: TOMORROW },
        { code: 'E', status: 'unused', expires_at: YESTERDAY }
      ]
    }
  })

  assert.equal(result.data.invites.total, 5)
  assert.equal(result.data.invites.unused, 1)
  assert.equal(result.data.invites.used, 1)
  assert.equal(result.data.invites.disabled, 1)
  assert.equal(result.data.invites.expired, 2)
  assert.equal(calls.write, 0)
})

test('counts dishes and missing ingredients or tutorials compatibly', async () => {
  const { result } = await getOverview({
    data: {
      dishes: [
        { status: 'on_sale', ingredients: [{ name: '米饭', enabled: true }], tutorials: [{ url: 'x', enabled: true }] },
        { status: 'off_sale', ingredients: [{ name: '牛肉', enabled: false }], tutorials: [{ url: 'y', enabled: false }] },
        { status: 'on_sale' },
        { status: 'sold_out', ingredients: [], tutorials: [] }
      ]
    }
  })

  assert.equal(result.data.dishes.total, 4)
  assert.equal(result.data.dishes.on_sale, 2)
  assert.equal(result.data.dishes.off_sale, 1)
  assert.equal(result.data.dishes.without_ingredients, 3)
  assert.equal(result.data.dishes.without_tutorials, 3)
})

test('counts categories while old records without status are active', async () => {
  const { result } = await getOverview({
    data: {
      categories: [
        { status: 'active' },
        { status: 'disabled' },
        { enabled: true },
        { enabled: false },
        {}
      ]
    }
  })

  assert.equal(result.data.categories.total, 5)
  assert.equal(result.data.categories.active, 3)
  assert.equal(result.data.categories.disabled, 2)
})

test('counts today orders and cancelled aliases', async () => {
  const { result } = await getOverview({
    data: {
      orders: [
        { order_no: 'today-1', status: 'pending', created_at: new Date('2026-06-25T00:00:00.000Z') },
        { order_no: 'today-2', status: 'cancelled', created_at: new Date('2026-06-25T09:00:00.000Z') },
        { order_no: 'today-3', status: 'canceled', created_at: new Date('2026-06-25T09:30:00.000Z') },
        { order_no: 'today-4', status: 'finished', created_at: new Date('2026-06-25T10:00:00.000Z') },
        { order_no: 'old', status: 'finished', created_at: YESTERDAY }
      ]
    }
  })

  assert.equal(result.data.orders.today_total, 4)
  assert.equal(result.data.orders.today_not_cancelled, 2)
  assert.equal(result.data.orders.today_cancelled, 2)
  assert.equal(result.data.orders.today_finished, 1)
})

test('recent orders returns latest five safe fields only', async () => {
  const orders = Array.from({ length: 7 }, (_, index) => ({
    _id: `order_${index}`,
    order_no: `NO${index}`,
    status: 'pending',
    total_amount_cent: 1000 + index,
    item_count: index + 1,
    user_openid: `secret_${index}`,
    contact_phone: '13800000000',
    created_at: new Date(`2026-06-25T0${index}:00:00.000Z`)
  }))

  const { result } = await getOverview({
    data: {
      orders
    }
  })

  assert.equal(result.data.orders.recent.length, 5)
  assert.equal(result.data.orders.recent[0].order_no, 'NO6')
  assert.deepEqual(Object.keys(result.data.orders.recent[0]).sort(), [
    'created_at',
    'item_count',
    'order_id',
    'order_no',
    'status',
    'status_text',
    'total_amount_cent'
  ].sort())
  assert.equal(result.data.orders.recent[0].user_openid, undefined)
  assert.equal(result.data.orders.recent[0].contact_phone, undefined)
})

test('warning rules include actionable data health reminders', async () => {
  const { result } = await getOverview({
    data: {
      merchants: [{ merchant_id: 'm1', status: 'disabled' }],
      invites: [{ status: 'unused', expires_at: YESTERDAY }],
      dishes: [
        { name: '无食材', status: 'on_sale', ingredients: [], tutorials: [{ url: 'x', enabled: true }] },
        { name: '无做法', status: 'on_sale', ingredients: [{ name: '米饭', enabled: true }], tutorials: [] }
      ],
      orders: [{ order_no: 'today', status: 'pending', created_at: FIXED_NOW }]
    }
  })

  const types = result.data.warnings.map((warning) => warning.type).sort()
  assert.deepEqual(types, [
    'disabled_merchants',
    'expired_unused_invites',
    'prep_may_be_empty',
    'without_ingredients',
    'without_tutorials'
  ].sort())
})

test('overview does not write database data', async () => {
  const { result, calls } = await getOverview()

  assert.equal(result.success, true)
  assert.equal(calls.write, 0)
})
